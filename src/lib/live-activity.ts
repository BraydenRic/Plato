import Constants, { ExecutionEnvironment } from "expo-constants";

// Type-only, so it is erased at build time and never loads the native module.
import type { LiveActivityState } from "expo-live-activity";

import type { Theme } from "@/constants/theme";
import type { Workout } from "@/types";

/**
 * Only the two fields the widget actually reads. Structural rather than `Theme`
 * so a mode-resolved theme satisfies it too — the widget's colours are frozen
 * when the activity starts and never follow the app's light/dark mode.
 */
type ActivityTheme = Pick<Theme, "id" | "activityTint">;

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

// The chrome mirrors PALETTES.dark (constants/theme) but stays hardcoded hex —
// dark in both app modes, because this renders on the lock screen and its
// colours are frozen when the activity starts. The
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

/**
 * The widget looks images up by name in its own compiled asset catalog, one
 * imageset per file in assets/liveActivity — so a themed logo is just a matter
 * of naming the right one. Unlike the progress tint, which is style and frozen
 * when the activity starts, the image is part of the state and travels with
 * every update.
 */
export function activityImage(theme: ActivityTheme): string {
  return `plato-logo-${theme.id}`;
}

function workoutState(
  workout: Workout,
  doneSets: number,
  totalSets: number,
  theme: ActivityTheme,
  restEndsAt: number | null
) {
  return {
    title: workout.name,
    // Both bars look alike, so the subtitle is what says which one is on show.
    // It stays put for the whole rest: swapping it to something like "Ready" at
    // the deadline would need a push at that exact moment, and on a locked
    // phone nothing of ours is running to send one. The countdown holding at
    // 0:00 says it on its own, natively, whether or not the app is awake.
    subtitle: restEndsAt ? `Resting · ${doneSets}/${totalSets} sets` : `${doneSets}/${totalSets} sets`,
    // Both timers at once. The published types make these mutually exclusive,
    // but the native side reads them from separate fields of the same record —
    // `progressBar?.elapsedTimer?.startDate` and `progressBar?.date` — so
    // sending both populates both. The widget's own view is what used to pick
    // one, and plugins/with-live-activity-rest-timer opens that up.
    //
    // The countdown builds `now ... max(now, deadline)` natively, so it holds
    // at 0:00 once the deadline passes rather than running negative or waiting
    // on the app to notice — the only behaviour that survives a locked phone.
    progressBar: {
      // Counts up natively (like the phone-call pill) even while the app is
      // backgrounded or the phone is locked.
      elapsedTimer: { startDate: (workout.startedAt ?? workout.createdAt).getTime() },
      ...(restEndsAt != null ? { date: restEndsAt } : {}),
    } as unknown as LiveActivityState["progressBar"],
    imageName: activityImage(theme),
    dynamicIslandImageName: activityImage(theme),
  };
}

/**
 * Starts the in-workout Live Activity. Returns its id, or undefined where
 * unsupported.
 *
 * iOS fixes an activity's style at start, so switching theme mid-workout leaves
 * the progress bar on the old tint until the next workout — restarting it just
 * to recolour would make the Dynamic Island animate out and back in, which is
 * worse than the stale colour. The logo is state rather than style, so that one
 * does follow a mid-workout change.
 */
export function startWorkoutActivity(
  workout: Workout,
  doneSets: number,
  totalSets: number,
  theme: ActivityTheme,
  restEndsAt: number | null
): string | undefined {
  const mod = nativeModule();
  if (!mod) return undefined;
  try {
    const id = mod.startActivity(workoutState(workout, doneSets, totalSets, theme, restEndsAt), {
      ...ACTIVITY_STYLE,
      progressViewTint: theme.activityTint,
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
  totalSets: number,
  theme: ActivityTheme,
  restEndsAt: number | null
): boolean {
  const mod = nativeModule();
  if (!mod) return false;
  try {
    mod.updateActivity(activityId, workoutState(workout, doneSets, totalSets, theme, restEndsAt));
    return true;
  } catch {
    // The OS ended it (8-hour limit, user dismissed it, app reinstall…).
    return false;
  }
}

/** Ends the activity — the final state is what iOS shows while it dismisses. */
export function stopWorkoutActivity(activityId: string, title: string, theme: ActivityTheme) {
  const mod = nativeModule();
  if (!mod) return;
  try {
    mod.stopActivity(activityId, {
      title,
      subtitle: "Workout complete",
      progressBar: { progress: 1 },
      imageName: activityImage(theme),
      dynamicIslandImageName: activityImage(theme),
    });
  } catch {
    // Already gone — nothing to clean up.
  }
}
