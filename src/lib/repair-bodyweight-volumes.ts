import { bodyweightOn, sameDay, startOfDay, workoutDay, workoutVolumeLbs } from "./workout-utils";
import type { BodyweightEntry, Workout } from "@/types";

/**
 * One-time repair of volumes frozen against the wrong day's weigh-in.
 *
 * Finishing a workout stores `totalVolume`, and every reader prefers that
 * stored number over re-deriving it — deliberately, so a weigh-in tomorrow
 * can't re-value what you lifted today. Until build 29 the weight it froze was
 * resolved by walking completedAt → startedAt → createdAt, which skips
 * `scheduledFor` entirely: a session backfilled onto yesterday was priced at
 * this morning's weigh-in. Sessions logged that way are still carrying the
 * wrong number, and because the stored value wins, nothing re-derives it.
 *
 * A correction, not a re-valuation — which is why it runs once rather than on
 * every launch. Re-running it forever would mean correcting a missed weigh-in
 * next month quietly rewrote last month's history, and that is exactly what
 * freezing the number exists to prevent.
 */

export interface VolumeCorrection {
  id: string;
  /** What the workout's volume should have been, in lbs. */
  totalVolume: number;
}

/**
 * Whether this workout's volume depends on what the lifter weighed at all.
 *
 * Matches setVolumeLbs exactly: only a completed bodyweight set with reps in it
 * contributes. Anything else is priced from the weight written on the set, so
 * the day it was filed under cannot have changed its total — and rewriting one
 * would be a change with no cause behind it.
 */
function dependsOnBodyweight(workout: Workout): boolean {
  return workout.exercises.some((ex) =>
    ex.sets.some((set) => set.isCompleted && !!set.reps && set.weightUnit === "bodyweight")
  );
}

/**
 * The corrections to apply, or an empty list if there is nothing to fix.
 *
 * @param completed Finished workouts.
 * @param log The weigh-in log.
 */
export function staleBodyweightVolumes(
  completed: Workout[],
  log: BodyweightEntry[]
): VolumeCorrection[] {
  // An empty log can't value a bodyweight set, so it can't improve on anything
  // already stored. It is also indistinguishable from a log that failed to
  // load — and repairing against one of those would re-price every bodyweight
  // set at zero. Doing nothing is right for both.
  //
  // Deliberately doubled with the `!lbs` check below, which catches the same
  // case today because bodyweightOn only returns null for an empty log. Neither
  // is dead: this one states the precondition without depending on what
  // bodyweightOn does, and that one holds if it ever learns to return a default
  // instead. Writing a zeroed volume over real history is worth two locks —
  // remove either and the other still catches it; remove both and the tests
  // fail.
  if (log.length === 0) return [];

  const corrections: VolumeCorrection[] = [];
  for (const workout of completed) {
    if (!dependsOnBodyweight(workout)) continue;

    const lbs = bodyweightOn(log, workoutDay(workout))?.lbs;
    if (!lbs) continue;

    const correct = workoutVolumeLbs(workout, lbs);
    const stored = workout.totalVolume;

    // Missing entirely means an older build finished it without storing one, so
    // readers fall back to deriving it with no weight at all and every
    // bodyweight set counts zero. Filling it in is the same fix.
    if (stored == null) {
      corrections.push({ id: workout.id, totalVolume: correct });
      continue;
    }

    // Under half a pound across a whole session is arithmetic, not a different
    // weigh-in. Rewriting on that would churn the history for nothing.
    if (Math.abs(correct - stored) < 0.5) continue;

    corrections.push({ id: workout.id, totalVolume: correct });
  }
  return corrections;
}

/**
 * The same correction, narrowed to the workouts filed under one day.
 *
 * What a *fixed* weigh-in needs. Typing 250 where you meant 190 inflates the
 * volume of everything you lifted that day, and correcting the number is
 * pointless if the workout it mispriced keeps the inflated figure. That is not
 * the same as re-valuing history on a new weigh-in — the entry being corrected
 * was wrong, and this only touches the day it was wrong on.
 *
 * Deleting a weigh-in comes through here too: with it gone, bodyweightOn falls
 * to the nearest one that is left, which is what the rest of the app would have
 * used all along. If nothing is left, staleBodyweightVolumes refuses to price
 * anything and the stored numbers stand — better a stale volume than a zeroed
 * one.
 */
export function staleVolumesOnDay(
  completed: Workout[],
  log: BodyweightEntry[],
  day: Date
): VolumeCorrection[] {
  return staleBodyweightVolumes(
    completed.filter((workout) => sameDay(workoutDay(workout), day)),
    log
  );
}

/**
 * Workouts finished while the weigh-in log had failed to load.
 *
 * The workout screen read the log once, and a cold start with no signal failed
 * that read for good — so a session finished in a dead zone froze its
 * bodyweight sets at zero, though a weigh-in was on file the whole time. The
 * read no longer fails that way, but the sessions it already mispriced keep
 * their stored number, and the stored number always wins.
 *
 * Unlike the one-time repair above, this is safe to run on every launch,
 * because what it looks for can only have come from that failure:
 *
 *  - The stored volume is exactly what the sets come to with no weight at all.
 *    A volume frozen against a real weigh-in never matches that, unless every
 *    bodyweight set in it is assisted down to nothing — and then the correct
 *    number is the same zero, so there is nothing to write.
 *  - A weigh-in was already on file on or before the workout's day. Before the
 *    first one, zero was the honest answer ("nothing recorded, nothing
 *    invented"), and pricing those now would be a weigh-in re-writing history —
 *    the thing freezing the number exists to prevent.
 *
 * Once corrected, a workout stops matching the first test, so this never
 * touches the same one twice.
 */
export function zeroedBodyweightVolumes(
  completed: Workout[],
  log: BodyweightEntry[]
): VolumeCorrection[] {
  // Same lock as staleBodyweightVolumes: an empty log is also what a failed
  // read looks like, and it has no weight to price anything with.
  if (log.length === 0) return [];
  const firstWeighIn = startOfDay(log.reduce((a, b) => (a.date < b.date ? a : b)).date).getTime();

  const corrections: VolumeCorrection[] = [];
  for (const workout of completed) {
    if (!dependsOnBodyweight(workout)) continue;
    const stored = workout.totalVolume;
    // Missing is the one-time repair's case, not this one.
    if (stored == null) continue;

    const day = workoutDay(workout);
    if (day.getTime() < firstWeighIn) continue;

    const pricedWithNoWeight = Math.abs(stored - workoutVolumeLbs(workout)) < 0.5;
    if (!pricedWithNoWeight) continue;

    const lbs = bodyweightOn(log, day)?.lbs;
    if (!lbs) continue;
    const correct = workoutVolumeLbs(workout, lbs);
    if (Math.abs(correct - stored) < 0.5) continue;

    corrections.push({ id: workout.id, totalVolume: correct });
  }
  return corrections;
}
