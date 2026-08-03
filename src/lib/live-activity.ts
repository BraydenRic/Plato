import Constants, { ExecutionEnvironment } from "expo-constants";

import type { Workout } from "@/types";

// Live Activities are a native iOS 16.2+ feature compiled into dev/production
// builds — Expo Go doesn't have the module, so everything here no-ops there
// (same pattern as google-signin.ts). On unsupported iOS versions the plugin's
// silentOnUnsupportedOS option makes the calls no-op natively too.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Lazy require: a top-level `import` would look up the native module the moment
// this file is evaluated and crash Expo Go.
function nativeModule(): typeof import("expo-live-activity") | null {
  if (isExpoGo) return null;
  try {
    return require("expo-live-activity");
  } catch {
    return null;
  }
}

// The chrome mirrors Palette (constants/theme) but stays hardcoded hex — the
// native widget only parses plain hex strings, not rgba(). The progress tint is
// the one themed colour, so it arrives per-call instead (see startWorkoutActivity).
const ACTIVITY_STYLE = {
  backgroundColor: "#09090b",
  titleColor: "#fafafa",
  subtitleColor: "#a1a1aa",
  progressViewLabelColor: "#fafafa",
  timerType: "digital" as const,
  imagePosition: "right" as const,
  imageSize: { width: 40, height: 40 },
  contentFit: "contain" as const,
};

function workoutState(workout: Workout, doneSets: number, totalSets: number) {
  return {
    title: workout.name,
    subtitle: `${doneSets}/${totalSets} sets`,
    progressBar: {
      // Counts up natively (like the phone-call pill) even while the app is
      // backgrounded or the phone is locked.
      elapsedTimer: { startDate: (workout.startedAt ?? workout.createdAt).getTime() },
    },
    imageName: "plato-logo",
    dynamicIslandImageName: "plato-logo",
  };
}

/**
 * Starts the in-workout Live Activity. Returns its id, or undefined where
 * unsupported.
 *
 * `tint` is the caller's current theme accent. iOS fixes an activity's style at
 * start, so switching theme mid-workout leaves the pill on the old tint until
 * the next workout — restarting it just to recolour would make the Dynamic
 * Island animate out and back in, which is worse than the stale colour.
 */
export function startWorkoutActivity(
  workout: Workout,
  doneSets: number,
  totalSets: number,
  tint: string
): string | undefined {
  const mod = nativeModule();
  if (!mod) return undefined;
  try {
    const id = mod.startActivity(workoutState(workout, doneSets, totalSets), {
      ...ACTIVITY_STYLE,
      progressViewTint: tint,
      // Tapping the pill / lock-screen card drops the user straight back
      // into the live workout.
      deepLinkUrl: `/workout/${workout.id}`,
    });
    return typeof id === "string" ? id : undefined;
  } catch (e) {
    console.warn("Couldn't start Live Activity", e);
    return undefined;
  }
}

/** Refreshes the activity's set progress (and name/timer if they changed). */
export function updateWorkoutActivity(
  activityId: string,
  workout: Workout,
  doneSets: number,
  totalSets: number
): boolean {
  const mod = nativeModule();
  if (!mod) return false;
  try {
    mod.updateActivity(activityId, workoutState(workout, doneSets, totalSets));
    return true;
  } catch {
    // The OS ended it (8-hour limit, user dismissed it, app reinstall…).
    return false;
  }
}

/** Ends the activity — the final state is what iOS shows while it dismisses. */
export function stopWorkoutActivity(activityId: string, title: string) {
  const mod = nativeModule();
  if (!mod) return;
  try {
    mod.stopActivity(activityId, {
      title,
      subtitle: "Workout complete",
      progressBar: { progress: 1 },
      imageName: "plato-logo",
      dynamicIslandImageName: "plato-logo",
    });
  } catch {
    // Already gone — nothing to clean up.
  }
}
