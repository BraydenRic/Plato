import { bodyweightOn, sameDay, workoutDay, workoutVolumeLbs } from "./workout-utils";
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
