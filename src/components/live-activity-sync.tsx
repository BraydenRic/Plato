import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { startWorkoutActivity, stopWorkoutActivity, updateWorkoutActivity } from "@/lib/live-activity";
import { useCurrentWorkoutId } from "@/lib/current-workout";
import { completedSetCount, leadWorkout, totalSetCount } from "@/lib/workout-utils";
import { useWorkouts } from "@/hooks/use-workouts";
import { useTheme } from "@/context/ThemeContext";
import { useRestTimer } from "@/context/RestTimerContext";
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
  const theme = useTheme();
  const { rest } = useRestTimer();

  const tracked = useRef<Tracked | null>(null);
  const hydrated = useRef<Promise<void> | null>(null);
  // Serializes syncs so a fast start→finish can't interleave native calls.
  const chain = useRef(Promise.resolve());

  // iOS only lets an app start a Live Activity while it's on screen. A workout
  // started from the Apple Watch is created with this app in the background,
  // so that start is refused — and nothing else would try again until the
  // workout next changed with the app open. Counting returns to the
  // foreground re-runs the sync below, which starts it the moment the app is
  // opened. (Starting one from the background at all needs a push from a
  // server — push-to-start — which Plato doesn't have.)
  const [foregrounds, setForegrounds] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setForegrounds((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);

  // With several sessions open (cap is 5), the pill follows the one you last
  // opened — the same one the resume bar above the tabs leads with.
  const current: Workout | undefined = leadWorkout(active, useCurrentWorkoutId());
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
      // Only a rest belonging to this workout. Rest state outlives the screen,
      // so an old session's countdown must not follow the pill to a new one.
      const restEndsAt = workout && rest?.workoutId === workout.id ? rest.endsAt : null;

      if (!workout) {
        if (t) {
          stopWorkoutActivity(t.activityId, "Workout finished", theme);
          tracked.current = null;
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
        return;
      }

      if (t && t.workoutId === workout.id) {
        if (updateWorkoutActivity(t.activityId, workout, doneSets, totalSets, theme, restEndsAt))
          return;
        // The activity died underneath us — fall through and start a new one.
        tracked.current = null;
      } else if (t) {
        // A different workout took over as the live one.
        stopWorkoutActivity(t.activityId, "Workout finished", theme);
        tracked.current = null;
      }

      const activityId = startWorkoutActivity(workout, doneSets, totalSets, theme, restEndsAt);
      if (activityId) {
        tracked.current = { activityId, workoutId: workout.id };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tracked.current));
      }
    });
    // theme is deliberately not a dependency. The progress tint only applies to
    // a newly started activity, so re-running this on a theme change would tear
    // down and recreate a perfectly good pill mid-workout; the logo picks up the
    // new theme on the next update the workout sends anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, current, doneSets, totalSets, rest, foregrounds]);

  return null;
}
