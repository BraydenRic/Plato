import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";

import { startWorkoutActivity, stopWorkoutActivity, updateWorkoutActivity } from "@/lib/live-activity";
import { completedSetCount, totalSetCount } from "@/lib/workout-utils";
import { useWorkouts } from "@/hooks/use-workouts";
import type { Workout } from "@/types";

// Which Live Activity belongs to which workout, persisted so a relaunch can
// still update or dismiss an activity started before the app was killed.
const STORAGE_KEY = "workout_live_activity";
type Tracked = { activityId: string; workoutId: string };

/**
 * Invisible component (mounted once in the root layout) that mirrors the
 * current in-progress workout to an iOS Live Activity: the Dynamic Island
 * pill and lock-screen card show the workout name, set progress, and a
 * natively ticking elapsed timer. Starts when a workout starts, updates as
 * sets are logged, and dismisses when the workout is finished or deleted.
 */
export function LiveActivitySync() {
  const { active, loading } = useWorkouts();

  const tracked = useRef<Tracked | null>(null);
  const hydrated = useRef<Promise<void> | null>(null);
  // Serializes syncs so a fast start→finish can't interleave native calls.
  const chain = useRef(Promise.resolve());

  // With several sessions open (cap is 5), the pill follows the newest one.
  const current: Workout | undefined = active.reduce<Workout | undefined>(
    (latest, w) =>
      !latest || (w.startedAt?.getTime() ?? 0) > (latest.startedAt?.getTime() ?? 0) ? w : latest,
    undefined
  );
  const doneSets = current ? completedSetCount(current) : 0;
  const totalSets = current ? totalSetCount(current) : 0;

  useEffect(() => {
    if (loading) return; // don't dismiss anything before the first snapshot

    const workout = current;
    chain.current = chain.current.then(async () => {
      // One-time restore of the activity started by a previous app launch.
      if (!hydrated.current) {
        hydrated.current = AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
          if (raw && !tracked.current) tracked.current = JSON.parse(raw) as Tracked;
        });
      }
      await hydrated.current;

      const t = tracked.current;

      if (!workout) {
        if (t) {
          stopWorkoutActivity(t.activityId, "Workout finished");
          tracked.current = null;
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
        return;
      }

      if (t && t.workoutId === workout.id) {
        if (updateWorkoutActivity(t.activityId, workout, doneSets, totalSets)) return;
        // The activity died underneath us — fall through and start a new one.
        tracked.current = null;
      } else if (t) {
        // A different workout took over as the live one.
        stopWorkoutActivity(t.activityId, "Workout finished");
        tracked.current = null;
      }

      const activityId = startWorkoutActivity(workout, doneSets, totalSets);
      if (activityId) {
        tracked.current = { activityId, workoutId: workout.id };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tracked.current));
      }
    });
  }, [loading, current, doneSets, totalSets]);

  return null;
}
