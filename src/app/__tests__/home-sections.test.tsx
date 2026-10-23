import { act, fireEvent, render, screen } from "@testing-library/react-native";

import WorkoutsScreen from "../(tabs)/index";
import type { Workout } from "@/types";

/**
 * The bottom of Home used to be a seven-row weekly split, always open, with
 * History stuck under it as a "History" heading over a "Full history" card.
 * History is now one row under Templates, and the split folds to one line that
 * names the days you've set.
 */

const mockPush = jest.fn();
let mockCompleted: Workout[] = [];
let mockTemplates: Workout[] = [];
let mockPlan: (string | null)[] = [null, null, null, null, null, null, null];

// Tuesday 4 August 2026.
const NOW = new Date(2026, 7, 4, 12, 0);

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual("react");
    useEffect(cb, [cb]);
  },
}));
jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: () => ({
    loading: false,
    error: null,
    active: [],
    planned: [],
    completed: mockCompleted,
    templates: mockTemplates,
  }),
}));
jest.mock("@/hooks/use-weekly-plan", () => ({
  useWeeklyPlan: () => ({ plan: mockPlan, assignDay: jest.fn() }),
}));
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: null, dataUserId: "u1" }),
}));
jest.mock("@/lib/data", () => ({
  createWorkoutLocalFirst: () => ({ id: "new", saved: Promise.resolve() }),
  startFromTemplate: () => ({ id: "new", saved: Promise.resolve() }),
  deleteWorkout: jest.fn(async () => {}),
  stripUndefined: (v: unknown) => v,
}));
jest.mock("@/context/UnitContext", () => ({
  useWeightUnit: () => ({ unit: "lbs", setUnit: jest.fn() }),
}));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ accent: "#7c3aed", accentSoft: "#eee", accentText: "#a78bfa", onAccent: "#fff" }),
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

function workout(id: string, name: string, extra: Partial<Workout> = {}): Workout {
  return { id, userId: "u1", name, isTemplate: false, exercises: [], createdAt: NOW, ...extra };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  mockPush.mockClear();
  mockCompleted = [];
  mockTemplates = [];
  mockPlan = [null, null, null, null, null, null, null];
});

afterEach(() => {
  jest.useRealTimers();
});

async function renderHome() {
  render(<WorkoutsScreen />);
  await act(async () => {});
}

describe("History", () => {
  it("is one row with the count, and opens the full history", async () => {
    mockCompleted = [
      workout("a", "Push", { completedAt: new Date(2026, 7, 3) }),
      workout("b", "Pull", { completedAt: new Date(2026, 7, 2) }),
    ];
    await renderHome();

    expect(screen.getByText("2 workouts")).toBeTruthy();
    expect(screen.queryByText("Full history")).toBeNull();
    fireEvent.press(screen.getByTestId("history-link"));
    expect(mockPush).toHaveBeenCalledWith("/history");
  });

  it("isn't there before anything has been finished", async () => {
    await renderHome();
    expect(screen.queryByTestId("history-link")).toBeNull();
  });
});

describe("the weekly split", () => {
  it("folds to one line naming the days that have a template", async () => {
    mockTemplates = [workout("t1", "Push", { isTemplate: true }), workout("t2", "Legs", { isTemplate: true })];
    // getDay order: Sunday first. Monday → Push, Friday → Legs.
    mockPlan = [null, "t1", null, null, null, "t2", null];
    await renderHome();

    expect(screen.getByText(/Mon Push · Fri Legs/)).toBeTruthy();
    expect(screen.queryByText("Wednesday")).toBeNull();
  });

  it("opens to the seven days in place, and folds again", async () => {
    await renderHome();

    expect(screen.getByText("Set a template for each weekday")).toBeTruthy();
    fireEvent.press(screen.getByTestId("split-toggle"));
    expect(screen.getByText("Wednesday")).toBeTruthy();
    expect(screen.getAllByText("Rest")).toHaveLength(7);

    fireEvent.press(screen.getByTestId("split-toggle"));
    expect(screen.queryByText("Wednesday")).toBeNull();
  });
});
