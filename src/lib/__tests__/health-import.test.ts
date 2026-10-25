import {
  buildImportedWorkout,
  distanceCurve,
  fastest,
  importedHealthIds,
  pausesFrom,
  splits,
  wantsDistanceSamples,
  workoutsToImport,
  type DistanceSample,
  type HealthWorkout,
} from "../health-import";
import { makeSet, makeWorkout, makeWorkoutExercise } from "./factories";

const START = Date.UTC(2026, 9, 20, 7, 0, 0);
const MILE = 1609.344;

/**
 * Samples for a steady stretch: `metres` covered in `seconds`, as readings
 * every ten seconds — about how often a watch logs distance on a run.
 */
function steady(fromMs: number, metres: number, seconds: number): DistanceSample[] {
  const out: DistanceSample[] = [];
  const pieces = Math.max(1, Math.round(seconds / 10));
  for (let i = 0; i < pieces; i++) {
    out.push({
      startMs: fromMs + (i * seconds * 1000) / pieces,
      endMs: fromMs + ((i + 1) * seconds * 1000) / pieces,
      metres: metres / pieces,
    });
  }
  return out;
}

function healthWorkout(overrides: Partial<HealthWorkout> = {}): HealthWorkout {
  return {
    id: "H-1",
    activity: "running",
    indoor: false,
    startMs: START,
    endMs: START + 1500_000,
    duration: 1500,
    distance: 5000,
    activeCalories: 312.4,
    avgHeartRate: 151.6,
    maxHeartRate: 171.2,
    events: [],
    source: "Brayden's Apple Watch",
    sourceBundle: "com.apple.health.ABCD",
    ...overrides,
  };
}

describe("pausesFrom", () => {
  it("pairs each pause with the resume after it, in time order", () => {
    expect(
      pausesFrom(
        [
          { type: "resume", ms: 30 },
          { type: "pause", ms: 10 },
          { type: "pause", ms: 50 },
          { type: "resume", ms: 70 },
        ],
        100
      )
    ).toEqual([
      { startMs: 10, endMs: 30 },
      { startMs: 50, endMs: 70 },
    ]);
  });

  it("runs a pause nobody resumed to the end of the workout", () => {
    expect(pausesFrom([{ type: "pause", ms: 80 }], 100)).toEqual([{ startMs: 80, endMs: 100 }]);
  });

  // Auto-pause at a light, a manual pause on top, the manual resume, and only
  // then moving again: paused the whole way.
  it("stays paused until both a manual and an automatic pause have ended", () => {
    expect(
      pausesFrom(
        [
          { type: "motionPause", ms: 600 },
          { type: "pause", ms: 650 },
          { type: "resume", ms: 700 },
          { type: "motionResume", ms: 900 },
        ],
        2000
      )
    ).toEqual([{ startMs: 600, endMs: 900 }]);
  });

  it("ignores a resume with no pause before it, and a second pause while paused", () => {
    expect(
      pausesFrom(
        [
          { type: "resume", ms: 5 },
          { type: "pause", ms: 10 },
          { type: "pause", ms: 15 },
          { type: "resume", ms: 20 },
        ],
        100
      )
    ).toEqual([{ startMs: 10, endMs: 20 }]);
  });
});

describe("splits", () => {
  it("times each whole kilometre and mile", () => {
    // 4:00 for the first km, 5:00 for the second.
    const samples = [...steady(START, 1000, 240), ...steady(START + 240_000, 1000, 300)];
    const curve = distanceCurve(samples, [], START);
    expect(splits(curve, 1000)).toEqual([240, 300]);
    // Not even two kilometres make a whole second mile.
    expect(splits(curve, MILE)).toHaveLength(1);
  });

  // A split you stopped for a drink in the middle of isn't how fast you ran it.
  it("leaves paused time out", () => {
    const samples = [...steady(START, 500, 120), ...steady(START + 180_000, 500, 120)];
    const pauses = [{ startMs: START + 120_000, endMs: START + 180_000 }];
    expect(splits(distanceCurve(samples, pauses, START), 1000)).toEqual([240]);
  });

  // Readings stamped at a single moment, each holding the distance since the
  // last: spread over that gap, they time the run as it was run.
  it("spreads instant readings over the time since the one before", () => {
    const instants = Array.from({ length: 20 }, (_, i) => ({
      startMs: START + (i + 1) * 30_000,
      endMs: START + (i + 1) * 30_000,
      metres: 100,
    }));
    const curve = distanceCurve(instants, [], START);
    expect(splits(curve, 1000)).toEqual([300, 300]);
    expect(fastest(curve, 1000)).toBe(300);
  });

  it("is empty for a run shorter than one unit", () => {
    expect(splits(distanceCurve(steady(START, 900, 200), [], START), 1000)).toEqual([]);
  });
});

describe("fastest", () => {
  it("finds the quickest stretch even when it straddles the readings", () => {
    // A slow kilometre, a fast one, a slow one.
    const samples = [
      ...steady(START, 1000, 330),
      ...steady(START + 330_000, 1000, 240),
      ...steady(START + 570_000, 1000, 330),
    ];
    const curve = distanceCurve(samples, [], START);
    expect(fastest(curve, 1000)).toBe(240);
    // Any 2 km here holds a whole kilometre of slow running, wherever it starts.
    expect(fastest(curve, 2000)).toBe(570);
  });

  // Waiting at a light without pausing: an effort that ends there ended when
  // you arrived, and one that starts there started when you set off.
  it("doesn't count standing still at either end of an effort", () => {
    const samples = [...steady(START, 1000, 240), ...steady(START + 300_000, 1000, 240)];
    const curve = distanceCurve(samples, [], START);
    expect(fastest(curve, 1000)).toBe(240);
    // Across the stop it has to count: you were standing still in the middle.
    expect(fastest(curve, 2000)).toBe(540);
  });

  it("is nothing for a session shorter than the distance", () => {
    expect(fastest(distanceCurve(steady(START, 4000, 1200), [], START), 5000)).toBeNull();
  });

  it("throws out a GPS jump faster than anyone has ever run", () => {
    expect(fastest(distanceCurve(steady(START, 1000, 60), [], START), 1000)).toBeNull();
  });
});

describe("what gets imported", () => {
  it("skips what's already here, what was deleted, and what it can't use", () => {
    const found = [
      healthWorkout({ id: "new" }),
      healthWorkout({ id: "already" }),
      healthWorkout({ id: "deleted" }),
      healthWorkout({ id: "yoga", activity: "yoga" }),
      healthWorkout({ id: "mine", sourceBundle: "com.plato.workouts.watchkitapp" }),
      healthWorkout({ id: "empty", duration: 0 }),
    ];
    expect(workoutsToImport(found, new Set(["already"]), new Set(["deleted"])).fresh.map((w) => w.id)).toEqual(["new"]);
  });

  it("keeps one copy of a session two apps recorded, the Apple Watch's", () => {
    const watch = healthWorkout({ id: "watch", sourceBundle: "com.apple.health.X" });
    const strava = healthWorkout({ id: "strava", sourceBundle: "com.strava.stravaride", startMs: START - 20_000 });
    // A walk home right after: its own workout, not a copy.
    const walk = healthWorkout({ id: "walk", activity: "walking", startMs: START + 1_500_000, endMs: START + 2_400_000 });
    const { fresh, duplicates } = workoutsToImport([strava, watch, walk], new Set(), new Set());
    expect(fresh.map((w) => w.id)).toEqual(["watch", "walk"]);
    expect(duplicates.map((w) => w.id)).toEqual(["strava"]);
  });

  it("leaves out a second copy of a session that's already been imported", () => {
    const { fresh, duplicates } = workoutsToImport([healthWorkout({ id: "late-copy" })], new Set(), new Set(), [
      { startMs: START + 30_000, endMs: START + 1_480_000 },
    ]);
    expect(fresh).toEqual([]);
    expect(duplicates.map((w) => w.id)).toEqual(["late-copy"]);
  });

  it("reads the ids already imported off the workouts", () => {
    const workouts = [
      makeWorkout({ exercises: [makeWorkoutExercise("running", [makeSet({ tracked: { healthId: "A" } }), makeSet()])] }),
      makeWorkout({ exercises: [makeWorkoutExercise("bench-press", [makeSet()])] }),
    ];
    expect([...importedHealthIds(workouts)]).toEqual(["A"]);
  });

  it("asks for distance readings only where they make splits", () => {
    expect(wantsDistanceSamples("running")).toBe(true);
    expect(wantsDistanceSamples("cycling")).toBe(true);
    expect(wantsDistanceSamples("swimming")).toBe(false);
    expect(wantsDistanceSamples("jumpRope")).toBe(false);
  });
});

describe("buildImportedWorkout", () => {
  const samples = steady(START, 5000, 1500);
  const options = { userId: "u1", weightUnit: "lbs" as const };

  it("makes a finished run with one set holding everything the watch measured", () => {
    const w = buildImportedWorkout(healthWorkout(), samples, options);
    expect(w).toMatchObject({
      userId: "u1",
      name: "Outdoor Run",
      isTemplate: false,
      startedAt: new Date(START),
      completedAt: new Date(START + 1500_000),
      durationMinutes: 25,
      totalVolume: 0,
    });
    expect(w.exercises).toHaveLength(1);
    expect(w.exercises[0].exerciseId).toBe("running");
    expect(w.exercises[0].exercise.name).toBe("Running");
    const set = w.exercises[0].sets[0];
    expect(set).toMatchObject({ duration: 1500, distance: 5000, isCompleted: true, weightUnit: "lbs" });
    expect(set.tracked).toEqual({
      healthId: "H-1",
      source: "Brayden's Apple Watch",
      activeCalories: 312,
      avgHeartRate: 152,
      maxHeartRate: 171,
      splitsMi: [483, 483, 483],
      splitsKm: [300, 300, 300, 300, 300],
      best: { "1k": 300, "1mi": 483, "5k": 1500 },
    });
  });

  it("files an indoor run as the treadmill", () => {
    const w = buildImportedWorkout(healthWorkout({ indoor: true }), samples, options);
    expect(w.name).toBe("Indoor Run");
    expect(w.exercises[0].exerciseId).toBe("treadmill");
    expect(w.exercises[0].sets[0].tracked?.indoor).toBe(true);
  });

  it("leaves out what Health didn't have, rather than storing nulls", () => {
    const set = buildImportedWorkout(
      healthWorkout({ avgHeartRate: null, maxHeartRate: null, activeCalories: null }),
      [],
      options
    ).exercises[0].sets[0];
    expect(set.tracked).toEqual({ healthId: "H-1", source: "Brayden's Apple Watch" });
    expect("avgHeartRate" in set.tracked!).toBe(false);
  });

  it("keeps records to runs", () => {
    const set = buildImportedWorkout(healthWorkout({ activity: "walking" }), samples, options).exercises[0].sets[0];
    expect(set.tracked?.splitsKm).toHaveLength(5);
    expect(set.tracked?.best).toBeUndefined();
  });

  it("gives a jump rope session its time but no distance", () => {
    const w = buildImportedWorkout(healthWorkout({ activity: "jumpRope", distance: 12 }), [], options);
    expect(w.name).toBe("Jump Rope");
    expect(w.exercises[0].sets[0].distance).toBeUndefined();
    expect(w.exercises[0].sets[0].duration).toBe(1500);
  });

  it("gives a swim its distance without splits", () => {
    const set = buildImportedWorkout(healthWorkout({ activity: "swimming", distance: 1500 }), [], options).exercises[0]
      .sets[0];
    expect(set.distance).toBe(1500);
    expect(set.tracked?.splitsKm).toBeUndefined();
  });
});
