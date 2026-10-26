import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, StyleSheet } from "react-native";

import StartWorkoutScreen from "../start-workout";
import { emptySet, makeWorkout, makeWorkoutExercise } from "@/lib/__tests__/factories";
import type { Workout } from "@/types";

/**
 * Starting a workout: blank, or from a template, picked the way a cardio
 * session is. Today's split comes ready, so a planned day is one tap.
 */

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: mockReplace }) }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ dataUserId: "u1" }) }));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ accent: "#8b5cf6", accentSoft: "rgba(0,0,0,0.1)", accentText: "#c4b5fd", onAccent: "#fff" }),
}));
let mockTemplates: Workout[] = [];
let mockActive: Workout[] = [];
jest.mock("@/hooks/use-workouts", () => ({ useWorkouts: () => ({ templates: mockTemplates, active: mockActive }) }));
let mockPlan: (string | null)[] = [];
jest.mock("@/hooks/use-weekly-plan", () => ({ useWeeklyPlan: () => ({ plan: mockPlan, assignDay: jest.fn() }) }));
const mockCreate = jest.fn((_w: Omit<Workout, "id">) => ({ id: "new-blank", saved: Promise.resolve() }));
const mockFromTemplate = jest.fn((_t: Workout, _u: string) => ({ id: "new-from-template", saved: Promise.resolve() }));
jest.mock("@/lib/data", () => ({
  createWorkoutLocalFirst: (w: Omit<Workout, "id">) => mockCreate(w),
  startFromTemplate: (t: Workout, u: string) => mockFromTemplate(t, u),
  stripUndefined: (v: unknown) => v,
}));
let mockFontScale = 1;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale }),
}));

const template = (id: string, name: string, setsPerExercise: number[]) =>
  makeWorkout({
    id,
    name,
    isTemplate: true,
    exercises: setsPerExercise.map((n, i) => makeWorkoutExercise(`ex-${i}`, Array.from({ length: n }, () => emptySet()))),
  });
const PUSH = template("t-push", "Push Day", [3, 3]);
const LEGS = template("t-legs", "Legs", [4]);

beforeEach(() => {
  jest.clearAllMocks();
  mockTemplates = [PUSH, LEGS];
  mockActive = [];
  mockPlan = [null, null, null, null, null, null, null];
  mockFontScale = 1;
});

async function press(text: string) {
  await act(async () => {
    fireEvent.press(screen.getByText(text));
  });
}

it("offers a blank workout and every template, with what's in each", () => {
  render(<StartWorkoutScreen />);
  expect(screen.getByText("Blank workout")).toBeTruthy();
  expect(screen.getByText("Push Day")).toBeTruthy();
  expect(screen.getByText("2 exercises · 6 sets")).toBeTruthy();
  expect(screen.getByText("Legs")).toBeTruthy();
  expect(screen.getByText("1 exercise · 4 sets")).toBeTruthy();
});

it("starts a blank workout when today has no split, straight into it", async () => {
  render(<StartWorkoutScreen />);
  expect(screen.queryByText("Today")).toBeNull();
  await press("Start blank workout");

  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "u1", isTemplate: false, exercises: [], startedAt: expect.any(Date) })
  );
  expect(mockCreate.mock.calls[0][0].name).toMatch(/^(Morning|Afternoon|Evening) Workout$/);
  expect(mockFromTemplate).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith("/workout/new-blank");
});

it("has today's split ready, marked, and starts it", async () => {
  mockPlan[new Date().getDay()] = "t-legs";
  render(<StartWorkoutScreen />);
  expect(screen.getByText("Today")).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Legs, 1 exercise · 4 sets, today's split$/ }).props.accessibilityState).toMatchObject({ selected: true });

  await press("Start Legs");
  expect(mockFromTemplate).toHaveBeenCalledWith(LEGS, "u1");
  expect(mockReplace).toHaveBeenCalledWith("/workout/new-from-template");
});

it("starts whichever template is tapped instead", async () => {
  mockPlan[new Date().getDay()] = "t-legs";
  render(<StartWorkoutScreen />);
  await press("Push Day");
  await press("Start Push Day");
  expect(mockFromTemplate).toHaveBeenCalledWith(PUSH, "u1");
});

it("starts blank when that's tapped, even with a split for today", async () => {
  mockPlan[new Date().getDay()] = "t-legs";
  render(<StartWorkoutScreen />);
  await press("Blank workout");
  await press("Start blank workout");
  expect(mockCreate).toHaveBeenCalled();
  expect(mockFromTemplate).not.toHaveBeenCalled();
});

it("starts nothing past the limit of workouts in progress", async () => {
  mockActive = Array.from({ length: 5 }, () => makeWorkout({ startedAt: new Date() }));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  render(<StartWorkoutScreen />);
  await press("Start blank workout");

  expect(alert).toHaveBeenCalledWith("Too many workouts in progress", expect.any(String));
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  alert.mockRestore();
});

it("says where templates come from before there are any", () => {
  mockTemplates = [];
  render(<StartWorkoutScreen />);
  expect(screen.getByText("Blank workout")).toBeTruthy();
  expect(screen.getByText(/Templates you make on Home show up here/)).toBeTruthy();
});

// Two to a row while names fit in half the width; past that, one to a row,
// so a long name wraps whole words instead of breaking mid-word.
it.each([
  [1, "47%"],
  [2, "100%"],
])("lays the tiles out for text size %s at %s each", (fontScale, basis) => {
  mockFontScale = fontScale;
  render(<StartWorkoutScreen />);
  const tile = screen.getByRole("button", { name: /^Push Day,/ });
  expect(StyleSheet.flatten(tile.props.style).flexBasis).toBe(basis);
});
