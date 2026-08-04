import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { getBodyweightLog, setBodyweightLog } from "@/lib/data";
import { withBodyweightEntry } from "@/lib/workout-utils";
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

  const record = useCallback(
    async (lbs: number, when: Date = new Date()) => {
      if (!dataUserId || !Number.isFinite(lbs) || lbs <= 0) return;
      // Optimistic: the number is already on screen before the write lands, and
      // a failure leaves the log as the server has it on the next read.
      const next = withBodyweightEntry(log, { date: when, lbs });
      setLog(next);
      await setBodyweightLog(dataUserId, next);
    },
    [dataUserId, log]
  );

  return { log, loading, record, latest: log.length > 0 ? log[log.length - 1] : null };
}
