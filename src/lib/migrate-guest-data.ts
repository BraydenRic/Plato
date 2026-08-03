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
  recordMigratedTemplate,
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
  /**
   * Custom exercises that could not come across, because the account plus the
   * guest's own would have overflowed MAX_CUSTOM_EXERCISES. Surfaced so the
   * loss can be reported rather than happening in silence.
   */
  customExercisesDropped: number;
}

// Keep the account's own edits on conflict — they're deliberate and long-standing,
// where guest edits were made minutes ago in a throwaway session.
//
// The cap is the one place this can genuinely lose something. Every custom
// exercise lives in a single Firestore document, so MAX_CUSTOM_EXERCISES keeps
// that doc under the 1 MB ceiling — it can't simply be lifted the way the
// template and active-workout limits can. Since the account's own entries come
// first, any overflow falls on the guest's, so the count comes back with the
// merge for the caller to report instead of vanishing.
function mergeLibraries(
  account: ExerciseLibrary,
  guest: ExerciseLibrary
): { library: ExerciseLibrary; dropped: number } {
  const accountCustomIds = new Set(account.custom.map((e) => e.id));
  const overriddenIds = new Set(account.overrides.map((e) => e.id));
  const combined = [
    ...account.custom,
    ...guest.custom.filter((e) => !accountCustomIds.has(e.id)),
  ];
  return {
    library: {
      custom: combined.slice(0, MAX_CUSTOM_EXERCISES),
      removedIds: [...new Set([...account.removedIds, ...guest.removedIds])],
      overrides: [...account.overrides, ...guest.overrides.filter((e) => !overriddenIds.has(e.id))],
    },
    dropped: Math.max(0, combined.length - MAX_CUSTOM_EXERCISES),
  };
}

/** Returns how many custom exercises the cap forced out. */
async function migrateLibrary(userId: string, guest: GuestData): Promise<number> {
  const { custom, removedIds, overrides } = guest.library;
  if (custom.length === 0 && removedIds.length === 0 && overrides.length === 0) return 0;
  const account = await getExerciseLibrary(userId);
  const { library, dropped } = mergeLibraries(account, guest.library);
  await updateExerciseLibrary(userId, library);
  return dropped;
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

  // Templates and in-progress workouts are uploaded without regard to
  // MAX_TEMPLATES / MAX_ACTIVE_WORKOUTS, and deliberately so. Those two are
  // product limits on creating more, not storage limits — each workout is its
  // own document — so enforcing them here would mean deleting something the
  // user logged in order to satisfy a number. Landing slightly over is the
  // safe side: the UI already refuses to create more and says which to delete,
  // so it settles itself.
  //
  // Sequential on purpose: each workout leaves the device only once it's safely
  // in the cloud, which makes a partial failure resumable instead of duplicating.
  //
  // Seeded with what earlier attempts already uploaded — those templates are
  // long gone from the device, but the weekly split below still needs to know
  // where they landed.
  const templateIdMap = new Map<string, string>(Object.entries(guest.migratedTemplateIds));
  let migrated = 0;
  for (const workout of [...guest.workouts]) {
    const { id, ...fields } = workout;
    const cloudId = await createWorkout(stripUndefined({ ...fields, userId }), true);
    // Record before removing: between these two writes the mapping is the only
    // thing tying the split to the uploaded template.
    if (workout.isTemplate) {
      templateIdMap.set(id, cloudId);
      await recordMigratedTemplate(id, cloudId);
    }
    await removeMigratedWorkout(id);
    migrated++;
  }

  const customExercisesDropped = await migrateLibrary(userId, guest);
  await migrateWeeklyPlanWithIds(userId, guest.weeklyPlan, templateIdMap);

  // Totals and streaks are derived, so recompute from what actually landed.
  await upsertUserStats({ userId, ...computeStats(await getCompletedWorkouts(userId)) });

  await clearGuestData();
  await writeGuestActive(false);
  return { workouts: migrated, customExercisesDropped };
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
