import { fireEvent, render, screen } from "@testing-library/react-native";

import HistoryScreen from "../history";
import { EXERCISES } from "@/lib/exercises";
import type { Workout, WorkoutSet } from "@/types";

const mockBack = jest.fn();
let mockCompleted: Workout[] = [];

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
}));
jest.mock("@/hooks/use-workouts", () => ({
  AWAITING_SYNC_MESSAGE: "",
  useWorkouts: () => ({ completed: mockCompleted, loading: false, awaitingSync: false }),
}));
jest.mock("@/components/active-workout-bar", () => ({ ActiveWorkoutBar: () => null }));
jest.mock("@/lib/data", () => ({ deleteWorkout: jest.fn() }));
jest.mock("@/lib/cardio-discards", () => ({ recordCardioDiscard: jest.fn() }));
jest.mock("@/context/UnitContext", () => ({ useWeightUnit: () => ({ unit: "lbs", setUnit: jest.fn() }) }));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ accent: "#8b5cf6", accentSoft: "rgba(0,0,0,0.1)", accentText: "#c4b5fd" }),
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

const DONE = new Date(2026, 9, 19, 18, 30);

function finished(id: string, name: string, exercises: [string, Partial<WorkoutSet>[]][]): Workout {
  return {
    id,
    userId: "u1",
    name,
    isTemplate: false,
    createdAt: DONE,
    startedAt: new Date(2026, 9, 19, 18),
    completedAt: DONE,
    durationMinutes: 25,
    exercises: exercises.map(([exerciseId, sets], i) => ({
      id: `${id}-${i}`,
      exerciseId,
      exercise: EXERCISES.find((e) => e.id === exerciseId)!,
      orderIndex: i,
      sets: sets.map((s, n) => ({ id: `${id}-${i}-${n}`, weightUnit: "lbs" as const, isCompleted: true, ...s })),
    })),
  };
}

beforeEach(() => {
  mockBack.mockClear();
  mockCompleted = [];
});

it("names its back button, the only visible way out", () => {
  // The native header is off for this screen, so VoiceOver had an unnamed
  // glyph and nothing else to leave by.
  render(<HistoryScreen />);
  const back = screen.getByRole("button", { name: "Back" });
  fireEvent.press(back);
  expect(mockBack).toHaveBeenCalled();
});

it("keeps the set count on a circuit of Cardio-category exercises", () => {
  // Burpees and jump rope are filed under Cardio, but a circuit of them is a
  // workout, not a run: no distance to show in place of its sets.
  mockCompleted = [
    finished("circuit", "Conditioning", [
      ["burpees", [{ reps: 15 }, { reps: 15 }, { reps: 15 }]],
      ["jump-rope", [{ duration: 60 }, { duration: 60 }]],
    ]),
  ];
  render(<HistoryScreen />);
  expect(screen.getByText(/· 5 sets · 25m/)).toBeTruthy();
});

it("drops it for a workout that covered ground, which says how far instead", () => {
  mockCompleted = [finished("tread", "Treadmill", [["treadmill", [{ duration: 1500, distance: 5000 }]]])];
  render(<HistoryScreen />);
  expect(screen.queryByText(/sets/)).toBeNull();
  expect(screen.getByText("3.11 mi")).toBeTruthy();
});
