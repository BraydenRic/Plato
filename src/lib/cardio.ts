import { isTimedExercise } from "./exercises";
import { addDays, formatClock, startOfWeek } from "./workout-utils";
import type { BestEffortKey, Exercise, Workout, WorkoutSet } from "@/types";

/**
 * Cardio that covers ground, and how each kind is read beyond the clock.
 *
 *  foot — distance, and pace per mile or kilometre (runs, walks, hikes)
 *  ride — distance, and speed, which is how bikes and ellipticals display it
 *  row  — metres, and time per 500 m: the number every rowing machine shows
 *  swim — yards or metres, and time per 100, as pools are marked
 *
 * Anything cardio that isn't listed (burpees, jump rope, the StairMaster) is
 * logged by the clock alone, as before: there's no distance worth typing.
 */
export type DistanceKind = "foot" | "ride" | "row" | "swim";

// By id rather than a flag on each library entry, for the reason
// TIMED_EXERCISE_IDS gives: workouts embed copies of the exercise, so older
// logs carry no flag but their ids still match.
const DISTANCE_KIND: Record<string, DistanceKind> = {
  running: "foot",
  treadmill: "foot",
  "curved-treadmill": "foot",
  "incline-walk": "foot",
  walking: "foot",
  hiking: "foot",
  rucking: "foot",
  cycling: "ride",
  "recumbent-bike": "ride",
  "assault-bike": "ride",
  elliptical: "ride",
  rowing: "row",
  "ski-erg": "row",
  swimming: "swim",
};

export function distanceKind(exercise: Exercise): DistanceKind | null {
  if (!isTimedExercise(exercise)) return null;
  return DISTANCE_KIND[exercise.id] ?? null;
}

/** Cardio, as opposed to a hold like a plank — both are timed. */
export function isCardio(exercise: Exercise): boolean {
  return exercise.category === "Cardio" || DISTANCE_KIND[exercise.id] != null;
}

// ── Units ────────────────────────────────────────────────────────────────────

export type DistanceUnit = "mi" | "km" | "m" | "yd";

const METRES_PER: Record<DistanceUnit, number> = { mi: 1609.344, km: 1000, m: 1, yd: 0.9144 };

/**
 * The unit a distance is typed and shown in. It follows the weight setting —
 * someone in lbs thinks in miles — except on a rower, which reads in metres
 * whatever country it's in.
 */
export function distanceUnit(kind: DistanceKind, weightUnit: "lbs" | "kg"): DistanceUnit {
  if (kind === "row") return "m";
  if (kind === "swim") return weightUnit === "lbs" ? "yd" : "m";
  return weightUnit === "lbs" ? "mi" : "km";
}

export function toMetres(value: number, unit: DistanceUnit): number {
  return value * METRES_PER[unit];
}

export function fromMetres(metres: number, unit: DistanceUnit): number {
  return metres / METRES_PER[unit];
}

/**
 * The number alone, as an input shows it: "3.10" miles, "2000" metres.
 *
 * Two places for miles and kilometres because that's how every watch and
 * treadmill reads, and the second place is what tells 3.1 from 3.15. Short
 * units are whole: nobody rows 2,000.4 m.
 */
export function formatDistanceValue(metres: number, unit: DistanceUnit): string {
  const value = fromMetres(metres, unit);
  return unit === "mi" || unit === "km" ? value.toFixed(2) : String(Math.round(value));
}

/** "3.10 mi", "2,000 m". */
export function formatDistance(metres: number, unit: DistanceUnit): string {
  if (unit === "mi" || unit === "km") return `${formatDistanceValue(metres, unit)} ${unit}`;
  return `${Math.round(fromMetres(metres, unit)).toLocaleString()} ${unit}`;
}

/** "3.1" → metres. Undefined for blank or garbage, and for zero or less. */
export function parseDistanceText(text: string, unit: DistanceUnit): number | undefined {
  const t = text.trim().replace(",", ".");
  if (!t) return undefined;
  const value = Number(t);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return toMetres(value, unit);
}

/**
 * How fast, the way this kind of cardio is usually read: "8:28 /mi" on foot,
 * "15.2 mph" on a bike, "1:52 /500m" on a rower, "1:45 /100yd" in the pool.
 * Null without both a time and a distance.
 */
export function formatRate(
  metres: number | undefined,
  seconds: number | undefined,
  kind: DistanceKind,
  weightUnit: "lbs" | "kg"
): string | null {
  if (!metres || !seconds || metres <= 0 || seconds <= 0) return null;
  const unit = distanceUnit(kind, weightUnit);
  if (kind === "ride") {
    const perHour = fromMetres(metres, unit) / (seconds / 3600);
    return `${perHour.toFixed(1)} ${unit === "mi" ? "mph" : "km/h"}`;
  }
  const per = kind === "row" ? 500 : kind === "swim" ? 100 : 1;
  const span = kind === "foot" ? unit : `${per}${unit}`;
  const secondsPer = seconds / (fromMetres(metres, unit) / per);
  return `${formatClock(Math.round(secondsPer))} /${span}`;
}

// ── Sets and workouts ────────────────────────────────────────────────────────

/**
 * Whether a cardio set counts as done: some time or some distance. Distance on
 * its own counts because a treadmill tells you how far as readily as how long,
 * and a session you only know the distance of still happened.
 */
export function cardioSetDone(set: Pick<WorkoutSet, "duration" | "distance">): boolean {
  return (set.duration ?? 0) > 0 || (set.distance ?? 0) > 0;
}

/** Every exercise in it is cardio — a run, not a leg day that ended on a bike. */
export function isCardioWorkout(workout: Workout): boolean {
  return workout.exercises.length > 0 && workout.exercises.every((ex) => isCardio(ex.exercise));
}

/**
 * How far a workout went, ready to show beside it: "3.10 mi". Null when it
 * covered no ground.
 *
 * Distances in different units only add up within a unit — a run and a row
 * don't make one number — so this totals each and shows the largest, which in
 * practice is the one workout's one cardio exercise.
 */
export function workoutDistanceLabel(workout: Workout, weightUnit: "lbs" | "kg"): string | null {
  const totals = new Map<DistanceUnit, number>();
  for (const ex of workout.exercises) {
    const kind = distanceKind(ex.exercise);
    if (!kind) continue;
    const unit = distanceUnit(kind, weightUnit);
    const metres = ex.sets.reduce((sum, s) => sum + (s.isCompleted ? (s.distance ?? 0) : 0), 0);
    if (metres > 0) totals.set(unit, (totals.get(unit) ?? 0) + metres);
  }
  let best: [DistanceUnit, number] | null = null;
  for (const entry of totals) if (!best || entry[1] > best[1]) best = entry;
  return best ? formatDistance(best[1], best[0]) : null;
}

/** Seconds of completed cardio in a workout, for a run's headline time. */
export function workoutCardioSeconds(workout: Workout): number {
  return workout.exercises.reduce(
    (sum, ex) =>
      isCardio(ex.exercise)
        ? sum + ex.sets.reduce((s, set) => s + (set.isCompleted ? (set.duration ?? 0) : 0), 0)
        : sum,
    0
  );
}

// ── Progress ─────────────────────────────────────────────────────────────────

/**
 * Cardio grouped the way people compare it: a treadmill run is a run, a hike is
 * a walk. Only the groups where distance means the same thing session to
 * session — an elliptical's "miles" are the machine's guess and don't compare
 * with anything, so it has no group.
 */
export type CardioActivity = "run" | "walk" | "ride" | "row" | "swim";

const ACTIVITY: Record<string, CardioActivity> = {
  running: "run",
  treadmill: "run",
  "curved-treadmill": "run",
  walking: "walk",
  "incline-walk": "walk",
  hiking: "walk",
  rucking: "walk",
  cycling: "ride",
  "recumbent-bike": "ride",
  "assault-bike": "ride",
  rowing: "row",
  "ski-erg": "row",
  swimming: "swim",
};

export const ACTIVITY_ORDER: CardioActivity[] = ["run", "walk", "ride", "row", "swim"];

export const ACTIVITY_LABEL: Record<CardioActivity, { one: string; many: string; noun: string }> = {
  run: { one: "Run", many: "runs", noun: "Running" },
  walk: { one: "Walk", many: "walks", noun: "Walking" },
  ride: { one: "Ride", many: "rides", noun: "Cycling" },
  row: { one: "Row", many: "rows", noun: "Rowing" },
  swim: { one: "Swim", many: "swims", noun: "Swimming" },
};

export const ACTIVITY_KIND: Record<CardioActivity, DistanceKind> = {
  run: "foot",
  walk: "foot",
  ride: "ride",
  row: "row",
  swim: "swim",
};

export const BEST_EFFORTS: { key: BestEffortKey; metres: number; label: string }[] = [
  { key: "1k", metres: 1000, label: "1 km" },
  { key: "1mi", metres: 1609.344, label: "Mile" },
  { key: "5k", metres: 5000, label: "5K" },
  { key: "10k", metres: 10000, label: "10K" },
  { key: "half", metres: 21097.5, label: "Half marathon" },
  { key: "marathon", metres: 42195, label: "Marathon" },
];

/** One exercise's cardio within one workout: a run, a ride. */
export interface CardioSession {
  workoutId: string;
  date: Date;
  activity: CardioActivity;
  metres: number;
  seconds: number;
  best: Partial<Record<BestEffortKey, number>>;
}

/**
 * A typed-in set stands for a standard distance only when it *is* that
 * distance, give or take a little — 3.1 miles is a 5K. A 10-mile run's average
 * pace says nothing about how fast its fastest mile was, so it isn't stretched
 * to cover one; only Health's mile-by-mile readings can say that.
 */
const TYPED_EFFORT_SLACK = 1.05;

function typedBest(set: WorkoutSet): Partial<Record<BestEffortKey, number>> {
  const best: Partial<Record<BestEffortKey, number>> = {};
  if (!set.distance || !set.duration) return best;
  for (const effort of BEST_EFFORTS) {
    if (set.distance >= effort.metres && set.distance <= effort.metres * TYPED_EFFORT_SLACK) {
      best[effort.key] = Math.round((set.duration * effort.metres) / set.distance);
    }
  }
  return best;
}

function keepFaster(into: Partial<Record<BestEffortKey, number>>, from: Partial<Record<BestEffortKey, number>>) {
  for (const [key, seconds] of Object.entries(from) as [BestEffortKey, number][]) {
    if (seconds > 0 && (into[key] == null || seconds < into[key]!)) into[key] = seconds;
  }
}

/** Every cardio session that covered ground, newest first like `completed`. */
export function cardioSessions(completed: Workout[]): CardioSession[] {
  const sessions: CardioSession[] = [];
  for (const workout of completed) {
    if (!workout.completedAt) continue;
    for (const ex of workout.exercises) {
      const activity = ACTIVITY[ex.exerciseId];
      if (!activity) continue;
      let metres = 0;
      let seconds = 0;
      const best: Partial<Record<BestEffortKey, number>> = {};
      for (const set of ex.sets) {
        if (!set.isCompleted || !set.distance) continue;
        metres += set.distance;
        seconds += set.duration ?? 0;
        // Health's readings, where it has them, are the real thing; a set
        // without them falls back to what its own time and distance can say.
        keepFaster(best, set.tracked?.best ?? typedBest(set));
      }
      if (metres > 0) {
        sessions.push({ workoutId: workout.id, date: workout.completedAt, activity, metres, seconds, best });
      }
    }
  }
  return sessions;
}

/** The activities someone actually does, in a fixed order so tabs don't shuffle. */
export function activitiesIn(sessions: CardioSession[]): CardioActivity[] {
  const present = new Set(sessions.map((s) => s.activity));
  return ACTIVITY_ORDER.filter((a) => present.has(a));
}

export interface CardioRecords {
  longest?: CardioSession;
  best: Partial<Record<BestEffortKey, number>>;
}

export function cardioRecords(sessions: CardioSession[]): CardioRecords {
  const records: CardioRecords = { best: {} };
  for (const s of sessions) {
    if (!records.longest || s.metres > records.longest.metres) records.longest = s;
    keepFaster(records.best, s.best);
  }
  return records;
}

/**
 * Distance per training week (Monday to Sunday, like the rest of the app), the
 * oldest of `weeks` first and the current week last. Weeks with nothing in
 * them are zero, not missing, so a gap reads as a gap.
 */
export function weeklyDistance(
  sessions: CardioSession[],
  weeks: number,
  now: Date = new Date()
): { weekStart: Date; metres: number }[] {
  const thisWeek = startOfWeek(now);
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addDays(thisWeek, -7 * (weeks - 1 - i)),
    metres: 0,
  }));
  const first = buckets[0].weekStart.getTime();
  for (const s of sessions) {
    const start = startOfWeek(s.date).getTime();
    if (start < first) continue;
    const bucket = buckets.find((b) => b.weekStart.getTime() === start);
    if (bucket) bucket.metres += s.metres;
  }
  return buckets;
}
