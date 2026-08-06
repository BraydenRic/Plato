import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { ActiveWorkoutBar } from "../active-workout-bar";
import type { Workout, WorkoutSet } from "@/types";

/**
 * The bar stands in for the workout screen while you're somewhere else, so the
 * two things it has to get right are the numbers it reports and the fact that
 * it takes you back.
 *
 * The rest countdown is the one with a trap in it: the deadline lives above the
 * navigator so it survives leaving the workout, which also means it survives
 * *that workout*. A bar that read the deadline without checking whose it was
 * would count down someone else's rest.
 */

const mockPush = jest.fn();
let mockRest: { workoutId: string; endsAt: number } | null = null;
let mockWorkout: Workout | null = null;

jest.mock("@/hooks/use-active-workout", () => ({
  useActiveWorkout: () => mockWorkout,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/context/RestTimerContext", () => ({
  useRestTimer: () => ({ rest: mockRest }),
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ accent: "#8b5cf6", accentText: "#c4b5fd" }),
}));

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

const NOW = new Date(2026, 7, 4, 18, 30, 0);

function set(isCompleted: boolean): WorkoutSet {
  return { id: `s${Math.random()}`, weightUnit: "lbs", isCompleted };
}

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "w1",
    userId: "u1",
    name: "Push Day",
    isTemplate: false,
    createdAt: NOW,
    // Five minutes in.
    startedAt: new Date(NOW.getTime() - 5 * 60_000),
    exercises: [
      {
        id: "e1",
        exerciseId: "bench",
        exercise: {
          id: "bench",
          name: "Bench Press",
          category: "Chest",
          musclesWorked: ["chest"],
          description: "",
        },
        orderIndex: 0,
        sets: [set(true), set(true), set(false), set(false)],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRest = null;
  mockWorkout = workout();
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

it("reports the workout, its set progress and how long it's been running", () => {
  render(<ActiveWorkoutBar />);

  expect(screen.getByText("Push Day")).toBeTruthy();
  expect(screen.getByText("2/4 sets")).toBeTruthy();
  expect(screen.getByText("5:00")).toBeTruthy();
});

it("keeps the clock ticking", () => {
  render(<ActiveWorkoutBar />);

  act(() => jest.advanceTimersByTime(2_000));

  expect(screen.getByText("5:02")).toBeTruthy();
});

it("says so rather than counting sets when there are none yet", () => {
  mockWorkout = workout({ exercises: [] });
  render(<ActiveWorkoutBar />);

  expect(screen.getByText("No sets yet")).toBeTruthy();
});

it("shows the rest countdown instead of the elapsed clock while resting", () => {
  mockRest = { workoutId: "w1", endsAt: NOW.getTime() + 45_000 };

  render(<ActiveWorkoutBar />);

  expect(screen.getByText("Rest 0:45")).toBeTruthy();
  expect(screen.queryByText("5:00")).toBeNull();
});

it("goes back to the elapsed clock once the rest runs out", () => {
  mockRest = { workoutId: "w1", endsAt: NOW.getTime() + 2_000 };
  render(<ActiveWorkoutBar />);

  act(() => jest.advanceTimersByTime(3_000));

  // The deadline is deliberately never cleared — the Live Activity needs it to
  // hold at 0:00 — so the bar has to decide on the remaining time itself.
  expect(screen.queryByText(/Rest/)).toBeNull();
  expect(screen.getByText("5:03")).toBeTruthy();
});

it("ignores a rest belonging to a different workout", () => {
  mockRest = { workoutId: "some-other-workout", endsAt: NOW.getTime() + 45_000 };

  render(<ActiveWorkoutBar />);

  expect(screen.queryByText("Rest 0:45")).toBeNull();
  expect(screen.getByText("5:00")).toBeTruthy();
});

it("opens the workout it's advertising", () => {
  mockWorkout = workout({ id: "w7" });
  render(<ActiveWorkoutBar />);

  fireEvent.press(screen.getByTestId("active-workout-bar"));

  expect(mockPush).toHaveBeenCalledWith("/workout/w7");
});

it("is nothing but the status-bar inset when no workout is running", () => {
  mockWorkout = null;

  render(<ActiveWorkoutBar />);

  // The strip still holds the top inset for the tab screens below it, which no
  // longer carry a SafeAreaView of their own.
  expect(screen.queryByTestId("active-workout-bar")).toBeNull();
  expect(screen.root.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ height: 59 })])
  );
});
