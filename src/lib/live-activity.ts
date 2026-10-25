import Constants, { ExecutionEnvironment } from "expo-constants";

// Type-only, so it is erased at build time and never loads the native module.
import type { LiveActivityState } from "expo-live-activity";

import type { Theme } from "@/constants/theme";
import { movingSeconds } from "@/lib/cardio-session";
import { formatClock } from "@/lib/workout-utils";
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
  // The Apple Watch's Smart Stack (see watchImage).
  smallImageSize: { width: 24, height: 24 },
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

/**
 * The same logo at 48px, for the Apple Watch's Smart Stack.
 *
 * The watch showed a blank square where the logo goes. The main logos are
 * 512px, added as single-scale images, so the system takes each for a 512pt
 * picture, and Apple requires a Live Activity's image to be no bigger than
 * where it's drawn: the phone copes, the watch's slot (about 24pt here) draws
 * nothing. The watch layout uses this name in preference to the main one.
 */
export function watchImage(theme: ActivityTheme): string {
  return `${activityImage(theme)}-small`;
}

/**
 * Longest title sent, in characters. ActivityKit caps an activity's attributes
 * and state at about 4 KB together, and the name is the one part of that a
 * user controls: a pasted essay of a name made the start fail, and worse, made
 * a mid-workout update vanish while JS was told it had worked — freezing the
 * set count and the rest countdown until the name was shortened. The widget
 * shows one line of it anyway.
 */
const MAX_TITLE_LENGTH = 100;

export function activityTitle(name: string): string {
  // By code point, so a cut can't split an emoji's surrogate pair into
  // something the widget can't draw.
  const chars = Array.from(name);
  if (chars.length <= MAX_TITLE_LENGTH) return name;
  return `${chars.slice(0, MAX_TITLE_LENGTH - 1).join("").trimEnd()}…`;
}

/**
 * A cardio session's slice of the state: its moving time, and no set count.
 *
 * It is stored as one exercise with one set that stays incomplete until End,
 * so the lifting state read "0/1 sets" for the whole of every run, and its
 * clock counted from the start straight through every pause — five minutes
 * at a light and the lock screen ran five minutes ahead of the session screen.
 */
function cardioState(workout: Workout) {
  const cardio = workout.cardio!;
  const startedAtMs = (workout.startedAt ?? workout.createdAt).getTime();
  if (cardio.pausedAtMs != null) {
    // A native timer can't be stopped, only left out — and nothing of ours
    // runs on a locked phone to tick a frozen one. Paused, the time stands
    // still anyway, so it goes in the subtitle as plain text.
    return { subtitle: `Paused · ${formatClock(movingSeconds(workout, cardio.pausedAtMs))}` };
  }
  return {
    // No subtitle while moving: the name already says what it is, and the
    // ticking clock says it's going.
    progressBar: {
      // Started later by every pause that's over, so it counts moving time —
      // the same number the session screen and the resume bar show.
      elapsedTimer: { startDate: startedAtMs + (cardio.pausedSeconds ?? 0) * 1000 },
    } as unknown as LiveActivityState["progressBar"],
  };
}

function workoutState(
  workout: Workout,
  doneSets: number,
  totalSets: number,
  theme: ActivityTheme,
  restEndsAt: number | null
) {
  const images = {
    imageName: activityImage(theme),
    dynamicIslandImageName: activityImage(theme),
    smallImageName: watchImage(theme),
  };
  if (workout.cardio) return { title: activityTitle(workout.name), ...cardioState(workout), ...images };

  return {
    title: activityTitle(workout.name),
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
    ...images,
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
      title: activityTitle(title),
      subtitle: "Workout complete",
      progressBar: { progress: 1 },
      imageName: activityImage(theme),
      dynamicIslandImageName: activityImage(theme),
      smallImageName: watchImage(theme),
    });
  } catch {
    // Already gone — nothing to clean up.
  }
}
