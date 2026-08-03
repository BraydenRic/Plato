import type { WeeklyPlan, Workout, WorkoutSet } from "@/types";

export const EMPTY_WEEKLY_PLAN: WeeklyPlan = [null, null, null, null, null, null, null];

// Some stored docs carry null/undefined holes in their exercises/sets arrays
// (crashed build 9 the moment a set row rendered). Rendering, stats, and the
// keypad all assume every entry exists, so drop the holes at the read boundary
// and log them — writes should never produce these, so a warning here means a
// bug (or legacy data) worth chasing.
//
// Lives here rather than next to the Firestore reader because the on-device
// guest store needs it too, and pulling it from there would drag the whole
// Firebase SDK into a mode that is meant to never touch the network.
export function sanitizeExercises(raw: unknown, docName?: unknown): Workout["exercises"] {
  const entries = (Array.isArray(raw) ? raw : []) as Workout["exercises"];
  const exercises = entries.filter((ex) => ex && ex.exercise);
  if (exercises.length !== entries.length) {
    console.warn(
      `Dropped ${entries.length - exercises.length} corrupt exercise entries in "${String(docName ?? "?")}"`
    );
  }
  return exercises.map((ex) => {
    const rawSets = Array.isArray(ex.sets) ? ex.sets : [];
    const sets = rawSets.filter(Boolean);
    if (sets.length !== rawSets.length) {
      console.warn(
        `Dropped ${rawSets.length - sets.length} corrupt set entries in "${String(docName ?? "?")}" / ${ex.exercise?.name ?? ex.exerciseId}:`,
        JSON.stringify(rawSets)
      );
    }
    return { ...ex, sets };
  });
}

// Templates are reusable and never auto-expire, so cap them per account to keep
// the collection from growing without bound. 20 comfortably covers real routines
// (most people keep 3–10) while stopping runaway creation.
export const MAX_TEMPLATES = 20;

// Cap simultaneously in-progress (started, unfinished) workouts. Nobody trains
// more than a couple at once; the limit stops runaway "start and abandon" from
// piling up live sessions. Finishing or deleting one frees a slot.
export const MAX_ACTIVE_WORKOUTS = 5;

// All of a user's custom exercises live in a single document, so cap them to
// keep it well under Firestore's 1 MB limit. 200 is far more than anyone builds
// by hand (the app ships ~177 defaults) while staying tiny on disk.
export const MAX_CUSTOM_EXERCISES = 200;

const KG_TO_LBS = 2.20462;

export function setVolumeLbs(set: WorkoutSet): number {
  if (!set.isCompleted || !set.reps) return 0;
  if (set.weightUnit === "bodyweight" || !set.weight) return 0;
  const lbs = set.weightUnit === "kg" ? set.weight * KG_TO_LBS : set.weight;
  return set.reps * lbs;
}

export function workoutVolumeLbs(workout: Workout): number {
  return workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + setVolumeLbs(set), 0),
    0
  );
}

export function completedSetCount(workout: Workout): number {
  return workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length,
    0
  );
}

export function totalSetCount(workout: Workout): number {
  return workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
}

export function formatVolume(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M`;
  if (lbs >= 10_000) return `${Math.round(lbs / 1000)}k`;
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k`;
  return `${Math.round(lbs)}`;
}

// Sets remember the unit they were logged in; convert for display so old
// workouts follow the current preference. Rounded to 1 decimal for inputs.
export function convertWeight(value: number, from: "lbs" | "kg", to: "lbs" | "kg"): number {
  if (from === to) return value;
  const converted = from === "lbs" ? value / KG_TO_LBS : value * KG_TO_LBS;
  return Math.round(converted * 10) / 10;
}

// Volumes are stored in lbs; convert only at display time.
export function displayVolume(lbs: number, unit: "lbs" | "kg"): string {
  if (unit === "kg") return `${formatVolume(lbs / KG_TO_LBS)} kg`;
  return `${formatVolume(lbs)} lbs`;
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Seconds a set stopwatch should show, and the exact value it commits when
 * stopped — one function so the two can never disagree.
 *
 * Floored rather than rounded: the readout ticks on whole seconds, and rounding
 * up meant stopping at 0:42.6 logged 0:43, so the number jumped as you stopped it.
 *
 * `bankedSeconds` is the duration the set already held, which `startedAt` is
 * backdated by — elapsed can never legitimately fall below it, so clamping
 * absorbs a stale clock reading rather than briefly showing less than was
 * already logged.
 */
export function liveSetSeconds(nowMs: number, startedAt: number, bankedSeconds = 0): number {
  return Math.max(bankedSeconds, 0, Math.floor((nowMs - startedAt) / 1000));
}

export function relativeDay(date: Date): string {
  const diff = Math.round((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  if (Math.abs(diff) < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Calendar helpers for the week planner ────────────────────────────────────

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Monday-based week start — training weeks read Mon→Sun. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(d, -dow);
}

export function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * The calendar day a workout belongs to. A scheduled workout stays pinned to the
 * day it was planned for — even after you start or finish it — so starting a
 * workout planned for tomorrow never drags it onto today. Unscheduled workouts
 * fall back to when they actually happened.
 */
export function workoutDay(workout: Workout): Date {
  return startOfDay(
    workout.scheduledFor ?? workout.completedAt ?? workout.startedAt ?? workout.createdAt
  );
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── "What did I lift last time?" ─────────────────────────────────────────────

/** A set counts as remembered only if it was finished with a real number in it. */
function isLogged(set: WorkoutSet): boolean {
  return set.isCompleted && (set.weight != null || set.duration != null);
}

/**
 * The numbers to ghost into empty inputs, per exercise, indexed by set position.
 *
 * Two rules make this behave the way lifters expect:
 *
 *  1. It walks the whole history, not just the last workout. A session where the
 *     exercise was in the workout but nothing was entered logs nothing, so it's
 *     passed over and an older session supplies the numbers — skipping bench for
 *     two weeks still ghosts what you last actually pressed, and finishing a
 *     workout with an exercise left blank can't erase that memory.
 *  2. Positions are preserved, holes and all. Compacting the logged sets would
 *     slide set 3's numbers up under set 2 and ghost a weight that was never
 *     lifted there. A set the source session never reached stays undefined, and
 *     the row shows a dash.
 *
 * @param completed Finished workouts, newest first — the first session holding a
 *   logged set for an exercise wins.
 * @param excludeWorkoutId The workout being edited, so it can't ghost itself.
 */
export function previousSetsByExercise(
  completed: Workout[],
  excludeWorkoutId?: string
): Map<string, (WorkoutSet | undefined)[]> {
  const map = new Map<string, (WorkoutSet | undefined)[]>();
  for (const workout of completed) {
    if (workout.id === excludeWorkoutId) continue;
    for (const exercise of workout.exercises) {
      if (map.has(exercise.exerciseId)) continue;
      const logged = exercise.sets.map((set) => (isLogged(set) ? set : undefined));
      if (logged.some(Boolean)) map.set(exercise.exerciseId, logged);
    }
  }
  return map;
}

/**
 * How reopening a finished workout should retime it, on top of clearing the
 * finish fields. Shared by the cloud and on-device stores so the two can't
 * drift — each one just translates the result into its own "clear a field"
 * form (Firestore needs deleteField(), the local store deletes the key).
 */
export type ReopenTiming =
  /** Finished on an earlier day: becomes a backlog edit pinned to that day. */
  | { kind: "backlog"; scheduledFor: Date }
  /** Finished today: resume the clock where it stopped, ignoring the pause. */
  | { kind: "resume"; startedAt: Date }
  | { kind: "none" };

export function reopenTiming(workout: Workout): ReopenTiming {
  if (!workout.completedAt) return { kind: "none" };
  if (!sameDay(workout.completedAt, new Date())) {
    return { kind: "backlog", scheduledFor: workout.completedAt };
  }
  if (workout.startedAt) {
    const pausedMs = Date.now() - workout.completedAt.getTime();
    return { kind: "resume", startedAt: new Date(workout.startedAt.getTime() + pausedMs) };
  }
  return { kind: "none" };
}
