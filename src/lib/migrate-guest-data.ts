// Not through data.ts. data.ts resolves a write once it's safe on the phone,
// but this deletes each workout from the guest store once its write resolves,
// so it has to know the server has it first. Workouts go through cloud-cache's
// outbox all the same (see writeAndConfirm), waiting for the server's ack:
// Firestore's own queue is lost if the app is killed, and sets logged on a
// moved workout meanwhile must not reach the server before the workout does.
// The rest goes straight to Firestore. Reading what the account already holds
// is different again: cloud-cache's copy is complete once the server has
// answered, which the caller waits for.
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  computeStats,
  getCompletedWorkouts,
  stripUndefined,
  upsertUserStats,
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
import { announceBodyweight, writeCachedBodyweight } from "./bodyweight-cache";
import { getWorkout as getFromAccountCopy, whenPendingWorkoutLands, writeAndConfirm } from "./cloud-cache";
import { movedGuestWorkoutId } from "./data";
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

/**
 * Thrown once the account being moved into is gone: signed out of, deleted, or
 * no longer wanted (see migrateGuestDataTo's `shouldStop`). Whatever hadn't
 * moved is still on the phone, and nothing more was written anywhere.
 */
export class MigrationStopped extends Error {
  constructor() {
    super("The account being moved into is gone.");
    this.name = "MigrationStopped";
  }
}

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
async function migrateBodyweight(userId: string, guest: GuestData, checkpoint: () => void): Promise<void> {
  const entries = guest.bodyweight ?? [];
  if (entries.length === 0) return;
  let merged = await getBodyweightLog(userId);
  checkpoint();
  for (const entry of entries) merged = withBodyweightEntry(merged, entry);
  // The weigh-in screens may already have cached the account's log from
  // before this merge — on the device for an offline start, and in memory for
  // the rest of this launch. Left stale, the next weigh-in there would write
  // it back over the merged log. So they get the merged log as soon as it's
  // sent, not once the server has it: the moving screen may have stepped
  // aside by then, and a weigh-in logged while this waits would be built on
  // the old log and land after this one. If the write fails, the guest's
  // entries are still on the phone and the retry merges them in again.
  const saving = setBodyweightLog(userId, merged);
  announceBodyweight(userId, merged);
  await Promise.all([saving, writeCachedBodyweight(userId, merged)]);
}

/**
 * Where a guest workout lands in the account: the same document every time.
 *
 * A workout leaves the device only once the server acks it. If the server
 * commits the write but the ack never arrives (signal gone, app killed), the
 * workout is still here on the next launch and goes up again. A fresh id from
 * addDoc would then show it twice in the history; a fixed one just writes the
 * same document again.
 */
const cloudWorkoutId = movedGuestWorkoutId;

/**
 * What each workout looked like when it was sent, by cloud id, until the move
 * finishes.
 *
 * A re-run can find a workout an earlier run sent and never heard back about,
 * because the app was killed. If the account has it, and nothing for it is
 * still in the outbox (see whenPendingWorkoutLands below), that send landed, and
 * the account's copy may have moved on since: the moving screen steps aside
 * mid-move, and they may have gone on logging sets on it. Sending the guest
 * copy again would wipe those out. But the guest copy can be the newer one
 * too, when a sign-out mid-move put them back in guest mode and they carried
 * on there. Comparing it with what was sent tells the two apart.
 *
 * A digest rather than the workout itself, so this never holds a second copy
 * of anyone's history.
 */
const SENT_KEY = "plato.guest.sent.v1";

async function readSent(): Promise<Record<string, string>> {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(SENT_KEY)) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    // Without it every workout simply goes up again, as it always used to.
    return {};
  }
}

/** A short stand-in for a workout's contents, only ever compared with another (FNV-1a). */
function digest(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length}.${(hash >>> 0).toString(36)}`;
}

/**
 * Uploads sent this launch that the server hasn't answered yet, by cloud id.
 *
 * A sign-out mid-move wipes the account's outbox, but leaves the upload
 * waiting in Firestore's queue for that account, and signing back in sends
 * it. Meanwhile the account's copy already shows the workout, since Firestore
 * lays its unsent writes over what it reports, yet the server may not have
 * it, and that queue is lost if the app is killed. So the copy only proves an
 * earlier send landed once nothing for that workout is still on its way. In
 * memory on purpose: so is the queue.
 */
const unanswered = new Map<string, Promise<void>>();

/** Returns how many custom exercises the cap forced out. */
async function migrateLibrary(userId: string, guest: GuestData, checkpoint: () => void): Promise<number> {
  const { custom, removedIds, overrides } = guest.library;
  if (custom.length === 0 && removedIds.length === 0 && overrides.length === 0) return 0;
  const account = await getExerciseLibrary(userId);
  checkpoint();
  const { library, dropped } = mergeLibraries(account, guest.library);
  await updateExerciseLibrary(userId, library);
  return dropped;
}

/**
 * Uploads guest data to `userId`, then clears the device copy.
 * Returns null when there was nothing to move.
 *
 * `onProgress` is called each time the server answers a step, so the caller
 * can tell a long history that is still moving from a connection that died.
 *
 * `shouldStop` is asked after every wait, because any of them can outlast the
 * account: the move carries on behind a usable app once the moving screen
 * steps aside, and a write can hang on a dead signal for as long as it likes.
 * Once it says stop, nothing more is written, to the account or to the phone,
 * and this rejects with MigrationStopped.
 */
export async function migrateGuestDataTo(
  userId: string,
  onProgress?: () => void,
  shouldStop?: () => boolean
): Promise<MigrationResult | null> {
  const checkpoint = () => {
    if (shouldStop?.()) throw new MigrationStopped();
  };
  const guest = await readGuestData();
  checkpoint();
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
  const sent = await readSent();
  let templateRoom = MAX_MERGED_TEMPLATES - (await getWorkouts(userId, true)).length;
  let activeRoom = MAX_MERGED_ACTIVE_WORKOUTS - (await countActiveWorkouts(userId));
  checkpoint();
  onProgress?.();
  let templatesDropped = 0;
  let activeWorkoutsDropped = 0;
  let migrated = 0;
  for (const workout of [...guest.workouts]) {
    const { id, ...fields } = workout;
    const cloudId = cloudWorkoutId(userId, id);
    // The guest's own createdAt goes up with it, so the history keeps its dates.
    const data = stripUndefined({ ...fields, userId });
    const contents = digest(JSON.stringify(data));
    // An earlier run's upload the app was killed on, still in the outbox
    // with whatever was logged on the workout in the account queued behind
    // it. It goes up first on its own, so sending the guest copy again
    // would only land after those edits and wipe them out.
    const waiting = await whenPendingWorkoutLands(userId, cloudId);
    checkpoint();
    // Already in the account means an earlier run sent it. The room below
    // already counts it, so it can't be what overflows it. The same goes
    // for one still waiting to go up, even if it was deleted there since.
    const inAccount = waiting !== null || (await getFromAccountCopy(cloudId)) !== null;
    checkpoint();
    if (!inAccount && workout.isTemplate) {
      if (templateRoom <= 0) {
        // Left on the device only until clearGuestData below; counted so the
        // caller can say so rather than let it go unremarked.
        templatesDropped++;
        continue;
      }
      templateRoom--;
    } else if (!inAccount && isActiveWorkout(workout)) {
      if (activeRoom <= 0) {
        activeWorkoutsDropped++;
        continue;
      }
      activeRoom--;
    }
    // Sent before, landed, and unchanged here since (see SENT_KEY): the
    // account's copy is the newer one, so it's left as it is.
    const landedUnchanged = inAccount && !unanswered.has(cloudId) && sent[cloudId] === contents;
    let send = !landedUnchanged;
    if (waiting) {
      // Its guest copy stays until the server has it, as for a fresh send.
      await waiting.landed;
      checkpoint();
      // Changed here since that upload was queued — the session dropped
      // mid-move, they carried on as a guest, then signed back in — so the
      // guest copy is the newer one, the same rule as below. It goes up too,
      // behind whatever was waiting, so it lands last.
      send = sent[cloudId] !== undefined && sent[cloudId] !== contents;
    }
    if (send) {
      const { saved, landed } = writeAndConfirm(userId, { collection: "workouts", docId: cloudId, kind: "set", data });
      unanswered.set(cloudId, landed);
      const answered = () => {
        if (unanswered.get(cloudId) === landed) unanswered.delete(cloudId);
      };
      landed.then(answered, answered);
      // Noted once it's really on its way, never before, so the note can't
      // claim a send that a stop got in ahead of.
      sent[cloudId] = contents;
      await Promise.all([saved, landed, AsyncStorage.setItem(SENT_KEY, JSON.stringify(sent)).catch(() => {})]);
      checkpoint();
    }
    // Record before removing: between these two writes the mapping is the only
    // thing tying the split to the uploaded template.
    if (workout.isTemplate) {
      templateIdMap.set(id, cloudId);
      await recordMigratedTemplate(id, cloudId);
    }
    await removeMigratedWorkout(id);
    migrated++;
    onProgress?.();
  }

  await migrateBodyweight(userId, guest, checkpoint);
  checkpoint();
  onProgress?.();
  const customExercisesDropped = await migrateLibrary(userId, guest, checkpoint);
  checkpoint();
  onProgress?.();
  await migrateWeeklyPlanWithIds(userId, guest.weeklyPlan, templateIdMap, checkpoint);
  checkpoint();
  onProgress?.();

  // Totals and streaks are derived, so recompute from what actually landed.
  const completed = await getCompletedWorkouts(userId);
  checkpoint();
  await upsertUserStats({ userId, ...computeStats(completed) });
  checkpoint();

  // Every workout still here now is one a ceiling above left behind. The
  // rest have gone one at a time, each once the server had it.
  await clearGuestData();
  await writeGuestActive(false);
  await AsyncStorage.removeItem(SENT_KEY).catch(() => {});
  return { workouts: migrated, customExercisesDropped, templatesDropped, activeWorkoutsDropped };
}

// Guest template ids don't survive the upload, so remap each weekday onto the
// template's new cloud id. Days the account already filled are left alone.
async function migrateWeeklyPlanWithIds(
  userId: string,
  guestPlan: WeeklyPlan,
  templateIdMap: Map<string, string>,
  checkpoint: () => void
): Promise<void> {
  if (!guestPlan.some((day) => day !== null)) return;
  const account = await getWeeklyPlan(userId);
  checkpoint();
  const merged = account.map((day, i) => {
    if (day !== null) return day;
    const guestDay = guestPlan[i];
    return guestDay ? templateIdMap.get(guestDay) ?? null : null;
  });
  if (merged.some((day, i) => day !== account[i])) await setWeeklyPlan(userId, merged);
}
