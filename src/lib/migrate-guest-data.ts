import {
  computeStats,
  createWorkout,
  getCompletedWorkouts,
  stripUndefined,
  upsertUserStats,
} from "./data";
import {
  getExerciseLibrary,
  getWeeklyPlan,
  setWeeklyPlan,
  updateExerciseLibrary,
  type ExerciseLibrary,
  type WeeklyPlan,
} from "./firestore";
import { MAX_CUSTOM_EXERCISES } from "./workout-utils";
import {
  clearGuestData,
  hasContent,
  readGuestData,
  removeMigratedWorkout,
  writeGuestActive,
  type GuestData,
} from "./local-store";

/**
 * Moves everything a guest logged on this device into their new cloud account.
 *
 * Two rules drive the design:
 *  1. Never lose a workout. Each one is removed from the device only after its
 *     cloud write succeeds, so a failure halfway through leaves the rest intact
 *     and a retry can't duplicate what already made it across.
 *  2. Never clobber. Someone may be signing into an account that already has
 *     data, so the library and weekly split merge rather than overwrite.
 */

export interface MigrationResult {
  workouts: number;
}

// Keep the account's own edits on conflict — they're deliberate and long-standing,
// where guest edits were made minutes ago in a throwaway session.
function mergeLibraries(account: ExerciseLibrary, guest: ExerciseLibrary): ExerciseLibrary {
  const accountCustomIds = new Set(account.custom.map((e) => e.id));
  const overriddenIds = new Set(account.overrides.map((e) => e.id));
  return {
    custom: [...account.custom, ...guest.custom.filter((e) => !accountCustomIds.has(e.id))].slice(
      0,
      MAX_CUSTOM_EXERCISES
    ),
    removedIds: [...new Set([...account.removedIds, ...guest.removedIds])],
    overrides: [...account.overrides, ...guest.overrides.filter((e) => !overriddenIds.has(e.id))],
  };
}

async function migrateLibrary(userId: string, guest: GuestData): Promise<void> {
  const { custom, removedIds, overrides } = guest.library;
  if (custom.length === 0 && removedIds.length === 0 && overrides.length === 0) return;
  const account = await getExerciseLibrary(userId);
  await updateExerciseLibrary(userId, mergeLibraries(account, guest.library));
}

/**
 * Uploads guest data to `userId`, then clears the device copy.
 * Returns null when there was nothing to move.
 */
export async function migrateGuestDataTo(userId: string): Promise<MigrationResult | null> {
  const guest = await readGuestData();
  if (!hasContent(guest)) {
    await writeGuestActive(false);
    return null;
  }

  // Sequential on purpose: each workout leaves the device only once it's safely
  // in the cloud, which makes a partial failure resumable instead of duplicating.
  const templateIdMap = new Map<string, string>();
  let migrated = 0;
  for (const workout of [...guest.workouts]) {
    const { id, ...fields } = workout;
    const cloudId = await createWorkout(stripUndefined({ ...fields, userId }), true);
    if (workout.isTemplate) templateIdMap.set(id, cloudId);
    await removeMigratedWorkout(id);
    migrated++;
  }

  await migrateLibrary(userId, guest);
  await migrateWeeklyPlanWithIds(userId, guest.weeklyPlan, templateIdMap);

  // Totals and streaks are derived, so recompute from what actually landed.
  await upsertUserStats({ userId, ...computeStats(await getCompletedWorkouts(userId)) });

  await clearGuestData();
  await writeGuestActive(false);
  return { workouts: migrated };
}

// Guest template ids don't survive the upload, so remap each weekday onto the
// template's new cloud id. Days the account already filled are left alone.
async function migrateWeeklyPlanWithIds(
  userId: string,
  guestPlan: WeeklyPlan,
  templateIdMap: Map<string, string>
): Promise<void> {
  if (!guestPlan.some((day) => day !== null)) return;
  const account = await getWeeklyPlan(userId);
  const merged = account.map((day, i) => {
    if (day !== null) return day;
    const guestDay = guestPlan[i];
    return guestDay ? templateIdMap.get(guestDay) ?? null : null;
  });
  if (merged.some((day, i) => day !== account[i])) await setWeeklyPlan(userId, merged);
}
