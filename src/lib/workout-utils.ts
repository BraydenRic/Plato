import type { BodyweightEntry, WeeklyPlan, Workout, WorkoutSet } from "@/types";

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

/**
 * Ceiling on templates once a guest session merges into an account.
 *
 * Twice MAX_TEMPLATES, because that is exactly the most an honest merge can
 * produce: an account already at its limit plus a guest session already at
 * its own. Anything beyond it can only come from signing out, filling guest
 * mode again and signing back in — repeatedly — which is the only way the
 * per-screen limit can be walked past.
 *
 * Capping at MAX_TEMPLATES instead would bound it no more tightly, and would
 * quietly delete real work: someone at 20 templates who reinstalls, taps
 * "Continue as guest", saves two, then signs in would lose both.
 */
export const MAX_MERGED_TEMPLATES = MAX_TEMPLATES * 2;

// Cap simultaneously in-progress (started, unfinished) workouts. Nobody trains
// more than a couple at once; the limit stops runaway "start and abandon" from
// piling up live sessions. Finishing or deleting one frees a slot.
export const MAX_ACTIVE_WORKOUTS = 5;

/**
 * Ceiling on in-progress workouts once a guest session merges into an account.
 * Twice MAX_ACTIVE_WORKOUTS for the same reason as MAX_MERGED_TEMPLATES: that is
 * the most an honest merge can produce, so the cap only ever bites the repeated
 * sign-out/guest/sign-in cycle that walks past the per-screen limit.
 */
export const MAX_MERGED_ACTIVE_WORKOUTS = MAX_ACTIVE_WORKOUTS * 2;

/**
 * Started but not finished — the live session(s).
 *
 * Shared so the screen that refuses a sixth and the merge that caps the total
 * are answering the same question. Two copies of this would drift, and the
 * symptom would be a cap that counts something subtly different from what the
 * user is looking at.
 */
export function isActiveWorkout(workout: {
  isTemplate?: boolean;
  completedAt?: Date | null;
  startedAt?: Date | null;
}): boolean {
  return !workout.isTemplate && !workout.completedAt && !!workout.startedAt;
}

/**
 * The one in-progress session the app speaks for: the most recently started.
 *
 * Up to MAX_ACTIVE_WORKOUTS can be live at once, but the two places that stand
 * in for the workout while you're elsewhere — the Live Activity pill and the
 * resume bar above the tabs — each have room for exactly one, and pointing at
 * different sessions would be worse than either choice. So the pick is made
 * once, here, instead of separately at each of them.
 */
export function liveWorkout(active: Workout[]): Workout | undefined {
  return active.reduce<Workout | undefined>(
    (latest, w) =>
      !latest || (w.startedAt?.getTime() ?? 0) > (latest.startedAt?.getTime() ?? 0) ? w : latest,
    undefined
  );
}

// All of a user's custom exercises live in a single document, so cap them to
// keep it well under Firestore's 1 MB limit. 200 is far more than anyone builds
// by hand (the app ships ~177 defaults) while staying tiny on disk.
export const MAX_CUSTOM_EXERCISES = 200;

/**
 * Weigh-ins kept per user. One document holds the lot, same as the exercise
 * library, so this keeps it far under Firestore's 1 MB ceiling — daily
 * weigh-ins would take five years to get here.
 */
export const MAX_BODYWEIGHT_ENTRIES = 2000;

const KG_TO_LBS = 2.20462;

export function setVolumeLbs(set: WorkoutSet, bodyweightLbs?: number): number {
  if (!set.isCompleted || !set.reps) return 0;
  if (set.weightUnit === "bodyweight") {
    // Nothing recorded, nothing invented: a bodyweight set counts zero until
    // the user has told the app what they weigh, exactly as it did before.
    if (!bodyweightLbs) return 0;
    // `weight` is the added load here, already in lbs, and may be negative for
    // the assisted machine. Clamped so heavy assistance can't go below zero.
    return set.reps * Math.max(0, bodyweightLbs + (set.weight ?? 0));
  }
  if (!set.weight) return 0;
  const lbs = set.weightUnit === "kg" ? set.weight * KG_TO_LBS : set.weight;
  return set.reps * lbs;
}

/**
 * `bodyweightLbs` is what the lifter weighed when this workout happened — the
 * caller resolves it with bodyweightOn, since only it knows the date. Omitted,
 * bodyweight sets count zero, which is what every reader of an already-finished
 * workout wants: those have their volume stored and must not be re-valued.
 */
export function workoutVolumeLbs(workout: Workout, bodyweightLbs?: number): number {
  return workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + setVolumeLbs(set, bodyweightLbs), 0),
    0
  );
}

/**
 * Epley's estimated one-rep max: what a set is "worth" as a single.
 *
 * The number that makes 225×7, 225×8, 225×9 read as the three weeks of
 * progress they are, rather than as a flat line at 225. Weight alone cannot
 * see reps, and reps alone cannot see weight.
 *
 * It is an estimate and it drifts. Epley is close over roughly 1–10 reps and
 * increasingly generous past that — a set of twenty does not really predict the
 * single it claims. Used for comparing a lifter against themselves over weeks,
 * which is what this is for, that bias cancels out; used to pick an actual
 * attempt, it does not.
 *
 * A single rep returns the weight itself, which is the one case where the
 * estimate is not an estimate.
 */
export function estimatedOneRepMax(lbs: number, reps: number | undefined): number {
  if (!reps || reps < 1) return 0;
  return lbs * (1 + reps / 30);
}

/** Formats a bodyweight set's load: "BW", "BW+25", "BW-30". */
export function formatBodyweightLoad(added: number | undefined, unit: "lbs" | "kg"): string {
  if (!added) return "BW";
  const shown = Math.round(convertWeight(Math.abs(added), "lbs", unit) * 10) / 10;
  return `BW${added > 0 ? "+" : "-"}${shown}`;
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

/**
 * A weight, ready to put on screen.
 *
 * convertWeight returns the value untouched when the units already match,
 * which is right for filling an input — nobody wants their stored 102.55
 * quietly rounded because they opened the keypad. It is wrong for reading:
 * Epley on 200 for 10 is 266.666…, and six decimal places of an estimate is
 * false precision dressed as detail.
 *
 * Nearest half, because that is the granularity a gym actually has. Plates
 * come in 2.5 lb and 1.25 kg pairs, so a half is the smallest change anyone can
 * make and a smaller one describes nothing. Whole numbers lose their ".0".
 */
export function formatWeight(lbs: number, unit: "lbs" | "kg"): string {
  const rounded = Math.round(convertWeight(lbs, "lbs", unit) * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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


/**
 * Completed sets per exercise category, heaviest first.
 *
 * By category rather than by muscle, and that choice does more work than it
 * looks like. A set of bench works chest, triceps and shoulders, so counting it
 * against each would make ten sets of pressing read as ten of everything —
 * avoidable only by counting halves, which invites "why is my triceps 5.5".
 * An exercise belongs to exactly one category, so a set is one set and the
 * numbers are just true.
 *
 * Only completed sets count. A set you wrote down and did not do is not volume.
 */
export function setsByCategory(workouts: Workout[]): { category: string; sets: number }[] {
  const counts = new Map<string, number>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const done = exercise.sets.filter((set) => set.isCompleted).length;
      if (done === 0) continue;
      const category = exercise.exercise.category;
      counts.set(category, (counts.get(category) ?? 0) + done);
    }
  }
  return [...counts.entries()]
    .map(([category, sets]) => ({ category, sets }))
    // Ties broken by name so the order cannot flicker between renders.
    .sort((a, b) => b.sets - a.sets || a.category.localeCompare(b.category));
}

// ── Bodyweight ───────────────────────────────────────────────────────────────

/**
 * Adds a weigh-in, newest last, replacing any entry already on that day.
 *
 * One per day because a weigh-in is a reading of the same thing, not an event
 * worth accumulating — logging twice on a Tuesday should correct Tuesday, not
 * put two dots on the chart a few hours apart.
 */
export function withBodyweightEntry(
  log: BodyweightEntry[],
  entry: BodyweightEntry
): BodyweightEntry[] {
  const day = startOfDay(entry.date).getTime();
  const kept = log.filter((e) => startOfDay(e.date).getTime() !== day);
  return [...kept, entry]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-MAX_BODYWEIGHT_ENTRIES);
}

/**
 * Drops the weigh-in on a day, if there is one.
 *
 * Addressed by day rather than by identity, for the same reason
 * withBodyweightEntry replaces by day: there is only ever one reading per day,
 * so the day *is* the identity.
 */
export function withoutBodyweightEntry(log: BodyweightEntry[], day: Date): BodyweightEntry[] {
  const target = startOfDay(day).getTime();
  return log.filter((entry) => startOfDay(entry.date).getTime() !== target);
}

/**
 * The weigh-in closest in time to `when`, or null if there are none.
 *
 * Nearest rather than most-recent-before, so a workout logged before someone
 * started tracking still gets a sensible weight instead of nothing. This is
 * what a future bodyweight-aware volume would call: valuing last March's
 * pull-ups at last March's weight rather than at today's.
 */
export function bodyweightOn(log: BodyweightEntry[], when: Date): BodyweightEntry | null {
  if (log.length === 0) return null;
  return log.reduce((best, entry) =>
    Math.abs(entry.date.getTime() - when.getTime()) <
    Math.abs(best.date.getTime() - when.getTime())
      ? entry
      : best
  );
}
