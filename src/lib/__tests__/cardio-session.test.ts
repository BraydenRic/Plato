import {
  finishedSession,
  isCardioSession,
  isPaused,
  movingSeconds,
  movingSecondsUntil,
  newCardioSession,
  paused,
  placeLabel,
  recentOfKind,
  resumed,
  sessionHasDistance,
  sessionIcon,
  sessionSpan,
  sessionTarget,
} from "../cardio-session";
import type { CardioSessionKind, Workout, WorkoutSet } from "@/types";
import { makeSet, makeWorkout, makeWorkoutExercise } from "./factories";

const T0 = Date.UTC(2026, 9, 25, 7, 0, 0);
const options = { userId: "u1", weightUnit: "lbs" as const, now: new Date(T0) };

describe("what a session is saved as", () => {
  it("names it as the Workout app does, with the matching exercise", () => {
    expect(sessionTarget("run", false)).toMatchObject({ name: "Outdoor Run", exercise: { id: "running" } });
    expect(sessionTarget("run", true)).toMatchObject({ name: "Indoor Run", exercise: { id: "treadmill" } });
    expect(sessionTarget("bike", true)).toMatchObject({ name: "Indoor Cycle", exercise: { id: "cycling" } });
    expect(sessionTarget("swim", true)).toMatchObject({ name: "Pool Swim", exercise: { id: "swimming" } });
    expect(sessionTarget("stairs", true)).toMatchObject({ name: "Stair Stepper", exercise: { id: "stairmaster" } });
  });

  // A rower has no outdoor version to fall back to; asking for one gets the
  // only one there is rather than nothing.
  it("falls back to the place a kind does happen in", () => {
    expect(sessionTarget("row", false)).toMatchObject({ name: "Indoor Row", exercise: { id: "rowing" } });
  });

  it("calls the places what they are in the water", () => {
    expect(placeLabel("swim", "indoor")).toBe("Pool");
    expect(placeLabel("swim", "outdoor")).toBe("Open water");
    expect(placeLabel("run", "indoor")).toBe("Indoor");
  });

  it("knows a stair stepper covers no ground", () => {
    expect(sessionHasDistance("run", false)).toBe(true);
    expect(sessionHasDistance("row", true)).toBe(true);
    expect(sessionHasDistance("stairs", true)).toBe(false);
  });

  it("starts as one exercise with one empty set, marked as a session", () => {
    const w = newCardioSession("run", false, options);
    expect(w).toMatchObject({ name: "Outdoor Run", isTemplate: false, startedAt: new Date(T0), cardio: { kind: "run", indoor: false } });
    expect(w.exercises).toHaveLength(1);
    expect(w.exercises[0].sets).toEqual([expect.objectContaining({ isCompleted: false, weightUnit: "lbs" })]);
    expect(isCardioSession({ ...w, id: "x" })).toBe(true);
  });

  it("tells a session from a workout that happens to hold cardio", () => {
    const legDay = makeWorkout({ exercises: [makeWorkoutExercise("squat", [makeSet()]), makeWorkoutExercise("cycling", [makeSet()])] });
    expect(isCardioSession(legDay)).toBe(false);
    // A run brought in by build 65's Health import: no `cardio` field, but
    // exactly one set the watch recorded.
    const imported = makeWorkout({ exercises: [makeWorkoutExercise("running", [makeSet({ tracked: { healthId: "H" } })])] });
    expect(isCardioSession(imported)).toBe(true);
  });
});

describe("the clock", () => {
  const session = () => ({ ...newCardioSession("run", false, options), id: "s" });

  it("counts from the start", () => {
    expect(movingSeconds(session(), T0 + 125_000)).toBe(125);
  });

  it("stops while paused, and leaves the pause out once resumed", () => {
    let w = session();
    w = { ...w, cardio: paused(w, T0 + 60_000) };
    expect(isPaused(w)).toBe(true);
    expect(movingSeconds(w, T0 + 90_000)).toBe(60);
    w = { ...w, cardio: resumed(w, T0 + 100_000) };
    expect(isPaused(w)).toBe(false);
    expect(w.cardio).toEqual({ kind: "run", indoor: false, pausedSeconds: 40, pauses: [{ fromMs: T0 + 60_000, toMs: T0 + 100_000 }] });
    expect(movingSeconds(w, T0 + 160_000)).toBe(120);
  });

  it("adds up more than one pause", () => {
    let w = session();
    w = { ...w, cardio: paused(w, T0 + 10_000) };
    w = { ...w, cardio: resumed(w, T0 + 20_000) };
    w = { ...w, cardio: paused(w, T0 + 30_000) };
    w = { ...w, cardio: resumed(w, T0 + 45_000) };
    expect(movingSeconds(w, T0 + 60_000)).toBe(35);
    // Each kept, for the step counter to be asked around.
    expect(w.cardio?.pauses).toEqual([
      { fromMs: T0 + 10_000, toMs: T0 + 20_000 },
      { fromMs: T0 + 30_000, toMs: T0 + 45_000 },
    ]);
  });

  it("ignores a second pause while paused, and a resume while running", () => {
    let w = session();
    w = { ...w, cardio: paused(w, T0 + 10_000) };
    expect(paused(w, T0 + 20_000)).toEqual(w.cardio);
    const running = session();
    expect(resumed(running, T0 + 20_000)).toEqual(running.cardio);
  });
});

describe("ending a session", () => {
  it("fills the set with the moving time and the distance given, and finishes it", () => {
    const w = { ...newCardioSession("run", false, options), id: "s" };
    const done = finishedSession(w, { distance: 5000, nowMs: T0 + 1500_000 });
    expect(done.completedAt).toEqual(new Date(T0 + 1500_000));
    expect(done.durationMinutes).toBe(25);
    expect(done.totalVolume).toBe(0);
    expect(done.exercises[0].sets[0]).toMatchObject({ duration: 1500, distance: 5000, isCompleted: true });
  });

  // Ended while paused: the pause is banked, not counted as running.
  it("banks a pause that's still on", () => {
    let w = { ...newCardioSession("walk", false, options), id: "s" };
    w = { ...w, cardio: paused(w, T0 + 600_000) };
    const done = finishedSession(w, { nowMs: T0 + 900_000 });
    expect(done.exercises[0].sets[0].duration).toBe(600);
    expect(done.cardio).toEqual({ kind: "walk", indoor: false, pausedSeconds: 300, pauses: [{ fromMs: T0 + 600_000, toMs: T0 + 900_000 }] });
  });

  it("finishes without a distance when none is given", () => {
    const w = { ...newCardioSession("stairs", true, options), id: "s" };
    const set = finishedSession(w, { nowMs: T0 + 600_000 }).exercises[0].sets[0];
    expect(set.distance).toBeUndefined();
    expect(set.isCompleted).toBe(true);
  });
});

/** A finished session of `kind`, `minutes` long, ending `day` days before T0. */
function finished(kind: CardioSessionKind, day: number, set: Partial<WorkoutSet>, cardio: Partial<Workout["cardio"]> = {}): Workout {
  const start = T0 - day * 86_400_000;
  return makeWorkout({
    id: `${kind}-${day}`,
    startedAt: new Date(start),
    completedAt: new Date(start + 1800_000),
    cardio: { kind, ...cardio },
    exercises: [makeWorkoutExercise("running", [makeSet({ weight: undefined, reps: undefined, duration: 1500, ...set })])],
  });
}

describe("a session from start to end", () => {
  it("uses the pauses the phone kept", () => {
    expect(sessionSpan(finished("run", 0, {}, { pausedSeconds: 240 }))).toMatchObject({ moving: 1500, paused: 240 });
  });

  // The watch keeps its own pauses; the phone only sees the two times.
  it("takes a watch-timed session's pause from the elapsed time", () => {
    expect(sessionSpan(finished("run", 0, {}))).toMatchObject({ moving: 1500, paused: 300 });
  });

  it("reads a few seconds between the clocks as no pause", () => {
    expect(sessionSpan(finished("run", 0, { duration: 1797 }))?.paused).toBe(0);
    expect(sessionSpan(finished("run", 0, { duration: 1850 }))?.paused).toBe(0);
  });

  it("has nothing to show without both ends", () => {
    expect(sessionSpan({ ...finished("run", 0, {}), startedAt: undefined })).toBeNull();
  });
});

describe("the last few of a kind", () => {
  it("measures by distance when this one has one, skipping those that don't, oldest first", () => {
    const now = finished("run", 0, { distance: 5000 });
    const before = [finished("run", 2, { distance: 4000 }), finished("run", 3, {}), finished("run", 5, { distance: 3000 })];
    expect(recentOfKind(before, now)).toEqual({ measure: "distance", values: [3000, 4000, 5000] });
  });

  it("measures by moving time when this one has no distance", () => {
    const now = finished("run", 0, { duration: 1500 });
    expect(recentOfKind([finished("run", 2, { duration: 1200, distance: 4000 })], now)).toEqual({ measure: "time", values: [1200, 1500] });
  });

  // Seen from History, a run from last week is set against the ones before
  // it, not the ones since.
  it("leaves out other kinds and anything after this one", () => {
    const now = finished("run", 3, { duration: 1500 });
    const others = [finished("walk", 4, { duration: 900 }), finished("run", 1, { duration: 2000 }), finished("run", 5, { duration: 1000 })];
    expect(recentOfKind(others, now)?.values).toEqual([1000, 1500]);
  });

  it("counts this one once, even when the store already has it", () => {
    const now = finished("run", 0, { duration: 1500 });
    expect(recentOfKind([now, finished("run", 1, { duration: 1000 })], now)?.values).toEqual([1000, 1500]);
  });

  it("keeps the most recent few", () => {
    const now = finished("run", 0, { duration: 2000 });
    const before = Array.from({ length: 10 }, (_, i) => finished("run", i + 1, { duration: 1000 + i }));
    const values = recentOfKind(before, now, 4)!.values;
    expect(values).toEqual([1002, 1001, 1000, 2000]);
  });

  it("has no trend for the first of a kind", () => {
    expect(recentOfKind([finished("walk", 1, { duration: 900 })], finished("run", 0, {}))).toBeNull();
  });
});

describe("a session's glyph", () => {
  it("is its kind's", () => {
    expect(sessionIcon(finished("swim", 0, {}))).toBe("water");
  });

  it("goes by the exercise for an import with no kind stored", () => {
    const imported = { ...finished("run", 0, { tracked: { healthId: "H" } }), cardio: undefined };
    expect(sessionIcon(imported)).toBe("footsteps");
  });

  it("is none for a workout", () => {
    expect(sessionIcon(makeWorkout({ exercises: [makeWorkoutExercise("bench-press", [makeSet()])] }))).toBeNull();
  });
});

describe("the phone's time before a watch took over", () => {
  it("is the moving time up to the takeover, pauses left out", () => {
    const run = finished("run", 0, {}, { pausedSeconds: 30, pauses: [{ fromMs: T0 + 20_000, toMs: T0 + 50_000 }] });
    expect(movingSecondsUntil(run, T0 + 120_000)).toBe(90);
  });

  it("is nothing for a session the watch started", () => {
    expect(movingSecondsUntil(finished("run", 0, {}), T0)).toBe(0);
    expect(movingSecondsUntil(finished("run", 0, {}), T0 - 5000)).toBe(0);
  });

  // Paused on the phone 10 s in while the watch was waking, and the watch
  // took over at 90 s: the phone had it moving for 10 s, not 90.
  it("leaves out a pause still on when the watch took over", () => {
    const run = finished("run", 0, {}, { pausedAtMs: T0 + 10_000 });
    expect(movingSecondsUntil(run, T0 + 90_000)).toBe(10);
  });
});
