import {
  staleBodyweightVolumes,
  staleVolumesOnDay,
  zeroedBodyweightVolumes,
} from "../repair-bodyweight-volumes";
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

// The reported case: 195 lbs on the 4th, 190 on the 5th. Weighed in each
// morning, and kept with the time of day, as Profile records them.
const log: BodyweightEntry[] = [
  { date: new Date(2026, 7, 4, 7), lbs: 195 },
  { date: new Date(2026, 7, 5, 7), lbs: 190 },
];

/**
 * A plan for `day` logged straight onto it from `typed`, as the app writes one:
 * never started, and finishWith stamps completedAt at noon on the scheduled
 * day. The old path froze its volume before that stamp existed, so it went by
 * createdAt.
 */
function backfilled(day: Date, typed: Date): Pick<Workout, "scheduledFor" | "createdAt" | "completedAt"> {
  return { scheduledFor: day, createdAt: typed, completedAt: new Date(day.getTime() + 12 * 3_600_000) };
}

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
    // Typed up on the morning of the 5th, filed under the 4th — the case
    // that broke.
    ...backfilled(AUG_4, new Date(2026, 7, 5, 9)),
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
  // A dip belt (+25) and the assisted machine (−30), both on the 4th, frozen
  // at the 5th's 190: 5 × 215 + 5 × 160.
  const stale = workout({ sets: [bwSet(5, 25), bwSet(5, -30)], totalVolume: 1875 });

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
  const threeDays: BodyweightEntry[] = [...log, { date: new Date(2026, 7, 6, 7), lbs: 185 }];
  // Each typed up the morning after it happened, and frozen at that day's weight.
  const onThe4th = workout({ id: "a", sets: [bwSet(10)], ...backfilled(AUG_4, new Date(2026, 7, 5, 9)), totalVolume: 1900 });
  const onThe5th = workout({ id: "b", sets: [bwSet(10)], ...backfilled(AUG_5, new Date(2026, 7, 6, 9)), totalVolume: 1850 });

  expect(staleBodyweightVolumes([onThe4th, onThe5th], threeDays)).toEqual([
    { id: "a", totalVolume: 1950 },
    { id: "b", totalVolume: 1900 },
  ]);
});

/**
 * The repair's done marker is kept on the device, so a reinstall, a new phone
 * or a second device runs it over the whole cloud history again. It may only
 * ever find the old path's one mistake, or a new phone re-values everything.
 */
describe("running again on a new phone", () => {
  it("leaves a session from before the first weigh-in at zero", () => {
    // Nothing was recorded then, so zero was the honest number.
    const early = workout({
      sets: [bwSet(10)],
      totalVolume: 0,
      ...backfilled(new Date(2026, 7, 1), new Date(2026, 7, 2, 9)),
    });

    expect(staleBodyweightVolumes([early], log)).toEqual([]);
  });

  it("doesn't invent a volume for a session from before the first weigh-in", () => {
    const { totalVolume, ...early } = workout({
      sets: [bwSet(10)],
      ...backfilled(new Date(2026, 7, 1), new Date(2026, 7, 2, 9)),
    });
    expect(totalVolume).toBeUndefined();

    expect(staleBodyweightVolumes([early as Workout], log)).toEqual([]);
  });

  it("leaves a session priced at the weigh-in it had, though a nearer one was logged later", () => {
    // Pull-ups on the 5th, typed up early on the 6th and priced at the 1st's
    // 200 because that was all there was. The 6th's 190 came half an hour later.
    const OCT_1 = new Date(2026, 9, 1);
    const OCT_5 = new Date(2026, 9, 5);
    const later: BodyweightEntry[] = [
      { date: OCT_1, lbs: 200 },
      { date: new Date(2026, 9, 6, 7), lbs: 190 },
    ];
    const priced = workout({ sets: [bwSet(10)], ...backfilled(OCT_5, new Date(2026, 9, 6, 6, 30)), totalVolume: 2000 });

    expect(staleBodyweightVolumes([priced], later)).toEqual([]);
  });

  // Weighed in at night, the old lookup could price a morning on the evening
  // before. That was the lookup, not the day being skipped: a different
  // mistake from the one this repairs, and not its to rewrite.
  it("leaves alone anything the old path priced from its own day", () => {
    const evenings: BodyweightEntry[] = [
      { date: new Date(2026, 7, 4, 18, 30), lbs: 195 },
      { date: new Date(2026, 7, 5, 18, 30), lbs: 190 },
    ];
    const SIX_AM = new Date(2026, 7, 5, 6);
    // Lifted live at 6am on the 5th, and priced at the 4th's evening 195.
    const lifted = workout({
      id: "lifted",
      sets: [bwSet(10)],
      scheduledFor: undefined,
      createdAt: SIX_AM,
      startedAt: SIX_AM,
      completedAt: new Date(2026, 7, 5, 7),
      durationMinutes: 60,
      totalVolume: 1950,
    });
    // Planned at 6am for that day, logged a day late, and priced the same way.
    const plannedThatDay = workout({ id: "planned", sets: [bwSet(10)], ...backfilled(AUG_5, SIX_AM), totalVolume: 1950 });

    expect(staleBodyweightVolumes([lifted, plannedThatDay], evenings)).toEqual([]);
  });

  it("corrects a session once, and leaves the corrected number alone after", () => {
    const stale = workout({ sets: [bwSet(10)], totalVolume: 1900 });
    const [correction] = staleBodyweightVolumes([stale], log);
    expect(correction).toEqual({ id: "w1", totalVolume: 1950 });

    const corrected = { ...stale, totalVolume: correction.totalVolume };
    expect(staleBodyweightVolumes([corrected], log)).toEqual([]);
  });
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

  // Weigh-ins keep their time of day. Matched by raw time against midnight,
  // the 20th's evening typo priced the 21st's session, and editing the 21st's
  // own weigh-in found nothing to re-price — though the prompt promised it.
  it("re-prices a day's session when that day's evening weigh-in is edited", () => {
    const evenings: BodyweightEntry[] = [
      { date: new Date(2026, 9, 20, 18, 30), lbs: 250 },
      { date: new Date(2026, 9, 21, 18, 30), lbs: 192 },
    ];
    const OCT_21 = new Date(2026, 9, 21);
    // Frozen at the 20th's typo by the old lookup.
    const inflated = workout({ sets: [bwSet(10)], scheduledFor: OCT_21, completedAt: OCT_21, totalVolume: 2500 });

    expect(staleVolumesOnDay([inflated], evenings, evenings[1].date)).toEqual([
      { id: "w1", totalVolume: 1920 },
    ]);
  });

  it("re-prices a session the one-time repair would leave alone", () => {
    // Priced at a weigh-in that was then corrected: nothing like the old
    // path's figure, but the user just said the number behind it was wrong.
    const inflated = workout({ sets: [bwSet(10)], totalVolume: 2500 });

    expect(staleBodyweightVolumes([inflated], log)).toEqual([]);
    expect(staleVolumesOnDay([inflated], log, AUG_4)).toEqual([{ id: "w1", totalVolume: 1950 }]);
  });

  it("leaves stored volumes standing when the last weigh-in is deleted", () => {
    const onThe4th = workout({ sets: [bwSet(10)], scheduledFor: AUG_4, totalVolume: 1950 });

    // Emptying the log must never re-price a session at zero.
    expect(staleVolumesOnDay([onThe4th], [], AUG_4)).toEqual([]);
  });
});

/**
 * Sessions finished while the weigh-in log had failed to load froze their
 * bodyweight sets at zero. This runs on every launch, so the refusals are the
 * point: it may only ever match that one failure.
 */
describe("volumes frozen while the log was missing", () => {
  it("prices a session frozen at zero against the weigh-in it should have had", () => {
    // 10 pull-ups on the 4th, stored as if nobody weighed anything.
    const zeroed = workout({ sets: [bwSet(10)], totalVolume: 0 });

    expect(zeroedBodyweightVolumes([zeroed], log)).toEqual([{ id: "w1", totalVolume: 1950 }]);
  });

  it("keeps the rest of the session's volume, correcting only the bodyweight part", () => {
    const mixed = workout({ sets: [bwSet(10), barbellSet(5, 100)], totalVolume: 500 });

    expect(zeroedBodyweightVolumes([mixed], log)).toEqual([{ id: "w1", totalVolume: 2450 }]);
  });

  it("leaves a session from before the first weigh-in at zero", () => {
    // Zero was the honest number then. Pricing it now would be a weigh-in
    // re-writing history, which freezing the volume exists to prevent.
    const early = workout({
      sets: [bwSet(10)],
      totalVolume: 0,
      scheduledFor: new Date(2026, 7, 1),
      completedAt: new Date(2026, 7, 1),
    });

    expect(zeroedBodyweightVolumes([early], log)).toEqual([]);
  });

  it("never re-values a session frozen against a real weigh-in", () => {
    // Priced at the 5th's weight though it belongs to the 4th — the one-time
    // repair's business, not this one's, and it must not become an every-launch
    // re-valuation by the back door.
    const priced = workout({ sets: [bwSet(10)], totalVolume: 1900 });

    expect(zeroedBodyweightVolumes([priced], log)).toEqual([]);
  });

  it("writes nothing when heavy assistance really did come to zero", () => {
    const assisted = workout({ sets: [bwSet(10, -250)], totalVolume: 0 });

    expect(zeroedBodyweightVolumes([assisted], log)).toEqual([]);
  });

  it("leaves a session with no stored volume to the one-time repair", () => {
    const unstored = workout({ sets: [bwSet(10)] });

    expect(zeroedBodyweightVolumes([unstored], log)).toEqual([]);
  });

  it("does nothing against an empty log, which is what a failed read looks like", () => {
    const zeroed = workout({ sets: [bwSet(10)], totalVolume: 0 });

    expect(zeroedBodyweightVolumes([zeroed], [])).toEqual([]);
  });
});
