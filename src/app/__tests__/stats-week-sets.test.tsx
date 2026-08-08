import { render, screen } from "@testing-library/react-native";

import StatsScreen from "../(tabs)/stats";
import type { Workout } from "@/types";

/**
 * The counts are bare numbers beside a muscle name, which could as easily be
 * reps or pounds. The heading is the only thing saying which, so it is worth an
 * assertion rather than an eyeball — it is also the first thing anyone would
 * delete while tidying the card up.
 */

const MONDAY = new Date(2026, 7, 3, 9, 0);
let mockCompleted: Workout[] = [];

jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: () => ({ completed: mockCompleted, loading: false }),
}));
jest.mock("@/context/UnitContext", () => ({ useWeightUnit: () => ({ unit: "lbs" }) }));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ accent: "#8b5cf6", accentSoft: "rgba(0,0,0,0.1)", accentText: "#c4b5fd" }),
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@/components/muscle-map", () => ({ MuscleMap: () => null }));
jest.mock("@/lib/data", () => ({
  computeStats: () => ({
    totalCompletedWorkouts: 1,
    totalWorkoutTimeMinutes: 60,
    totalVolumeLbs: 1000,
    totalSetsCompleted: 5,
    currentStreak: 1,
    longestStreak: 1,
  }),
}));

function session(category: string, done: number, when: Date): Workout {
  return {
    id: `w-${category}-${when.getTime()}`,
    userId: "u1",
    name: category,
    isTemplate: false,
    createdAt: when,
    completedAt: when,
    exercises: [
      {
        id: "e1",
        exerciseId: "x",
        exercise: { id: "x", name: "x", category, musclesWorked: ["m"], description: "" },
        orderIndex: 0,
        sets: Array.from({ length: done }, (_, i) => ({
          id: `s${i}`,
          weightUnit: "lbs" as const,
          isCompleted: true,
        })),
      },
    ],
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  // Wednesday, so Monday of this week is the 3rd.
  jest.setSystemTime(new Date(2026, 7, 5, 12, 0));
  mockCompleted = [];
});

afterEach(() => jest.useRealTimers());

it("says what the numbers are", () => {
  mockCompleted = [session("Chest", 6, MONDAY)];

  render(<StatsScreen />);

  expect(screen.getByText("Sets completed this week")).toBeTruthy();
  expect(screen.getByText("Chest")).toBeTruthy();
  expect(screen.getByText("6")).toBeTruthy();
});

it("adds up across the week's workouts", () => {
  mockCompleted = [
    session("Chest", 6, MONDAY),
    session("Chest", 4, new Date(2026, 7, 4, 9, 0)),
    // 7, not 5: the lifetime grid above also renders a "5".
    session("Back", 7, new Date(2026, 7, 4, 10, 0)),
  ];

  render(<StatsScreen />);

  expect(screen.getByText("10")).toBeTruthy();
  expect(screen.getByText("7")).toBeTruthy();
});

it("leaves out last week", () => {
  // Sunday the 2nd is the week before, so it must not be counted.
  mockCompleted = [session("Legs", 9, new Date(2026, 7, 2, 9, 0))];

  render(<StatsScreen />);

  expect(screen.queryByText("Sets completed this week")).toBeNull();
  expect(screen.queryByText("Legs")).toBeNull();
});
