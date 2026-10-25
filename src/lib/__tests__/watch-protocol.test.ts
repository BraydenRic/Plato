import snapshotFixture from "./fixtures/watch-snapshot.json";
import opsFixture from "./fixtures/watch-ops.json";
import {
  applySetOp,
  bankRunningTimer,
  buildWatchSnapshot,
  displayWeight,
  endedCardioIds,
  finishedFields,
  opTime,
  parseWatchLive,
  parseWatchOp,
  SNAPSHOT_APPLIED_LIMIT,
  type WatchOp,
  type WatchSetOp,
} from "../watch-protocol";
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from "@/types";

/**
 * The contract with the Apple Watch app.
 *
 * Nothing here can be seen working without a watch on a wrist, and the two
 * ways it goes wrong are both quiet: a set logged on the watch that lands on
 * the phone subtly different from one typed there (a bodyweight load in the
 * wrong unit, a set marked done that the phone would call partial), or a
 * snapshot field renamed on one side only, which the watch's decoder drops
 * without a word.
 *
 * The fixtures pin the second one from both ends: watch-snapshot.json is what
 * this file builds, and the watch's Swift models are checked against that same
 * file; watch-ops.json was encoded by the Swift side and must parse here.
 */

// UTC, so the fixture's timestamps are the same in every timezone.
const START = new Date(Date.UTC(2026, 9, 23, 18, 0, 0));
const NOW = START.getTime() + 30 * 60_000;

function exercise(id: string, name: string, extra: Partial<Exercise> = {}): Exercise {
  return { id, name, category: "Chest", musclesWorked: [], description: "", ...extra };
}

function set(id: string, patch: Partial<WorkoutSet> = {}): WorkoutSet {
  return { id, weightUnit: "lbs", isCompleted: false, ...patch };
}

function workoutExercise(id: string, ex: Exercise, sets: WorkoutSet[]): WorkoutExercise {
  return { id, exerciseId: ex.id, exercise: ex, orderIndex: 0, sets };
}

const bench = exercise("bench-press", "Bench Press");
const pullUp = exercise("pull-up", "Pull-Up", { category: "Back" });
const plank = exercise("plank", "Plank", { category: "Core" });

function liveWorkout(): Workout {
  return {
    id: "w-live",
    userId: "u1",
    name: "Push Day",
    isTemplate: false,
    createdAt: START,
    startedAt: START,
    exercises: [
      workoutExercise("we-bench", bench, [
        set("s1", { weight: 185, reps: 5, isCompleted: true, completedAt: START }),
        set("s2", { weight: 80, weightUnit: "kg" }),
        set("s3"),
      ]),
      workoutExercise("we-pull", pullUp, [set("p1", { weightUnit: "bodyweight", weight: 0 }), set("p2")]),
      workoutExercise("we-plank", plank, [set("k1", { duration: 45, isCompleted: true })]),
    ],
  };
}

function lastSession(): Workout {
  return {
    id: "w-last",
    userId: "u1",
    name: "Push Day",
    isTemplate: false,
    createdAt: new Date(START.getTime() - 7 * 86_400_000),
    startedAt: new Date(START.getTime() - 7 * 86_400_000),
    completedAt: new Date(START.getTime() - 7 * 86_400_000 + 3_600_000),
    exercises: [
      workoutExercise("we-old-bench", bench, [
        set("o1", { weight: 180, reps: 5, isCompleted: true }),
        set("o2", { weight: 180, reps: 4, isCompleted: true }),
      ]),
      workoutExercise("we-old-pull", pullUp, [
        set("o3", { weightUnit: "bodyweight", weight: 25, reps: 8, isCompleted: true }),
      ]),
    ],
  };
}

function template(): Workout {
  return {
    id: "t-push",
    userId: "u1",
    name: "Push Day",
    isTemplate: true,
    createdAt: START,
    exercises: [
      workoutExercise("tb", bench, [set("t1"), set("t2"), set("t3")]),
      workoutExercise("tp", pullUp, [set("t4")]),
    ],
  };
}

function snapshot(overrides: Partial<Parameters<typeof buildWatchSnapshot>[0]> = {}) {
  return buildWatchSnapshot({
    signedIn: true,
    workout: liveWorkout(),
    templates: [template()],
    completed: [lastSession()],
    unit: "lbs",
    restSeconds: 90,
    rest: { workoutId: "w-live", endsAt: NOW + 60_000 },
    accent: "#8b5cf6",
    onAccent: "#ffffff",
    applied: ["op-1", "op-2"],
    now: NOW,
    ...overrides,
  });
}

describe("buildWatchSnapshot", () => {
  it("matches the fixture the watch's models are checked against", () => {
    expect(JSON.parse(JSON.stringify(snapshot()))).toEqual(snapshotFixture);
  });

  it("carries nothing of the account once signed out", () => {
    const out = snapshot({ signedIn: false });
    expect(out.account).toBe("none");
    expect(out.workout).toBeNull();
    expect(out.templates).toEqual([]);
    expect(out.restEndsAt).toBeNull();
  });

  it("tells each set how it's logged", () => {
    const kinds = snapshot().workout!.exercises.map((e) => e.kind);
    expect(kinds).toEqual(["weight", "bodyweight", "timed"]);
  });

  it("shows weights in the current unit, like the phone's set rows", () => {
    const sets = snapshot().workout!.exercises[0].sets;
    expect(sets[1].weight).toBe(176.4); // 80 kg
    const inKg = snapshot({ unit: "kg" }).workout!.exercises[0].sets;
    expect(inKg[0].weight).toBe(83.9); // 185 lbs
  });

  it("sends whole numbers where the watch expects them", () => {
    const workout = liveWorkout();
    workout.exercises[0].sets[1] = set("s2", { reps: 7.6, duration: 30.4 });
    const [, s2] = snapshot({ workout, restSeconds: 89.7 }).workout!.exercises[0].sets;
    expect([s2.reps, s2.duration]).toEqual([8, 30]);
    expect(snapshot({ restSeconds: 89.7 }).restSeconds).toBe(90);
  });

  it("leaves plain bodyweight as null so the watch can say BW", () => {
    expect(snapshot().workout!.exercises[1].sets[0].weight).toBeNull();
  });

  it("brings last session's numbers by set position", () => {
    const [benchSets, pullSets] = snapshot().workout!.exercises.map((e) => e.sets);
    expect(benchSets.map((s) => [s.lastWeight, s.lastReps])).toEqual([
      [180, 5],
      [180, 4],
      [null, null],
    ]);
    expect(pullSets[0].lastWeight).toBe(25);
  });

  it("only passes on a rest that belongs to this workout", () => {
    expect(snapshot().restEndsAt).toBe(NOW + 60_000);
    expect(snapshot({ rest: { workoutId: "w-other", endsAt: NOW + 60_000 } }).restEndsAt).toBeNull();
  });

  it("keeps only the most recent applied ids", () => {
    const applied = Array.from({ length: SNAPSHOT_APPLIED_LIMIT + 20 }, (_, i) => `op-${i}`);
    const out = snapshot({ applied });
    expect(out.applied).toHaveLength(SNAPSHOT_APPLIED_LIMIT);
    expect(out.applied[out.applied.length - 1]).toBe(`op-${SNAPSHOT_APPLIED_LIMIT + 19}`);
  });

  it("previews long templates without sending the whole thing", () => {
    const long: Workout = {
      ...template(),
      exercises: Array.from({ length: 15 }, (_, i) => workoutExercise(`x${i}`, bench, [set(`xs${i}`)])),
    };
    const [preview] = snapshot({ templates: [long] }).templates;
    expect(preview.exercises).toHaveLength(12);
    expect(preview.exerciseCount).toBe(15);
    expect(preview.setCount).toBe(15);
  });
});

describe("displayWeight", () => {
  it("converts a bodyweight set's added load from lbs", () => {
    expect(displayWeight(set("a", { weightUnit: "bodyweight", weight: 22.0462 }), "kg")).toBe(10);
  });

  it("is null for a set with no weight", () => {
    expect(displayWeight(set("a"), "lbs")).toBeNull();
    expect(displayWeight(undefined, "lbs")).toBeNull();
  });
});

describe("parseWatchOp", () => {
  const logSet = {
    opId: "op-9",
    kind: "logSet",
    at: NOW,
    workoutId: "w-live",
    exerciseId: "we-bench",
    setId: "s2",
    weight: 185,
    reps: 5,
    unit: "lbs",
  };

  it("accepts every op the watch's encoder produced", () => {
    for (const op of opsFixture) {
      expect(parseWatchOp(op)).not.toBeNull();
    }
  });

  it("reads a logged set, with absent fields as null", () => {
    expect(parseWatchOp(logSet)).toEqual({ ...logSet, duration: null });
  });

  it("rounds reps and seconds to whole numbers", () => {
    expect(parseWatchOp({ ...logSet, reps: 4.6 })).toMatchObject({ reps: 5 });
  });

  it.each([
    ["an unknown kind", { ...logSet, kind: "deleteEverything" }],
    ["a missing set id", { ...logSet, setId: undefined }],
    ["an id that is far too long", { ...logSet, opId: "x".repeat(500) }],
    ["a unit it doesn't know", { ...logSet, unit: "stone" }],
    ["a weight that isn't a number", { ...logSet, weight: "185" }],
    ["an impossible rep count", { ...logSet, reps: -1 }],
    ["no timestamp", { ...logSet, at: undefined }],
    ["a rest extension of nothing", { opId: "o", kind: "extendRest", at: NOW, workoutId: "w" }],
    ["something that isn't an object", "logSet"],
  ])("refuses %s", (_label, raw) => {
    expect(parseWatchOp(raw)).toBeNull();
  });
});

describe("opTime", () => {
  it("keeps the watch's time when it's sensible", () => {
    expect(opTime(NOW - 5000, NOW, START.getTime())).toBe(NOW - 5000);
  });

  it("never puts a set before its workout started or after now", () => {
    expect(opTime(START.getTime() - 60_000, NOW, START.getTime())).toBe(START.getTime());
    expect(opTime(NOW + 60_000, NOW, START.getTime())).toBe(NOW);
  });
});

describe("applySetOp", () => {
  const options = { unit: "lbs" as const, now: NOW };

  function log(patch: Partial<Extract<WatchOp, { kind: "logSet" }>>): WatchSetOp {
    return {
      opId: "op",
      kind: "logSet",
      at: NOW - 1000,
      workoutId: "w-live",
      exerciseId: "we-bench",
      setId: "s3",
      weight: 185,
      reps: 5,
      duration: null,
      unit: "lbs",
      ...patch,
    };
  }

  function setAfter(result: ReturnType<typeof applySetOp>, exerciseId: string, setId: string) {
    return result!.exercises.find((e) => e.id === exerciseId)!.sets.find((s) => s.id === setId)!;
  }

  it("logs a weighted set the way the phone's set row would", () => {
    const result = applySetOp(liveWorkout(), log({}), options);
    expect(setAfter(result, "we-bench", "s3")).toEqual({
      id: "s3",
      weight: 185,
      weightUnit: "lbs",
      reps: 5,
      isCompleted: true,
      completedAt: new Date(NOW - 1000),
    });
    expect(result!.completedNow).toBe(true);
  });

  it("stores the unit the watch was showing", () => {
    const result = applySetOp(liveWorkout(), log({ weight: 82.5, unit: "kg" }), options);
    expect(setAfter(result, "we-bench", "s3")).toMatchObject({ weight: 82.5, weightUnit: "kg" });
  });

  it("calls a set with no reps partial, not done", () => {
    const result = applySetOp(liveWorkout(), log({ reps: 0 }), options);
    expect(setAfter(result, "we-bench", "s3").isCompleted).toBe(false);
    expect(result!.completedNow).toBe(false);
  });

  it("doesn't count editing a done set as finishing one", () => {
    const result = applySetOp(liveWorkout(), log({ setId: "s1", reps: 6 }), options);
    expect(setAfter(result, "we-bench", "s1")).toMatchObject({ reps: 6, isCompleted: true });
    expect(result!.completedNow).toBe(false);
  });

  it("banks a bodyweight set's added load in lbs and calls it done on reps", () => {
    const result = applySetOp(
      liveWorkout(),
      log({ exerciseId: "we-pull", setId: "p2", weight: 10, reps: 8, unit: "kg" }),
      options
    );
    expect(setAfter(result, "we-pull", "p2")).toMatchObject({
      weight: 22,
      weightUnit: "bodyweight",
      reps: 8,
      isCompleted: true,
    });
  });

  it("logs a timed set by its duration", () => {
    const workout = liveWorkout();
    workout.exercises[2].sets.push(set("k2"));
    const result = applySetOp(
      workout,
      log({ exerciseId: "we-plank", setId: "k2", weight: null, reps: null, duration: 60 }),
      options
    );
    expect(setAfter(result, "we-plank", "k2")).toMatchObject({ duration: 60, isCompleted: true });
  });

  it("clears a set back to untouched", () => {
    const result = applySetOp(
      liveWorkout(),
      { opId: "op", kind: "undoSet", at: NOW, workoutId: "w-live", exerciseId: "we-bench", setId: "s1" },
      options
    );
    const cleared = setAfter(result, "we-bench", "s1");
    expect(cleared.isCompleted).toBe(false);
    expect(cleared.weight ?? cleared.reps ?? cleared.completedAt).toBeUndefined();
  });

  it("adds a set under the id the watch chose, once", () => {
    const add: WatchSetOp = { opId: "op", kind: "addSet", at: NOW, workoutId: "w-live", exerciseId: "we-bench", setId: "new" };
    const result = applySetOp(liveWorkout(), add, options);
    expect(setAfter(result, "we-bench", "new")).toEqual({ id: "new", weightUnit: "lbs", isCompleted: false });

    const again = { ...liveWorkout(), exercises: result!.exercises };
    expect(applySetOp(again, add, options)).toBeNull();
  });

  it("does nothing for an exercise or set that's gone", () => {
    expect(applySetOp(liveWorkout(), log({ exerciseId: "nope" }), options)).toBeNull();
    expect(applySetOp(liveWorkout(), log({ setId: "nope" }), options)).toBeNull();
  });

  it("never dates a set before its workout started", () => {
    const result = applySetOp(liveWorkout(), log({ at: START.getTime() - 3_600_000 }), options);
    expect(setAfter(result, "we-bench", "s3").completedAt).toEqual(START);
  });
});

describe("cardio from the watch", () => {
  const running = exercise("running", "Running", { category: "Cardio" });
  const options = { unit: "lbs" as const, now: NOW };

  function withRun(runSet: WorkoutSet): Workout {
    const workout = liveWorkout();
    workout.exercises.push(workoutExercise("we-run", running, [runSet]));
    return workout;
  }

  const at = (result: ReturnType<typeof applySetOp>) => result!.exercises.find((e) => e.id === "we-run")!.sets[0];

  // The watch has no distance field; a set the phone counts done by its
  // distance must not be undone by the watch logging no time.
  it("keeps a set done by its distance when the watch logs no time", () => {
    const op: WatchSetOp = {
      opId: "op",
      kind: "logSet",
      at: NOW - 1000,
      workoutId: "w-live",
      exerciseId: "we-run",
      setId: "r1",
      weight: null,
      reps: null,
      duration: 0,
      unit: "lbs",
    };
    expect(at(applySetOp(withRun(set("r1", { distance: 5000, isCompleted: true })), op, options))).toMatchObject({
      distance: 5000,
      isCompleted: true,
    });
  });

  it("clears the distance with everything else when the watch un-logs the set", () => {
    const op: WatchSetOp = { opId: "op", kind: "undoSet", at: NOW, workoutId: "w-live", exerciseId: "we-run", setId: "r1" };
    const after = at(applySetOp(withRun(set("r1", { distance: 5000, duration: 1500, isCompleted: true })), op, options));
    expect(after.distance).toBeUndefined();
    expect(after.isCompleted).toBe(false);
  });

  it("keeps a set with a distance done when a stopwatch banked on it reads zero", () => {
    const workout = withRun(set("r1", { distance: 5000, isCompleted: true }));
    const banked = bankRunningTimer(workout.exercises, { exerciseId: "we-run", setId: "r1", startedAt: NOW }, NOW);
    expect(banked.find((e) => e.id === "we-run")!.sets[0]).toMatchObject({ distance: 5000, isCompleted: true });
  });
});

describe("finishing from the watch", () => {
  it("writes the workout screen's finish fields", () => {
    const workout = liveWorkout();
    const fields = finishedFields(workout, workout.exercises, new Date(NOW), undefined);
    expect(fields.completedAt).toEqual(new Date(NOW));
    expect(fields.durationMinutes).toBe(30);
    expect(fields.totalVolume).toBe(185 * 5);
  });

  it("never records a workout shorter than a minute", () => {
    const workout = liveWorkout();
    expect(finishedFields(workout, workout.exercises, START, undefined).durationMinutes).toBe(1);
  });

  it("banks a stopwatch still running on the phone", () => {
    const workout = liveWorkout();
    workout.exercises[2].sets.push(set("k2"));
    const banked = bankRunningTimer(
      workout.exercises,
      { exerciseId: "we-plank", setId: "k2", startedAt: NOW - 50_000 },
      NOW
    );
    expect(banked[2].sets[1]).toMatchObject({ duration: 50, isCompleted: true });
  });
});

describe("cardio ops from the watch", () => {
  const base = { opId: "op-1", at: NOW };

  it("reads a start, a pause and a finish", () => {
    expect(parseWatchOp({ ...base, kind: "startCardio", session: "run", indoor: false })).toEqual({
      ...base,
      kind: "startCardio",
      session: "run",
      indoor: false,
    });
    expect(parseWatchOp({ ...base, kind: "pauseCardio", workoutId: null, startOpId: "s-1", session: "run", startedAt: NOW - 1000 })).toEqual({
      ...base,
      kind: "pauseCardio",
      workoutId: null,
      startOpId: "s-1",
      session: "run",
      startedAt: NOW - 1000,
    });
    const finish = parseWatchOp({
      ...base,
      kind: "finishCardio",
      workoutId: "w-1",
      startOpId: null,
      session: "bike",
      indoor: true,
      startedAt: NOW - 600_000,
      duration: 600.4,
      distance: 5000,
      activeCalories: 120,
      avgHeartRate: 140,
      maxHeartRate: 999,
      healthId: "HK-1",
      curve: [0, 0, 5000, 600],
    });
    // A heart rate no heart has is a sensor glitch, dropped rather than losing the ride.
    expect(finish).toMatchObject({ kind: "finishCardio", duration: 600, avgHeartRate: 140, maxHeartRate: null, curve: [0, 0, 5000, 600] });
  });

  it("refuses a cardio op that says nothing about which session", () => {
    expect(parseWatchOp({ ...base, kind: "pauseCardio", workoutId: null, startOpId: null })).toBeNull();
  });

  it("refuses a kind of session it doesn't know", () => {
    expect(parseWatchOp({ ...base, kind: "startCardio", session: "skydive", indoor: false })).toBeNull();
  });

  it("drops a malformed curve but keeps the run", () => {
    const finish = parseWatchOp({
      ...base,
      kind: "finishCardio",
      workoutId: "w-1",
      startOpId: null,
      session: "run",
      indoor: false,
      startedAt: NOW,
      duration: 60,
      distance: 200,
      activeCalories: null,
      avgHeartRate: null,
      maxHeartRate: null,
      healthId: null,
      curve: "nope",
    });
    expect(finish).toMatchObject({ kind: "finishCardio", curve: null, distance: 200 });
  });
});

describe("live readings", () => {
  it("reads one, and refuses one that isn't", () => {
    const reading = { workoutId: "w-1", startOpId: null, kind: "run", startedAt: NOW, elapsed: 30, distance: 90, heartRate: 140, paused: false, at: NOW };
    expect(parseWatchLive(reading)).toEqual(reading);
    expect(parseWatchLive({ ...reading, kind: "fly" })).toBeNull();
    expect(parseWatchLive({ ...reading, paused: "no" })).toBeNull();
  });
});

describe("sessions ended on the phone", () => {
  const ended = (overrides: Partial<Workout>): Workout => ({
    ...liveWorkout(),
    completedAt: new Date(NOW - 60_000),
    cardio: { kind: "run", watch: true, watchStartOpId: "s-1" },
    ...overrides,
  });

  it("lists a watch-tracked session still waiting for what the watch measured", () => {
    expect(endedCardioIds([ended({})], NOW)).toEqual(["w-live", "s-1"]);
  });

  it("stops once the watch's numbers are in, after a while, or for one the watch never tracked", () => {
    const withData = ended({});
    withData.exercises = [{ ...withData.exercises[0], sets: [{ ...withData.exercises[0].sets[0], tracked: { source: "Apple Watch" } }] }];
    expect(endedCardioIds([withData], NOW)).toEqual([]);
    expect(endedCardioIds([ended({ completedAt: new Date(NOW - 7 * 3600_000) })], NOW)).toEqual([]);
    expect(endedCardioIds([ended({ cardio: { kind: "run" } })], NOW)).toEqual([]);
  });
});
