import { cardioSetDone } from "./cardio";
import { MAX_CURVE_POINTS, measuredByWatch } from "./cardio-tracking";
import { isBodyweightExercise, isTimedExercise } from "./exercises";
import { convertWeight, liveSetSeconds, previousSetsByExercise, workoutVolumeLbs } from "./workout-utils";
import type { CardioSessionKind, Workout, WorkoutExercise, WorkoutSet } from "@/types";

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
  /** Set when it's a cardio session, which the watch shows as its own screen. */
  cardio: WatchCardio | null;
}

/** A cardio session, as far as the watch needs to know it. */
export interface WatchCardio {
  kind: CardioSessionKind;
  indoor: boolean;
  /** ms since epoch, while paused; null while moving. */
  pausedAtMs: number | null;
  pausedSeconds: number;
  /** A watch is tracking it. */
  watch: boolean;
  /** The id of the watch's start op, when the watch started it — how the watch recognises its own. */
  startOpId: string | null;
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
  /**
   * Sessions the watch was tracking that were ended or thrown away on the
   * phone, so a watch still tracking one stops: sending what it measured for
   * one that ended, keeping nothing of one that was discarded.
   */
  endedCardio: EndedCardio[];
}

/**
 * A session ended on the phone, described every way a watch might know it:
 * by the phone's id, by its own start op, or — never having heard either —
 * by kind and start time.
 */
export interface EndedCardio {
  id: string;
  startOpId: string | null;
  kind: CardioSessionKind;
  /** ms since epoch */
  startedAt: number;
  /** Thrown away on the phone: the watch keeps nothing, Health included. */
  discard: boolean;
}

const SESSION_KINDS: CardioSessionKind[] = ["run", "walk", "hike", "bike", "swim", "row", "elliptical", "stairs"];

/** How long a session ended on the phone keeps asking a watch to end it too. */
export const ENDED_CARDIO_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Watch-tracked sessions ended on the phone that are still waiting for what
 * the watch measured: finished, but with nothing from the watch on their set.
 * The iPhone's step count isn't from the watch: a session the phone measured
 * before a late watch start turned up still waits for that watch.
 */
export function endedCardio(completed: Workout[], now: number): EndedCardio[] {
  const ended: EndedCardio[] = [];
  for (const w of completed) {
    if (!w.cardio?.watch || !w.completedAt || now - w.completedAt.getTime() > ENDED_CARDIO_WINDOW_MS) continue;
    if (measuredByWatch(w.exercises[0]?.sets[0]?.tracked)) continue;
    ended.push({
      id: w.id,
      startOpId: w.cardio.watchStartOpId ?? null,
      kind: w.cardio.kind,
      startedAt: (w.startedAt ?? w.createdAt).getTime(),
      discard: false,
    });
  }
  return ended;
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
 * What the phone takes back from the watch (see parseWatchOp), and so all
 * the snapshot sends: a number the watch pre-fills is one Done can send.
 * Weights are in the op's unit.
 */
const WEIGHT_RANGE = { min: -2000, max: 5000 };
const REPS_RANGE = { min: 0, max: 1000 };
const DURATION_RANGE = { min: 0, max: 24 * 60 * 60 };

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
 * A weight the watch can send back as it is, or null. The phone takes any
 * number typed; a typo past what an op may carry, pre-filled on the watch,
 * made Done send a set the phone then refused without a word.
 */
function watchWeight(weight: number | null): number | null {
  return weight != null && weight >= WEIGHT_RANGE.min && weight <= WEIGHT_RANGE.max ? weight : null;
}

/**
 * Whole numbers for the fields the watch decodes as integers, within what an
 * op may carry back. One stray fraction (old data, another client) would
 * fail the watch's decoder, and so would a number past a 32-bit Int — a
 * Series 8 is one — and it would then ignore every snapshot from that point
 * on. Out of range is null: there's no honest number to show instead.
 */
function whole(value: number | undefined | null, range: { min: number; max: number }): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= range.min && rounded <= range.max ? rounded : null;
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
          weight: watchWeight(displayWeight(set, unit)),
          reps: whole(set.reps, REPS_RANGE),
          duration: whole(set.duration, DURATION_RANGE),
          lastWeight: watchWeight(displayWeight(last?.[i], unit)),
          lastReps: whole(last?.[i]?.reps, REPS_RANGE),
          lastDuration: whole(last?.[i]?.duration, DURATION_RANGE),
        })),
      };
    }),
    cardio: workout.cardio
      ? {
          kind: workout.cardio.kind,
          indoor: !!workout.cardio.indoor,
          pausedAtMs: workout.cardio.pausedAtMs ?? null,
          pausedSeconds: workout.cardio.pausedSeconds ?? 0,
          watch: !!workout.cardio.watch,
          startOpId: workout.cardio.watchStartOpId ?? null,
        }
      : null,
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
  /** See endedCardio, plus sessions discarded on the phone. */
  endedCardio?: EndedCardio[];
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
    restSeconds: whole(input.restSeconds, DURATION_RANGE) ?? 0,
    restEndsAt: workout && input.rest?.workoutId === workout.id ? input.rest.endsAt : null,
    accent: input.accent,
    onAccent: input.onAccent,
    workout: workout ? toWatchWorkout(workout, input.completed, input.unit) : null,
    templates: input.signedIn ? input.templates.map(toWatchTemplate) : [],
    applied: input.applied.slice(-SNAPSHOT_APPLIED_LIMIT),
    endedCardio: input.signedIn ? (input.endedCardio ?? []) : [],
  };
}

/**
 * The most a snapshot may be, as UTF-8. WatchConnectivity refuses a context
 * or message past about 64 KB — Apple gives no number — and nothing tells
 * either side: the watch just keeps the last snapshot it got, for good. A
 * heavy user is nearer 30 KB; this leaves room for the rest of the payload.
 */
export const WATCH_SNAPSHOT_MAX_BYTES = 56 * 1024;

function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // A surrogate pair: one four-byte character.
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * The snapshot cut down to fit, what's least missed going first: last
 * session's numbers on sets already done (nothing reads them), most of each
 * template's preview, the older applied ids, then templates from the end of
 * the list. The workout in progress is never cut — it's what the watch is for.
 */
export function fitWatchSnapshot(snapshot: WatchSnapshot, maxBytes = WATCH_SNAPSHOT_MAX_BYTES): WatchSnapshot {
  const fits = (s: WatchSnapshot) => utf8Length(JSON.stringify(s)) <= maxBytes;
  if (fits(snapshot)) return snapshot;
  const cuts: ((s: WatchSnapshot) => WatchSnapshot)[] = [
    (s) => ({
      ...s,
      workout: s.workout && {
        ...s.workout,
        exercises: s.workout.exercises.map((e) => ({
          ...e,
          sets: e.sets.map((set) => (set.done ? { ...set, lastWeight: null, lastReps: null, lastDuration: null } : set)),
        })),
      },
    }),
    (s) => ({ ...s, templates: s.templates.map((t) => ({ ...t, exercises: t.exercises.slice(0, 3) })) }),
    // The newest are the ones a watch can still be waiting on.
    (s) => ({ ...s, applied: s.applied.slice(-100) }),
  ];
  let next = snapshot;
  for (const cut of cuts) {
    next = cut(next);
    if (fits(next)) return next;
  }
  while (next.templates.length > 0 && !fits(next)) next = { ...next, templates: next.templates.slice(0, -1) };
  return next;
}

// ── Ops from the watch ────────────────────────────────────────────────────────

interface OpBase {
  opId: string;
  /** When it happened on the watch, ms since epoch. */
  at: number;
}

/**
 * Which session an op is about: the phone's id once the watch has learned it,
 * and the watch's own start op id, which is all it has until then. Kind and
 * start time are the last resort, for a session the watch tracked before ever
 * hearing about it.
 */
interface CardioRef {
  workoutId: string | null;
  startOpId: string | null;
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
  | (OpBase & { kind: "endRest"; workoutId: string })
  /**
   * A session the watch is now tracking. Its opId is how the watch knows it
   * until the phone's id arrives. `fromPhone`: the phone woke the watch for it
   * (false: started on the watch; absent: a watch build from before it said).
   */
  | (OpBase & { kind: "startCardio"; session: CardioSessionKind; indoor: boolean; fromPhone?: boolean })
  | (OpBase & CardioRef & { kind: "pauseCardio" | "resumeCardio"; session?: CardioSessionKind; startedAt?: number })
  /**
   * A session ended, with what the watch measured. Complete on its own: if
   * the start never landed, this is enough to bring the whole session in.
   */
  | (OpBase &
      CardioRef & {
        kind: "finishCardio";
        session: CardioSessionKind;
        indoor: boolean;
        /** ms since epoch */
        startedAt: number;
        /** Seconds moving. */
        duration: number;
        /** Metres. */
        distance: number | null;
        activeCalories: number | null;
        avgHeartRate: number | null;
        maxHeartRate: number | null;
        /** The workout the watch saved to Apple Health. */
        healthId: string | null;
        /** Metres and moving seconds, alternating — see curveFromFlat. */
        curve: number[] | null;
      });

export type WatchCardioOp = Extract<WatchOp, { kind: "pauseCardio" | "resumeCardio" | "finishCardio" }>;

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
      const weight = finiteOrNull(op.weight, WEIGHT_RANGE.min, WEIGHT_RANGE.max);
      const reps = finiteOrNull(op.reps, REPS_RANGE.min, REPS_RANGE.max);
      const duration = finiteOrNull(op.duration, DURATION_RANGE.min, DURATION_RANGE.max);
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
    case "startCardio":
      if (!SESSION_KINDS.includes(op.session as CardioSessionKind) || typeof op.indoor !== "boolean") return null;
      return {
        ...base,
        kind: "startCardio",
        session: op.session as CardioSessionKind,
        indoor: op.indoor,
        ...(typeof op.fromPhone === "boolean" ? { fromPhone: op.fromPhone } : {}),
      };
    case "pauseCardio":
    case "resumeCardio": {
      // Kind and start help find a session the watch doesn't know the id of.
      const session = SESSION_KINDS.includes(op.session as CardioSessionKind) ? (op.session as CardioSessionKind) : undefined;
      const startedAt = typeof op.startedAt === "number" && Number.isFinite(op.startedAt) ? op.startedAt : undefined;
      const ref = cardioRef(op, session != null && startedAt != null);
      if (!ref) return null;
      return {
        ...base,
        ...ref,
        kind: op.kind,
        ...(session ? { session } : {}),
        ...(startedAt != null ? { startedAt } : {}),
      };
    }
    case "finishCardio": {
      if (!SESSION_KINDS.includes(op.session as CardioSessionKind) || typeof op.indoor !== "boolean") return null;
      if (typeof op.startedAt !== "number" || !Number.isFinite(op.startedAt)) return null;
      // A finish always says its kind and start, so it can be matched with no id at all.
      const ref = cardioRef(op, true);
      if (!ref) return null;
      const duration = finiteOrNull(op.duration, 0, 24 * 60 * 60);
      const distance = finiteOrNull(op.distance, 0, 1_000_000);
      const activeCalories = finiteOrNull(op.activeCalories, 0, 50_000);
      const avgHeartRate = finiteOrNull(op.avgHeartRate, 20, 260);
      const maxHeartRate = finiteOrNull(op.maxHeartRate, 20, 260);
      if (duration == null || distance === undefined || activeCalories === undefined) return null;
      // A heart rate out of range is a sensor glitch, not a reason to lose the run.
      const healthId = op.healthId == null ? null : isId(op.healthId) ? op.healthId : undefined;
      if (healthId === undefined) return null;
      const curve =
        Array.isArray(op.curve) && op.curve.length <= MAX_CURVE_POINTS * 2 && op.curve.every((n) => typeof n === "number")
          ? (op.curve as number[])
          : null;
      return {
        ...base,
        ...ref,
        kind: "finishCardio",
        session: op.session as CardioSessionKind,
        indoor: op.indoor,
        startedAt: op.startedAt,
        duration: Math.round(duration),
        distance,
        activeCalories,
        avgHeartRate: avgHeartRate ?? null,
        maxHeartRate: maxHeartRate ?? null,
        healthId,
        curve,
      };
    }
    default:
      return null;
  }
}

/** Null when the op gives no way at all to tell which session it means. */
function cardioRef(op: Record<string, unknown>, hasKindAndStart: boolean): CardioRef | null {
  const workoutId = isId(op.workoutId) ? op.workoutId : null;
  const startOpId = isId(op.startOpId) ? op.startOpId : null;
  return workoutId || startOpId || hasKindAndStart ? { workoutId, startOpId } : null;
}

/**
 * A tracked session's numbers, sent every few seconds while the phone is in
 * reach so its screen can show them too. Shown and thrown away; the session
 * itself is saved by finishCardio.
 */
export interface WatchLive {
  workoutId: string | null;
  startOpId: string | null;
  kind: CardioSessionKind;
  /** ms since epoch */
  startedAt: number;
  /** Seconds moving. */
  elapsed: number;
  /** Metres. */
  distance: number | null;
  heartRate: number | null;
  paused: boolean;
  /** When it was measured, ms since epoch. */
  at: number;
}

export function parseWatchLive(raw: unknown): WatchLive | null {
  if (!raw || typeof raw !== "object") return null;
  const live = raw as Record<string, unknown>;
  if (!SESSION_KINDS.includes(live.kind as CardioSessionKind)) return null;
  const elapsed = finiteOrNull(live.elapsed, 0, 24 * 60 * 60);
  const distance = finiteOrNull(live.distance, 0, 1_000_000);
  const heartRate = finiteOrNull(live.heartRate, 20, 260);
  if (elapsed == null || distance === undefined || typeof live.paused !== "boolean") return null;
  if (typeof live.at !== "number" || typeof live.startedAt !== "number") return null;
  return {
    workoutId: isId(live.workoutId) ? live.workoutId : null,
    startOpId: isId(live.startOpId) ? live.startOpId : null,
    kind: live.kind as CardioSessionKind,
    startedAt: live.startedAt,
    elapsed,
    distance,
    heartRate: heartRate ?? null,
    paused: live.paused,
    at: live.at,
  };
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
    // Distance too: the watch can't show it, so a cardio set it un-logs must
    // not keep a distance typed on the phone and look half-done.
    patch = {
      weight: undefined,
      reps: undefined,
      duration: undefined,
      distance: undefined,
      isCompleted: false,
      completedAt: undefined,
    };
  } else {
    const kind = watchSetKind(exercise);
    if (kind === "timed") {
      const seconds = op.duration != null && op.duration > 0 ? op.duration : undefined;
      // A distance typed on the phone still counts, as it does there.
      const done = cardioSetDone({ duration: seconds, distance: set.distance });
      patch = { duration: seconds, isCompleted: done, completedAt: done ? at : undefined };
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
                  isCompleted: cardioSetDone({ duration: seconds, distance: s.distance }),
                  completedAt: cardioSetDone({ duration: seconds, distance: s.distance }) ? new Date(now) : undefined,
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
