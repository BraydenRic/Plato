import {
  addDays,
  completedSetCount,
  convertWeight,
  displayVolume,
  formatClock,
  formatDuration,
  formatVolume,
  newId,
  previousSetsByExercise,
  relativeDay,
  reopenTiming,
  sameDay,
  setVolumeLbs,
  startOfDay,
  startOfWeek,
  totalSetCount,
  workoutDay,
  workoutVolumeLbs,
} from "../workout-utils";
import {
  daysAgo,
  emptySet,
  makeSet,
  makeWorkout,
  makeWorkoutExercise,
} from "./factories";

describe("setVolumeLbs", () => {
  it("counts weight × reps for a completed lbs set", () => {
    expect(setVolumeLbs(makeSet({ weight: 100, reps: 10 }))).toBe(1000);
  });

  it("converts kg to lbs so volume is always comparable", () => {
    expect(setVolumeLbs(makeSet({ weight: 100, reps: 1, weightUnit: "kg" }))).toBeCloseTo(220.462, 3);
  });

  it("ignores sets that were never completed", () => {
    expect(setVolumeLbs(makeSet({ isCompleted: false }))).toBe(0);
  });

  it("ignores sets with no reps", () => {
    expect(setVolumeLbs(makeSet({ reps: undefined }))).toBe(0);
    expect(setVolumeLbs(makeSet({ reps: 0 }))).toBe(0);
  });

  it("ignores bodyweight sets, which carry no external load", () => {
    expect(setVolumeLbs(makeSet({ weightUnit: "bodyweight", weight: 0 }))).toBe(0);
  });

  it("ignores a completed set with no weight, like a timed hold", () => {
    expect(setVolumeLbs(makeSet({ weight: undefined, duration: 60 }))).toBe(0);
  });
});

describe("workout set counting", () => {
  const workout = makeWorkout({
    exercises: [
      makeWorkoutExercise("bench-press", [makeSet(), makeSet(), emptySet()]),
      makeWorkoutExercise("squat", [makeSet(), emptySet()]),
    ],
  });

  it("sums volume across every exercise", () => {
    expect(workoutVolumeLbs(workout)).toBe(3000);
  });

  it("counts only completed sets", () => {
    expect(completedSetCount(workout)).toBe(3);
  });

  it("counts every set, logged or not", () => {
    expect(totalSetCount(workout)).toBe(5);
  });
});

describe("formatVolume", () => {
  it.each([
    [0, "0"],
    [340, "340"],
    [999, "999"],
    [1000, "1.0k"],
    [1200, "1.2k"],
    [9999, "10.0k"],
    [10_000, "10k"],
    [12_345, "12k"],
    [999_999, "1000k"],
    [1_000_000, "1.0M"],
    [1_250_000, "1.3M"],
  ])("formats %i as %s", (lbs, expected) => {
    expect(formatVolume(lbs)).toBe(expected);
  });
});

describe("convertWeight", () => {
  it("is a no-op when the units already match", () => {
    expect(convertWeight(135, "lbs", "lbs")).toBe(135);
  });

  it("rounds to one decimal so inputs stay typable", () => {
    expect(convertWeight(100, "lbs", "kg")).toBe(45.4);
    expect(convertWeight(100, "kg", "lbs")).toBe(220.5);
  });

  it("round-trips back to roughly the original weight", () => {
    const kg = convertWeight(225, "lbs", "kg");
    expect(convertWeight(kg, "kg", "lbs")).toBeCloseTo(225, 0);
  });
});

describe("displayVolume", () => {
  it("labels lbs without converting", () => {
    expect(displayVolume(12_000, "lbs")).toBe("12k lbs");
  });

  it("converts to kg before formatting", () => {
    expect(displayVolume(2204.62, "kg")).toBe("1.0k kg");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0m"],
    [45, "45m"],
    [60, "1h 0m"],
    [80, "1h 20m"],
    [1440, "24h 0m"],
  ])("formats %i minutes as %s", (mins, expected) => {
    expect(formatDuration(mins)).toBe(expected);
  });
});

describe("formatClock", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [65, "1:05"],
    [90, "1:30"],
    [3600, "60:00"],
  ])("formats %i seconds as %s", (secs, expected) => {
    expect(formatClock(secs)).toBe(expected);
  });
});

describe("relativeDay", () => {
  it("names today, yesterday and tomorrow", () => {
    expect(relativeDay(new Date())).toBe("Today");
    expect(relativeDay(daysAgo(1))).toBe("Yesterday");
    expect(relativeDay(addDays(new Date(), 1))).toBe("Tomorrow");
  });

  it("uses the weekday name inside a week", () => {
    const threeDaysBack = daysAgo(3);
    expect(relativeDay(threeDaysBack)).toBe(
      threeDaysBack.toLocaleDateString(undefined, { weekday: "long" })
    );
  });

  it("falls back to a calendar date beyond a week", () => {
    const old = daysAgo(30);
    expect(relativeDay(old)).toBe(
      old.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    );
  });
});

describe("calendar helpers", () => {
  it("startOfDay zeroes the time component", () => {
    const d = startOfDay(new Date("2026-03-04T15:45:30"));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it("startOfDay does not mutate its argument", () => {
    const original = new Date("2026-03-04T15:45:30");
    const copy = new Date(original);
    startOfDay(original);
    expect(original.getTime()).toBe(copy.getTime());
  });

  it("addDays crosses month boundaries", () => {
    const d = addDays(new Date("2026-01-31T12:00:00"), 1);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(1);
  });

  it("startOfWeek anchors to Monday", () => {
    // 2026-03-04 is a Wednesday.
    expect(startOfWeek(new Date("2026-03-04T12:00:00")).getDay()).toBe(1);
  });

  it("treats Sunday as the end of its week, not the start", () => {
    // 2026-03-08 is a Sunday; its week began Monday the 2nd.
    const week = startOfWeek(new Date("2026-03-08T12:00:00"));
    expect(week.getDay()).toBe(1);
    expect(week.getDate()).toBe(2);
  });

  it("sameDay ignores the clock time", () => {
    expect(sameDay(new Date("2026-03-04T00:01:00"), new Date("2026-03-04T23:59:00"))).toBe(true);
    expect(sameDay(new Date("2026-03-04T23:59:00"), new Date("2026-03-05T00:01:00"))).toBe(false);
  });
});

describe("workoutDay", () => {
  const scheduled = new Date("2026-03-01T12:00:00");
  const completed = new Date("2026-03-02T12:00:00");
  const started = new Date("2026-03-03T12:00:00");
  const created = new Date("2026-03-04T12:00:00");

  it("pins a scheduled workout to its planned day even once finished", () => {
    const w = makeWorkout({ scheduledFor: scheduled, completedAt: completed, startedAt: started, createdAt: created });
    expect(workoutDay(w)).toEqual(startOfDay(scheduled));
  });

  it("falls back through completedAt, then startedAt, then createdAt", () => {
    expect(workoutDay(makeWorkout({ completedAt: completed, startedAt: started, createdAt: created })))
      .toEqual(startOfDay(completed));
    expect(workoutDay(makeWorkout({ startedAt: started, createdAt: created }))).toEqual(startOfDay(started));
    expect(workoutDay(makeWorkout({ createdAt: created }))).toEqual(startOfDay(created));
  });
});

describe("newId", () => {
  it("does not collide across a tight loop", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()));
    expect(ids.size).toBe(500);
  });
});

describe("reopenTiming", () => {
  it("does nothing for a workout that was never finished", () => {
    expect(reopenTiming(makeWorkout())).toEqual({ kind: "none" });
  });

  it("turns a workout finished on an earlier day into a backlog edit", () => {
    const completedAt = daysAgo(3);
    expect(reopenTiming(makeWorkout({ completedAt, startedAt: daysAgo(3) }))).toEqual({
      kind: "backlog",
      scheduledFor: completedAt,
    });
  });

  it("resumes the clock for a workout finished today, discounting the pause", () => {
    const startedAt = new Date(Date.now() - 60 * 60_000);
    const completedAt = new Date(Date.now() - 10 * 60_000);
    const timing = reopenTiming(makeWorkout({ startedAt, completedAt }));

    expect(timing.kind).toBe("resume");
    if (timing.kind !== "resume") throw new Error("expected resume");
    // The 10 minutes it sat finished are added back, so elapsed stays ~50m.
    expect(timing.startedAt.getTime()).toBeCloseTo(startedAt.getTime() + 10 * 60_000, -3);
  });

  it("does nothing for a workout finished today that was never started", () => {
    expect(reopenTiming(makeWorkout({ completedAt: new Date() }))).toEqual({ kind: "none" });
  });
});

// The "what did I lift last time?" ghost numbers. This is the behaviour users
// notice most, and every case below maps to a real complaint.
describe("previousSetsByExercise", () => {
  it("returns nothing when there is no history", () => {
    expect(previousSetsByExercise([]).size).toBe(0);
  });

  it("uses the most recent session that logged the exercise", () => {
    const history = [
      makeWorkout({
        completedAt: daysAgo(2),
        exercises: [makeWorkoutExercise("bench-press", [makeSet({ weight: 185, reps: 8 })])],
      }),
      makeWorkout({
        completedAt: daysAgo(9),
        exercises: [makeWorkoutExercise("bench-press", [makeSet({ weight: 175, reps: 8 })])],
      }),
    ];

    expect(previousSetsByExercise(history).get("bench-press")?.[0]?.weight).toBe(185);
  });

  // The headline case: an exercise sitting untouched in a template for weeks
  // must not erase what you actually lifted before that.
  it("looks past sessions where the exercise was in the workout but left empty", () => {
    const history = [
      makeWorkout({
        completedAt: daysAgo(2),
        exercises: [makeWorkoutExercise("bench-press", [emptySet(), emptySet(), emptySet()])],
      }),
      makeWorkout({
        completedAt: daysAgo(9),
        exercises: [makeWorkoutExercise("bench-press", [emptySet(), emptySet()])],
      }),
      makeWorkout({
        completedAt: daysAgo(21),
        exercises: [makeWorkoutExercise("bench-press", [makeSet({ weight: 185, reps: 5 })])],
      }),
    ];

    const bench = previousSetsByExercise(history).get("bench-press");
    expect(bench?.[0]?.weight).toBe(185);
    expect(bench?.[0]?.reps).toBe(5);
  });

  // The bug this function was extracted to fix: compacting the logged sets slid
  // set 3's numbers up under set 2 and ghosted a weight never lifted there.
  it("keeps each logged set at its own position, leaving skipped ones as holes", () => {
    const history = [
      makeWorkout({
        completedAt: daysAgo(2),
        exercises: [
          makeWorkoutExercise("bench-press", [
            makeSet({ weight: 185, reps: 8 }),
            emptySet(),
            makeSet({ weight: 175, reps: 6 }),
          ]),
        ],
      }),
    ];

    const bench = previousSetsByExercise(history).get("bench-press");
    expect(bench).toHaveLength(3);
    expect(bench?.[0]?.weight).toBe(185);
    expect(bench?.[1]).toBeUndefined();
    expect(bench?.[2]?.weight).toBe(175);
  });

  it("leaves sets beyond last session's length undefined rather than inventing them", () => {
    const history = [
      makeWorkout({
        completedAt: daysAgo(2),
        exercises: [makeWorkoutExercise("bench-press", [makeSet({ weight: 185 })])],
      }),
    ];

    const bench = previousSetsByExercise(history).get("bench-press");
    expect(bench?.[0]?.weight).toBe(185);
    expect(bench?.[1]).toBeUndefined();
    expect(bench?.[5]).toBeUndefined();
  });

  it("never ghosts a workout from itself", () => {
    const current = makeWorkout({
      id: "current",
      completedAt: daysAgo(0),
      exercises: [makeWorkoutExercise("bench-press", [makeSet({ weight: 999 })])],
    });
    const older = makeWorkout({
      completedAt: daysAgo(7),
      exercises: [makeWorkoutExercise("bench-press", [makeSet({ weight: 185 })])],
    });

    expect(previousSetsByExercise([current, older], "current").get("bench-press")?.[0]?.weight).toBe(185);
  });

  it("tracks each exercise independently", () => {
    const history = [
      makeWorkout({
        completedAt: daysAgo(2),
        exercises: [
          makeWorkoutExercise("bench-press", [emptySet()]),
          makeWorkoutExercise("squat", [makeSet({ weight: 315 })]),
        ],
      }),
      makeWorkout({
        completedAt: daysAgo(9),
        exercises: [makeWorkoutExercise("bench-press", [makeSet({ weight: 185 })])],
      }),
    ];

    const map = previousSetsByExercise(history);
    expect(map.get("squat")?.[0]?.weight).toBe(315);
    // Bench fell back a session; squat did not.
    expect(map.get("bench-press")?.[0]?.weight).toBe(185);
  });

  it("remembers timed sets by duration", () => {
    const history = [
      makeWorkout({
        completedAt: daysAgo(2),
        exercises: [
          makeWorkoutExercise("plank", [
            makeSet({ weight: undefined, reps: undefined, duration: 90, isCompleted: true }),
          ]),
        ],
      }),
    ];

    expect(previousSetsByExercise(history).get("plank")?.[0]?.duration).toBe(90);
  });

  it("treats a zero weight as a real number, not a missing one", () => {
    const history = [
      makeWorkout({
        completedAt: daysAgo(2),
        exercises: [makeWorkoutExercise("push-up", [makeSet({ weight: 0, reps: 20 })])],
      }),
    ];

    expect(previousSetsByExercise(history).get("push-up")?.[0]?.weight).toBe(0);
  });

  it("ignores a set flagged complete that holds no numbers at all", () => {
    const history = [
      makeWorkout({
        completedAt: daysAgo(2),
        exercises: [
          makeWorkoutExercise("bench-press", [
            makeSet({ weight: undefined, reps: undefined, duration: undefined, isCompleted: true }),
          ]),
        ],
      }),
    ];

    expect(previousSetsByExercise(history).has("bench-press")).toBe(false);
  });

  it("ignores an unfinished set even when numbers were typed into it", () => {
    const history = [
      makeWorkout({
        completedAt: daysAgo(2),
        exercises: [
          makeWorkoutExercise("bench-press", [makeSet({ weight: 185, reps: 8, isCompleted: false })]),
        ],
      }),
    ];

    expect(previousSetsByExercise(history).has("bench-press")).toBe(false);
  });
});
