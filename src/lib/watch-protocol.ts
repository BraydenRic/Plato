import { isBodyweightExercise, isTimedExercise } from "./exercises";
import { convertWeight, liveSetSeconds, previousSetsByExercise, workoutVolumeLbs } from "./workout-utils";
import type { Workout, WorkoutExercise, WorkoutSet } from "@/types";

/**
 * What the phone tells the Apple Watch app, and what the watch asks back.
 *
 * The phone is the only source of truth. It sends the watch a snapshot — the
 * workout in progress, the templates, a few settings — and the watch sends back
 * small ops ("log this set") that are applied here, through data.ts, exactly as
 * if they had been typed on the phone. The watch never touches Firestore.
 *
 * Everything below is pure so it can be tested without either device. The
 * Swift side of this contract is targets/watch/Models.swift; a field renamed
 * here has to be renamed there.
 */

export const WATCH_PROTOCOL_VERSION = 1;

/** How a set is logged: weight × reps, added load × reps, or a stopwatch. */
export type WatchSetKind = "weight" | "bodyweight" | "timed";

export interface WatchSet {
  id: string;
  done: boolean;
  /**
   * In the snapshot's unit. For a bodyweight exercise it's the *added* load
   * (negative for assistance) and null means plain bodyweight.
   */
  weight: number | null;
  reps: number | null;
  /** Seconds, for timed sets. */
  duration: number | null;
  /** Last session's numbers for this set position — the phone's grey placeholders. */
  lastWeight: number | null;
  lastReps: number | null;
  lastDuration: number | null;
}

export interface WatchExercise {
  /** The WorkoutExercise id, not the library exercise id. */
  id: string;
  name: string;
  kind: WatchSetKind;
  sets: WatchSet[];
}

export interface WatchWorkout {
  id: string;
  name: string;
  /** ms since epoch */
  startedAt: number;
  exercises: WatchExercise[];
}

export interface WatchTemplate {
  id: string;
  name: string;
  /** Exercise names in order, capped — the watch shows a preview, not the whole thing. */
  exercises: string[];
  exerciseCount: number;
  setCount: number;
}

export interface WatchSnapshot {
  v: typeof WATCH_PROTOCOL_VERSION;
  /** ms since epoch. The watch keeps whichever snapshot is newest. */
  sentAt: number;
  /** "none" while signed out, so the watch can't keep showing the last account's data. */
  account: "signedIn" | "none";
  unit: "lbs" | "kg";
  /** The rest countdown setting; 0 is off. */
  restSeconds: number;
  /** When the current workout's rest ends, if one is running. */
  restEndsAt: number | null;
  /** The theme's dark-mode accent, since the watch is always dark. */
  accent: string;
  onAccent: string;
  /** The workout the resume bar and Live Activity lead with. */
  workout: WatchWorkout | null;
  templates: WatchTemplate[];
  /** Recently applied op ids, so the watch knows which of its own edits have landed. */
  applied: string[];
}

/**
 * Applied op ids the snapshot carries — all the phone remembers, so even a
 * long session logged out of range is confirmed in full when it catches up.
 * About 11 KB at most.
 */
export const SNAPSHOT_APPLIED_LIMIT = 300;
/** How many exercise names a template preview carries. */
const TEMPLATE_PREVIEW_LIMIT = 12;

export function watchSetKind(exercise: WorkoutExercise): WatchSetKind {
  if (isTimedExercise(exercise.exercise)) return "timed";
  if (isBodyweightExercise(exercise.exercise)) return "bodyweight";
  return "weight";
}

/**
 * A set's weight as the phone's set row would show it, in `unit`.
 *
 * Mirrors SetRow's shownWeight: loads follow the unit preference, and a
 * bodyweight set's added load is banked in lbs and shown converted. Nothing
 * added is null rather than 0, so the watch can say "BW".
 */
export function displayWeight(set: WorkoutSet | undefined, unit: "lbs" | "kg"): number | null {
  if (!set || set.weight == null) return null;
  if (set.weightUnit === "bodyweight") return set.weight ? convertWeight(set.weight, "lbs", unit) : null;
  return convertWeight(set.weight, set.weightUnit, unit);
}

/**
 * Whole numbers for the fields the watch decodes as integers. One stray
 * fraction (old data, another client) would fail the watch's decoder, and it
 * would then ignore every snapshot from that point on.
 */
function whole(value: number | undefined | null): number | null {
  return value == null || !Number.isFinite(value) ? null : Math.round(value);
}

function toWatchWorkout(workout: Workout, completed: Workout[], unit: "lbs" | "kg"): WatchWorkout {
  const previous = previousSetsByExercise(completed, workout.id);
  return {
    id: workout.id,
    name: workout.name || "Workout",
    startedAt: (workout.startedAt ?? workout.createdAt).getTime(),
    exercises: workout.exercises.map((exercise) => {
      const last = previous.get(exercise.exerciseId);
      return {
        id: exercise.id,
        name: exercise.exercise?.name || "Exercise",
        kind: watchSetKind(exercise),
        sets: exercise.sets.map((set, i) => ({
          id: set.id,
          done: set.isCompleted,
          weight: displayWeight(set, unit),
          reps: whole(set.reps),
          duration: whole(set.duration),
          lastWeight: displayWeight(last?.[i], unit),
          lastReps: whole(last?.[i]?.reps),
          lastDuration: whole(last?.[i]?.duration),
        })),
      };
    }),
  };
}

function toWatchTemplate(template: Workout): WatchTemplate {
  return {
    id: template.id,
    name: template.name || "Template",
    exercises: template.exercises.slice(0, TEMPLATE_PREVIEW_LIMIT).map((e) => e.exercise?.name || "Exercise"),
    exerciseCount: template.exercises.length,
    setCount: template.exercises.reduce((sum, e) => sum + e.sets.length, 0),
  };
}

export function buildWatchSnapshot(input: {
  signedIn: boolean;
  /** The lead live workout (see leadWorkout). */
  workout: Workout | undefined;
  /** In the order Home shows them. */
  templates: Workout[];
  /** Finished workouts, newest first — for last session's numbers. */
  completed: Workout[];
  unit: "lbs" | "kg";
  restSeconds: number;
  rest: { workoutId: string; endsAt: number } | null;
  accent: string;
  onAccent: string;
  applied: string[];
  now: number;
}): WatchSnapshot {
  // Signed out carries nothing at all: the watch must not keep showing the last
  // person's workouts on a phone that has moved on.
  const workout = input.signedIn ? input.workout : undefined;
  return {
    v: WATCH_PROTOCOL_VERSION,
    sentAt: input.now,
    account: input.signedIn ? "signedIn" : "none",
    unit: input.unit,
    restSeconds: whole(input.restSeconds) ?? 0,
    restEndsAt: workout && input.rest?.workoutId === workout.id ? input.rest.endsAt : null,
    accent: input.accent,
    onAccent: input.onAccent,
    workout: workout ? toWatchWorkout(workout, input.completed, input.unit) : null,
    templates: input.signedIn ? input.templates.map(toWatchTemplate) : [],
    applied: input.applied.slice(-SNAPSHOT_APPLIED_LIMIT),
  };
}

// ── Ops from the watch ────────────────────────────────────────────────────────

interface OpBase {
  opId: string;
  /** When it happened on the watch, ms since epoch. */
  at: number;
}

interface SetRef {
  workoutId: string;
  /** WorkoutExercise id */
  exerciseId: string;
  setId: string;
}

export type WatchOp =
  /** Done on a set, or a done set edited. Values are in `unit`. */
  | (OpBase & SetRef & { kind: "logSet"; weight: number | null; reps: number | null; duration: number | null; unit: "lbs" | "kg" })
  /** Clear a set back to untouched, for a Done tapped by mistake. */
  | (OpBase & SetRef & { kind: "undoSet" })
  /** One more set. The watch picks the id so it can log into it straight away. */
  | (OpBase & SetRef & { kind: "addSet" })
  | (OpBase & { kind: "startTemplate"; templateId: string })
  | (OpBase & { kind: "finish"; workoutId: string })
  | (OpBase & { kind: "extendRest"; workoutId: string; seconds: number })
  | (OpBase & { kind: "endRest"; workoutId: string });

export type WatchSetOp = Extract<WatchOp, { kind: "logSet" | "undoSet" | "addSet" }>;

const MAX_ID_LENGTH = 128;

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function finiteOrNull(value: unknown, min: number, max: number): number | null | undefined {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return undefined;
  return value;
}

/**
 * Checks an op from the watch, field by field, before anything acts on it.
 *
 * The watch is our own app, but what arrives has crossed a radio link and a
 * disk, and is about to be written into someone's workout history. Anything
 * malformed — a version mismatch, a truncated write — is refused here rather
 * than half-applied.
 */
export function parseWatchOp(raw: unknown): WatchOp | null {
  if (!raw || typeof raw !== "object") return null;
  const op = raw as Record<string, unknown>;
  if (!isId(op.opId) || typeof op.at !== "number" || !Number.isFinite(op.at)) return null;
  const base = { opId: op.opId, at: op.at };

  switch (op.kind) {
    case "logSet": {
      if (!isId(op.workoutId) || !isId(op.exerciseId) || !isId(op.setId)) return null;
      if (op.unit !== "lbs" && op.unit !== "kg") return null;
      const weight = finiteOrNull(op.weight, -2000, 5000);
      const reps = finiteOrNull(op.reps, 0, 1000);
      const duration = finiteOrNull(op.duration, 0, 24 * 60 * 60);
      if (weight === undefined || reps === undefined || duration === undefined) return null;
      return {
        ...base,
        kind: "logSet",
        workoutId: op.workoutId,
        exerciseId: op.exerciseId,
        setId: op.setId,
        weight,
        reps: reps == null ? null : Math.round(reps),
        duration: duration == null ? null : Math.round(duration),
        unit: op.unit,
      };
    }
    case "undoSet":
    case "addSet":
      if (!isId(op.workoutId) || !isId(op.exerciseId) || !isId(op.setId)) return null;
      return { ...base, kind: op.kind, workoutId: op.workoutId, exerciseId: op.exerciseId, setId: op.setId };
    case "startTemplate":
      if (!isId(op.templateId)) return null;
      return { ...base, kind: "startTemplate", templateId: op.templateId };
    case "finish":
    case "endRest":
      if (!isId(op.workoutId)) return null;
      return { ...base, kind: op.kind, workoutId: op.workoutId };
    case "extendRest": {
      if (!isId(op.workoutId)) return null;
      const seconds = finiteOrNull(op.seconds, 1, 600);
      if (seconds == null) return null;
      return { ...base, kind: "extendRest", workoutId: op.workoutId, seconds: Math.round(seconds) };
    }
    default:
      return null;
  }
}

/**
 * When an op says it happened, kept between `earliest` and now.
 *
 * The watch's clock is trusted for ordering within a session — it's what lets a
 * set logged offline keep the time it was actually lifted — but not to put a
 * set before its workout started or after the moment it's being applied.
 */
export function opTime(at: number, now: number, earliest = 0): number {
  return Math.min(Math.max(at, earliest), now);
}

/**
 * Applies a set op to a workout's exercises.
 *
 * logSet follows SetRow.commit to the letter, so a set logged on the watch is
 * indistinguishable from one typed on the phone: a set is done with a weight
 * and positive reps, a bodyweight set on reps alone (its added load banked in
 * lbs), a timed set on a positive duration.
 *
 * Returns null when there's nothing to do — the exercise or set is gone, or an
 * added set already exists — so the caller skips the write.
 */
export function applySetOp(
  workout: Workout,
  op: WatchSetOp,
  options: { unit: "lbs" | "kg"; now: number }
): { exercises: WorkoutExercise[]; completedNow: boolean } | null {
  const exercise = workout.exercises.find((e) => e.id === op.exerciseId);
  if (!exercise) return null;
  const at = new Date(opTime(op.at, options.now, workout.startedAt?.getTime() ?? 0));

  const withSets = (sets: WorkoutSet[]) =>
    workout.exercises.map((e) => (e.id === exercise.id ? { ...e, sets } : e));

  if (op.kind === "addSet") {
    if (exercise.sets.some((s) => s.id === op.setId)) return null;
    const last = exercise.sets[exercise.sets.length - 1];
    const fresh: WorkoutSet = { id: op.setId, weightUnit: last?.weightUnit ?? options.unit, isCompleted: false };
    return { exercises: withSets([...exercise.sets, fresh]), completedNow: false };
  }

  const set = exercise.sets.find((s) => s.id === op.setId);
  if (!set) return null;

  let patch: Partial<WorkoutSet>;
  if (op.kind === "undoSet") {
    patch = { weight: undefined, reps: undefined, duration: undefined, isCompleted: false, completedAt: undefined };
  } else {
    const kind = watchSetKind(exercise);
    if (kind === "timed") {
      const seconds = op.duration != null && op.duration > 0 ? op.duration : undefined;
      patch = { duration: seconds, isCompleted: seconds != null, completedAt: seconds != null ? at : undefined };
    } else {
      const reps = op.reps ?? undefined;
      const done = kind === "bodyweight" ? reps != null && reps > 0 : op.weight != null && reps != null && reps > 0;
      patch = {
        weight:
          kind === "bodyweight" && op.weight != null ? convertWeight(op.weight, op.unit, "lbs") : (op.weight ?? undefined),
        ...(kind === "bodyweight"
          ? { weightUnit: "bodyweight" as const }
          : op.weight != null
            ? { weightUnit: op.unit }
            : {}),
        reps,
        isCompleted: done,
        completedAt: done ? at : undefined,
      };
    }
  }

  const next = { ...set, ...patch };
  return {
    exercises: withSets(exercise.sets.map((s) => (s.id === set.id ? next : s))),
    completedNow: next.isCompleted && !set.isCompleted,
  };
}

/**
 * A stopwatch left running on the phone, banked into its set — what the
 * workout screen's Finish does with one before saving.
 */
export function bankRunningTimer(
  exercises: WorkoutExercise[],
  timer: { exerciseId: string; setId: string; startedAt: number },
  now: number
): WorkoutExercise[] {
  const seconds = liveSetSeconds(now, timer.startedAt);
  return exercises.map((e) =>
    e.id !== timer.exerciseId
      ? e
      : {
          ...e,
          sets: e.sets.map((s) =>
            s.id !== timer.setId
              ? s
              : {
                  ...s,
                  duration: seconds > 0 ? seconds : undefined,
                  isCompleted: seconds > 0,
                  completedAt: seconds > 0 ? new Date(now) : undefined,
                }
          ),
        }
  );
}

/**
 * What finishing a live workout writes besides its sets — the workout screen's
 * finishWith for a session in progress: when, how long, and the volume frozen
 * with the day's bodyweight. (Finishing an off-day plan, the other branch
 * there, can't come from the watch: the watch only ever has a live workout.)
 */
export function finishedFields(
  workout: Workout,
  exercises: WorkoutExercise[],
  completedAt: Date,
  bodyweightLbs: number | undefined
): Pick<Workout, "completedAt" | "durationMinutes" | "totalVolume"> {
  const startedAt = workout.startedAt ?? workout.createdAt;
  return {
    completedAt,
    durationMinutes: Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000)),
    totalVolume: workoutVolumeLbs({ ...workout, exercises }, bodyweightLbs),
  };
}
