import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, StyleSheet } from "react-native";

import WorkoutsScreen from "../(tabs)/index";
import { FontScaleCap } from "@/constants/theme";
import { EXERCISES } from "@/lib/exercises";
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
  useRouter: () => ({ push: mockPush, navigate: mockPush, back: jest.fn(), replace: jest.fn() }),
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
// RN's own test default is 2, which every test here ran at before; the
// large-text tests set their own.
let mockFontScale = 2;
let mockWidth = 375;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 667, scale: 3, fontScale: mockFontScale }),
}));

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
  mockWidth = 375;
  mockActive = [];
  mockPlan = [null, null, null, null, null, null, null];
  mockFontScale = 2;
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

  it("wears its kind's icon on the week strip where a workout wears a barbell", async () => {
    await renderHome();
    const cardio = screen.getAllByTestId("week-cardio");
    const workouts = screen.getAllByTestId("week-workout");
    expect(cardio).toHaveLength(1);
    expect(cardio[0].props.name).toBe("footsteps");
    expect(workouts).toHaveLength(1);
    expect(workouts[0].props.name).toBe("barbell");
  });
});

// Three icons fit a day's cell. A fourth session would crowd it, and leaving
// it off would hide it, so the third slot counts what's left instead.
describe("a busy day on the week strip", () => {
  const session = (id: string, hour: number, extra: Partial<Workout> = {}) =>
    workout(id, id, { startedAt: new Date(2026, 7, 4, hour), completedAt: new Date(2026, 7, 4, hour, 30), ...extra });

  it("shows all three when there are three", async () => {
    mockCompleted = [session("a", 6, { cardio: { kind: "run" } }), session("b", 9), session("c", 18, { cardio: { kind: "swim" } })];
    await renderHome();
    expect(screen.getAllByTestId("week-cardio")).toHaveLength(2);
    expect(screen.getAllByTestId("week-workout")).toHaveLength(1);
    expect(screen.queryByText(/^\+\d$/)).toBeNull();
  });

  // Green, amber and purple each fell under 3:1 against some accent fill, so
  // the picked day draws its icons in its own text colour; the list under the
  // strip says which are done.
  it("draws the picked day's icons in its text colour, and other days' in their state's", async () => {
    mockCompleted = [
      session("today-run", 6, { cardio: { kind: "run" } }),
      workout("monday", "Monday", { startedAt: new Date(2026, 7, 3, 9), completedAt: new Date(2026, 7, 3, 10) }),
    ];
    await renderHome();
    const [todays] = screen.getAllByTestId("week-cardio");
    const [mondays] = screen.getAllByTestId("week-workout");
    expect(todays.props.color).toBe("#fff");
    // Done, in either mode's green.
    expect(["#34d399", "#046a4d"]).toContain(mondays.props.color);
  });

  it("draws the picked day's count and split ring in its text colour too", async () => {
    mockCompleted = [
      session("a", 6, { cardio: { kind: "run" } }),
      session("b", 9),
      session("c", 12, { cardio: { kind: "walk" } }),
      session("d", 18, { cardio: { kind: "swim" } }),
    ];
    await renderHome();
    expect(StyleSheet.flatten(screen.getByText("+2").props.style).color).toBe("#fff");
  });

  it("rings the picked day in its text colour when the split suggests a workout", async () => {
    mockTemplates = [workout("t1", "Pull", { isTemplate: true })];
    // Today, August 4 2026, is a Tuesday.
    mockPlan = [null, null, "t1", null, null, null, null];
    await renderHome();
    expect(StyleSheet.flatten(screen.getByTestId("week-suggestion").props.style).borderColor).toBe("#fff");
  });

  it("outlines a planned workout, so planned and going differ in shape, not just colour", async () => {
    mockPlanned = [workout("legs", "Legs", { scheduledFor: new Date(2026, 7, 6) })];
    await renderHome();
    expect(screen.getByTestId("week-workout").props.name).toBe("barbell-outline");
  });

  it("fits two marks to a day on a 320pt screen, counting the rest", async () => {
    mockWidth = 320;
    mockCompleted = [session("a", 6, { cardio: { kind: "run" } }), session("b", 9), session("c", 18, { cardio: { kind: "swim" } })];
    await renderHome();
    expect([...screen.queryAllByTestId("week-cardio"), ...screen.queryAllByTestId("week-workout")]).toHaveLength(1);
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("says each kind aloud, the way the icons show it", async () => {
    mockCompleted = [session("a", 6, { cardio: { kind: "run" } }), session("b", 9), session("c", 18, { cardio: { kind: "run" } })];
    await renderHome();
    expect(screen.getByLabelText(/^Tuesday, August 4/).props.accessibilityLabel).toBe(
      "Tuesday, August 4, today, 1 workout and 2 runs done"
    );
  });

  it("shows two and a count past three", async () => {
    mockCompleted = [
      session("a", 6, { cardio: { kind: "run" } }),
      session("b", 9),
      session("c", 12, { cardio: { kind: "walk" } }),
      session("d", 18, { cardio: { kind: "swim" } }),
    ];
    await renderHome();
    expect([...screen.queryAllByTestId("week-cardio"), ...screen.queryAllByTestId("week-workout")]).toHaveLength(2);
    expect(screen.getByText("+2")).toBeTruthy();
  });
});

// The Cardio category holds far more than runs: burpees, jump rope, sports,
// yoga. A conditioning circuit made of those is a workout like any other and
// keeps its counts; only a session, or a workout with a distance to show
// instead, drops them.
describe("a finished workout of Cardio-category exercises", () => {
  const exercise = (id: string, sets: { duration?: number; distance?: number; reps?: number }[]) => {
    const ex = EXERCISES.find((e) => e.id === id)!;
    return {
      id: `we-${id}`,
      exerciseId: id,
      exercise: ex,
      orderIndex: 0,
      sets: sets.map((s, i) => ({ id: `${id}-${i}`, weightUnit: "lbs" as const, isCompleted: true, ...s })),
    };
  };
  const finished = { startedAt: new Date(2026, 7, 4, 7), completedAt: new Date(2026, 7, 4, 7, 25), durationMinutes: 25 };

  it("keeps its exercise and set counts when it's a circuit", async () => {
    mockCompleted = [
      workout("circuit", "Conditioning", {
        ...finished,
        exercises: [exercise("burpees", [{ reps: 15 }, { reps: 15 }]), exercise("jump-rope", [{ duration: 60 }, { duration: 60 }])],
      }),
    ];
    await renderHome();
    expect(screen.getByText(/Today · 2 exercises · 4\/4 sets/)).toBeTruthy();
  });

  it("says how far instead when it covered ground", async () => {
    mockCompleted = [
      workout("tread", "Treadmill", { ...finished, exercises: [exercise("treadmill", [{ duration: 1500, distance: 5000 }])] }),
    ];
    await renderHome();
    expect(screen.queryByText(/sets/)).toBeNull();
    expect(screen.getByText(/Today · 25m/)).toBeTruthy();
  });
});

// The strip shows a narrow weekday and a date, and says what's on a day only
// in colour and dots; VoiceOver got "T, 4" and nothing else, and the arrows
// beside it read as nothing at all.
describe("the week strip, read aloud", () => {
  it("names the arrows", async () => {
    await renderHome();
    expect(screen.getByRole("button", { name: "Previous week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next week" })).toBeTruthy();
  });

  it("reads each day in full, with what's on it and whether it's picked", async () => {
    mockCompleted = [workout("push", "Push", { startedAt: new Date(2026, 7, 4, 9), completedAt: new Date(2026, 7, 4, 10) })];
    mockPlanned = [workout("legs", "Legs", { scheduledFor: new Date(2026, 7, 6) })];
    await renderHome();

    const today = screen.getByLabelText(/^Tuesday, August 4, today/);
    expect(today.props.accessibilityLabel).toBe("Tuesday, August 4, today, 1 workout done");
    expect(today.props.accessibilityState).toEqual({ selected: true });

    const thursday = screen.getByLabelText(/^Thursday, August 6/);
    expect(thursday.props.accessibilityLabel).toBe("Thursday, August 6, 1 workout planned");
    expect(thursday.props.accessibilityState).toEqual({ selected: false });
  });

  it("names the weekly split's pick for an empty day", async () => {
    mockTemplates = [workout("t1", "Pull", { isTemplate: true })];
    mockPlan = [null, null, null, "t1", null, null, null];
    await renderHome();
    expect(screen.getByLabelText("Wednesday, August 5, Pull from your weekly split")).toBeTruthy();
  });

  it("gives the template sheet's backdrop a name, as its one way out", async () => {
    mockTemplates = [workout("t1", "Pull", { isTemplate: true })];
    await renderHome();
    fireEvent.press(screen.getByTestId("split-toggle"));
    fireEvent.press(screen.getByText("Wednesday"));
    // Seven "Rest" rows in the split, and the sheet's own Rest option.
    expect(screen.getAllByText("Rest")).toHaveLength(8);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(screen.getAllByText("Rest")).toHaveLength(7);
  });
});

describe("at larger text sizes", () => {
  it("widens the split's weekday column with the text, up to where the text stops", async () => {
    // XXL, where a fixed 88pt broke "Wednesday" in two.
    mockFontScale = 1.235;
    await renderHome();
    fireEvent.press(screen.getByTestId("split-toggle"));

    const wednesday = screen.getByText("Wednesday");
    expect(StyleSheet.flatten(wednesday.props.style).width).toBeCloseTo(88 * 1.235);
    expect(wednesday.props.maxFontSizeMultiplier).toBe(FontScaleCap.grid);
  });

  it("stops widening it at the grid cap, with the text", async () => {
    mockFontScale = 3.1;
    await renderHome();
    fireEvent.press(screen.getByTestId("split-toggle"));

    expect(StyleSheet.flatten(screen.getByText("Wednesday").props.style).width).toBeCloseTo(88 * FontScaleCap.grid);
  });

  // The weekly split's suggestion for an empty today: beside its badge and
  // "Start" the name split mid-word at accessibility sizes.
  describe("the weekly split's suggestion", () => {
    // The name shows in Templates too; the suggestion's is in the dashed row.
    const suggestionRow = () => {
      for (const text of screen.getAllByText("Hypertrophy")) {
        let node = text.parent;
        while (node && StyleSheet.flatten(node.props.style)?.borderStyle !== "dashed") node = node.parent;
        if (node) return StyleSheet.flatten(node.props.style);
      }
      throw new Error("no suggestion row");
    };

    beforeEach(() => {
      mockTemplates = [workout("t1", "Hypertrophy", { isTemplate: true })];
      // Tuesday, today.
      mockPlan = [null, null, "t1", null, null, null, null];
    });

    it("stacks past the largest standard size, giving the name the row's width", async () => {
      mockFontScale = 2.35;
      await renderHome();
      expect(suggestionRow().flexDirection).toBe("column");
      // Its own "Start" among the templates' — none of them grows without a cap.
      for (const start of screen.getAllByText("Start")) expect(start.props.maxFontSizeMultiplier).toBeDefined();
    });

    it("stays one row at standard sizes", async () => {
      mockFontScale = 1;
      await renderHome();
      expect(suggestionRow().flexDirection).toBe("row");
    });
  });

  it("caps a template's name beside its button, as a workout's row does", async () => {
    mockTemplates = [workout("t1", "Hypertrophy", { isTemplate: true })];
    await renderHome();
    expect(screen.getByText("Hypertrophy").props.maxFontSizeMultiplier).toBe(FontScaleCap.heading);
  });
});

// The workout and cardio screens said when a delete failed; long-pressing a
// row on Home dropped the failure without a word.
describe("deleting from Home", () => {
  it("says when a workout couldn't be deleted", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { deleteWorkout } = jest.requireMock("@/lib/data");
    deleteWorkout.mockRejectedValueOnce(new Error("disk unavailable"));
    mockCompleted = [workout("a", "Push", { completedAt: NOW })];
    await renderHome();

    fireEvent(screen.getByText("Push"), "longPress");
    const [, , buttons] = alert.mock.calls.find(([title]) => title === "Delete workout?")!;
    await act(async () => {
      buttons!.find((b) => b.text === "Delete")!.onPress!();
    });

    expect(deleteWorkout).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    expect(alert).toHaveBeenCalledWith("Couldn't delete", "Something went wrong. Try again.");
    alert.mockRestore();
  });
});
