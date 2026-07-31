import { makeWorkout } from "./factories";

/**
 * `data.ts` is the app's single entry point for reads and writes, and it picks
 * the cloud or the on-device store from the *data itself* — a guest userId, or a
 * workout id that was created locally — rather than from an "am I a guest?"
 * flag. That matters because a stale flag would send writes to the wrong backend
 * at exactly the worst moment (mid-migration, when both stores hold data).
 *
 * These tests pin that dispatch down: every call must land on exactly one store.
 */

const cloudFns = [
  "subscribeWorkouts", "subscribeWorkout", "getWorkout", "getCompletedWorkouts",
  "createWorkout", "updateWorkout", "deleteWorkout", "reopenWorkout",
  "subscribeExerciseLibrary", "updateExerciseLibrary",
  "subscribeWeeklyPlan", "setWeeklyPlan", "upsertUserStats",
] as const;

jest.mock("../firestore", () => {
  const mod: Record<string, unknown> = {
    computeStats: jest.fn(),
    sanitizeExercises: jest.fn(),
    stripUndefined: (v: unknown) => v,
    EMPTY_WEEKLY_PLAN: [null, null, null, null, null, null, null],
  };
  for (const name of [
    "subscribeWorkouts", "subscribeWorkout", "getWorkout", "getCompletedWorkouts",
    "createWorkout", "updateWorkout", "deleteWorkout", "reopenWorkout",
    "subscribeExerciseLibrary", "updateExerciseLibrary",
    "subscribeWeeklyPlan", "setWeeklyPlan", "upsertUserStats",
  ]) {
    mod[name] = jest.fn(() => `cloud:${name}`);
  }
  return mod;
});

jest.mock("../local-store", () => {
  // The routing predicates stay real — they are the thing under test.
  const actual = jest.requireActual("../local-store");
  const mod: Record<string, unknown> = { ...actual };
  for (const name of [
    "subscribeWorkouts", "subscribeWorkout", "getWorkout", "getCompletedWorkouts",
    "createWorkout", "updateWorkout", "deleteWorkout", "reopenWorkout",
    "subscribeExerciseLibrary", "updateExerciseLibrary",
    "subscribeWeeklyPlan", "setWeeklyPlan", "upsertUserStats",
  ]) {
    mod[name] = jest.fn(() => `local:${name}`);
  }
  return mod;
});

import * as data from "../data";
import * as cloud from "../firestore";
import * as local from "../local-store";

const GUEST = "local-guest";
const UID = "aB3xY7zQ1mN5pR8sT2vW4yZ6cD0e";
const LOCAL_WORKOUT = "local-abc123";
const CLOUD_WORKOUT = "KFm2pQ9xLr4TnW8vZbCd";

const asMock = (mod: unknown, name: string) =>
  (mod as Record<string, jest.Mock>)[name];

/** Asserts a call reached one store and never the other. */
function expectRoutedTo(store: "cloud" | "local", name: string) {
  const hit = store === "cloud" ? cloud : local;
  const miss = store === "cloud" ? local : cloud;
  expect(asMock(hit, name)).toHaveBeenCalled();
  expect(asMock(miss, name)).not.toHaveBeenCalled();
}

beforeEach(() => jest.clearAllMocks());

describe("routing by userId", () => {
  it.each([
    ["subscribeWorkouts", () => data.subscribeWorkouts(GUEST, () => {})],
    ["getCompletedWorkouts", () => data.getCompletedWorkouts(GUEST)],
    ["subscribeExerciseLibrary", () => data.subscribeExerciseLibrary(GUEST, () => {})],
    ["subscribeWeeklyPlan", () => data.subscribeWeeklyPlan(GUEST, () => {})],
  ])("sends %s for the guest id to the device store", (name, call) => {
    call();
    expectRoutedTo("local", name);
  });

  it.each([
    ["subscribeWorkouts", () => data.subscribeWorkouts(UID, () => {})],
    ["getCompletedWorkouts", () => data.getCompletedWorkouts(UID)],
    ["subscribeExerciseLibrary", () => data.subscribeExerciseLibrary(UID, () => {})],
    ["subscribeWeeklyPlan", () => data.subscribeWeeklyPlan(UID, () => {})],
  ])("sends %s for a real uid to Firestore", (name, call) => {
    call();
    expectRoutedTo("cloud", name);
  });

  it("routes library and plan writes by userId", () => {
    const library = { custom: [], removedIds: [], overrides: [] };
    data.updateExerciseLibrary(GUEST, library);
    expectRoutedTo("local", "updateExerciseLibrary");
    jest.clearAllMocks();

    data.updateExerciseLibrary(UID, library);
    expectRoutedTo("cloud", "updateExerciseLibrary");
    jest.clearAllMocks();

    const plan = [null, null, null, null, null, null, null];
    data.setWeeklyPlan(GUEST, plan);
    expectRoutedTo("local", "setWeeklyPlan");
    jest.clearAllMocks();

    data.setWeeklyPlan(UID, plan);
    expectRoutedTo("cloud", "setWeeklyPlan");
  });

  it("keeps guest stats off the network entirely", () => {
    data.upsertUserStats({ userId: GUEST } as never);
    expectRoutedTo("local", "upsertUserStats");
  });
});

describe("routing by workout id", () => {
  it.each([
    ["subscribeWorkout", () => data.subscribeWorkout(LOCAL_WORKOUT, () => {})],
    ["getWorkout", () => data.getWorkout(LOCAL_WORKOUT)],
    ["updateWorkout", () => data.updateWorkout(LOCAL_WORKOUT, { name: "x" })],
  ])("sends %s for a local- id to the device store", (name, call) => {
    call();
    expectRoutedTo("local", name);
  });

  it.each([
    ["subscribeWorkout", () => data.subscribeWorkout(CLOUD_WORKOUT, () => {})],
    ["getWorkout", () => data.getWorkout(CLOUD_WORKOUT)],
    ["updateWorkout", () => data.updateWorkout(CLOUD_WORKOUT, { name: "x" })],
  ])("sends %s for a Firestore id to Firestore", (name, call) => {
    call();
    expectRoutedTo("cloud", name);
  });
});

describe("routing whole-workout operations", () => {
  it("deletes and reopens a guest workout on the device", () => {
    const guestWorkout = makeWorkout({ id: LOCAL_WORKOUT, userId: "local-guest" });
    data.deleteWorkout(guestWorkout);
    expectRoutedTo("local", "deleteWorkout");
    jest.clearAllMocks();

    data.reopenWorkout(guestWorkout);
    expectRoutedTo("local", "reopenWorkout");
  });

  it("deletes and reopens an account workout in Firestore", () => {
    const cloudWorkout = makeWorkout({ id: CLOUD_WORKOUT, userId: UID });
    data.deleteWorkout(cloudWorkout);
    expectRoutedTo("cloud", "deleteWorkout");
    jest.clearAllMocks();

    data.reopenWorkout(cloudWorkout);
    expectRoutedTo("cloud", "reopenWorkout");
  });

  it("creates a workout wherever its userId points", () => {
    data.createWorkout(makeWorkout({ userId: "local-guest" }));
    expectRoutedTo("local", "createWorkout");
    jest.clearAllMocks();

    data.createWorkout(makeWorkout({ userId: UID }));
    expectRoutedTo("cloud", "createWorkout");
  });
});

describe("templates", () => {
  it("blanks weights and reps so a template carries structure only", async () => {
    asMock(cloud, "createWorkout").mockResolvedValue("new-id");
    const source = makeWorkout({
      userId: UID,
      exercises: [
        {
          id: "we1",
          exerciseId: "bench-press",
          exercise: { id: "bench-press", name: "Bench", category: "Chest", musclesWorked: [], description: "" },
          orderIndex: 0,
          sets: [
            { id: "s1", weight: 185, reps: 8, weightUnit: "lbs", isCompleted: true },
            { id: "s2", weight: 175, reps: 6, weightUnit: "lbs", isCompleted: true },
          ],
        },
      ],
    });

    await data.saveAsTemplate(source, "Push Day");

    const [payload] = asMock(cloud, "createWorkout").mock.calls[0];
    expect(payload.isTemplate).toBe(true);
    expect(payload.name).toBe("Push Day");
    for (const set of payload.exercises[0].sets) {
      expect(set.weight).toBeUndefined();
      expect(set.reps).toBeUndefined();
      expect(set.isCompleted).toBe(false);
      expect(set.weightUnit).toBe("lbs"); // the unit is structure, not a number
    }
  });

  it("starts immediately when no day is given, and plans when one is", async () => {
    asMock(cloud, "createWorkout").mockResolvedValue("new-id");
    const template = makeWorkout({ userId: UID, isTemplate: true, exercises: [] });

    await data.startFromTemplate(template, UID);
    const [started] = asMock(cloud, "createWorkout").mock.calls[0];
    expect(started.startedAt).toBeInstanceOf(Date);
    expect(started.scheduledFor).toBeUndefined();
    expect(started.isTemplate).toBe(false);

    asMock(cloud, "createWorkout").mockClear();
    const day = new Date("2026-04-01T12:00:00Z");
    await data.startFromTemplate(template, UID, day);
    const [planned] = asMock(cloud, "createWorkout").mock.calls[0];
    // A planned workout has no startedAt — it isn't a session until you begin it.
    expect(planned.startedAt).toBeUndefined();
    expect(planned.scheduledFor).toEqual(day);
  });

  it("routes a guest's template creation to the device store", async () => {
    asMock(local, "createWorkout").mockResolvedValue("local-new");
    await data.startFromTemplate(makeWorkout({ isTemplate: true, exercises: [] }), GUEST);
    expectRoutedTo("local", "createWorkout");
  });
});
