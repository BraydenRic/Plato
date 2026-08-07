import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { useWorkouts } from "@/hooks/use-workouts";
import { applyVolumeCorrections } from "@/lib/apply-volume-corrections";
import { getBodyweightLog, setBodyweightLog } from "@/lib/data";
import { staleVolumesOnDay } from "@/lib/repair-bodyweight-volumes";
import { withBodyweightEntry, withoutBodyweightEntry } from "@/lib/workout-utils";
import type { BodyweightEntry } from "@/types";

/**
 * The weigh-in log, oldest first.
 *
 * Fetched rather than subscribed: unlike workouts, this changes only when the
 * user types a number into this device, so a live listener would cost a
 * permanent connection to watch for something only this screen causes.
 */
export function useBodyweight() {
  const { dataUserId } = useAuth();
  const { completed } = useWorkouts();
  const [log, setLog] = useState<BodyweightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!dataUserId) {
      setLog([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getBodyweightLog(dataUserId)
      .then((entries) => {
        if (!cancelled) setLog(entries);
      })
      .catch((e) => {
        // A failed read shows an empty card, which invites logging a weigh-in
        // that would then overwrite the log we couldn't see. Leave what's there.
        //
        // Logged rather than swallowed: the first time this ran against a real
        // account it failed with permission-denied, because `bodyweight` is a
        // collection the security rules had never heard of. A silent empty card
        // gave no clue, and the write path blamed the network.
        console.warn("Couldn't read the bodyweight log", e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataUserId]);

  /**
   * Re-prices the workouts filed under a day whose weigh-in just changed.
   *
   * Lives in the hook rather than at the call sites because it had already
   * drifted: the Bodyweight screen re-priced and Profile's prompt didn't, so
   * the same weigh-in left a different volume behind depending on which screen
   * you typed it into. Anything that can change the log goes through here now.
   *
   * Fire-and-forget. The log on screen is already right; the volumes are on
   * other screens, and a failure leaves them stale rather than wrong-and-hidden.
   */
  const reprice = useCallback(
    (day: Date, nextLog: BodyweightEntry[]) => {
      if (!dataUserId) return;
      applyVolumeCorrections(
        staleVolumesOnDay(completed, nextLog, day),
        completed,
        dataUserId
      ).catch((e) => console.warn("Couldn't re-price that day's workouts", e));
    },
    [completed, dataUserId]
  );

  const record = useCallback(
    async (lbs: number, when: Date = new Date()) => {
      if (!dataUserId || !Number.isFinite(lbs) || lbs <= 0) return;
      // Optimistic: the number is already on screen before the write lands, and
      // a failure leaves the log as the server has it on the next read.
      const next = withBodyweightEntry(log, { date: when, lbs });
      setLog(next);
      await setBodyweightLog(dataUserId, next);
      reprice(when, next);
    },
    [dataUserId, log, reprice]
  );

  /**
   * Drops a day's weigh-in.
   *
   * Optimistic like `record`, and a no-op when there was nothing on that day —
   * so a double tap can't write the whole log back for no reason.
   */
  const remove = useCallback(
    async (day: Date) => {
      if (!dataUserId) return;
      const next = withoutBodyweightEntry(log, day);
      if (next.length === log.length) return;
      setLog(next);
      await setBodyweightLog(dataUserId, next);
      reprice(day, next);
    },
    [dataUserId, log, reprice]
  );

  return { log, loading, record, remove, latest: log.length > 0 ? log[log.length - 1] : null };
}
