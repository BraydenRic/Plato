import { computeStats, updateWorkout, upsertUserStats } from "./data";
import type { VolumeCorrection } from "./repair-bodyweight-volumes";
import type { Workout } from "@/types";

/**
 * Writes a set of volume corrections, and brings the stored lifetime stats
 * along with them.
 *
 * Split out from the calculation next door so that side stays a pure function
 * of its arguments — it decides what to rewrite in someone's finished history,
 * which is worth being able to test without a data layer anywhere near it.
 *
 * @param completed All finished workouts, used to recompute the lifetime
 *   totals. Passed in rather than re-fetched, since every caller is holding it.
 */
export async function applyVolumeCorrections(
  corrections: VolumeCorrection[],
  completed: Workout[],
  userId: string
): Promise<void> {
  if (corrections.length === 0) return;

  // Sequential rather than all at once. This is background work behind a screen
  // the user is already using, and it has nothing to race.
  for (const correction of corrections) {
    await updateWorkout(correction.id, { totalVolume: correction.totalVolume });
  }

  // The Stats tab derives from the workouts themselves, so it is already right
  // by here. This is the stored lifetime doc, which only plato-web reads.
  const corrected = new Map(corrections.map((c) => [c.id, c.totalVolume]));
  const repaired = completed.map((workout) =>
    corrected.has(workout.id)
      ? { ...workout, totalVolume: corrected.get(workout.id)! }
      : workout
  );
  await upsertUserStats({ userId, ...computeStats(repaired) });
}
