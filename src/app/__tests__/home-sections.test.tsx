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
let mockPlanned: Workout[] = [];
let mockActive: Workout[] = [];
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
    active: mockActive,
    planned: mockPlanned,
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
  mockPlanned = [];
  mockActive = [];
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

describe("a planned workout's row", () => {
  it("says it's planned in its own line, with no pill repeating it", async () => {
    // Thursday of this week, with three sets laid out.
    mockPlanned = [
      workout("p1", "Leg Day", {
        scheduledFor: new Date(2026, 7, 6),
        exercises: [
          {
            id: "e1",
            exerciseId: "squat",
            exercise: { id: "squat", name: "Squat", category: "Legs", musclesWorked: ["Quads"], description: "" },
            orderIndex: 0,
            sets: [1, 2, 3].map((n) => ({ id: `s${n}`, weightUnit: "lbs" as const, isCompleted: false })),
          },
        ],
      }),
    ];
    await renderHome();
    // Select Thursday on the week strip so its row is on screen.
    fireEvent.press(screen.getByText("6"));

    expect(screen.getByText(/3 sets planned/)).toBeTruthy();
    expect(screen.queryByText("PLANNED")).toBeNull();
  });
});

describe("reordering a day", () => {
  const started = (id: string, name: string, hour: number, orderIndex?: number) =>
    workout(id, name, { startedAt: new Date(2026, 7, 4, hour), orderIndex });

  it("offers Reorder only once the day has more than one workout", async () => {
    mockActive = [started("a", "Push", 9)];
    await renderHome();
    expect(screen.queryByTestId("reorder-day")).toBeNull();
  });

  it("opens the reorder screen for the day on show", async () => {
    mockActive = [started("a", "Push", 9), started("b", "Legs", 10)];
    await renderHome();

    fireEvent.press(screen.getByTestId("reorder-day"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/reorder-day",
      params: { day: String(new Date(2026, 7, 4).getTime()) },
    });
  });

  it("lists the day in the order you set, not the order they started", async () => {
    mockActive = [started("a", "Push", 9, 1), started("b", "Legs", 10, 0)];
    await renderHome();

    const names = screen.getAllByText(/^(Push|Legs)$/).map((n) => n.props.children);
    expect(names).toEqual(["Legs", "Push"]);
  });
});

// Build 67: a finished run looked just like a lifting day. A glyph on its
// row and a dash on the week strip tell them apart, keeping the colours —
// green for done — that both share.
describe("a cardio session among workouts", () => {
  beforeEach(() => {
    mockCompleted = [
      workout("run", "Outdoor Run", { cardio: { kind: "run" }, startedAt: new Date(2026, 7, 4, 7), completedAt: new Date(2026, 7, 4, 7, 30) }),
      workout("push", "Push", { startedAt: new Date(2026, 7, 4, 9), completedAt: new Date(2026, 7, 4, 10) }),
    ];
  });

  it("wears its kind's glyph on its row; a workout wears none", async () => {
    await renderHome();
    expect(screen.getByText("Outdoor Run")).toBeTruthy();
    expect(screen.getByText("Push")).toBeTruthy();
    const icons = screen.getAllByTestId("session-icon");
    expect(icons).toHaveLength(1);
    expect(icons[0].props.name).toBe("footsteps");
  });

  it("is a dash on the week strip where a workout is a dot", async () => {
    await renderHome();
    expect(screen.getAllByTestId("week-dash")).toHaveLength(1);
    expect(screen.getAllByTestId("week-dot")).toHaveLength(1);
  });
});
