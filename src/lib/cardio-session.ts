import type { ComponentProps } from "react";
import type Ionicons from "@expo/vector-icons/Ionicons";

import { distanceKind } from "./cardio";
import { movingStretches } from "./phone-distance";
import { EXERCISES } from "./exercises";
import { newId } from "./workout-utils";
import type { CardioSessionKind, TrackedCardio, Workout, WorkoutSet } from "@/types";

/**
 * Cardio sessions: a run, a ride, a swim, started with Start cardio.
 *
 * Not a workout of exercises and sets, as far as anyone using the app can
 * tell — it has its own screen, a clock and an End button. Underneath it is
 * stored as one: a single exercise holding a single set, plus `cardio` saying
 * what kind of session it is. That's what lets History, Stats, the streak and
 * plato-web count it without any of them knowing sessions exist.
 */

type IconName = ComponentProps<typeof Ionicons>["name"];
export type Place = "outdoor" | "indoor";

interface KindInfo {
  kind: CardioSessionKind;
  label: string;
  /** What one of them is called in a sentence: "your last run", "your last 5 rides". */
  noun: { one: string; many: string };
  icon: IconName;
  /** Where it can happen, the usual one first. */
  places: Place[];
  /** The exercise and the name it's saved as, per place. */
  as: Partial<Record<Place, { exerciseId: string; name: string }>>;
}

/**
 * The sessions on offer. Names are the Workout app's, so a run you start here
 * reads the same in Plato, in Fitness and in Health.
 */
export const SESSION_KINDS: KindInfo[] = [
  {
    kind: "run",
    label: "Run",
    noun: { one: "run", many: "runs" },
    icon: "footsteps",
    places: ["outdoor", "indoor"],
    as: { outdoor: { exerciseId: "running", name: "Outdoor Run" }, indoor: { exerciseId: "treadmill", name: "Indoor Run" } },
  },
  {
    kind: "walk",
    label: "Walk",
    noun: { one: "walk", many: "walks" },
    icon: "walk",
    places: ["outdoor", "indoor"],
    as: { outdoor: { exerciseId: "walking", name: "Outdoor Walk" }, indoor: { exerciseId: "walking", name: "Indoor Walk" } },
  },
  {
    kind: "hike",
    label: "Hike",
    noun: { one: "hike", many: "hikes" },
    icon: "trail-sign",
    places: ["outdoor"],
    as: { outdoor: { exerciseId: "hiking", name: "Hike" } },
  },
  {
    kind: "bike",
    label: "Bike",
    noun: { one: "ride", many: "rides" },
    icon: "bicycle",
    places: ["outdoor", "indoor"],
    as: { outdoor: { exerciseId: "cycling", name: "Outdoor Cycle" }, indoor: { exerciseId: "cycling", name: "Indoor Cycle" } },
  },
  {
    kind: "swim",
    label: "Swim",
    noun: { one: "swim", many: "swims" },
    icon: "water",
    // A pool far more often than open water.
    places: ["indoor", "outdoor"],
    as: { indoor: { exerciseId: "swimming", name: "Pool Swim" }, outdoor: { exerciseId: "swimming", name: "Open Water Swim" } },
  },
  {
    kind: "row",
    label: "Row",
    noun: { one: "row", many: "rows" },
    icon: "boat",
    places: ["indoor"],
    as: { indoor: { exerciseId: "rowing", name: "Indoor Row" } },
  },
  {
    kind: "elliptical",
    label: "Elliptical",
    noun: { one: "elliptical session", many: "elliptical sessions" },
    icon: "infinite",
    places: ["indoor"],
    as: { indoor: { exerciseId: "elliptical", name: "Elliptical" } },
  },
  {
    kind: "stairs",
    label: "Stairs",
    noun: { one: "stair session", many: "stair sessions" },
    icon: "trending-up",
    places: ["indoor"],
    as: { indoor: { exerciseId: "stairmaster", name: "Stair Stepper" } },
  },
];

export function kindInfo(kind: CardioSessionKind): KindInfo {
  return SESSION_KINDS.find((k) => k.kind === kind) ?? SESSION_KINDS[0];
}

/** "Outdoor" and "Indoor", except in the water. */
export function placeLabel(kind: CardioSessionKind, place: Place): string {
  if (kind === "swim") return place === "indoor" ? "Pool" : "Open water";
  return place === "indoor" ? "Indoor" : "Outdoor";
}

/** The exercise and name a session of this kind and place is saved as. */
export function sessionTarget(kind: CardioSessionKind, indoor: boolean) {
  const info = kindInfo(kind);
  const place: Place = indoor ? "indoor" : "outdoor";
  const target = info.as[place] ?? info.as[info.places[0]]!;
  const exercise = EXERCISES.find((e) => e.id === target.exerciseId)!;
  return { name: target.name, exercise };
}

/** Whether the session covers ground — a stair stepper doesn't. */
export function sessionHasDistance(kind: CardioSessionKind, indoor: boolean): boolean {
  return distanceKind(sessionTarget(kind, indoor).exercise) != null;
}

/** A new session, started now. */
export function newCardioSession(
  kind: CardioSessionKind,
  indoor: boolean,
  options: { userId: string; weightUnit: "lbs" | "kg"; now: Date }
): Omit<Workout, "id"> {
  const { name, exercise } = sessionTarget(kind, indoor);
  return {
    userId: options.userId,
    name,
    isTemplate: false,
    createdAt: options.now,
    startedAt: options.now,
    cardio: { kind, indoor },
    exercises: [
      {
        id: newId(),
        exerciseId: exercise.id,
        exercise,
        orderIndex: 0,
        sets: [{ id: newId(), weightUnit: options.weightUnit, isCompleted: false }],
      },
    ],
  };
}

/**
 * A session, as opposed to a workout that happens to hold cardio. Also true
 * of a run brought in from Apple Health by build 65's import, which predates
 * the `cardio` field but is exactly one recorded set.
 */
export function isCardioSession(workout: Workout): boolean {
  if (workout.isTemplate) return false;
  if (workout.cardio) return true;
  return (
    workout.exercises.length === 1 && workout.exercises[0].sets.length === 1 && !!workout.exercises[0].sets[0].tracked
  );
}

/**
 * The glyph a session goes by in lists — a shoe, a bike — so a run reads as
 * a run next to a lifting day without a label saying so. Workouts get none:
 * the glyph's being there is what tells them apart. A build-65 import, with
 * no kind stored, goes by its exercise.
 */
export function sessionIcon(workout: Workout): IconName | null {
  if (!isCardioSession(workout)) return null;
  if (workout.cardio) return kindInfo(workout.cardio.kind).icon;
  const id = workout.exercises[0]?.exerciseId;
  return SESSION_KINDS.find((k) => Object.values(k.as).some((target) => target?.exerciseId === id))?.icon ?? "pulse";
}

/** The session's one set: where its time and distance live. */
export function sessionSet(workout: Workout): WorkoutSet | undefined {
  return workout.exercises[0]?.sets[0];
}

/**
 * Seconds moving: since it started, less every pause, including one still
 * going. Read from the stored times rather than counted, so it carries on
 * correctly however long the app was closed.
 */
export function movingSeconds(workout: Workout, nowMs: number): number {
  const started = workout.startedAt?.getTime() ?? nowMs;
  const pausedMs =
    (workout.cardio?.pausedSeconds ?? 0) * 1000 +
    (workout.cardio?.pausedAtMs != null ? Math.max(0, nowMs - workout.cardio.pausedAtMs) : 0);
  return Math.max(0, Math.floor((nowMs - started - pausedMs) / 1000));
}

/**
 * Seconds moving from the start up to `untilMs`, less the pauses kept in
 * that time: how long the phone had the session before a watch took over at
 * `untilMs`. Zero for a watch that started it.
 */
export function movingSecondsUntil(workout: Workout, untilMs: number): number {
  const start = workout.startedAt?.getTime();
  if (start == null || untilMs <= start) return 0;
  const ms = movingStretches(start, untilMs, workout.cardio?.pauses).reduce((sum, s) => sum + (s.toMs - s.fromMs), 0);
  return Math.round(ms / 1000);
}

export function isPaused(workout: Workout): boolean {
  return workout.cardio?.pausedAtMs != null;
}

/** The `cardio` field after pausing. */
export function paused(workout: Workout, nowMs: number): Workout["cardio"] {
  if (!workout.cardio || isPaused(workout)) return workout.cardio;
  return { ...workout.cardio, pausedAtMs: nowMs };
}

/** The `cardio` field after resuming: the pause banked, the clock running. */
export function resumed(workout: Workout, nowMs: number): Workout["cardio"] {
  const cardio = workout.cardio;
  if (!cardio || cardio.pausedAtMs == null) return cardio;
  const { pausedAtMs, ...rest } = cardio;
  const toMs = Math.max(pausedAtMs, nowMs);
  return {
    ...rest,
    pausedSeconds: (cardio.pausedSeconds ?? 0) + (toMs - pausedAtMs) / 1000,
    pauses: [...(cardio.pauses ?? []), { fromMs: pausedAtMs, toMs }],
  };
}

/**
 * What ending a session writes: its set filled in with the moving time and,
 * if given, how far — and what measured it, when something did — and the
 * workout marked finished. A pause still on is banked first, so a run ended
 * while paused doesn't count the pause.
 */
export function finishedSession(
  workout: Workout,
  options: { distance?: number; tracked?: TrackedCardio; nowMs: number }
): Pick<Workout, "exercises" | "completedAt" | "durationMinutes" | "totalVolume" | "cardio"> {
  const seconds = movingSeconds(workout, options.nowMs);
  const completedAt = new Date(options.nowMs);
  const cardio = resumed(workout, options.nowMs);
  const exercises = workout.exercises.map((ex, i) =>
    i !== 0
      ? ex
      : {
          ...ex,
          sets: ex.sets.map((set, j) =>
            j !== 0
              ? set
              : {
                  ...set,
                  duration: seconds > 0 ? seconds : set.duration,
                  distance: options.distance ?? set.distance,
                  tracked: options.tracked ?? set.tracked,
                  isCompleted: true,
                  completedAt,
                }
          ),
        }
  );
  return {
    exercises,
    completedAt,
    durationMinutes: Math.max(1, Math.round(seconds / 60)),
    totalVolume: 0,
    cardio,
  };
}

/**
 * A finished session from start to end: when, and how much of it was
 * paused. The phone keeps its own pauses; for one the watch timed, the pause
 * is whatever the elapsed time has over the moving time. A few seconds of
 * difference is the two clocks, not a pause.
 */
export function sessionSpan(workout: Workout): { start: Date; end: Date; moving: number; paused: number } | null {
  const start = workout.startedAt;
  const end = workout.completedAt;
  if (!start || !end || end.getTime() <= start.getTime()) return null;
  const moving = sessionSet(workout)?.duration ?? 0;
  const elapsed = (end.getTime() - start.getTime()) / 1000;
  const paused = workout.cardio?.pausedSeconds ?? Math.max(0, elapsed - moving);
  return { start, end, moving, paused: paused < 5 ? 0 : Math.round(paused) };
}

/** How the finished screen's trend measures sessions. */
export type SessionMeasure = "distance" | "time";

/**
 * This session and the ones of its kind before it, oldest first, for the
 * finished screen's trend: the last few, each measured the way this one can
 * be. A run with a distance is set against the runs that have one, in
 * metres; a stair session, or a run nobody gave a distance, against the
 * moving times, in seconds. Fewer than two and there's no trend to draw.
 *
 * `completed` may not hold this session yet — it's just been finished, ahead
 * of the store — so it's added here, as it is on screen.
 */
export function recentOfKind(
  completed: Workout[],
  workout: Workout,
  limit = 8
): { measure: SessionMeasure; values: number[] } | null {
  const kind = workout.cardio?.kind;
  const end = workout.completedAt?.getTime();
  if (!kind || end == null) return null;
  const measure: SessionMeasure = sessionSet(workout)?.distance ? "distance" : "time";
  const value = (w: Workout) => {
    const set = sessionSet(w);
    return measure === "distance" ? set?.distance : set?.duration;
  };
  if (!value(workout)) return null;
  const before = completed
    .filter((w) => w.id !== workout.id && w.cardio?.kind === kind && w.completedAt && w.completedAt.getTime() <= end)
    .sort((a, b) => a.completedAt!.getTime() - b.completedAt!.getTime());
  const values = [...before, workout]
    .map(value)
    .filter((v): v is number => v != null && v > 0)
    .slice(-limit);
  return values.length >= 2 ? { measure, values } : null;
}
