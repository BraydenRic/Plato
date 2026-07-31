import AsyncStorage from "@react-native-async-storage/async-storage";

import { emptySet, makeSet, makeWorkout, makeWorkoutExercise } from "./factories";

const DATA_KEY = "plato.guest.data.v1";
const ACTIVE_KEY = "plato.guest.active.v1";

/**
 * The store keeps a module-level cache, so every test needs a clean module
 * registry — otherwise state leaks between cases and the wipe/race tests become
 * meaningless.
 */
type LocalStore = typeof import("../local-store");

async function freshStore(seed?: unknown): Promise<LocalStore> {
  jest.resetModules();
  await AsyncStorage.clear();
  if (seed !== undefined) {
    await AsyncStorage.setItem(DATA_KEY, typeof seed === "string" ? seed : JSON.stringify(seed));
  }
  // require, not import(): Jest runs these as CommonJS, and only require picks
  // up the reset module registry that gives each test a clean store cache.
  return require("../local-store");
}

async function storedData(): Promise<Record<string, unknown>> {
  return JSON.parse((await AsyncStorage.getItem(DATA_KEY)) ?? "{}");
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("id routing predicates", () => {
  it("recognises the guest user id and nothing else", async () => {
    const { isGuestUserId, GUEST_USER_ID } = await freshStore();
    expect(isGuestUserId(GUEST_USER_ID)).toBe(true);
    expect(isGuestUserId("aB3xY7zQ1mN5pR8sT2vW4yZ6cD0e")).toBe(false);
    expect(isGuestUserId(null)).toBe(false);
    expect(isGuestUserId(undefined)).toBe(false);
    expect(isGuestUserId("")).toBe(false);
  });

  it("recognises locally-created workout ids", async () => {
    const { isLocalWorkoutId } = await freshStore();
    expect(isLocalWorkoutId("local-abc123")).toBe(true);
    // Firestore auto-ids are 20 alphanumeric chars with no dash, so they can
    // never be mistaken for a local one.
    expect(isLocalWorkoutId("KFm2pQ9xLr4TnW8vZbCd")).toBe(false);
  });
});

describe("guest session flag", () => {
  it("round-trips through storage", async () => {
    const { readGuestActive, writeGuestActive } = await freshStore();
    expect(await readGuestActive()).toBe(false);
    await writeGuestActive(true);
    expect(await readGuestActive()).toBe(true);
    await writeGuestActive(false);
    expect(await readGuestActive()).toBe(false);
    expect(await AsyncStorage.getItem(ACTIVE_KEY)).toBeNull();
  });
});

describe("workout CRUD", () => {
  it("creates workouts under a local- id and persists them", async () => {
    const store = await freshStore();
    const id = await store.createWorkout({ ...makeWorkout(), userId: store.GUEST_USER_ID } as never);

    expect(store.isLocalWorkoutId(id)).toBe(true);
    expect((await storedData()).workouts).toHaveLength(1);
    expect((await store.getWorkout(id))?.id).toBe(id);
  });

  it("returns null for an unknown workout", async () => {
    const store = await freshStore();
    expect(await store.getWorkout("local-nope")).toBeNull();
  });

  it("applies partial updates without dropping other fields", async () => {
    const store = await freshStore();
    const id = await store.createWorkout(makeWorkout({ name: "Push Day" }) as never);

    await store.updateWorkout(id, { name: "Pull Day" });

    const after = await store.getWorkout(id);
    expect(after?.name).toBe("Pull Day");
    expect(after?.userId).toBe("user-1");
  });

  it("ignores an update to a workout that no longer exists", async () => {
    const store = await freshStore();
    await expect(store.updateWorkout("local-gone", { name: "x" })).resolves.toBeUndefined();
  });

  it("deletes a workout", async () => {
    const store = await freshStore();
    const id = await store.createWorkout(makeWorkout() as never);
    const workout = await store.getWorkout(id);

    await store.deleteWorkout(workout!);

    expect(await store.getWorkout(id)).toBeNull();
    expect((await storedData()).workouts).toHaveLength(0);
  });

  it("returns completed workouts newest-first, excluding templates", async () => {
    const store = await freshStore();
    await store.createWorkout(makeWorkout({ name: "old", completedAt: new Date("2026-01-01") }) as never);
    await store.createWorkout(makeWorkout({ name: "new", completedAt: new Date("2026-03-01") }) as never);
    await store.createWorkout(makeWorkout({ name: "template", isTemplate: true, completedAt: new Date("2026-02-01") }) as never);
    await store.createWorkout(makeWorkout({ name: "unfinished" }) as never);

    const completed = await store.getCompletedWorkouts(store.GUEST_USER_ID);
    expect(completed.map((w) => w.name)).toEqual(["new", "old"]);
  });
});

describe("subscriptions", () => {
  it("emits current data and again on every change", async () => {
    const store = await freshStore();
    const seen: number[] = [];

    const unsubscribe = store.subscribeWorkouts(store.GUEST_USER_ID, (w) => seen.push(w.length));
    await new Promise((r) => setImmediate(r));
    await store.createWorkout(makeWorkout() as never);

    expect(seen[seen.length - 1]).toBe(1);

    unsubscribe();
    await store.createWorkout(makeWorkout() as never);
    expect(seen[seen.length - 1]).toBe(1); // no further emissions after unsubscribe
  });

  it("sorts subscribed workouts newest-created first", async () => {
    const store = await freshStore();
    await store.createWorkout(makeWorkout({ name: "older", createdAt: new Date("2026-01-01") }) as never);
    await store.createWorkout(makeWorkout({ name: "newer", createdAt: new Date("2026-02-01") }) as never);

    const names = await new Promise<string[]>((resolve) => {
      const off = store.subscribeWorkouts(store.GUEST_USER_ID, (w) => {
        off();
        resolve(w.map((x) => x.name));
      });
    });
    expect(names).toEqual(["newer", "older"]);
  });
});

describe("reading corrupt storage", () => {
  it("starts fresh rather than crashing on unparseable JSON", async () => {
    // The store logs this deliberately; keep it out of the test output.
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const store = await freshStore("{not json at all");
    const data = await store.readGuestData();
    expect(data.workouts).toEqual([]);
    expect(store.hasContent(data)).toBe(false);
  });

  // Regression: the library used to be spread over a default, so a null field
  // survived the JSON guard and blew up later at `library.custom.length`.
  it("repairs a library whose arrays are the wrong type", async () => {
    const store = await freshStore({ library: { custom: null, removedIds: "nope", overrides: 42 } });
    const data = await store.readGuestData();

    expect(data.library.custom).toEqual([]);
    expect(data.library.removedIds).toEqual([]);
    expect(data.library.overrides).toEqual([]);
    expect(() => store.hasContent(data)).not.toThrow();
  });

  it("normalises a weekly plan of the wrong length or shape", async () => {
    const store = await freshStore({ weeklyPlan: ["t1", 5, null, { bad: true }] });
    const { weeklyPlan } = await store.readGuestData();

    expect(weeklyPlan).toHaveLength(7);
    expect(weeklyPlan).toEqual(["t1", null, null, null, null, null, null]);
  });

  it("drops non-string entries from the migrated template map", async () => {
    const store = await freshStore({ migratedTemplateIds: { good: "cloud-1", bad: 7, alsoBad: null } });
    expect((await store.readGuestData()).migratedTemplateIds).toEqual({ good: "cloud-1" });
  });

  it("revives stored date strings back into Date objects", async () => {
    const store = await freshStore();
    const id = await store.createWorkout(
      makeWorkout({ completedAt: new Date("2026-02-02T10:00:00Z"), startedAt: new Date("2026-02-02T09:00:00Z") }) as never
    );

    // Force a reload from disk, which is where the string round-trip happens.
    const reloaded = await freshStore(await storedData());
    const workout = await reloaded.getWorkout(id);

    expect(workout?.completedAt).toBeInstanceOf(Date);
    expect(workout?.startedAt).toBeInstanceOf(Date);
    expect(workout?.completedAt?.toISOString()).toBe("2026-02-02T10:00:00.000Z");
  });
});

describe("hasContent", () => {
  it("is false for a brand-new store", async () => {
    const store = await freshStore();
    expect(store.hasContent(await store.readGuestData())).toBe(false);
  });

  it.each([
    ["a workout", { workouts: [{ id: "local-1", name: "w", exercises: [] }] }],
    ["a custom exercise", { library: { custom: [{ id: "c1" }], removedIds: [], overrides: [] } }],
    ["a removed built-in", { library: { custom: [], removedIds: ["bench-press"], overrides: [] } }],
    ["an edited built-in", { library: { custom: [], removedIds: [], overrides: [{ id: "bench-press" }] } }],
    ["a weekly split day", { weeklyPlan: ["t1", null, null, null, null, null, null] }],
  ])("is true when the store holds %s", async (_label, seed) => {
    const store = await freshStore(seed);
    expect(store.hasContent(await store.readGuestData())).toBe(true);
  });
});

describe("migration bookkeeping", () => {
  it("removes a migrated workout without disturbing the rest", async () => {
    const store = await freshStore();
    const keep = await store.createWorkout(makeWorkout({ name: "keep" }) as never);
    const drop = await store.createWorkout(makeWorkout({ name: "drop" }) as never);

    await store.removeMigratedWorkout(drop);

    expect(await store.getWorkout(drop)).toBeNull();
    expect(await store.getWorkout(keep)).not.toBeNull();
  });

  // Without this the weekly split is lost on any retry: templates leave the
  // device as they upload, so a resumed run has nothing left to remap against.
  it("persists where each template landed so a retry can still remap the split", async () => {
    const store = await freshStore();
    await store.recordMigratedTemplate("local-t1", "cloud-t1");

    expect((await storedData()).migratedTemplateIds).toEqual({ "local-t1": "cloud-t1" });

    const reloaded = await freshStore(await storedData());
    expect((await reloaded.readGuestData()).migratedTemplateIds).toEqual({ "local-t1": "cloud-t1" });
  });
});

describe("clearGuestData", () => {
  it("wipes both the cache and the stored blob", async () => {
    const store = await freshStore();
    await store.createWorkout(makeWorkout() as never);

    await store.clearGuestData();

    expect(await AsyncStorage.getItem(DATA_KEY)).toBeNull();
    expect(store.hasContent(await store.readGuestData())).toBe(false);
  });

  it("notifies subscribers that the data is gone", async () => {
    const store = await freshStore();
    await store.createWorkout(makeWorkout() as never);
    const seen: number[] = [];
    store.subscribeWorkouts(store.GUEST_USER_ID, (w) => seen.push(w.length));
    await new Promise((r) => setImmediate(r));

    await store.clearGuestData();

    expect(seen[seen.length - 1]).toBe(0);
  });

  // Regression: a read already in flight would install its pre-wipe result into
  // the cache afterwards, the next write would persist it back, and the next
  // launch would upload the "deleted" data again as duplicates.
  it("cannot be undone by a read that was already in flight", async () => {
    jest.resetModules();
    await AsyncStorage.clear();
    await AsyncStorage.setItem(
      DATA_KEY,
      JSON.stringify({ workouts: [{ id: "local-1", name: "ghost", exercises: [], createdAt: new Date().toISOString() }] })
    );

    // Hold the read open so the wipe lands strictly between getItem and its
    // continuation — the exact window the generation counter guards.
    let releaseRead: (value: string | null) => void = () => {};
    const pending = new Promise<string | null>((resolve) => {
      releaseRead = resolve;
    });
    const getItem = jest.spyOn(AsyncStorage, "getItem").mockReturnValueOnce(pending as never);

    const store: LocalStore = require("../local-store");
    const inFlight = store.readGuestData();

    await store.clearGuestData();
    releaseRead(JSON.stringify({ workouts: [{ id: "local-1", name: "ghost", exercises: [] }] }));
    await inFlight;
    getItem.mockRestore();

    // The wiped state must win, on disk and in memory.
    expect(store.hasContent(await store.readGuestData())).toBe(false);
    await store.setWeeklyPlan(store.GUEST_USER_ID, ["t", null, null, null, null, null, null]);
    expect((await storedData()).workouts).toEqual([]);
  });
});

describe("exercise library and weekly plan", () => {
  it("stores and reloads a custom library", async () => {
    const store = await freshStore();
    const library = { custom: [{ id: "c1", name: "My Lift" }], removedIds: ["bench-press"], overrides: [] };

    await store.updateExerciseLibrary(store.GUEST_USER_ID, library as never);

    const reloaded = await freshStore(await storedData());
    expect((await reloaded.readGuestData()).library.removedIds).toEqual(["bench-press"]);
  });

  it("stores and reloads the weekly split", async () => {
    const store = await freshStore();
    await store.setWeeklyPlan(store.GUEST_USER_ID, ["t1", null, "t2", null, null, null, null]);

    const reloaded = await freshStore(await storedData());
    expect((await reloaded.readGuestData()).weeklyPlan).toEqual(["t1", null, "t2", null, null, null, null]);
  });

  it("keeps user stats a no-op, since the Stats tab derives its own numbers", async () => {
    const store = await freshStore();
    await expect(store.upsertUserStats()).resolves.toBeUndefined();
  });
});

describe("reopenWorkout", () => {
  it("clears the finish fields and pins an older workout to its day", async () => {
    const store = await freshStore();
    const completedAt = new Date("2026-01-05T12:00:00Z");
    const id = await store.createWorkout(
      makeWorkout({ completedAt, startedAt: completedAt, durationMinutes: 45, totalVolume: 5000 }) as never
    );

    await store.reopenWorkout((await store.getWorkout(id))!);

    const after = await store.getWorkout(id);
    expect(after?.completedAt).toBeUndefined();
    expect(after?.durationMinutes).toBeUndefined();
    expect(after?.totalVolume).toBeUndefined();
    expect(after?.scheduledFor?.getTime()).toBe(completedAt.getTime());
    expect(after?.startedAt).toBeUndefined();
  });

  it("resumes the clock for a workout finished today", async () => {
    const store = await freshStore();
    const startedAt = new Date(Date.now() - 60 * 60_000);
    const completedAt = new Date(Date.now() - 10 * 60_000);
    const id = await store.createWorkout(makeWorkout({ startedAt, completedAt }) as never);

    await store.reopenWorkout((await store.getWorkout(id))!);

    const after = await store.getWorkout(id);
    expect(after?.completedAt).toBeUndefined();
    expect(after?.startedAt!.getTime()).toBeGreaterThan(startedAt.getTime());
  });
});

describe("sanitising on read", () => {
  it("drops corrupt exercise and set entries instead of crashing", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const store = await freshStore({
      workouts: [
        {
          id: "local-1",
          name: "Messy",
          createdAt: new Date().toISOString(),
          exercises: [
            null,
            { exerciseId: "bench-press", exercise: { id: "bench-press" }, sets: [null, { id: "s1" }] },
          ],
        },
      ],
    });

    const workout = await store.getWorkout("local-1");
    expect(workout?.exercises).toHaveLength(1);
    expect(workout?.exercises[0].sets).toHaveLength(1);
  });
});

describe("volume of a guest workout survives a storage round-trip", () => {
  it("keeps completed sets intact", async () => {
    const store = await freshStore();
    const id = await store.createWorkout(
      makeWorkout({
        exercises: [makeWorkoutExercise("bench-press", [makeSet({ weight: 100, reps: 10 }), emptySet()])],
      }) as never
    );

    const reloaded = await freshStore(await storedData());
    const workout = await reloaded.getWorkout(id);

    expect(workout?.exercises[0].sets).toHaveLength(2);
    expect(workout?.exercises[0].sets[0].isCompleted).toBe(true);
    expect(workout?.exercises[0].sets[1].isCompleted).toBe(false);
  });
});
