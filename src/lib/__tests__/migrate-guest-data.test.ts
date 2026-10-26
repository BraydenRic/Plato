import AsyncStorage from "@react-native-async-storage/async-storage";

import { readCachedBodyweight } from "../bodyweight-cache";
import { makeSet, makeWorkout, makeWorkoutExercise } from "./factories";

const DATA_KEY = "plato.guest.data.v1";
const ACTIVE_KEY = "plato.guest.active.v1";
const UID = "aB3xY7zQ1mN5pR8sT2vW4yZ6cD0e";

/**
 * Migration never writes through `./data`, because data.ts resolves writes
 * once they're on the phone and migration has to know they reached the
 * server. It talks to `./firestore` directly, and sends workouts through
 * cloud-cache's outbox, waiting for the ack. Both are mocked; the on-device
 * store is real, because the whole point of these tests is what survives on
 * the device when a run fails partway.
 */
// Pinned to globalThis, like the AsyncStorage mock: jest.resetModules() re-runs
// the factories below, and anything they close over must outlive that so the
// per-test implementations set in beforeEach survive into the reloaded module.
const cloud = ((globalThis as Record<string, unknown>).__cloudMock ??= {
  sendWrite: jest.fn(),
  getCompletedWorkouts: jest.fn(),
  upsertUserStats: jest.fn(),
  getExerciseLibrary: jest.fn(),
  updateExerciseLibrary: jest.fn(),
  getWeeklyPlan: jest.fn(),
  setWeeklyPlan: jest.fn(),
  getWorkouts: jest.fn(),
  countActiveWorkouts: jest.fn(),
  getBodyweightLog: jest.fn(),
  setBodyweightLog: jest.fn(),
}) as Record<string, jest.Mock>;

jest.mock("../firestore", () => ({
  sendWrite: (...args: unknown[]) => (globalThis as any).__cloudMock.sendWrite(...args),
  getCompletedWorkouts: (...args: unknown[]) => (globalThis as any).__cloudMock.getCompletedWorkouts(...args),
  upsertUserStats: (...args: unknown[]) => (globalThis as any).__cloudMock.upsertUserStats(...args),
  computeStats: () => ({ totalCompletedWorkouts: 0 }),
  // Real behaviour, reimplemented: Firestore rejects undefined values, and the
  // migration relies on this to drop absent optional fields.
  stripUndefined: (value: unknown) =>
    JSON.parse(JSON.stringify(value ?? null, (_k, v) => (v === undefined ? undefined : v))),
  getExerciseLibrary: (...args: unknown[]) => (globalThis as any).__cloudMock.getExerciseLibrary(...args),
  updateExerciseLibrary: (...args: unknown[]) => (globalThis as any).__cloudMock.updateExerciseLibrary(...args),
  getWeeklyPlan: (...args: unknown[]) => (globalThis as any).__cloudMock.getWeeklyPlan(...args),
  setWeeklyPlan: (...args: unknown[]) => (globalThis as any).__cloudMock.setWeeklyPlan(...args),
  getWorkouts: (...args: unknown[]) => (globalThis as any).__cloudMock.getWorkouts(...args),
  countActiveWorkouts: (...args: unknown[]) =>
    (globalThis as any).__cloudMock.countActiveWorkouts(...args),
  getBodyweightLog: (...args: unknown[]) => (globalThis as any).__cloudMock.getBodyweightLog(...args),
  setBodyweightLog: (...args: unknown[]) => (globalThis as any).__cloudMock.setBodyweightLog(...args),
}));

/**
 * cloud-cache's copy of the account's workouts, which says whether an earlier
 * run's upload is already there. Empty unless a test puts something in it.
 *
 * Workouts go up through its outbox: on the phone at once, landed when the
 * server acks. Here that ack is the `sendWrite` above, so a test can hold it,
 * refuse it or answer it, and what an earlier run left in the outbox is
 * whatever a test has `whenPendingWorkoutLands` hand back.
 */
const accountCopy = ((globalThis as Record<string, unknown>).__accountCopyMock ??= {
  getWorkout: jest.fn(),
  writeAndConfirm: jest.fn(),
  whenPendingWorkoutLands: jest.fn(),
}) as Record<string, jest.Mock>;

jest.mock("../cloud-cache", () => ({
  getWorkout: (...args: unknown[]) => (globalThis as any).__accountCopyMock.getWorkout(...args),
  writeAndConfirm: (...args: unknown[]) => (globalThis as any).__accountCopyMock.writeAndConfirm(...args),
  whenPendingWorkoutLands: (...args: unknown[]) =>
    (globalThis as any).__accountCopyMock.whenPendingWorkoutLands(...args),
}));

/** The workouts that went up, in order, as the documents they were written as. */
function uploadedWorkouts(): Record<string, any>[] {
  return cloud.sendWrite.mock.calls
    .map(([write]) => write)
    .filter((write) => write.collection === "workouts")
    .map((write) => write.data);
}

type LocalStore = typeof import("../local-store");
type Migrator = typeof import("../migrate-guest-data");

async function seed(data: Record<string, unknown>): Promise<{ store: LocalStore; migrate: Migrator }> {
  jest.resetModules();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(ACTIVE_KEY, "1");
  await AsyncStorage.setItem(
    DATA_KEY,
    JSON.stringify({ workouts: [], library: { custom: [], removedIds: [], overrides: [] }, weeklyPlan: Array(7).fill(null), ...data })
  );
  return { store: require("../local-store"), migrate: require("../migrate-guest-data") };
}

/** The app killed and opened again: fresh modules, same device storage. */
function relaunch(): { store: LocalStore; migrate: Migrator } {
  jest.resetModules();
  return { store: require("../local-store"), migrate: require("../migrate-guest-data") };
}

/** Lets pending promises and storage calls run until `condition` holds. */
async function until(condition: () => boolean | Promise<boolean>): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Never happened");
}

const emptyLibrary = { custom: [], removedIds: [], overrides: [] };

beforeEach(() => {
  jest.clearAllMocks();
  cloud.sendWrite.mockResolvedValue(undefined);
  cloud.getCompletedWorkouts.mockResolvedValue([]);
  cloud.upsertUserStats.mockResolvedValue(undefined);
  cloud.getExerciseLibrary.mockResolvedValue(emptyLibrary);
  cloud.updateExerciseLibrary.mockResolvedValue(undefined);
  cloud.getWeeklyPlan.mockResolvedValue(Array(7).fill(null));
  cloud.setWeeklyPlan.mockResolvedValue(undefined);
  // The account starts with no templates, so the merge cap is out of the way
  // unless a test deliberately fills it.
  cloud.getWorkouts.mockResolvedValue([]);
  cloud.countActiveWorkouts.mockResolvedValue(0);
  cloud.getBodyweightLog.mockResolvedValue([]);
  cloud.setBodyweightLog.mockResolvedValue(undefined);
  accountCopy.getWorkout.mockResolvedValue(null);
  accountCopy.writeAndConfirm.mockImplementation((_uid: string, write: unknown) => {
    const landed: Promise<void> = cloud.sendWrite(write);
    return { saved: Promise.resolve(), landed };
  });
  accountCopy.whenPendingWorkoutLands.mockResolvedValue(null);
});

describe("nothing to migrate", () => {
  it("returns null and leaves guest mode without touching the cloud", async () => {
    const { migrate } = await seed({});

    expect(await migrate.migrateGuestDataTo(UID)).toBeNull();
    expect(cloud.sendWrite).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(ACTIVE_KEY)).toBeNull();
  });
});

describe("happy path", () => {
  const guestWorkouts = [
    makeWorkout({ id: "local-1", name: "Push", completedAt: new Date("2026-02-01T10:00:00Z"), exercises: [makeWorkoutExercise("bench-press", [makeSet()])] }),
    makeWorkout({ id: "local-2", name: "Pull", completedAt: new Date("2026-02-03T10:00:00Z") }),
  ];

  it("uploads every workout under the new account id", async () => {
    const { migrate } = await seed({ workouts: guestWorkouts });

    const result = await migrate.migrateGuestDataTo(UID);

    expect(result).toEqual({
      workouts: 2,
      customExercisesDropped: 0,
      templatesDropped: 0,
      activeWorkoutsDropped: 0,
    });
    expect(cloud.sendWrite).toHaveBeenCalledTimes(2);
    for (const [write] of cloud.sendWrite.mock.calls) {
      expect(write).toMatchObject({ collection: "workouts", kind: "set" });
      expect(write.data.userId).toBe(UID);
      // The guest id names the document but isn't stored as a field.
      expect(write.data.id).toBeUndefined();
      // The guest's dates come with it, rather than the upload time. (The
      // stripUndefined stand-in above round-trips through JSON, hence a string.)
      expect(write.data.createdAt).toBe("2026-01-01T10:00:00.000Z");
    }
    expect(cloud.sendWrite.mock.calls.map(([w]) => w.docId)).toEqual([`${UID}_local-1`, `${UID}_local-2`]);
  });

  it("tells the caller each time the server answers, so it can tell slow from stalled", async () => {
    const { migrate } = await seed({ workouts: guestWorkouts });
    const onProgress = jest.fn();

    await migrate.migrateGuestDataTo(UID, onProgress);

    // The room reads, each workout, then weigh-ins, library and split.
    expect(onProgress).toHaveBeenCalledTimes(6);
  });

  it("wipes the device copy and leaves guest mode once everything lands", async () => {
    const { store, migrate } = await seed({ workouts: guestWorkouts });

    await migrate.migrateGuestDataTo(UID);

    expect(store.hasContent(await store.readGuestData())).toBe(false);
    expect(await AsyncStorage.getItem(ACTIVE_KEY)).toBeNull();
  });

  it("re-derives lifetime stats from what actually landed", async () => {
    const { migrate } = await seed({ workouts: guestWorkouts });

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.getCompletedWorkouts).toHaveBeenCalledWith(UID);
    expect(cloud.upsertUserStats).toHaveBeenCalledWith(expect.objectContaining({ userId: UID }));
  });
});

describe("partial failure", () => {
  const three = [
    makeWorkout({ id: "local-1", name: "one" }),
    makeWorkout({ id: "local-2", name: "two" }),
    makeWorkout({ id: "local-3", name: "three" }),
  ];

  it("keeps un-uploaded workouts on the device and does not wipe guest data", async () => {
    const { store, migrate } = await seed({ workouts: three });
    cloud.sendWrite
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("offline"));

    await expect(migrate.migrateGuestDataTo(UID)).rejects.toThrow("offline");

    const left = await store.readGuestData();
    // The first is gone (safely in the cloud); the rest are untouched.
    expect(left.workouts.map((w) => w.name)).toEqual(["two", "three"]);
    expect(await AsyncStorage.getItem(ACTIVE_KEY)).toBe("1");
  });

  it("a retry uploads only what is still on the device, never a duplicate", async () => {
    const { store, migrate } = await seed({ workouts: three });
    cloud.sendWrite.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("offline"));
    await expect(migrate.migrateGuestDataTo(UID)).rejects.toThrow();

    cloud.sendWrite.mockClear();
    await migrate.migrateGuestDataTo(UID);

    expect(cloud.sendWrite).toHaveBeenCalledTimes(2);
    expect(uploadedWorkouts().map((w) => w.name)).toEqual(["two", "three"]);
    expect(store.hasContent(await store.readGuestData())).toBe(false);
  });

  // The server committed the write but its answer never arrived, and the app
  // was closed. The workout is still on the device, so the next launch sends
  // it again. It has to land on the same document, not beside it.
  it("writes a workout whose answer was lost to the same document again", async () => {
    const { migrate } = await seed({ workouts: three });
    cloud.sendWrite.mockRejectedValueOnce(new Error("killed before the ack"));
    await expect(migrate.migrateGuestDataTo(UID)).rejects.toThrow();
    const firstTry = cloud.sendWrite.mock.calls[0][0].docId;

    cloud.sendWrite.mockClear();
    await migrate.migrateGuestDataTo(UID);

    expect(cloud.sendWrite.mock.calls[0][0].docId).toBe(firstTry);
  });
});

describe("a re-run that finds an earlier upload already in the account", () => {
  // Mid-workout when they signed in. The moving screen stepped aside while
  // this workout's upload waited on the signal, and they carried on logging
  // sets on it in the account.
  const midWorkout = makeWorkout({ id: "local-1", name: "Pull", startedAt: new Date("2026-02-03T10:00:00Z") });
  const CLOUD_1 = `${UID}_local-1`;

  /** A first run whose upload never hears back, as when the app is killed. */
  async function firstRunNeverAnswered(migrate: Migrator) {
    cloud.sendWrite.mockReturnValueOnce(new Promise(() => {}));
    void migrate.migrateGuestDataTo(UID);
    await until(async () => (await AsyncStorage.getItem("plato.guest.sent.v1")) !== null);
    cloud.sendWrite.mockClear();
    accountCopy.writeAndConfirm.mockClear();
  }

  /** An answer from the server that the test gives when it chooses. */
  function deferred() {
    let resolve: () => void = () => {};
    let reject: (e: unknown) => void = () => {};
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  /** Lets the move get as far as it can without an answer. */
  async function ticks() {
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Sets logged on the moved workout go into the outbox behind its upload,
  // so the upload has to be in there too: Firestore's own queue is lost if
  // the app is killed, and the sets would then reach the server first, as
  // edits to a workout it doesn't have, and be refused.
  it("sends the workout through the outbox, and keeps the guest copy until the server has it", async () => {
    const { store, migrate } = await seed({ workouts: [midWorkout] });
    const ack = deferred();
    cloud.sendWrite.mockReturnValueOnce(ack.promise);

    const moving = migrate.migrateGuestDataTo(UID);
    await until(() => accountCopy.writeAndConfirm.mock.calls.length > 0);
    await ticks();

    expect(accountCopy.writeAndConfirm).toHaveBeenCalledWith(
      UID,
      expect.objectContaining({ collection: "workouts", docId: CLOUD_1, kind: "set" })
    );
    expect((await store.readGuestData()).workouts.map((w) => w.id)).toEqual(["local-1"]);

    ack.resolve();
    await moving;
    expect(store.hasContent(await store.readGuestData())).toBe(false);
  });

  // Killed while that upload waited on the signal. The outbox sends it again
  // on its own, ahead of the sets logged behind it, so the guest copy going
  // up again would land after them and wipe them out.
  describe("after a relaunch, with the upload still in the outbox", () => {
    async function relaunchWithUploadWaiting() {
      const { migrate: firstLaunch } = await seed({ workouts: [midWorkout] });
      await firstRunNeverAnswered(firstLaunch);
      const relaunched = relaunch();
      const ack = deferred();
      accountCopy.whenPendingWorkoutLands.mockImplementation(async (_uid: string, id: string) =>
        id === CLOUD_1 ? { landed: ack.promise } : null
      );
      // The account's copy shows it, with the outbox laid over the server's answer.
      accountCopy.getWorkout.mockImplementation(async (id: string) => (id === CLOUD_1 ? { id } : null));
      return { ...relaunched, ack };
    }

    it("waits for it rather than sending the guest copy over it", async () => {
      const { store, migrate, ack } = await relaunchWithUploadWaiting();

      const moving = migrate.migrateGuestDataTo(UID);
      await until(() => accountCopy.whenPendingWorkoutLands.mock.calls.length > 0);
      await ticks();

      expect(accountCopy.writeAndConfirm).not.toHaveBeenCalled();
      expect(cloud.sendWrite).not.toHaveBeenCalled();
      // Nor does the guest copy go before the server has the upload, whether
      // on its own or with the rest of the guest data at the end.
      expect((await store.readGuestData()).workouts.map((w) => w.id)).toEqual(["local-1"]);
      expect(await AsyncStorage.getItem(ACTIVE_KEY)).toBe("1");

      ack.resolve();
      expect(await moving).toMatchObject({ workouts: 1 });
      expect(accountCopy.writeAndConfirm).not.toHaveBeenCalled();
      expect(store.hasContent(await store.readGuestData())).toBe(false);
    });

    it("keeps the guest copy if the server refuses it", async () => {
      const { store, migrate, ack } = await relaunchWithUploadWaiting();

      const moving = migrate.migrateGuestDataTo(UID);
      ack.reject(new Error("permission-denied"));

      await expect(moving).rejects.toThrow("permission-denied");
      expect((await store.readGuestData()).workouts.map((w) => w.id)).toEqual(["local-1"]);
      expect(await AsyncStorage.getItem(ACTIVE_KEY)).toBe("1");
    });

    it("keeps the guest copy if they sign out before it lands", async () => {
      const { store, migrate, ack } = await relaunchWithUploadWaiting();
      let gone = false;

      const moving = migrate.migrateGuestDataTo(UID, undefined, () => gone);
      await until(() => accountCopy.whenPendingWorkoutLands.mock.calls.length > 0);
      await ticks();
      // Signing out wipes the outbox; Firestore may still get it there.
      gone = true;
      ack.resolve();

      await expect(moving).rejects.toThrow(migrate.MigrationStopped);
      expect((await store.readGuestData()).workouts.map((w) => w.id)).toEqual(["local-1"]);
    });
  });

  it("leaves it alone after a relaunch, so what was logged on it in the account survives", async () => {
    const { migrate: firstLaunch } = await seed({ workouts: [midWorkout] });
    await firstRunNeverAnswered(firstLaunch);

    const { store, migrate } = relaunch();
    // The send had landed: the account has it, edits and all.
    accountCopy.getWorkout.mockImplementation(async (id: string) => (id === CLOUD_1 ? { id } : null));
    // And it already counts toward the account's in-progress ceiling, so it
    // mustn't be turned away as though it were one too many.
    cloud.countActiveWorkouts.mockResolvedValue(require("../workout-utils").MAX_MERGED_ACTIVE_WORKOUTS);
    const result = await migrate.migrateGuestDataTo(UID);

    expect(cloud.sendWrite).not.toHaveBeenCalled();
    expect(result).toMatchObject({ workouts: 1, activeWorkoutsDropped: 0 });
    expect(store.hasContent(await store.readGuestData())).toBe(false);
  });

  // Signed out mid-move, which put them back in guest mode with this workout,
  // and they carried on there. Now the guest copy is the newer one.
  it("still sends it when the guest copy changed after it was sent", async () => {
    const { migrate: firstLaunch } = await seed({ workouts: [midWorkout] });
    await firstRunNeverAnswered(firstLaunch);

    const { store, migrate } = relaunch();
    await store.updateWorkout("local-1", { name: "Pull, carried on as a guest" });
    accountCopy.getWorkout.mockImplementation(async (id: string) => (id === CLOUD_1 ? { id } : null));
    await migrate.migrateGuestDataTo(UID);

    expect(cloud.sendWrite).toHaveBeenCalledTimes(1);
    expect(cloud.sendWrite.mock.calls[0][0].docId).toBe(CLOUD_1);
    expect(uploadedWorkouts()[0].name).toBe("Pull, carried on as a guest");
  });

  // Same launch, after a sign-out wiped the outbox: the earlier send is still
  // waiting in Firestore's queue, which lays it over what the account shows.
  // The server may not have it, and that queue goes if the app is killed, so
  // it isn't proof yet.
  it("sends it again while the earlier upload is still waiting this launch", async () => {
    const { store, migrate } = await seed({ workouts: [midWorkout] });
    await firstRunNeverAnswered(migrate);
    accountCopy.getWorkout.mockImplementation(async (id: string) => (id === CLOUD_1 ? { id } : null));

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.sendWrite).toHaveBeenCalledTimes(1);
    expect(cloud.sendWrite.mock.calls[0][0].docId).toBe(CLOUD_1);
    expect(store.hasContent(await store.readGuestData())).toBe(false);
  });

  it("forgets what it sent once the move is done", async () => {
    const { migrate } = await seed({ workouts: [midWorkout] });
    await migrate.migrateGuestDataTo(UID);
    expect(await AsyncStorage.getItem("plato.guest.sent.v1")).toBeNull();
  });
});

describe("the account going mid-move", () => {
  // The move runs behind a usable app once the moving screen steps aside, so
  // the account can be signed out of or deleted while an upload waits.
  const three = [
    makeWorkout({ id: "local-1", name: "one" }),
    makeWorkout({ id: "local-2", name: "two" }),
    makeWorkout({ id: "local-3", name: "three" }),
  ];
  const weighIns = [{ date: "2026-02-01T08:00:00.000Z", lbs: 181 }];

  it("writes nothing more, anywhere, once told to stop", async () => {
    const { store, migrate } = await seed({ workouts: three, bodyweight: weighIns });
    let gone = false;
    // Signed out while the first upload waited for its answer.
    cloud.sendWrite.mockImplementationOnce(async () => {
      gone = true;
    });

    await expect(migrate.migrateGuestDataTo(UID, undefined, () => gone)).rejects.toThrow(migrate.MigrationStopped);

    expect(cloud.sendWrite).toHaveBeenCalledTimes(1);
    expect(cloud.setBodyweightLog).not.toHaveBeenCalled();
    // Nothing left the phone either: not the workout that was answered after
    // the sign-out, not the weigh-ins, not the guest flag.
    expect((await store.readGuestData()).workouts.map((w) => w.name)).toEqual(["one", "two", "three"]);
    expect(await readCachedBodyweight(UID)).toBeNull();
    expect(await AsyncStorage.getItem(ACTIVE_KEY)).toBe("1");
  });

  it("doesn't merge weigh-ins into an account that went while its log was read", async () => {
    const { store, migrate } = await seed({ bodyweight: weighIns });
    const announced = jest.fn();
    require("../bodyweight-cache").onBodyweightAdopted(announced);
    let gone = false;
    cloud.getBodyweightLog.mockImplementationOnce(async () => {
      gone = true;
      return [];
    });

    await expect(migrate.migrateGuestDataTo(UID, undefined, () => gone)).rejects.toThrow(migrate.MigrationStopped);

    expect(cloud.setBodyweightLog).not.toHaveBeenCalled();
    expect(announced).not.toHaveBeenCalled();
    // Written back after sign-out had removed it, this would outstay them.
    expect(await readCachedBodyweight(UID)).toBeNull();
    expect(store.hasContent(await store.readGuestData())).toBe(true);
  });
});

describe("weigh-ins", () => {
  const weighIns = [
    { date: "2026-02-01T08:00:00.000Z", lbs: 181 },
    { date: "2026-02-03T08:00:00.000Z", lbs: 180 },
  ];

  it("moves them when they are all the guest logged", async () => {
    const { store, migrate } = await seed({ bodyweight: weighIns });

    expect(await migrate.migrateGuestDataTo(UID)).not.toBeNull();

    const [[userId, log]] = cloud.setBodyweightLog.mock.calls;
    expect(userId).toBe(UID);
    expect(log.map((e: { lbs: number }) => e.lbs)).toEqual([181, 180]);
    expect(store.hasContent(await store.readGuestData())).toBe(false);
  });

  it("still moves them on a retry after every workout already went up", async () => {
    const { migrate } = await seed({ workouts: [makeWorkout({ id: "local-1" })], bodyweight: weighIns });
    cloud.getBodyweightLog.mockRejectedValueOnce(new Error("client is offline"));
    await expect(migrate.migrateGuestDataTo(UID)).rejects.toThrow("offline");
    expect(cloud.setBodyweightLog).not.toHaveBeenCalled();

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.setBodyweightLog).toHaveBeenCalledTimes(1);
  });

  // The weigh-in screens may have cached the account's log before the merge,
  // and paint that copy on an offline start. It has to be the merged log.
  it("leaves the device's copy of the log matching the merged one", async () => {
    const { migrate } = await seed({ bodyweight: weighIns });
    cloud.getBodyweightLog.mockResolvedValue([{ date: new Date("2026-01-20T08:00:00.000Z"), lbs: 185 }]);

    await migrate.migrateGuestDataTo(UID);

    expect((await readCachedBodyweight(UID))?.map((e) => e.lbs)).toEqual([185, 181, 180]);
  });

  // The moving screen may have stepped aside while this write waits on the
  // signal. A weigh-in logged meanwhile is built on whatever the screens
  // hold, and has to be built on the merged log, or it lands after it and
  // takes the guest's weigh-ins back out.
  it("hands the merged log to the screens before the server has it", async () => {
    const { store, migrate } = await seed({ bodyweight: weighIns });
    cloud.getBodyweightLog.mockResolvedValue([{ date: new Date("2026-01-20T08:00:00.000Z"), lbs: 185 }]);
    let acked: () => void = () => {};
    cloud.setBodyweightLog.mockReturnValueOnce(new Promise<void>((resolve) => (acked = resolve)));
    const announced = jest.fn();
    require("../bodyweight-cache").onBodyweightAdopted(announced);

    const moving = migrate.migrateGuestDataTo(UID);
    await until(async () => (await readCachedBodyweight(UID)) !== null);

    expect(announced).toHaveBeenCalledWith(UID, expect.anything());
    expect(announced.mock.calls[0][1].map((e: { lbs: number }) => e.lbs)).toEqual([185, 181, 180]);
    expect((await readCachedBodyweight(UID))?.map((e) => e.lbs)).toEqual([185, 181, 180]);
    // The guest's own copy stays until the server has the merge.
    expect(store.hasContent(await store.readGuestData())).toBe(true);

    acked();
    await moving;
    expect(store.hasContent(await store.readGuestData())).toBe(false);
  });
});

describe("weekly split", () => {
  const template = makeWorkout({ id: "local-t1", name: "Leg Day", isTemplate: true });
  const CLOUD_T1 = `${UID}_local-t1`;
  const planPointingAtTemplate = ["local-t1", null, null, null, null, null, null];

  it("remaps guest template ids onto their new cloud ids", async () => {
    const { migrate } = await seed({ workouts: [template], weeklyPlan: planPointingAtTemplate });

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.setWeeklyPlan).toHaveBeenCalledWith(UID, [CLOUD_T1, null, null, null, null, null, null]);
  });

  // The regression: templates leave the device the moment they upload, so a run
  // that died after the workout loop used to retry with an empty id map and
  // silently drop the split before wiping the guest data for good.
  it("survives a retry after the run failed past the workout loop", async () => {
    const { store, migrate } = await seed({ workouts: [template], weeklyPlan: planPointingAtTemplate });
    cloud.getWeeklyPlan.mockRejectedValueOnce(new Error("offline"));

    await expect(migrate.migrateGuestDataTo(UID)).rejects.toThrow("offline");
    // The template is already in the cloud and gone from the device...
    expect((await store.readGuestData()).workouts).toHaveLength(0);
    // ...but the split still needs migrating, so guest data must survive.
    expect(store.hasContent(await store.readGuestData())).toBe(true);

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.setWeeklyPlan).toHaveBeenCalledWith(UID, [CLOUD_T1, null, null, null, null, null, null]);
    expect(cloud.sendWrite).toHaveBeenCalledTimes(1); // no duplicate upload
  });

  it("never overwrites a day the account already filled", async () => {
    const { migrate } = await seed({
      workouts: [template],
      weeklyPlan: ["local-t1", "local-t1", null, null, null, null, null],
    });
    cloud.getWeeklyPlan.mockResolvedValue(["account-existing", null, null, null, null, null, null]);

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.setWeeklyPlan).toHaveBeenCalledWith(UID, [
      "account-existing", CLOUD_T1, null, null, null, null, null,
    ]);
  });

  it("writes nothing when the guest had no split at all", async () => {
    const { migrate } = await seed({ workouts: [template] });
    await migrate.migrateGuestDataTo(UID);
    expect(cloud.setWeeklyPlan).not.toHaveBeenCalled();
  });

  it("writes nothing when the merge would change no day", async () => {
    const { migrate } = await seed({
      workouts: [template],
      weeklyPlan: ["local-t1", null, null, null, null, null, null],
    });
    cloud.getWeeklyPlan.mockResolvedValue(["account-existing", null, null, null, null, null, null]);

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.setWeeklyPlan).not.toHaveBeenCalled();
  });
});

describe("exercise library merge", () => {
  it("skips the cloud entirely when the guest customised nothing", async () => {
    const { migrate } = await seed({ workouts: [makeWorkout({ id: "local-1" })] });
    await migrate.migrateGuestDataTo(UID);
    expect(cloud.updateExerciseLibrary).not.toHaveBeenCalled();
  });

  it("keeps the account's own version of a conflicting custom exercise", async () => {
    const { migrate } = await seed({
      library: { custom: [{ id: "c1", name: "Guest Version" }], removedIds: [], overrides: [] },
    });
    cloud.getExerciseLibrary.mockResolvedValue({
      custom: [{ id: "c1", name: "Account Version" }],
      removedIds: [],
      overrides: [],
    });

    await migrate.migrateGuestDataTo(UID);

    const [, merged] = cloud.updateExerciseLibrary.mock.calls[0];
    expect(merged.custom).toEqual([{ id: "c1", name: "Account Version" }]);
  });

  it("carries over a custom exercise the account does not have", async () => {
    const { migrate } = await seed({
      library: { custom: [{ id: "guest-only", name: "Sled Push" }], removedIds: [], overrides: [] },
    });
    cloud.getExerciseLibrary.mockResolvedValue({
      custom: [{ id: "acct", name: "Account Lift" }],
      removedIds: [],
      overrides: [],
    });

    await migrate.migrateGuestDataTo(UID);

    const [, merged] = cloud.updateExerciseLibrary.mock.calls[0];
    expect(merged.custom.map((e: { id: string }) => e.id)).toEqual(["acct", "guest-only"]);
  });

  it("unions removed built-ins without duplicating them", async () => {
    const { migrate } = await seed({
      library: { custom: [], removedIds: ["bench-press", "squat"], overrides: [] },
    });
    cloud.getExerciseLibrary.mockResolvedValue({
      custom: [],
      removedIds: ["bench-press", "deadlift"],
      overrides: [],
    });

    await migrate.migrateGuestDataTo(UID);

    const [, merged] = cloud.updateExerciseLibrary.mock.calls[0];
    expect([...merged.removedIds].sort()).toEqual(["bench-press", "deadlift", "squat"]);
  });

  it("stays within the custom-exercise cap", async () => {
    const { MAX_CUSTOM_EXERCISES } = require("../workout-utils");
    const many = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, name: `${prefix} ${i}` }));

    const { migrate } = await seed({
      library: { custom: many("guest", 50), removedIds: [], overrides: [] },
    });
    cloud.getExerciseLibrary.mockResolvedValue({
      custom: many("acct", MAX_CUSTOM_EXERCISES),
      removedIds: [],
      overrides: [],
    });

    const result = await migrate.migrateGuestDataTo(UID);

    const [, merged] = cloud.updateExerciseLibrary.mock.calls[0];
    expect(merged.custom).toHaveLength(MAX_CUSTOM_EXERCISES);
    // The cap is a Firestore document-size guard, so it can't just be lifted.
    // What it must not do is drop 50 of someone's exercises without saying so.
    expect(result?.customExercisesDropped).toBe(50);
  });

  it("keeps the account's own exercises when the cap forces a choice", async () => {
    const { MAX_CUSTOM_EXERCISES } = require("../workout-utils");
    const many = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, name: `${prefix} ${i}` }));

    const { migrate } = await seed({
      library: { custom: many("guest", 10), removedIds: [], overrides: [] },
    });
    cloud.getExerciseLibrary.mockResolvedValue({
      custom: many("acct", MAX_CUSTOM_EXERCISES),
      removedIds: [],
      overrides: [],
    });

    await migrate.migrateGuestDataTo(UID);

    // Same rule as every other conflict here: the long-standing account data
    // wins over a throwaway guest session.
    const [, merged] = cloud.updateExerciseLibrary.mock.calls[0];
    expect(merged.custom.every((e: { id: string }) => e.id.startsWith("acct-"))).toBe(true);
  });

  it("reports nothing dropped when everything fits", async () => {
    const { migrate } = await seed({
      library: { custom: [{ id: "g1", name: "Sled Push" }], removedIds: [], overrides: [] },
    });
    const result = await migrate.migrateGuestDataTo(UID);
    expect(result?.customExercisesDropped).toBe(0);
  });
});

describe("the merged template ceiling", () => {
  /**
   * The per-screen limit only stops you creating a 21st template. Without a
   * ceiling here, signing out, refilling guest mode and signing back in could
   * be repeated to climb past it without bound.
   */
  const { MAX_TEMPLATES, MAX_MERGED_TEMPLATES } = require("../workout-utils");

  const templates = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${prefix}-${i}`,
      name: `${prefix} ${i}`,
      isTemplate: true,
      exercises: [],
      createdAt: new Date("2026-01-01").toISOString(),
    }));

  it("lets a full account and a full guest session both come across", async () => {
    // The honest worst case: 20 + 20. Nothing may be lost here.
    const { migrate } = await seed({ workouts: templates("guest", MAX_TEMPLATES) });
    cloud.getWorkouts.mockResolvedValue(templates("acct", MAX_TEMPLATES));

    const result = await migrate.migrateGuestDataTo(UID);

    expect(result?.templatesDropped).toBe(0);
    expect(cloud.sendWrite).toHaveBeenCalledTimes(MAX_TEMPLATES);
  });

  it("stops the cycle being repeated to climb past the ceiling", async () => {
    // Second time around the account is already at the ceiling, so a fresh
    // guest session full of templates adds nothing.
    const { migrate } = await seed({ workouts: templates("guest", MAX_TEMPLATES) });
    cloud.getWorkouts.mockResolvedValue(templates("acct", MAX_MERGED_TEMPLATES));

    const result = await migrate.migrateGuestDataTo(UID);

    expect(result?.templatesDropped).toBe(MAX_TEMPLATES);
    expect(cloud.sendWrite).not.toHaveBeenCalled();
  });

  it("fills the remaining room and reports only the excess", async () => {
    const { migrate } = await seed({ workouts: templates("guest", 10) });
    cloud.getWorkouts.mockResolvedValue(templates("acct", MAX_MERGED_TEMPLATES - 4));

    const result = await migrate.migrateGuestDataTo(UID);

    expect(cloud.sendWrite).toHaveBeenCalledTimes(4);
    expect(result?.templatesDropped).toBe(6);
  });

  it("never drops a logged workout to make room", async () => {
    // The ceiling is about templates. A completed session is the history the
    // app exists to keep, and must cross regardless.
    const { migrate } = await seed({
      workouts: [
        ...templates("guest", 3),
        {
          id: "done-1",
          name: "Leg day",
          exercises: [],
          createdAt: new Date("2026-02-01").toISOString(),
          completedAt: new Date("2026-02-01").toISOString(),
        },
      ],
    });
    cloud.getWorkouts.mockResolvedValue(templates("acct", MAX_MERGED_TEMPLATES));

    const result = await migrate.migrateGuestDataTo(UID);

    expect(result?.templatesDropped).toBe(3);
    expect(result?.workouts).toBe(1);
    const [uploaded] = uploadedWorkouts();
    expect(uploaded.name).toBe("Leg day");
  });

  it("measures room against the account, not the guest session", async () => {
    // Counting only what the guest brought would let each cycle add a fresh 20.
    const { migrate } = await seed({ workouts: templates("guest", 5) });
    cloud.getWorkouts.mockResolvedValue(templates("acct", MAX_MERGED_TEMPLATES - 2));

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.getWorkouts).toHaveBeenCalledWith(UID, true);
    expect(cloud.sendWrite).toHaveBeenCalledTimes(2);
  });
});

describe("the merged in-progress ceiling", () => {
  /**
   * Same hole as the templates, same shape of fix. Worth stating what this
   * deliberately does *not* do: it never marks an unfinished session complete.
   * Streaks and totals are derived from completedAt, so auto-finishing an
   * abandoned workout would credit a training day that never happened.
   */
  const { MAX_ACTIVE_WORKOUTS, MAX_MERGED_ACTIVE_WORKOUTS } = require("../workout-utils");

  const started = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${prefix}-${i}`,
      name: `${prefix} ${i}`,
      exercises: [],
      createdAt: new Date("2026-01-01").toISOString(),
      startedAt: new Date("2026-01-01").toISOString(),
    }));

  it("lets a full account and a full guest session both come across", async () => {
    const { migrate } = await seed({ workouts: started("guest", MAX_ACTIVE_WORKOUTS) });
    cloud.countActiveWorkouts.mockResolvedValue(MAX_ACTIVE_WORKOUTS);

    const result = await migrate.migrateGuestDataTo(UID);

    expect(result?.activeWorkoutsDropped).toBe(0);
    expect(cloud.sendWrite).toHaveBeenCalledTimes(MAX_ACTIVE_WORKOUTS);
  });

  it("stops the cycle being repeated to climb past the ceiling", async () => {
    const { migrate } = await seed({ workouts: started("guest", MAX_ACTIVE_WORKOUTS) });
    cloud.countActiveWorkouts.mockResolvedValue(MAX_MERGED_ACTIVE_WORKOUTS);

    const result = await migrate.migrateGuestDataTo(UID);

    expect(result?.activeWorkoutsDropped).toBe(MAX_ACTIVE_WORKOUTS);
    expect(cloud.sendWrite).not.toHaveBeenCalled();
  });

  it("uploads an unfinished workout still unfinished", async () => {
    // The tempting shortcut for this cap was to finish in-progress workouts on
    // sign-in instead of counting them. Streaks and totals come off completedAt,
    // so that would credit a training day nobody did. Whatever crosses must
    // arrive exactly as unfinished as it left.
    const { migrate } = await seed({ workouts: started("guest", 1) });
    cloud.countActiveWorkouts.mockResolvedValue(0);

    await migrate.migrateGuestDataTo(UID);

    const [uploaded] = uploadedWorkouts();
    expect(uploaded.startedAt).toBeTruthy();
    expect(uploaded.completedAt ?? null).toBeNull();
  });

  it("still carries a finished workout when in-progress ones are capped", async () => {
    const { migrate } = await seed({
      workouts: [
        ...started("guest", 3),
        {
          id: "done-1",
          name: "Leg day",
          exercises: [],
          createdAt: new Date("2026-02-01").toISOString(),
          startedAt: new Date("2026-02-01").toISOString(),
          completedAt: new Date("2026-02-01").toISOString(),
        },
      ],
    });
    cloud.countActiveWorkouts.mockResolvedValue(MAX_MERGED_ACTIVE_WORKOUTS);

    const result = await migrate.migrateGuestDataTo(UID);

    expect(result?.activeWorkoutsDropped).toBe(3);
    expect(result?.workouts).toBe(1);
    const [uploaded] = uploadedWorkouts();
    expect(uploaded.name).toBe("Leg day");
  });

  it("leaves a planned workout alone — it was never started", async () => {
    const { migrate } = await seed({
      workouts: [
        { id: "p1", name: "Tuesday", exercises: [], createdAt: new Date("2026-02-01").toISOString() },
      ],
    });
    cloud.countActiveWorkouts.mockResolvedValue(MAX_MERGED_ACTIVE_WORKOUTS);

    const result = await migrate.migrateGuestDataTo(UID);

    expect(result?.activeWorkoutsDropped).toBe(0);
    expect(cloud.sendWrite).toHaveBeenCalledTimes(1);
  });

  it("measures room against the account, not the guest session", async () => {
    const { migrate } = await seed({ workouts: started("guest", 4) });
    cloud.countActiveWorkouts.mockResolvedValue(MAX_MERGED_ACTIVE_WORKOUTS - 1);

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.countActiveWorkouts).toHaveBeenCalledWith(UID);
    expect(cloud.sendWrite).toHaveBeenCalledTimes(1);
  });
});
