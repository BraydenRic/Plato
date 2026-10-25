import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import { LiveActivitySync } from "../live-activity-sync";
import type { Workout } from "@/types";

/**
 * A workout started from the Apple Watch is created while the phone app is in
 * the background, where iOS refuses to start a Live Activity. The pill has to
 * appear as soon as the app comes forward instead of waiting for the workout
 * to change.
 */

const mockStart = jest.fn<string | undefined, unknown[]>();
const mockUpdate = jest.fn((..._args: unknown[]) => true);
const mockStop = jest.fn((..._args: unknown[]) => {});
jest.mock("@/lib/live-activity", () => ({
  startWorkoutActivity: (...args: unknown[]) => mockStart(...args),
  updateWorkoutActivity: (...args: unknown[]) => mockUpdate(...args),
  stopWorkoutActivity: (...args: unknown[]) => mockStop(...args),
}));

const mockWorkout: Workout = {
  id: "w1",
  userId: "u1",
  name: "Chest/Back",
  isTemplate: false,
  createdAt: new Date(),
  startedAt: new Date(),
  exercises: [],
};
let mockActive: Workout[] = [mockWorkout];
jest.mock("@/hooks/use-workouts", () => ({ useWorkouts: () => ({ active: mockActive, loading: false }) }));
jest.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ activityTint: "#8b5cf6" }) }));
jest.mock("@/context/RestTimerContext", () => ({ useRestTimer: () => ({ rest: null }) }));
jest.mock("@/lib/current-workout", () => ({ useCurrentWorkoutId: () => null }));

let appStateListener: ((state: AppStateStatus) => void) | null = null;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockStart.mockReset();
  mockUpdate.mockClear();
  mockStop.mockClear();
  mockActive = [mockWorkout];
  appStateListener = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
  });
});

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

it("starts the Live Activity once the app comes forward if iOS refused it in the background", async () => {
  mockStart.mockReturnValueOnce(undefined).mockReturnValue("activity-1");
  render(<LiveActivitySync />);
  await flush();
  expect(mockStart).toHaveBeenCalledTimes(1);

  await act(async () => appStateListener?.("active"));
  await flush();
  expect(mockStart).toHaveBeenCalledTimes(2);
  expect(JSON.parse((await AsyncStorage.getItem("workout_live_activity"))!)).toEqual({
    activityId: "activity-1",
    workoutId: "w1",
  });
});

it("only refreshes a Live Activity that's already showing", async () => {
  mockStart.mockReturnValue("activity-1");
  render(<LiveActivitySync />);
  await flush();
  await act(async () => appStateListener?.("active"));
  await flush();
  expect(mockStart).toHaveBeenCalledTimes(1);
  expect(mockUpdate).toHaveBeenCalled();
});

it("ignores the app going to the background", async () => {
  mockStart.mockReturnValue(undefined);
  render(<LiveActivitySync />);
  await flush();
  await act(async () => appStateListener?.("background"));
  await flush();
  expect(mockStart).toHaveBeenCalledTimes(1);
});

/**
 * Every sync is chained onto the one before, so a single rejected step used to
 * skip all the rest for the remainder of the launch — and the finished
 * workout's activity sat on the lock screen, still counting, for hours.
 */
describe("when the phone's storage fails", () => {
  // Only the storage spies: the shared in-memory AsyncStorage outlives this file.
  const spies: jest.SpyInstance[] = [];
  afterEach(() => spies.splice(0).forEach((spy) => spy.mockRestore()));

  it("still ends the activity when the workout finishes, after a failed save", async () => {
    spies.push(jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full")));
    mockStart.mockReturnValue("activity-1");
    const { rerender } = render(<LiveActivitySync />);
    await flush();
    expect(mockStart).toHaveBeenCalledTimes(1);

    // Later updates still land on the activity that was started.
    await act(async () => appStateListener?.("active"));
    await flush();
    expect(mockUpdate).toHaveBeenCalledWith("activity-1", mockWorkout, 0, 0, expect.anything(), null);

    mockActive = [];
    rerender(<LiveActivitySync />);
    await flush();
    expect(mockStop).toHaveBeenCalledWith("activity-1", "Workout finished", expect.anything());
  });

  it("still starts the activity when the saved record can't be read", async () => {
    spies.push(jest.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("unreadable")));
    mockStart.mockReturnValue("activity-1");
    render(<LiveActivitySync />);
    await flush();
    expect(mockStart).toHaveBeenCalledTimes(1);

    await act(async () => appStateListener?.("active"));
    await flush();
    expect(mockUpdate).toHaveBeenCalled();
  });
});
