import { act, fireEvent, render, screen } from "@testing-library/react-native";

import WorkoutsScreen from "../(tabs)/index";
import type { Workout } from "@/types";

/**
 * Starting a workout must not show it on this screen before the workout screen
 * has finished covering it.
 *
 * The row exists the instant it's created — the store's cache updates locally —
 * but the push takes an animation to cover this list, so the new workout is
 * visible underneath the incoming screen for the length of it. Every list here
 * that can show that workout has to hold it back, and the failure mode is
 * forgetting one: "In progress" rendered it unfiltered while the calendar
 * directly below correctly didn't. This asserts against the whole screen rather
 * than a single section so a list added later is covered by default.
 *
 * The other half is when it comes back. Waiting until this screen is focused
 * again holds the row until the back-swipe has finished, which puts the gap
 * somewhere the user is looking instead of somewhere they aren't.
 */

const NEW_ID = "new-workout";
const mockPush = jest.fn();

const mockStartedWorkout: Workout = {
  id: NEW_ID,
  userId: "u1",
  name: "Thursday Session",
  isTemplate: false,
  exercises: [],
  createdAt: new Date(),
  startedAt: new Date(),
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual("react");
    useEffect(cb, [cb]);
  },
}));

// The workout is already in the store from the moment it's created, which is
// the whole reason this suppression exists.
jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: () => ({
    loading: false,
    error: null,
    active: [mockStartedWorkout],
    planned: [],
    completed: [],
    templates: [],
  }),
}));

jest.mock("@/hooks/use-weekly-plan", () => ({
  useWeeklyPlan: () => ({ plan: {}, assignDay: jest.fn() }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: null, dataUserId: "u1" }),
}));

jest.mock("@/lib/data", () => ({
  createWorkoutLocalFirst: () => ({ id: "new-workout", saved: Promise.resolve() }),
  startFromTemplate: () => ({ id: "new-workout", saved: Promise.resolve() }),
  deleteWorkout: jest.fn(async () => {}),
  stripUndefined: (v: unknown) => v,
}));

jest.mock("@/context/UnitContext", () => ({
  useWeightUnit: () => ({ unit: "lbs", setUnit: jest.fn() }),
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    id: "violet",
    label: "Violet",
    accent: "#7c3aed",
    accentSoft: "rgba(124,58,237,0.12)",
    accentText: "#a78bfa",
    accentMuted: "#6d28d9",
    onAccent: "#ffffff",
    activityTint: "#7c3aed",
    iconName: null,
  }),
}));

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

beforeEach(() => {
  jest.useFakeTimers();
  mockPush.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Every list on the screen at once — the point is that none of them show it. */
const rowsForNewWorkout = () => screen.queryAllByText(mockStartedWorkout.name);

it("hides a workout being opened from every list, then brings it back", async () => {
  render(<WorkoutsScreen />);

  // Visible to begin with: it's a normal in-progress workout.
  expect(rowsForNewWorkout().length).toBeGreaterThan(0);

  // Async so the create promise settles inside act — it flips the button out of
  // its loading state and would otherwise land mid-assertion.
  await act(async () => {
    fireEvent.press(screen.getByText("Start empty workout"));
  });

  expect(mockPush).toHaveBeenCalledWith(`/workout/${NEW_ID}`);
  expect(rowsForNewWorkout()).toHaveLength(0);

  // Still hidden while the push is animating...
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(rowsForNewWorkout()).toHaveLength(0);

  // ...and back once the workout screen is covering this one, so a back-swipe
  // drags a list that's already complete into view.
  act(() => {
    jest.advanceTimersByTime(500);
  });
  expect(rowsForNewWorkout().length).toBeGreaterThan(0);
});
