import AsyncStorage from "@react-native-async-storage/async-storage";

import { makeSet, makeWorkout, makeWorkoutExercise } from "./factories";

const DATA_KEY = "plato.guest.data.v1";
const ACTIVE_KEY = "plato.guest.active.v1";
const UID = "aB3xY7zQ1mN5pR8sT2vW4yZ6cD0e";

/**
 * Migration talks to the cloud through `./data` (workouts, stats) and directly
 * to `./firestore` (library, weekly split). Both are mocked; the on-device store
 * is real, because the whole point of these tests is what survives on the device
 * when a run fails partway.
 */
// Pinned to globalThis, like the AsyncStorage mock: jest.resetModules() re-runs
// the factories below, and anything they close over must outlive that so the
// per-test implementations set in beforeEach survive into the reloaded module.
const cloud = ((globalThis as Record<string, unknown>).__cloudMock ??= {
  createWorkout: jest.fn(),
  getCompletedWorkouts: jest.fn(),
  upsertUserStats: jest.fn(),
  getExerciseLibrary: jest.fn(),
  updateExerciseLibrary: jest.fn(),
  getWeeklyPlan: jest.fn(),
  setWeeklyPlan: jest.fn(),
  getWorkouts: jest.fn(),
  countActiveWorkouts: jest.fn(),
}) as Record<string, jest.Mock>;

jest.mock("../data", () => ({
  createWorkout: (...args: unknown[]) => (globalThis as any).__cloudMock.createWorkout(...args),
  getCompletedWorkouts: (...args: unknown[]) => (globalThis as any).__cloudMock.getCompletedWorkouts(...args),
  upsertUserStats: (...args: unknown[]) => (globalThis as any).__cloudMock.upsertUserStats(...args),
  computeStats: () => ({ totalCompletedWorkouts: 0 }),
  // Real behaviour, reimplemented: Firestore rejects undefined values, and the
  // migration relies on this to drop absent optional fields.
  stripUndefined: (value: unknown) =>
    JSON.parse(JSON.stringify(value ?? null, (_k, v) => (v === undefined ? undefined : v))),
}));

jest.mock("../firestore", () => ({
  getExerciseLibrary: (...args: unknown[]) => (globalThis as any).__cloudMock.getExerciseLibrary(...args),
  updateExerciseLibrary: (...args: unknown[]) => (globalThis as any).__cloudMock.updateExerciseLibrary(...args),
  getWeeklyPlan: (...args: unknown[]) => (globalThis as any).__cloudMock.getWeeklyPlan(...args),
  setWeeklyPlan: (...args: unknown[]) => (globalThis as any).__cloudMock.setWeeklyPlan(...args),
  getWorkouts: (...args: unknown[]) => (globalThis as any).__cloudMock.getWorkouts(...args),
  countActiveWorkouts: (...args: unknown[]) =>
    (globalThis as any).__cloudMock.countActiveWorkouts(...args),
}));

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

const emptyLibrary = { custom: [], removedIds: [], overrides: [] };

beforeEach(() => {
  jest.clearAllMocks();
  let n = 0;
  cloud.createWorkout.mockImplementation(async () => `cloud-${++n}`);
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
});

describe("nothing to migrate", () => {
  it("returns null and leaves guest mode without touching the cloud", async () => {
    const { migrate } = await seed({});

    expect(await migrate.migrateGuestDataTo(UID)).toBeNull();
    expect(cloud.createWorkout).not.toHaveBeenCalled();
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
    expect(cloud.createWorkout).toHaveBeenCalledTimes(2);
    for (const [payload, preserveCreatedAt] of cloud.createWorkout.mock.calls) {
      expect(payload.userId).toBe(UID);
      // Guest ids must not travel to the cloud — Firestore assigns its own.
      expect(payload.id).toBeUndefined();
      expect(preserveCreatedAt).toBe(true);
    }
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
    cloud.createWorkout
      .mockResolvedValueOnce("cloud-1")
      .mockRejectedValueOnce(new Error("offline"));

    await expect(migrate.migrateGuestDataTo(UID)).rejects.toThrow("offline");

    const left = await store.readGuestData();
    // The first is gone (safely in the cloud); the rest are untouched.
    expect(left.workouts.map((w) => w.name)).toEqual(["two", "three"]);
    expect(await AsyncStorage.getItem(ACTIVE_KEY)).toBe("1");
  });

  it("a retry uploads only what is still on the device, never a duplicate", async () => {
    const { store, migrate } = await seed({ workouts: three });
    cloud.createWorkout.mockResolvedValueOnce("cloud-1").mockRejectedValueOnce(new Error("offline"));
    await expect(migrate.migrateGuestDataTo(UID)).rejects.toThrow();

    cloud.createWorkout.mockReset();
    let n = 10;
    cloud.createWorkout.mockImplementation(async () => `cloud-${++n}`);
    await migrate.migrateGuestDataTo(UID);

    expect(cloud.createWorkout).toHaveBeenCalledTimes(2);
    expect(cloud.createWorkout.mock.calls.map(([w]) => w.name)).toEqual(["two", "three"]);
    expect(store.hasContent(await store.readGuestData())).toBe(false);
  });
});

describe("weekly split", () => {
  const template = makeWorkout({ id: "local-t1", name: "Leg Day", isTemplate: true });
  const planPointingAtTemplate = ["local-t1", null, null, null, null, null, null];

  it("remaps guest template ids onto their new cloud ids", async () => {
    const { migrate } = await seed({ workouts: [template], weeklyPlan: planPointingAtTemplate });
    cloud.createWorkout.mockResolvedValueOnce("cloud-t1");

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.setWeeklyPlan).toHaveBeenCalledWith(UID, ["cloud-t1", null, null, null, null, null, null]);
  });

  // The regression: templates leave the device the moment they upload, so a run
  // that died after the workout loop used to retry with an empty id map and
  // silently drop the split before wiping the guest data for good.
  it("survives a retry after the run failed past the workout loop", async () => {
    const { store, migrate } = await seed({ workouts: [template], weeklyPlan: planPointingAtTemplate });
    cloud.createWorkout.mockResolvedValueOnce("cloud-t1");
    cloud.getWeeklyPlan.mockRejectedValueOnce(new Error("offline"));

    await expect(migrate.migrateGuestDataTo(UID)).rejects.toThrow("offline");
    // The template is already in the cloud and gone from the device...
    expect((await store.readGuestData()).workouts).toHaveLength(0);
    // ...but the split still needs migrating, so guest data must survive.
    expect(store.hasContent(await store.readGuestData())).toBe(true);

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.setWeeklyPlan).toHaveBeenCalledWith(UID, ["cloud-t1", null, null, null, null, null, null]);
    expect(cloud.createWorkout).toHaveBeenCalledTimes(1); // no duplicate upload
  });

  it("never overwrites a day the account already filled", async () => {
    const { migrate } = await seed({
      workouts: [template],
      weeklyPlan: ["local-t1", "local-t1", null, null, null, null, null],
    });
    cloud.createWorkout.mockResolvedValueOnce("cloud-t1");
    cloud.getWeeklyPlan.mockResolvedValue(["account-existing", null, null, null, null, null, null]);

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.setWeeklyPlan).toHaveBeenCalledWith(UID, [
      "account-existing", "cloud-t1", null, null, null, null, null,
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
    cloud.createWorkout.mockResolvedValueOnce("cloud-t1");
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
    expect(cloud.createWorkout).toHaveBeenCalledTimes(MAX_TEMPLATES);
  });

  it("stops the cycle being repeated to climb past the ceiling", async () => {
    // Second time around the account is already at the ceiling, so a fresh
    // guest session full of templates adds nothing.
    const { migrate } = await seed({ workouts: templates("guest", MAX_TEMPLATES) });
    cloud.getWorkouts.mockResolvedValue(templates("acct", MAX_MERGED_TEMPLATES));

    const result = await migrate.migrateGuestDataTo(UID);

    expect(result?.templatesDropped).toBe(MAX_TEMPLATES);
    expect(cloud.createWorkout).not.toHaveBeenCalled();
  });

  it("fills the remaining room and reports only the excess", async () => {
    const { migrate } = await seed({ workouts: templates("guest", 10) });
    cloud.getWorkouts.mockResolvedValue(templates("acct", MAX_MERGED_TEMPLATES - 4));

    const result = await migrate.migrateGuestDataTo(UID);

    expect(cloud.createWorkout).toHaveBeenCalledTimes(4);
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
    const [[uploaded]] = cloud.createWorkout.mock.calls;
    expect(uploaded.name).toBe("Leg day");
  });

  it("measures room against the account, not the guest session", async () => {
    // Counting only what the guest brought would let each cycle add a fresh 20.
    const { migrate } = await seed({ workouts: templates("guest", 5) });
    cloud.getWorkouts.mockResolvedValue(templates("acct", MAX_MERGED_TEMPLATES - 2));

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.getWorkouts).toHaveBeenCalledWith(UID, true);
    expect(cloud.createWorkout).toHaveBeenCalledTimes(2);
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
    expect(cloud.createWorkout).toHaveBeenCalledTimes(MAX_ACTIVE_WORKOUTS);
  });

  it("stops the cycle being repeated to climb past the ceiling", async () => {
    const { migrate } = await seed({ workouts: started("guest", MAX_ACTIVE_WORKOUTS) });
    cloud.countActiveWorkouts.mockResolvedValue(MAX_MERGED_ACTIVE_WORKOUTS);

    const result = await migrate.migrateGuestDataTo(UID);

    expect(result?.activeWorkoutsDropped).toBe(MAX_ACTIVE_WORKOUTS);
    expect(cloud.createWorkout).not.toHaveBeenCalled();
  });

  it("uploads an unfinished workout still unfinished", async () => {
    // The tempting shortcut for this cap was to finish in-progress workouts on
    // sign-in instead of counting them. Streaks and totals come off completedAt,
    // so that would credit a training day nobody did. Whatever crosses must
    // arrive exactly as unfinished as it left.
    const { migrate } = await seed({ workouts: started("guest", 1) });
    cloud.countActiveWorkouts.mockResolvedValue(0);

    await migrate.migrateGuestDataTo(UID);

    const [[uploaded]] = cloud.createWorkout.mock.calls;
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
    const [[uploaded]] = cloud.createWorkout.mock.calls;
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
    expect(cloud.createWorkout).toHaveBeenCalledTimes(1);
  });

  it("measures room against the account, not the guest session", async () => {
    const { migrate } = await seed({ workouts: started("guest", 4) });
    cloud.countActiveWorkouts.mockResolvedValue(MAX_MERGED_ACTIVE_WORKOUTS - 1);

    await migrate.migrateGuestDataTo(UID);

    expect(cloud.countActiveWorkouts).toHaveBeenCalledWith(UID);
    expect(cloud.createWorkout).toHaveBeenCalledTimes(1);
  });
});
