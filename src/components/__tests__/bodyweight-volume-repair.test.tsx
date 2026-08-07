import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, waitFor } from "@testing-library/react-native";

import { BodyweightVolumeRepair } from "../bodyweight-volume-repair";
import type { BodyweightEntry, Workout } from "@/types";

/**
 * This rewrites finished history behind the user's back, so the parts worth
 * pinning are the ones that stop it: it must not run twice, must not run
 * against a log that hasn't arrived, and must leave itself un-marked if a write
 * fails so the next launch finishes the job rather than declaring victory.
 */

const mockUpdateWorkout = jest.fn(async () => {});
const mockUpsertUserStats = jest.fn(async () => {});
let mockCompleted: Workout[] = [];
let mockLog: BodyweightEntry[] = [];
let mockWorkoutsLoading = false;
let mockLogLoading = false;
let mockUserId: string | null = "u1";

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ dataUserId: mockUserId }),
}));

jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: () => ({ completed: mockCompleted, loading: mockWorkoutsLoading }),
}));

jest.mock("@/hooks/use-bodyweight", () => ({
  useBodyweight: () => ({ log: mockLog, loading: mockLogLoading }),
}));

jest.mock("@/lib/data", () => ({
  updateWorkout: (...args: unknown[]) => mockUpdateWorkout(...(args as [])),
  upsertUserStats: (...args: unknown[]) => mockUpsertUserStats(...(args as [])),
  computeStats: () => ({
    totalCompletedWorkouts: 1,
    totalWorkoutTimeMinutes: 60,
    totalVolumeLbs: 1950,
    totalSetsCompleted: 1,
    currentStreak: 1,
    longestStreak: 1,
  }),
}));

const AUG_4 = new Date(2026, 7, 4);
const AUG_5 = new Date(2026, 7, 5);

const log: BodyweightEntry[] = [
  { date: AUG_4, lbs: 195 },
  { date: AUG_5, lbs: 190 },
];

function staleWorkout(): Workout {
  return {
    id: "w1",
    userId: "u1",
    name: "Pull Day",
    isTemplate: false,
    createdAt: AUG_5,
    scheduledFor: AUG_4,
    completedAt: AUG_5,
    // Frozen at the 5th's weight; belongs to the 4th.
    totalVolume: 1900,
    exercises: [
      {
        id: "e1",
        exerciseId: "pull-up",
        exercise: {
          id: "pull-up",
          name: "Pull-Up",
          category: "Back",
          musclesWorked: ["lats"],
          description: "",
          isBodyweight: true,
        },
        orderIndex: 0,
        sets: [{ id: "s1", reps: 10, weightUnit: "bodyweight", isCompleted: true }],
      },
    ],
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockCompleted = [staleWorkout()];
  mockLog = log;
  mockWorkoutsLoading = false;
  mockLogLoading = false;
  mockUserId = "u1";
});

it("corrects the stored volume and records that it has run", async () => {
  render(<BodyweightVolumeRepair />);

  await waitFor(() => expect(mockUpdateWorkout).toHaveBeenCalledWith("w1", { totalVolume: 1950 }));
  await waitFor(async () =>
    expect(await AsyncStorage.getItem("bodyweight_volume_repair_v1:u1")).not.toBeNull()
  );
});

it("refreshes the stored lifetime stats the web app reads", async () => {
  render(<BodyweightVolumeRepair />);

  await waitFor(() =>
    expect(mockUpsertUserStats).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1" }))
  );
});

it("never runs a second time", async () => {
  await AsyncStorage.setItem("bodyweight_volume_repair_v1:u1", "2026-08-06T00:00:00.000Z");

  render(<BodyweightVolumeRepair />);

  // Give the effect the same chance to write that the first test gave it.
  await waitFor(async () =>
    expect(await AsyncStorage.getItem("bodyweight_volume_repair_v1:u1")).toBe(
      "2026-08-06T00:00:00.000Z"
    )
  );
  expect(mockUpdateWorkout).not.toHaveBeenCalled();
});

it("waits for the weigh-in log rather than repairing against an empty one", async () => {
  // What a failed read looks like: not loading, but nothing there.
  mockLog = [];

  render(<BodyweightVolumeRepair />);

  await waitFor(async () =>
    expect(await AsyncStorage.getItem("bodyweight_volume_repair_v1:u1")).toBeNull()
  );
  // Crucially it also didn't mark itself done, so the next launch tries again.
  expect(mockUpdateWorkout).not.toHaveBeenCalled();
});

it("holds off while the workouts are still loading", async () => {
  mockWorkoutsLoading = true;

  render(<BodyweightVolumeRepair />);

  await waitFor(async () =>
    expect(await AsyncStorage.getItem("bodyweight_volume_repair_v1:u1")).toBeNull()
  );
  expect(mockUpdateWorkout).not.toHaveBeenCalled();
});

it("leaves itself unmarked when a write fails, so the next launch finishes the job", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  mockUpdateWorkout.mockRejectedValueOnce(new Error("offline") as never);

  render(<BodyweightVolumeRepair />);

  await waitFor(() => expect(warn).toHaveBeenCalled());
  expect(await AsyncStorage.getItem("bodyweight_volume_repair_v1:u1")).toBeNull();
  warn.mockRestore();
});

it("marks itself done without writing when there is nothing stale", async () => {
  mockCompleted = [{ ...staleWorkout(), totalVolume: 1950 }];

  render(<BodyweightVolumeRepair />);

  await waitFor(async () =>
    expect(await AsyncStorage.getItem("bodyweight_volume_repair_v1:u1")).not.toBeNull()
  );
  expect(mockUpdateWorkout).not.toHaveBeenCalled();
  expect(mockUpsertUserStats).not.toHaveBeenCalled();
});

it("does nothing for a signed-out app", async () => {
  mockUserId = null;

  render(<BodyweightVolumeRepair />);

  await waitFor(() => expect(mockUpdateWorkout).not.toHaveBeenCalled());
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});
