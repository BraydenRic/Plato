import { staleBodyweightVolumes, staleVolumesOnDay } from "../repair-bodyweight-volumes";
import type { BodyweightEntry, Workout, WorkoutSet } from "@/types";

/**
 * The repair rewrites finished history, so what it *declines* to touch matters
 * more than what it corrects. Three things must never move: a workout whose
 * volume never depended on a weigh-in, one already holding the right number,
 * and anything at all when the log is empty — which is what a failed read looks
 * like, and repairing against one would re-price every bodyweight set at zero.
 */

const AUG_4 = new Date(2026, 7, 4);
const AUG_5 = new Date(2026, 7, 5);

// The reported case: 195 lbs on the 4th, 190 on the 5th.
const log: BodyweightEntry[] = [
  { date: AUG_4, lbs: 195 },
  { date: AUG_5, lbs: 190 },
];

function bwSet(reps: number, added?: number): WorkoutSet {
  return { id: `s${reps}-${added ?? 0}`, reps, weight: added, weightUnit: "bodyweight", isCompleted: true };
}

function barbellSet(reps: number, weight: number): WorkoutSet {
  return { id: `b${reps}-${weight}`, reps, weight, weightUnit: "lbs", isCompleted: true };
}

function workout(overrides: Partial<Workout> & { sets: WorkoutSet[] }): Workout {
  const { sets, ...rest } = overrides;
  return {
    id: "w1",
    userId: "u1",
    name: "Pull Day",
    isTemplate: false,
    createdAt: AUG_5,
    // Typed up on the 5th, filed under the 4th — the case that broke.
    scheduledFor: AUG_4,
    completedAt: AUG_5,
    exercises: [
      {
        id: "e1",
        exerciseId: "pull-up",
        exercise: {
          id: "pull-up",
          name: "Pull-Up",
          category: "Back",
          musclesWorked: ["lats"],
          description: "",
          isBodyweight: true,
        },
        orderIndex: 0,
        sets,
      },
    ],
    ...rest,
  };
}

it("re-prices a backfilled session at the weight of the day it is filed under", () => {
  // Frozen at the 5th's 190 lbs when it belongs to the 4th's 195.
  const stale = workout({ sets: [bwSet(10)], totalVolume: 1900 });

  expect(staleBodyweightVolumes([stale], log)).toEqual([{ id: "w1", totalVolume: 1950 }]);
});

it("leaves a workout already holding the right number alone", () => {
  const fine = workout({ sets: [bwSet(10)], totalVolume: 1950 });

  expect(staleBodyweightVolumes([fine], log)).toEqual([]);
});

it("leaves workouts whose volume never depended on a weigh-in alone", () => {
  // Deliberately stored wrong. Nothing here is priced from bodyweight, so the
  // day it is filed under cannot explain the difference and the repair has no
  // business guessing at one.
  const barbell = workout({ sets: [barbellSet(5, 225)], totalVolume: 999 });

  expect(staleBodyweightVolumes([barbell], log)).toEqual([]);
});

it("does nothing at all when the log is empty", () => {
  const stale = workout({ sets: [bwSet(10)], totalVolume: 1900 });

  // A failed read is indistinguishable from having never weighed in, and
  // repairing against either would zero the session out.
  expect(staleBodyweightVolumes([stale], [])).toEqual([]);
});

it("fills in a volume an older build never stored", () => {
  const { totalVolume, ...rest } = workout({ sets: [bwSet(10)] });
  expect(totalVolume).toBeUndefined();

  // Readers fall back to deriving with no weight, so the session currently
  // reads as zero volume rather than as slightly wrong.
  expect(staleBodyweightVolumes([rest as Workout], log)).toEqual([
    { id: "w1", totalVolume: 1950 },
  ]);
});

it("ignores drift too small to be a different weigh-in", () => {
  const rounded = workout({ sets: [bwSet(10)], totalVolume: 1949.7 });

  expect(staleBodyweightVolumes([rounded], log)).toEqual([]);
});

it("counts added and assisted load against the corrected weight", () => {
  // A dip belt (+25) and the assisted machine (−30), both on the 4th.
  const stale = workout({ sets: [bwSet(5, 25), bwSet(5, -30)], totalVolume: 1750 });

  // 5 × (195+25) + 5 × (195−30) = 1100 + 825
  expect(staleBodyweightVolumes([stale], log)).toEqual([{ id: "w1", totalVolume: 1925 }]);
});

it("skips sets that were never completed, exactly as the live valuation does", () => {
  const withSkipped = workout({
    sets: [bwSet(10), { id: "skipped", reps: 8, weightUnit: "bodyweight", isCompleted: false }],
    totalVolume: 1950,
  });

  expect(staleBodyweightVolumes([withSkipped], log)).toEqual([]);
});

it("values each workout against its own day, not one shared weight", () => {
  const onThe4th = workout({ id: "a", sets: [bwSet(10)], scheduledFor: AUG_4, totalVolume: 0 });
  const onThe5th = workout({ id: "b", sets: [bwSet(10)], scheduledFor: AUG_5, totalVolume: 0 });

  expect(staleBodyweightVolumes([onThe4th, onThe5th], log)).toEqual([
    { id: "a", totalVolume: 1950 },
    { id: "b", totalVolume: 1900 },
  ]);
});

describe("re-pricing a single day after its weigh-in is fixed", () => {
  it("touches only workouts filed under the day that changed", () => {
    const onThe4th = workout({ id: "a", sets: [bwSet(10)], scheduledFor: AUG_4, totalVolume: 0 });
    const onThe5th = workout({ id: "b", sets: [bwSet(10)], scheduledFor: AUG_5, totalVolume: 0 });

    expect(staleVolumesOnDay([onThe4th, onThe5th], log, AUG_4)).toEqual([
      { id: "a", totalVolume: 1950 },
    ]);
  });

  it("prices against the corrected number", () => {
    // The typo: 250 was entered on the 4th, so the session was inflated.
    const typo: BodyweightEntry[] = [{ date: AUG_4, lbs: 250 }];
    const inflated = workout({ sets: [bwSet(10)], scheduledFor: AUG_4, totalVolume: 2500 });

    const fixed: BodyweightEntry[] = [{ date: AUG_4, lbs: 190 }];
    expect(staleVolumesOnDay([inflated], fixed, AUG_4)).toEqual([{ id: "w1", totalVolume: 1900 }]);
    // And with the typo still in place there is nothing to correct.
    expect(staleVolumesOnDay([inflated], typo, AUG_4)).toEqual([]);
  });

  it("falls back to the nearest remaining weigh-in when one is deleted", () => {
    const onThe5th = workout({ sets: [bwSet(10)], scheduledFor: AUG_5, totalVolume: 1900 });

    // The 5th's entry is gone; the 4th's 195 is what's left.
    expect(staleVolumesOnDay([onThe5th], [{ date: AUG_4, lbs: 195 }], AUG_5)).toEqual([
      { id: "w1", totalVolume: 1950 },
    ]);
  });

  it("leaves stored volumes standing when the last weigh-in is deleted", () => {
    const onThe4th = workout({ sets: [bwSet(10)], scheduledFor: AUG_4, totalVolume: 1950 });

    // Emptying the log must never re-price a session at zero.
    expect(staleVolumesOnDay([onThe4th], [], AUG_4)).toEqual([]);
  });
});
