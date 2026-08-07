import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";

import { useAuth } from "@/context/AuthContext";
import { useBodyweight } from "@/hooks/use-bodyweight";
import { useWorkouts } from "@/hooks/use-workouts";
import { computeStats, updateWorkout, upsertUserStats } from "@/lib/data";
import { staleBodyweightVolumes } from "@/lib/repair-bodyweight-volumes";

/** Per account, and versioned so a future repair can be told apart from this one. */
const DONE_KEY = "bodyweight_volume_repair_v1";

/**
 * Invisible component (mounted once in the root layout) that corrects volumes
 * frozen against the wrong day's weigh-in. See repair-bodyweight-volumes for
 * what went wrong and why the fix runs once rather than continuously.
 *
 * Silent by design. There is nothing for the user to decide here — the numbers
 * were wrong and now they aren't — and a workout is exactly the wrong moment to
 * be asked about one.
 */
export function BodyweightVolumeRepair() {
  const { dataUserId } = useAuth();
  const { completed, loading: workoutsLoading } = useWorkouts();
  const { log, loading: logLoading } = useBodyweight();
  /** The account this has already run for, so a snapshot can't restart it. */
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!dataUserId || ranFor.current === dataUserId) return;
    if (workoutsLoading || logLoading) return;
    // Not just an optimisation: an empty log is also what a failed read looks
    // like, and there is no marker to set yet, so leaving early means the next
    // launch tries again once the log is really there.
    if (log.length === 0) return;

    ranFor.current = dataUserId;
    const key = `${DONE_KEY}:${dataUserId}`;

    (async () => {
      if (await AsyncStorage.getItem(key)) return;

      const corrections = staleBodyweightVolumes(completed, log);
      if (corrections.length > 0) {
        // Sequential rather than all at once — this is background work behind a
        // screen the user is already using, and it has nothing to race.
        for (const correction of corrections) {
          await updateWorkout(correction.id, { totalVolume: correction.totalVolume });
        }

        // The Stats tab derives from the workouts themselves, so it is already
        // right by here. This is the stored lifetime doc, which only plato-web
        // reads — recomputed from the corrected numbers rather than re-fetched,
        // since we are holding them.
        const corrected = new Map(corrections.map((c) => [c.id, c.totalVolume]));
        const repaired = completed.map((w) =>
          corrected.has(w.id) ? { ...w, totalVolume: corrected.get(w.id)! } : w
        );
        await upsertUserStats({ userId: dataUserId, ...computeStats(repaired) });
      }

      // Last, so a failure anywhere above leaves it unset and the next launch
      // picks the work back up.
      await AsyncStorage.setItem(key, new Date().toISOString());
    })().catch((e) => {
      console.warn("Couldn't repair bodyweight volumes", e);
    });
  }, [dataUserId, completed, log, workoutsLoading, logLoading]);

  return null;
}
