import {
  computeStats,
  createWorkout,
  getCompletedWorkouts,
  stripUndefined,
  upsertUserStats,
} from "./data";
import {
  countActiveWorkouts,
  getBodyweightLog,
  getExerciseLibrary,
  getWorkouts,
  setBodyweightLog,
  getWeeklyPlan,
  setWeeklyPlan,
  updateExerciseLibrary,
  type ExerciseLibrary,
  type WeeklyPlan,
} from "./firestore";
import {
  MAX_CUSTOM_EXERCISES,
  MAX_MERGED_ACTIVE_WORKOUTS,
  MAX_MERGED_TEMPLATES,
  isActiveWorkout,
  withBodyweightEntry,
} from "./workout-utils";
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
  /**
   * Templates left behind because the merged total would have passed
   * MAX_MERGED_TEMPLATES. Surfaced for the same reason as the exercises above.
   */
  templatesDropped: number;
  /**
   * In-progress workouts left behind for the same reason as the templates above.
   * Finished ones are never affected.
   */
  activeWorkoutsDropped: number;
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

/**
 * Folds the guest's weigh-ins into the account's, one day at a time.
 *
 * Union rather than overwrite, like the library: someone may have weighed in on
 * both sides. withBodyweightEntry replaces same-day entries, so the guest's
 * reading wins a collision — it is the more recent of the two by definition,
 * since the account was dormant while they were using guest mode.
 */
async function migrateBodyweight(userId: string, guest: GuestData): Promise<void> {
  const entries = guest.bodyweight ?? [];
  if (entries.length === 0) return;
  let merged = await getBodyweightLog(userId);
  for (const entry of entries) merged = withBodyweightEntry(merged, entry);
  await setBodyweightLog(userId, merged);
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

  // Templates get a ceiling here, but a deliberately generous one — see
  // MAX_MERGED_TEMPLATES. The per-screen limit only governs creating more, so
  // without this a sign-out/guest/sign-in cycle could be repeated to climb past
  // it indefinitely. Room is measured against what the account already holds, so
  // the cap can't be walked around by merging twice.
  //
  // In-progress workouts get the same treatment, for the same reason — the
  // per-screen limit of five is walked past by the same repeated cycle. The
  // count comes from an unlimited read rather than getWorkouts, whose 50-row
  // window could miss an abandoned session sitting behind a long history.
  //
  // Finished workouts are never capped. A completed session is the history the
  // app exists to keep; a template or an abandoned session is not.
  //
  // Sequential on purpose: each workout leaves the device only once it's safely
  // in the cloud, which makes a partial failure resumable instead of duplicating.
  //
  // Seeded with what earlier attempts already uploaded — those templates are
  // long gone from the device, but the weekly split below still needs to know
  // where they landed.
  const templateIdMap = new Map<string, string>(Object.entries(guest.migratedTemplateIds));
  let templateRoom = MAX_MERGED_TEMPLATES - (await getWorkouts(userId, true)).length;
  let activeRoom = MAX_MERGED_ACTIVE_WORKOUTS - (await countActiveWorkouts(userId));
  let templatesDropped = 0;
  let activeWorkoutsDropped = 0;
  let migrated = 0;
  for (const workout of [...guest.workouts]) {
    if (workout.isTemplate) {
      if (templateRoom <= 0) {
        // Left on the device only until clearGuestData below; counted so the
        // caller can say so rather than let it go unremarked.
        templatesDropped++;
        continue;
      }
      templateRoom--;
    } else if (isActiveWorkout(workout)) {
      if (activeRoom <= 0) {
        activeWorkoutsDropped++;
        continue;
      }
      activeRoom--;
    }
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

  await migrateBodyweight(userId, guest);
  const customExercisesDropped = await migrateLibrary(userId, guest);
  await migrateWeeklyPlanWithIds(userId, guest.weeklyPlan, templateIdMap);

  // Totals and streaks are derived, so recompute from what actually landed.
  await upsertUserStats({ userId, ...computeStats(await getCompletedWorkouts(userId)) });

  await clearGuestData();
  await writeGuestActive(false);
  return { workouts: migrated, customExercisesDropped, templatesDropped, activeWorkoutsDropped };
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
