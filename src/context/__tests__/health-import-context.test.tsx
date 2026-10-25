import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import {
  FIRST_IMPORT_DAYS,
  HEALTH_KEY_PREFIX,
  HealthImportProvider,
  LOOKBACK_MS,
  useHealthImport,
} from "../HealthImportContext";
import { IMPORTED_ACTIVITIES, type HealthWorkout } from "@/lib/health-import";
import type { Workout } from "@/types";

/**
 * Bringing workouts in from Apple Health has two ways to go wrong that a
 * person would notice: a run arriving twice, and someone else's runs arriving
 * at all. Most of what's here is about those.
 */

const mockHealth = {
  isAvailable: jest.fn(() => true),
  requestAccess: jest.fn(async () => {}),
  getWorkouts: jest.fn(async (_since: number, _activities: string[]): Promise<HealthWorkout[]> => []),
  getDistanceSamples: jest.fn(async (_id: string) => []),
};
jest.mock("../../../modules/plato-health", () => ({
  __esModule: true,
  get default() {
    return mockHealth;
  },
}));

let mockUserId: string | null = "u1";
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ dataUserId: mockUserId }) }));
jest.mock("@/context/UnitContext", () => ({ useWeightUnit: () => ({ unit: "lbs", loaded: true }) }));

let mockCompleted: Workout[] = [];
let mockLoading = false;
let mockAwaitingSync = false;
jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: () => ({ completed: mockCompleted, loading: mockLoading, awaitingSync: mockAwaitingSync }),
}));

const mockCreate = jest.fn((_w: Omit<Workout, "id">) => ({ id: "new", saved: Promise.resolve() }));
const mockUpsertStats = jest.fn(async (_s: unknown) => {});
jest.mock("@/lib/data", () => ({
  createWorkoutLocalFirst: (w: Omit<Workout, "id">) => mockCreate(w),
  getCompletedWorkouts: jest.fn(async () => []),
  upsertUserStats: (s: unknown) => mockUpsertStats(s),
  computeStats: () => ({ totalCompletedWorkouts: 1 }),
}));

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function run(id: string): HealthWorkout {
  return {
    id,
    activity: "running",
    indoor: false,
    startMs: NOW - 2 * DAY,
    endMs: NOW - 2 * DAY + 1500_000,
    duration: 1500,
    distance: 5000,
    activeCalories: 300,
    avgHeartRate: 150,
    maxHeartRate: 170,
    events: [],
    source: "Apple Watch",
    sourceBundle: "com.apple.health",
  };
}

function storedFor(userId: string) {
  return AsyncStorage.getItem(HEALTH_KEY_PREFIX + userId).then((raw) => (raw ? JSON.parse(raw) : null));
}

let api: ReturnType<typeof useHealthImport>;
function Probe() {
  api = useHealthImport();
  return null;
}

let appStateListener: ((state: AppStateStatus) => void) | null = null;

async function flush() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function mount() {
  const view = render(
    <HealthImportProvider>
      <Probe />
    </HealthImportProvider>
  );
  await flush();
  return view;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockHealth.isAvailable.mockImplementation(() => true);
  mockHealth.requestAccess.mockImplementation(async () => {});
  mockHealth.getWorkouts.mockImplementation(async () => []);
  mockUserId = "u1";
  mockCompleted = [];
  mockLoading = false;
  mockAwaitingSync = false;
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  appStateListener = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("does nothing until it's turned on", async () => {
  await mount();
  expect(api.available).toBe(true);
  expect(api.enabled).toBe(false);
  expect(mockHealth.getWorkouts).not.toHaveBeenCalled();
});

it("isn't offered where there's no Health", async () => {
  mockHealth.isAvailable.mockImplementation(() => false);
  await mount();
  expect(api.available).toBe(false);
});

it("asks iOS first, then brings in the past year", async () => {
  mockHealth.getWorkouts.mockImplementation(async () => [run("H-1")]);
  await mount();
  await act(async () => {
    await api.setEnabled(true);
  });
  await flush();

  expect(mockHealth.requestAccess.mock.invocationCallOrder[0]).toBeLessThan(
    mockHealth.getWorkouts.mock.invocationCallOrder[0]
  );
  expect(mockHealth.getWorkouts).toHaveBeenCalledWith(NOW - FIRST_IMPORT_DAYS * DAY, IMPORTED_ACTIVITIES);
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate.mock.calls[0][0]).toMatchObject({ userId: "u1", name: "Outdoor Run" });
  // The streak and plato-web's totals count it, as they would a finished workout.
  expect(mockUpsertStats).toHaveBeenCalledWith({ userId: "u1", totalCompletedWorkouts: 1 });
  expect(await storedFor("u1")).toEqual({ enabled: true, lastSync: NOW, seen: ["H-1"] });
  expect(api.enabled).toBe(true);
});

it("never brings the same workout in twice, or one that was deleted", async () => {
  await AsyncStorage.setItem(HEALTH_KEY_PREFIX + "u1", JSON.stringify({ enabled: true, lastSync: NOW - DAY, seen: ["H-2"] }));
  // H-1 is already a workout here; H-2 was imported once and then deleted.
  mockCompleted = [
    {
      id: "w1",
      userId: "u1",
      name: "Outdoor Run",
      isTemplate: false,
      createdAt: new Date(NOW - 3 * DAY),
      completedAt: new Date(NOW - 3 * DAY),
      exercises: [
        {
          id: "e1",
          exerciseId: "running",
          exercise: { id: "running", name: "Running", category: "Cardio", musclesWorked: [], description: "" },
          orderIndex: 0,
          sets: [{ id: "s1", weightUnit: "lbs", isCompleted: true, tracked: { healthId: "H-1" } }],
        },
      ],
    },
  ];
  mockHealth.getWorkouts.mockImplementation(async () => [run("H-1"), run("H-2"), run("H-3")]);
  await mount();

  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate.mock.calls[0][0].exercises[0].sets[0].tracked?.healthId).toBe("H-3");
  expect((await storedFor("u1")).seen).toEqual(["H-2", "H-3"]);
});

it("looks again each time Plato comes forward, back a week from the last look", async () => {
  const lastLook = NOW - 3 * DAY;
  await AsyncStorage.setItem(HEALTH_KEY_PREFIX + "u1", JSON.stringify({ enabled: true, lastSync: lastLook, seen: [] }));
  await mount();
  expect(mockHealth.getWorkouts).toHaveBeenLastCalledWith(lastLook - LOOKBACK_MS, IMPORTED_ACTIVITIES);

  (Date.now as jest.Mock).mockReturnValue(NOW + DAY);
  await act(async () => appStateListener?.("active"));
  await flush();
  expect(mockHealth.getWorkouts).toHaveBeenCalledTimes(2);
  expect(mockHealth.getWorkouts).toHaveBeenLastCalledWith(NOW - LOOKBACK_MS, IMPORTED_ACTIVITIES);
});

// What's been imported is read off the workouts; off a half-loaded list, the
// missing ones would come in again.
it("waits for the workouts to load and sync before importing", async () => {
  await AsyncStorage.setItem(HEALTH_KEY_PREFIX + "u1", JSON.stringify({ enabled: true, seen: [] }));
  mockAwaitingSync = true;
  const view = await mount();
  expect(mockHealth.getWorkouts).not.toHaveBeenCalled();

  mockAwaitingSync = false;
  view.rerender(
    <HealthImportProvider>
      <Probe />
    </HealthImportProvider>
  );
  await flush();
  expect(mockHealth.getWorkouts).toHaveBeenCalledTimes(1);
});

it("keeps the setting to the account that turned it on", async () => {
  await AsyncStorage.setItem(HEALTH_KEY_PREFIX + "u1", JSON.stringify({ enabled: true, seen: [] }));
  mockUserId = "u2";
  await mount();
  expect(api.enabled).toBe(false);
  expect(mockHealth.getWorkouts).not.toHaveBeenCalled();
});

it("stays off when iOS can't be asked", async () => {
  mockHealth.requestAccess.mockImplementation(async () => {
    throw new Error("no");
  });
  await mount();
  await act(async () => {
    await api.setEnabled(true);
  });
  await flush();
  expect(api.enabled).toBe(false);
  expect(api.failed).toBe(true);
  expect(mockHealth.getWorkouts).not.toHaveBeenCalled();
});

it("says so when reading Health fails, and keeps what it had", async () => {
  await AsyncStorage.setItem(HEALTH_KEY_PREFIX + "u1", JSON.stringify({ enabled: true, lastSync: NOW - DAY, seen: ["H-9"] }));
  mockHealth.getWorkouts.mockImplementation(async () => {
    throw new Error("denied");
  });
  await mount();
  expect(api.failed).toBe(true);
  expect(api.importing).toBe(false);
  expect(await storedFor("u1")).toEqual({ enabled: true, lastSync: NOW - DAY, seen: ["H-9"] });
});

// Turning it back on should pick up what was recorded while it was off.
it("turning it off stops importing and forgets when it last looked, but not what it imported", async () => {
  await AsyncStorage.setItem(HEALTH_KEY_PREFIX + "u1", JSON.stringify({ enabled: true, lastSync: NOW - DAY, seen: ["H-1"] }));
  await mount();
  expect(mockHealth.getWorkouts).toHaveBeenCalledTimes(1);

  await act(async () => {
    await api.setEnabled(false);
  });
  expect(await storedFor("u1")).toEqual({ enabled: false, seen: ["H-1"] });

  await act(async () => appStateListener?.("active"));
  await flush();
  expect(mockHealth.getWorkouts).toHaveBeenCalledTimes(1);
});
