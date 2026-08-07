import {
  MAX_BODYWEIGHT_ENTRIES,
  addDays,
  bodyweightOn,
  completedSetCount,
  convertWeight,
  displayVolume,
  estimatedOneRepMax,
  formatBodyweightLoad,
  formatClock,
  formatDuration,
  formatVolume,
  formatWeight,
  liveSetSeconds,
  newId,
  previousSetsByExercise,
  relativeDay,
  reopenTiming,
  sameDay,
  setVolumeLbs,
  setsByCategory,
  startOfDay,
  startOfWeek,
  totalSetCount,
  withBodyweightEntry,
  withoutBodyweightEntry,
  workoutDay,
  workoutVolumeLbs,
} from "../workout-utils";
import type { Workout } from "@/types";
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

  it("ignores a bodyweight set when no bodyweight is supplied", () => {
    // Not because such a set is worthless — see the bodyweight suite below —
    // but because the caller has to say what the lifter weighed. Every reader
    // of an already-finished workout passes nothing, so their stored volume
    // stays exactly as it was logged.
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

describe("liveSetSeconds", () => {
  // The row and the commit both call this, so agreement between what you watch
  // and what gets logged is a property of there being one function, not luck.
  const startedAt = 1_000_000;

  it("reports whole seconds elapsed", () => {
    expect(liveSetSeconds(startedAt + 42_000, startedAt)).toBe(42);
  });

  it("floors a part-second rather than rounding it up", () => {
    // Regression: this rounded, so stopping at 0:42.6 showed 0:42 and logged
    // 0:43 — the row ticked up one second at the moment you stopped it.
    expect(liveSetSeconds(startedAt + 42_600, startedAt)).toBe(42);
    expect(liveSetSeconds(startedAt + 42_999, startedAt)).toBe(42);
  });

  it("logs exactly the value the readout last showed", () => {
    const stoppedAt = startedAt + 42_600;
    const shown = liveSetSeconds(stoppedAt, startedAt);
    const committed = liveSetSeconds(stoppedAt, startedAt);
    expect(committed).toBe(shown);
  });

  it("never reads below what the set already banked", () => {
    // Regression: on resume the row's clock is briefly the previous run's last
    // tick, which put elapsed under the banked duration and flashed 0:00 over a
    // set that already held 1:30.
    const staleNow = startedAt - 5_000;
    expect(liveSetSeconds(staleNow, startedAt, 90)).toBe(90);
  });

  it("reads the banked duration the instant a resumed set starts", () => {
    // start backdates startedAt by the banked seconds, so t=0 is already 1:30.
    const banked = 90;
    const resumedAt = 1_000_000;
    expect(liveSetSeconds(resumedAt, resumedAt - banked * 1000, banked)).toBe(banked);
  });

  it("counts on from the banked duration once time passes", () => {
    const banked = 90;
    const resumedAt = 1_000_000;
    const backdated = resumedAt - banked * 1000;
    expect(liveSetSeconds(resumedAt + 10_000, backdated, banked)).toBe(100);
  });

  it("never goes negative when the clock reads before the start", () => {
    expect(liveSetSeconds(startedAt - 30_000, startedAt)).toBe(0);
  });

  it("treats a fresh set as starting from zero", () => {
    expect(liveSetSeconds(startedAt, startedAt)).toBe(0);
  });
});

describe("the bodyweight log", () => {
  /**
   * A weigh-in is a reading of one thing, not an event worth accumulating, so
   * the log holds at most one entry per day and stays sorted. bodyweightOn is
   * what a future bodyweight-aware volume would call — it is here now because
   * the rule it encodes (value a set against the weight at the time) is the
   * whole reason the log is dated rather than a single number.
   */
  const day = (iso: string, lbs: number) => ({ date: new Date(iso), lbs });

  it("starts from nothing", () => {
    const log = withBodyweightEntry([], day("2026-03-01", 178));
    expect(log).toHaveLength(1);
    expect(log[0].lbs).toBe(178);
  });

  it("keeps entries oldest first however they arrive", () => {
    let log = withBodyweightEntry([], day("2026-03-10", 180));
    log = withBodyweightEntry(log, day("2026-03-01", 178));
    log = withBodyweightEntry(log, day("2026-03-05", 179));
    expect(log.map((e) => e.lbs)).toEqual([178, 179, 180]);
  });

  it("corrects a same-day weigh-in rather than adding a second", () => {
    let log = withBodyweightEntry([], day("2026-03-01T07:00:00", 178));
    log = withBodyweightEntry(log, day("2026-03-01T19:00:00", 180));
    expect(log).toHaveLength(1);
    expect(log[0].lbs).toBe(180);
  });

  it("treats a different day as a different entry", () => {
    let log = withBodyweightEntry([], day("2026-03-01T23:00:00", 178));
    log = withBodyweightEntry(log, day("2026-03-02T01:00:00", 179));
    expect(log).toHaveLength(2);
  });

  it("drops the oldest once the cap is reached", () => {
    let log: { date: Date; lbs: number }[] = [];
    // One a day past the ceiling; the earliest must fall off, not the newest.
    for (let i = 0; i < MAX_BODYWEIGHT_ENTRIES + 5; i++) {
      log = withBodyweightEntry(log, {
        date: new Date(2020, 0, 1 + i),
        lbs: 150 + i,
      });
    }
    expect(log).toHaveLength(MAX_BODYWEIGHT_ENTRIES);
    expect(log[log.length - 1].lbs).toBe(150 + MAX_BODYWEIGHT_ENTRIES + 4);
  });
});

describe("bodyweightOn", () => {
  const log = [
    { date: new Date("2026-01-01"), lbs: 170 },
    { date: new Date("2026-03-01"), lbs: 178 },
    { date: new Date("2026-06-01"), lbs: 184 },
  ];

  it("has no answer for an empty log", () => {
    expect(bodyweightOn([], new Date("2026-03-01"))).toBeNull();
  });

  it("values a workout against the weigh-in nearest it", () => {
    // The point of dating the log: March's pull-ups get March's weight, not
    // whatever the scale says today.
    expect(bodyweightOn(log, new Date("2026-03-05"))?.lbs).toBe(178);
    expect(bodyweightOn(log, new Date("2026-05-20"))?.lbs).toBe(184);
  });

  it("still answers for a workout logged before tracking began", () => {
    expect(bodyweightOn(log, new Date("2025-06-01"))?.lbs).toBe(170);
  });

  it("uses the latest for a workout after the last weigh-in", () => {
    expect(bodyweightOn(log, new Date("2027-01-01"))?.lbs).toBe(184);
  });
});

describe("bodyweight sets", () => {
  /**
   * The load is the lifter, and the weight field is only what they added — a
   * plate on a dip belt, or a negative for the assisted machine. The added
   * amount is banked in lbs because "bodyweight" leaves nowhere to record which
   * unit was typed.
   */
  const bwSet = (reps: number, added?: number) => ({
    id: "s",
    reps,
    weight: added,
    weightUnit: "bodyweight" as const,
    isCompleted: true,
  });

  it("counts the lifter when nothing is added", () => {
    expect(setVolumeLbs(bwSet(10), 180)).toBe(1800);
  });

  it("adds the belt", () => {
    expect(setVolumeLbs(bwSet(5, 25), 180)).toBe(205 * 5);
  });

  it("subtracts the assistance", () => {
    expect(setVolumeLbs(bwSet(12, -30), 180)).toBe(150 * 12);
  });

  it("counts zero when no bodyweight has ever been recorded", () => {
    // Nothing invented from a number the app doesn't have — this is exactly
    // the behaviour bodyweight sets had before any of this existed.
    expect(setVolumeLbs(bwSet(10), undefined)).toBe(0);
    expect(setVolumeLbs(bwSet(10, 25), undefined)).toBe(0);
  });

  it("never goes negative under more assistance than the lifter weighs", () => {
    expect(setVolumeLbs(bwSet(10, -500), 180)).toBe(0);
  });

  it("still ignores a set that was never completed", () => {
    expect(setVolumeLbs({ ...bwSet(10), isCompleted: false }, 180)).toBe(0);
  });

  it("leaves loaded sets alone", () => {
    // Passing a bodyweight must not leak into ordinary lifts.
    const barbell = { id: "s", reps: 5, weight: 225, weightUnit: "lbs" as const, isCompleted: true };
    expect(setVolumeLbs(barbell, 180)).toBe(1125);
    expect(setVolumeLbs(barbell)).toBe(1125);
  });
});

describe("formatBodyweightLoad", () => {
  it("reads as BW with nothing added", () => {
    expect(formatBodyweightLoad(undefined, "lbs")).toBe("BW");
    expect(formatBodyweightLoad(0, "lbs")).toBe("BW");
  });

  it("shows the belt and the assistance", () => {
    expect(formatBodyweightLoad(25, "lbs")).toBe("BW+25");
    expect(formatBodyweightLoad(-30, "lbs")).toBe("BW-30");
  });

  it("converts the added load for a kg lifter", () => {
    // Banked in lbs, shown in the chosen unit.
    expect(formatBodyweightLoad(convertWeight(20, "kg", "lbs"), "kg")).toBe("BW+20");
  });
});

describe("removing a weigh-in", () => {
  const log = [
    { date: new Date(2026, 7, 4, 7, 30), lbs: 195 },
    { date: new Date(2026, 7, 5, 8, 0), lbs: 190 },
  ];

  it("drops the entry on that day", () => {
    expect(withoutBodyweightEntry(log, new Date(2026, 7, 4))).toEqual([log[1]]);
  });

  it("matches on the day, not the moment it was logged", () => {
    // The entry was recorded at 07:30; deleting it shouldn't require saying so.
    expect(withoutBodyweightEntry(log, new Date(2026, 7, 4, 22, 15))).toEqual([log[1]]);
  });

  it("leaves the log alone when nothing was logged that day", () => {
    expect(withoutBodyweightEntry(log, new Date(2026, 7, 9))).toEqual(log);
  });
});

describe("estimated one-rep max", () => {
  it("makes added reps at the same weight read as progress", () => {
    // The reported case: three weeks of 225, adding a rep each time, which the
    // top-set line drew as flat.
    const weeks = [7, 8, 9].map((reps) => estimatedOneRepMax(225, reps));

    expect(weeks[0]).toBeLessThan(weeks[1]);
    expect(weeks[1]).toBeLessThan(weeks[2]);
    expect(weeks.map(Math.round)).toEqual([278, 285, 293]);
  });

  it("returns the weight itself for a single", () => {
    // The one case where the estimate is not an estimate.
    expect(estimatedOneRepMax(315, 1)).toBeCloseTo(315 * (1 + 1 / 30));
  });

  it("rates a lighter set for more reps above a heavier set for few", () => {
    // 205×10 is worth more as a single than 225×3, which is why the chart picks
    // the best set by this rather than by weight.
    expect(estimatedOneRepMax(205, 10)).toBeGreaterThan(estimatedOneRepMax(225, 3));
  });

  it("counts a set with no reps as nothing", () => {
    expect(estimatedOneRepMax(225, undefined)).toBe(0);
    expect(estimatedOneRepMax(225, 0)).toBe(0);
  });
});

describe("weights on screen", () => {
  it("stops an estimate from claiming six decimal places", () => {
    // The reported case: Epley on 200 for 10 reps is 266.666…, and lbs-to-lbs
    // skips the rounding that a real conversion would have done.
    expect(formatWeight(estimatedOneRepMax(200, 10), "lbs")).toBe("266.5");
  });

  it("drops the decimal on a whole number", () => {
    expect(formatWeight(225, "lbs")).toBe("225");
  });

  it("keeps a half, because that is a real plate change", () => {
    expect(formatWeight(102.5, "lbs")).toBe("102.5");
  });

  it("rounds to the nearest half either way", () => {
    expect(formatWeight(266.7, "lbs")).toBe("266.5");
    expect(formatWeight(266.8, "lbs")).toBe("267");
  });

  it("rounds in the unit on screen, not the one in storage", () => {
    // 220.462 lb is exactly 100 kg, and both orderings agree on it — which is
    // why it proved nothing on its own. 100.3 lb is 45.5 kg, but rounded to a
    // half-pound first it becomes 100.5 lb, which is 45.6 kg. A viewer in kg
    // should see kg halves.
    expect(formatWeight(220.462, "kg")).toBe("100");
    expect(formatWeight(100.3, "kg")).toBe("45.5");
  });
});

describe("sets per category", () => {
  const exercise = (id: string, category: string, done: number, planned = 0) => ({
    id,
    exerciseId: id,
    exercise: { id, name: id, category, musclesWorked: ["x"], description: "" },
    orderIndex: 0,
    sets: [
      ...Array.from({ length: done }, (_, i) => ({
        id: `${id}-d${i}`,
        weightUnit: "lbs" as const,
        isCompleted: true,
      })),
      ...Array.from({ length: planned }, (_, i) => ({
        id: `${id}-p${i}`,
        weightUnit: "lbs" as const,
        isCompleted: false,
      })),
    ],
  });

  const workout = (...exercises: ReturnType<typeof exercise>[]) =>
    ({
      id: "w",
      userId: "u",
      name: "w",
      isTemplate: false,
      createdAt: new Date(),
      exercises,
    }) as Workout;

  it("adds a category up across exercises and workouts", () => {
    const result = setsByCategory([
      workout(exercise("bench", "Chest", 3), exercise("fly", "Chest", 3)),
      workout(exercise("row", "Back", 4)),
    ]);

    expect(result).toEqual([
      { category: "Chest", sets: 6 },
      { category: "Back", sets: 4 },
    ]);
  });

  it("counts a set once, in one category", () => {
    // The reason this counts categories rather than muscles: bench works chest,
    // triceps and shoulders, and counting it against each would read ten sets
    // of pressing as ten of everything.
    const result = setsByCategory([workout(exercise("bench", "Chest", 10))]);

    expect(result).toEqual([{ category: "Chest", sets: 10 }]);
  });

  it("ignores sets that were written down but not done", () => {
    const result = setsByCategory([workout(exercise("squat", "Legs", 2, 3))]);

    expect(result).toEqual([{ category: "Legs", sets: 2 }]);
  });

  it("leaves out a category with nothing completed in it", () => {
    const result = setsByCategory([workout(exercise("curl", "Biceps", 0, 4))]);

    expect(result).toEqual([]);
  });

  it("orders by size, then by name so it cannot flicker", () => {
    const result = setsByCategory([
      workout(exercise("a", "Shoulders", 3), exercise("b", "Back", 3), exercise("c", "Legs", 9)),
    ]);

    expect(result.map((r) => r.category)).toEqual(["Legs", "Back", "Shoulders"]);
  });
});
