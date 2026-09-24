import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useWorkouts } from "@/hooks/use-workouts";
import { applyVolumeCorrections } from "@/lib/apply-volume-corrections";
import { readCachedBodyweight, writeCachedBodyweight } from "@/lib/bodyweight-cache";
import { getBodyweightLog, setBodyweightLog } from "@/lib/data";
import { isGuestUserId } from "@/lib/local-store";
import { staleVolumesOnDay } from "@/lib/repair-bodyweight-volumes";
import { withBodyweightEntry, withoutBodyweightEntry } from "@/lib/workout-utils";
import type { BodyweightEntry } from "@/types";

/**
 * The last log read, per user, for the life of the process.
 *
 * The fetch is per-mount, which was invisible while one screen used this and
 * obvious the moment two did: opening Bodyweight from Profile started from an
 * empty log and showed "Nothing weighed in this range" until the read came
 * back. Seeding from here paints the real chart on the first frame and lets the
 * read confirm it silently.
 *
 * Keyed by user so a different account never inherits one, and process-scoped
 * so it cannot go stale across launches.
 */
const lastRead = new Map<string, BodyweightEntry[]>();

/**
 * How long to wait before each retry of a failed read. The last one repeats
 * for as long as the screen is open — offline, a read fails fast, so this costs
 * next to nothing while the signal is gone and picks the log up soon after it
 * comes back.
 */
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000];

/**
 * Counts weigh-ins recorded or removed, from any screen. A read compares it
 * before and after, so one that set off before an edit can't land after it and
 * put the old log back — likelier now that reads retry, since a weigh-in typed
 * with no signal is exactly when one is still pending. Module-wide rather than
 * per hook because the edit and the stale read are usually on different
 * screens: Profile records, the workout screen's retry lands.
 */
let editSeq = 0;

/**
 * Accounts whose log has actually been seen on this phone this launch, from
 * the cloud or from the device copy.
 *
 * A weigh-in writes the whole log back. Written over a log that was never
 * seen, like a new phone opened with no signal, it would replace the real
 * history with a single entry. So until an account is in here, weigh-ins are
 * shown but held in `heldEdits`. The first real read adds them to what it
 * found, then writes.
 */
const knownLogs = new Set<string>();
const heldEdits = new Map<string, ((log: BodyweightEntry[]) => BodyweightEntry[])[]>();

/**
 * The weigh-in log, oldest first.
 *
 * Fetched rather than subscribed: unlike workouts, this changes only when the
 * user types a number into this device, so a live listener would cost a
 * permanent connection to watch for something only this screen causes.
 *
 * Fetching once and giving up was the bug behind "BW not set" over a log with
 * a weigh-in in it. Firestore keeps nothing on disk here, so opening the app
 * with no signal — routine in a gym — failed the read, and nothing ever tried
 * again: the workout screen went without a weight for as long as it was open,
 * and finishing froze every bodyweight set at zero. So now the last good copy
 * is kept on the device and painted while the cloud read is out, and a failed
 * read is retried — on a timer, and whenever the app comes back to the front.
 */
export function useBodyweight() {
  const { dataUserId } = useAuth();
  const { completed } = useWorkouts();
  const [log, setLog] = useState<BodyweightEntry[]>(
    () => (dataUserId ? lastRead.get(dataUserId) : undefined) ?? []
  );
  const [loading, setLoading] = useState(() => !(dataUserId && lastRead.has(dataUserId)));

  useEffect(() => {
    if (!dataUserId) {
      setLog([]);
      setLoading(false);
      return;
    }
    const userId = dataUserId;
    let cancelled = false;
    /** A cloud read landed. Nothing older — the device copy — may replace it. */
    let fresh = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    // A guest's log already lives on the device and its read can't fail for
    // want of a signal, so a second copy of it would be pure duplication.
    const cacheable = !isGuestUserId(userId);

    // Only an unseeded screen waits. One that already has the log refreshes
    // underneath what is on screen rather than blanking it first.
    const seed = lastRead.get(userId);
    if (seed) setLog(seed);
    setLoading(!seed);

    // Cold start: nothing read yet this launch, so paint the copy the last
    // launch left behind rather than an empty log while the cloud read is out.
    if (!seed && cacheable) {
      readCachedBodyweight(userId).then((cached) => {
        if (cancelled || fresh || !cached || lastRead.has(userId)) return;
        knownLogs.add(userId);
        lastRead.set(userId, cached);
        setLog(cached);
        setLoading(false);
      });
    }

    function read() {
      clearTimeout(retryTimer);
      const seqAtStart = editSeq;
      getBodyweightLog(userId)
        .then((fetched) => {
          fresh = true;
          knownLogs.add(userId);
          let entries = fetched;
          const held = heldEdits.get(userId);
          if (held) {
            // The first real read since weigh-ins were held back. Add them to
            // it and save the result. That's the write they were waiting for.
            heldEdits.delete(userId);
            entries = held.reduce((log, edit) => edit(log), fetched);
            setBodyweightLog(userId, entries).catch((e) => console.warn("Couldn't save held weigh-ins", e));
            lastRead.set(userId, entries);
            if (cancelled) return;
            if (cacheable) writeCachedBodyweight(userId, entries);
            setLog(entries);
            setLoading(false);
            return;
          }
          // An edit made while this was in flight is newer than what it read.
          if (editSeq !== seqAtStart) return;
          lastRead.set(userId, entries);
          // Not after the screen has let go. A read that lands after sign-out
          // would otherwise put the weigh-ins back on the phone just after
          // signing out deleted them.
          if (cancelled) return;
          if (cacheable) writeCachedBodyweight(userId, entries);
          setLog(entries);
          setLoading(false);
        })
        .catch((e) => {
          // A failed read shows an empty card, which invites logging a weigh-in
          // that would then overwrite the log we couldn't see. Leave what's
          // there — the device copy, if there is one — and try again.
          //
          // Logged rather than swallowed: the first time this ran against a
          // real account it failed with permission-denied, because `bodyweight`
          // is a collection the security rules had never heard of. A silent
          // empty card gave no clue, and the write path blamed the network.
          console.warn("Couldn't read the bodyweight log", e);
          if (cancelled) return;
          setLoading(false);
          const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
          attempt += 1;
          retryTimer = setTimeout(read, delay);
        });
    }
    read();

    // Coming back from the lock screen is the likeliest moment the signal is
    // back, and it is often long before the next timer would fire.
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active" && !fresh) read();
    });

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      foreground.remove();
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

  /**
   * Shows an edit to the log at once, then saves it, or holds it back while
   * the log has never been seen (see knownLogs).
   */
  const applyEdit = useCallback(
    async (userId: string, edit: (log: BodyweightEntry[]) => BodyweightEntry[], day: Date) => {
      const next = edit(log);
      editSeq += 1;
      setLog(next);
      lastRead.set(userId, next);
      if (!isGuestUserId(userId) && !knownLogs.has(userId)) {
        heldEdits.set(userId, [...(heldEdits.get(userId) ?? []), edit]);
        return;
      }
      if (!isGuestUserId(userId)) writeCachedBodyweight(userId, next);
      await setBodyweightLog(userId, next);
      reprice(day, next);
    },
    [log, reprice]
  );

  const record = useCallback(
    async (lbs: number, when: Date = new Date()) => {
      if (!dataUserId || !Number.isFinite(lbs) || lbs <= 0) return;
      // Optimistic: the number is already on screen before the write lands, and
      // a failure leaves the log as the server has it on the next read.
      await applyEdit(dataUserId, (base) => withBodyweightEntry(base, { date: when, lbs }), when);
    },
    [dataUserId, applyEdit]
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
      if (withoutBodyweightEntry(log, day).length === log.length) return;
      await applyEdit(dataUserId, (base) => withoutBodyweightEntry(base, day), day);
    },
    [dataUserId, log, applyEdit]
  );

  return { log, loading, record, remove, latest: log.length > 0 ? log[log.length - 1] : null };
}
