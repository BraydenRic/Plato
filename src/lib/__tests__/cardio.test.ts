import {
  activitiesIn,
  averageActiveWeek,
  cardioRecords,
  cardioSessions,
  cardioSetDone,
  distanceKind,
  distanceUnit,
  formatDistance,
  formatDistanceValue,
  formatRate,
  isCardioWorkout,
  parseDistanceText,
  weeklyDistance,
  workoutCardioSeconds,
  workoutDistanceLabel,
} from "../cardio";
import { EXERCISES } from "../exercises";
import { emptySet, makeExercise, makeSet, makeWorkout, makeWorkoutExercise } from "./factories";
import type { WorkoutSet } from "@/types";

const MILE = 1609.344;
const library = (id: string) => EXERCISES.find((e) => e.id === id)!;

/** A cardio exercise straight from the library, so its category is real. */
function cardio(id: string, sets: WorkoutSet[]) {
  return makeWorkoutExercise(id, sets, { exercise: library(id) });
}

function run(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return makeSet({ weight: undefined, reps: undefined, duration: 1500, distance: 5000, ...overrides });
}

describe("which cardio covers ground", () => {
  it("reads runs and walks by pace, bikes by speed, rowers by 500 m, swims by 100", () => {
    expect(distanceKind(library("running"))).toBe("foot");
    expect(distanceKind(library("treadmill"))).toBe("foot");
    expect(distanceKind(library("hiking"))).toBe("foot");
    expect(distanceKind(library("cycling"))).toBe("ride");
    expect(distanceKind(library("rowing"))).toBe("row");
    expect(distanceKind(library("swimming"))).toBe("swim");
  });

  it("leaves cardio with no distance worth typing on the clock alone", () => {
    expect(distanceKind(library("burpees"))).toBeNull();
    expect(distanceKind(library("jump-rope"))).toBeNull();
    expect(distanceKind(library("stairmaster"))).toBeNull();
  });

  it("never gives a hold or a lift a distance", () => {
    expect(distanceKind(library("plank"))).toBeNull();
    expect(distanceKind(library("bench-press"))).toBeNull();
  });

  // Workouts embed copies of the exercise, so an old log's copy may carry an
  // explicit flag; the id is what decides.
  it("goes by id, so a copy embedded in an old workout still counts", () => {
    expect(distanceKind(makeExercise({ id: "running", category: "Cardio" }))).toBe("foot");
    // Someone's custom "Run" has no id the app knows; it stays a timer.
    expect(distanceKind(makeExercise({ id: "custom-run", category: "Cardio" }))).toBeNull();
  });
});

describe("units", () => {
  it("follows the weight setting, except on a rower", () => {
    expect(distanceUnit("foot", "lbs")).toBe("mi");
    expect(distanceUnit("foot", "kg")).toBe("km");
    expect(distanceUnit("ride", "kg")).toBe("km");
    expect(distanceUnit("row", "lbs")).toBe("m");
    expect(distanceUnit("swim", "lbs")).toBe("yd");
    expect(distanceUnit("swim", "kg")).toBe("m");
  });

  it("shows miles and kilometres to two places, short units whole", () => {
    expect(formatDistanceValue(5000, "mi")).toBe("3.11");
    expect(formatDistanceValue(5000, "km")).toBe("5.00");
    expect(formatDistanceValue(2000.4, "m")).toBe("2000");
    expect(formatDistance(5000, "km")).toBe("5.00 km");
    expect(formatDistance(2000, "m")).toBe("2,000 m");
  });

  it("reads what was typed, comma decimals included", () => {
    expect(parseDistanceText("3.1", "mi")).toBeCloseTo(3.1 * MILE);
    expect(parseDistanceText("3,1", "mi")).toBeCloseTo(3.1 * MILE);
    expect(parseDistanceText(" 5 ", "km")).toBe(5000);
  });

  it("treats blank, zero and garbage as no distance", () => {
    expect(parseDistanceText("", "mi")).toBeUndefined();
    expect(parseDistanceText("0", "mi")).toBeUndefined();
    expect(parseDistanceText("-2", "km")).toBeUndefined();
    expect(parseDistanceText("far", "km")).toBeUndefined();
  });
});

describe("how fast", () => {
  it("gives pace per mile or kilometre on foot", () => {
    // 5 km in 25:00 is 5:00/km, or 8:03/mi.
    expect(formatRate(5000, 1500, "foot", "kg")).toBe("5:00 /km");
    expect(formatRate(5000, 1500, "foot", "lbs")).toBe("8:03 /mi");
  });

  it("gives speed on a bike", () => {
    expect(formatRate(10 * MILE, 3600, "ride", "lbs")).toBe("10.0 mph");
    expect(formatRate(30000, 3600, "ride", "kg")).toBe("30.0 km/h");
  });

  it("gives time per 500 m on a rower and per 100 in the pool", () => {
    expect(formatRate(2000, 420, "row", "lbs")).toBe("1:45 /500m");
    expect(formatRate(1000, 1200, "swim", "kg")).toBe("2:00 /100m");
  });

  it("says nothing without both a time and a distance", () => {
    expect(formatRate(undefined, 1500, "foot", "lbs")).toBeNull();
    expect(formatRate(5000, undefined, "foot", "lbs")).toBeNull();
    expect(formatRate(5000, 0, "foot", "lbs")).toBeNull();
  });
});

describe("cardioSetDone", () => {
  it("counts time or distance, either on its own", () => {
    expect(cardioSetDone({ duration: 60 })).toBe(true);
    expect(cardioSetDone({ distance: 400 })).toBe(true);
    expect(cardioSetDone({})).toBe(false);
    expect(cardioSetDone({ duration: 0, distance: 0 })).toBe(false);
  });
});

describe("a workout's distance", () => {
  it("is a run's distance, in the reader's unit", () => {
    const w = makeWorkout({ exercises: [cardio("running", [run()])] });
    expect(workoutDistanceLabel(w, "kg")).toBe("5.00 km");
    expect(workoutDistanceLabel(w, "lbs")).toBe("3.11 mi");
  });

  it("only counts completed sets", () => {
    const w = makeWorkout({ exercises: [cardio("running", [run(), run({ isCompleted: false, distance: 9000 })])] });
    expect(workoutDistanceLabel(w, "kg")).toBe("5.00 km");
  });

  // A run and a row don't add up to one number.
  it("shows the larger of two units rather than summing across them", () => {
    const w = makeWorkout({
      exercises: [cardio("running", [run({ distance: 1000 })]), cardio("rowing", [run({ distance: 2000 })])],
    });
    expect(workoutDistanceLabel(w, "kg")).toBe("2,000 m");
  });

  it("is nothing for a workout that covered no ground", () => {
    expect(workoutDistanceLabel(makeWorkout({ exercises: [makeWorkoutExercise("bench-press", [makeSet()])] }), "lbs")).toBeNull();
  });

  it("knows a run from a leg day that ended on the bike", () => {
    expect(isCardioWorkout(makeWorkout({ exercises: [cardio("running", [run()])] }))).toBe(true);
    expect(
      isCardioWorkout(
        makeWorkout({ exercises: [makeWorkoutExercise("squat", [makeSet()]), cardio("cycling", [run()])] })
      )
    ).toBe(false);
    expect(isCardioWorkout(makeWorkout({ exercises: [] }))).toBe(false);
  });

  it("totals the cardio time, leaving the lifting out", () => {
    const w = makeWorkout({
      exercises: [
        makeWorkoutExercise("squat", [makeSet({ duration: 999 })]),
        cardio("cycling", [run({ duration: 600 }), run({ duration: 300 }), emptySet({ duration: 50 })]),
      ],
    });
    expect(workoutCardioSeconds(w)).toBe(900);
  });
});

describe("cardio progress", () => {
  const at = (iso: string) => new Date(iso);

  it("makes one session per exercise per workout, grouping a treadmill with outdoor runs", () => {
    const sessions = cardioSessions([
      makeWorkout({ id: "a", completedAt: at("2026-10-20T08:00:00"), exercises: [cardio("treadmill", [run(), run()])] }),
      makeWorkout({ id: "b", completedAt: at("2026-10-18T08:00:00"), exercises: [cardio("walking", [run()])] }),
      makeWorkout({ id: "c", completedAt: at("2026-10-17T08:00:00"), exercises: [cardio("burpees", [run()])] }),
    ]);
    expect(sessions.map((s) => [s.workoutId, s.activity, s.metres])).toEqual([
      ["a", "run", 10000],
      ["b", "walk", 5000],
    ]);
    expect(activitiesIn(sessions)).toEqual(["run", "walk"]);
  });

  it("prefers Health's fastest mile over anything worked out from an average", () => {
    const sessions = cardioSessions([
      makeWorkout({
        completedAt: at("2026-10-20T08:00:00"),
        exercises: [cardio("running", [run({ distance: 2 * MILE, duration: 960, tracked: { healthId: "h", best: { "1mi": 450 } } })])],
      }),
    ]);
    expect(cardioRecords(sessions).best["1mi"]).toBe(450);
  });

  it("takes a typed-in 5K as a 5K, scaled to the exact distance", () => {
    const real = cardioSessions([makeWorkout({ completedAt: at("2026-10-20T08:00:00"), exercises: [cardio("running", [run({ distance: 5100, duration: 1530 })])] })]);
    expect(cardioRecords(real).best["5k"]).toBe(1500);
  });

  // 3.1 is how a 5K is written in miles, though it's 4,989 m.
  it("counts the usual miles shorthand for a race as that race", () => {
    const shorthand = cardioSessions([
      makeWorkout({ completedAt: at("2026-10-20T08:00:00"), exercises: [cardio("running", [run({ distance: 3.1 * MILE, duration: 1500 })])] }),
    ]);
    expect(cardioRecords(shorthand).best["5k"]).toBe(1503);
    // Three miles is just short of a 5K, not one.
    const short = cardioSessions([
      makeWorkout({ completedAt: at("2026-10-20T08:00:00"), exercises: [cardio("running", [run({ distance: 3 * MILE })])] }),
    ]);
    expect(cardioRecords(short).best["5k"]).toBeUndefined();
  });

  // A 10-mile run's average says nothing about its fastest mile.
  it("doesn't stretch a long typed-in run into a mile record", () => {
    const sessions = cardioSessions([
      makeWorkout({ completedAt: at("2026-10-20T08:00:00"), exercises: [cardio("running", [run({ distance: 10 * MILE, duration: 4800 })])] }),
    ]);
    expect(cardioRecords(sessions).best["1mi"]).toBeUndefined();
    expect(cardioRecords(sessions).longest?.metres).toBe(10 * MILE);
  });

  it("buckets distance by training week, current week last, empty weeks as zero", () => {
    const now = at("2026-10-22T12:00:00"); // a Thursday
    const sessions = cardioSessions([
      makeWorkout({ completedAt: at("2026-10-21T08:00:00"), exercises: [cardio("running", [run({ distance: 3000 })])] }),
      makeWorkout({ completedAt: at("2026-10-19T08:00:00"), exercises: [cardio("running", [run({ distance: 2000 })])] }),
      makeWorkout({ completedAt: at("2026-10-08T08:00:00"), exercises: [cardio("running", [run({ distance: 4000 })])] }),
      // Before the window: ignored, not piled into the first week.
      makeWorkout({ completedAt: at("2026-09-01T08:00:00"), exercises: [cardio("running", [run({ distance: 9999 })])] }),
    ]);
    const weeks = weeklyDistance(sessions, 3, now);
    expect(weeks.map((w) => w.metres)).toEqual([4000, 0, 5000]);
    expect(weeks[2].weekStart).toEqual(at("2026-10-19T00:00:00"));
  });
});

// The line across the weekly chart: a typical week of it, so weeks off and
// the weeks before someone started don't pull it toward zero.
describe("averageActiveWeek", () => {
  it("averages only the weeks with some distance in them", () => {
    expect(averageActiveWeek([{ metres: 0 }, { metres: 3000 }, { metres: 0 }, { metres: 5000 }])).toBe(4000);
  });

  it("is nothing until two weeks have some", () => {
    expect(averageActiveWeek([])).toBeNull();
    expect(averageActiveWeek([{ metres: 0 }, { metres: 0 }])).toBeNull();
    expect(averageActiveWeek([{ metres: 0 }, { metres: 5000 }])).toBeNull();
  });
});
