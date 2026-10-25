import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, TextInput } from "react-native";

import WorkoutScreen from "../workout/[id]";
import type { Workout } from "@/types";

/**
 * Edits made on the workout screen have to show up on the workout screen.
 *
 * That reads as too obvious to test, and it is exactly what kept breaking. The
 * screen used to write to the store and then wait for its own subscription to
 * echo the change back before rendering it. On a freshly created workout the
 * echo didn't arrive: adding an exercise showed nothing and deleting one left
 * it on screen, both of them fixed by leaving the workout and coming back —
 * the signature of a stale copy. Three attempts to repair the echo shipped
 * without a reproduction, because nothing here was covered.
 *
 * So these tests deliberately give the screen *no* echo at all. The
 * subscription is mocked to deliver the workout once and then go quiet, which
 * is the broken case; the screen has to update from its own state regardless.
 */

const mockUpdateWorkout = jest.fn(async () => {});
let mockGetWorkout = jest.fn(async (): Promise<Workout | null> => null);
let emitWorkout: ((w: Workout | null) => void) | null = null;
let mockBodyweightLog: { date: Date; lbs: number }[] = [];

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "w1" }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  // The real one re-runs on every navigation focus; here the screen is only
  // ever mounted, so a plain mount effect is the same thing.
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual("react");
    useEffect(cb, [cb]);
  },
}));

jest.mock("@/lib/data", () => ({
  subscribeWorkout: (_id: string, onChange: (w: Workout | null) => void) => {
    emitWorkout = onChange;
    return () => {
      emitWorkout = null;
    };
  },
  getWorkout: (...args: unknown[]) => mockGetWorkout(...(args as [])),
  updateWorkout: (...args: unknown[]) => mockUpdateWorkout(...(args as [])),
  getCompletedWorkouts: jest.fn(async () => []),
  reopenWorkout: jest.fn(async () => {}),
  saveAsTemplate: jest.fn(async () => {}),
  deleteWorkout: jest.fn(async () => {}),
  upsertUserStats: jest.fn(async () => {}),
  computeStats: jest.fn(() => ({})),
  stripUndefined: (v: unknown) => v,
}));

jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: () => ({ completed: [], templates: [], active: [] }),
}));

jest.mock("@/hooks/use-bodyweight", () => ({
  useBodyweight: () => ({
    log: mockBodyweightLog,
    loading: false,
    record: jest.fn(),
    latest: mockBodyweightLog[mockBodyweightLog.length - 1] ?? null,
  }),
}));

let mockRestSeconds = 0;
const mockStartRest = jest.fn();
jest.mock("@/context/RestTimerContext", () => ({
  useRestTimer: () => ({ restSeconds: mockRestSeconds, rest: null, startRest: mockStartRest, stopRest: jest.fn() }),
}));

let mockTimer: { workoutId: string; exerciseId: string; setId: string; startedAt: number } | null = null;
jest.mock("@/context/SetTimerContext", () => ({
  useSetTimer: () => ({ timer: mockTimer, startTimer: jest.fn(), clearTimer: jest.fn() }),
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

// Native-only leaves. The screen's behaviour under test is which exercises it
// renders, which none of these participate in.
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => "ReanimatedSwipeable");
// Renders its rows rather than nothing, so the template editor's cards are
// drawn too — a stand-in that rendered null is how a template showing "BW not
// set" whatever the log held went unnoticed by every test here.
// Keeps the props it was last given, so tests can read the spring the list was
// handed and play a drop through its onDragEnd.
let mockDragListProps: Record<string, any> = {};
const mockMarkCurrent = jest.fn();
jest.mock("@/lib/current-workout", () => ({
  markCurrentWorkout: (id: string) => mockMarkCurrent(id),
}));
jest.mock("react-native-draggable-flatlist", () => ({
  __esModule: true,
  default: (props: {
    data: unknown[];
    renderItem: (info: { item: unknown; drag: () => void; isActive: boolean }) => React.ReactNode;
  }) => {
    mockDragListProps = props;
    return props.data.map((item) => props.renderItem({ item, drag: () => {}, isActive: false }));
  },
  ScaleDecorator: ({ children }: { children: React.ReactNode }) => children,
}));

function workoutWith(names: string[]): Workout {
  return {
    id: "w1",
    userId: "u1",
    name: "Push day",
    isTemplate: false,
    exercises: names.map((name, i) => ({
      id: `ex${i}`,
      exerciseId: `lib${i}`,
      exercise: {
        id: `lib${i}`,
        name,
        category: "Chest",
        musclesWorked: ["chest"],
        description: "",
      },
      orderIndex: i,
      sets: [{ id: `s${i}`, weightUnit: "lbs" as const, isCompleted: false }],
    })),
    createdAt: new Date("2026-08-01T10:00:00Z"),
    startedAt: new Date("2026-08-01T10:00:00Z"),
  };
}

/** Deliver the workout the way the subscription would on first load. */
async function loadWorkout(w: Workout) {
  render(<WorkoutScreen />);
  await act(async () => {
    emitWorkout?.(w);
  });
}

async function loadWith(names: string[]) {
  await loadWorkout(workoutWith(names));
}

/** Confirm the next Alert by pressing its destructive button. */
function confirmAlerts() {
  return jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.style === "destructive")?.onPress?.();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  emitWorkout = null;
  mockGetWorkout = jest.fn(async () => null);
  mockBodyweightLog = [];
  mockRestSeconds = 0;
  mockTimer = null;
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("takes a removed exercise off the screen without waiting for an echo", async () => {
  const alertSpy = confirmAlerts();
  await loadWith(["Bench press", "Incline press"]);

  expect(screen.getByText("Bench press")).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getAllByTestId("remove-exercise")[0]);
  });

  expect(alertSpy).toHaveBeenCalled();
  expect(screen.queryByText("Bench press")).toBeNull();
  expect(screen.getByText("Incline press")).toBeTruthy();
  // ...and the removal was actually written, not just hidden.
  expect(mockUpdateWorkout).toHaveBeenCalledWith("w1", {
    exercises: [
      expect.objectContaining({
        exercise: expect.objectContaining({ name: "Incline press" }),
      }),
    ],
  });
});

it("shows an added set immediately", async () => {
  await loadWith(["Bench press"]);

  expect(screen.getByText(/0\/1 sets/)).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getByText("+ Add set"));
  });

  expect(screen.getByText(/0\/2 sets/)).toBeTruthy();
});

it("doesn't let a focus re-read undo an edit made while it was in flight", async () => {
  // The re-read can start before an edit and land after it, carrying the
  // workout as it was. It resolves here after the delete, which is the race a user hits by deleting straight after reopening
  // the screen — the exercise reappearing a second after they removed it.
  let resolveRead: (w: Workout) => void = () => {};
  mockGetWorkout = jest.fn(
    () => new Promise<Workout | null>((res) => { resolveRead = res as (w: Workout) => void; })
  );
  confirmAlerts();

  await loadWith(["Bench press", "Incline press"]);

  await act(async () => {
    fireEvent.press(screen.getAllByTestId("remove-exercise")[0]);
  });
  expect(screen.queryByText("Bench press")).toBeNull();

  await act(async () => {
    resolveRead(workoutWith(["Bench press", "Incline press"]));
  });

  await waitFor(() => expect(mockGetWorkout).toHaveBeenCalled());
  expect(screen.queryByText("Bench press")).toBeNull();
});

/**
 * A bodyweight set is worth what you weighed on the day of the workout, which
 * is not always the day you typed it in.
 *
 * Backfilling is the case that broke: a workout planned or logged for an
 * earlier day has no startedAt and no completedAt, so resolving the date by
 * completedAt → startedAt → createdAt fell through to today and valued
 * yesterday's pull ups at this morning's weigh-in. It shows in the exercise
 * header, and finishing freezes totalVolume from the same number.
 */
describe("what a bodyweight set is valued against", () => {
  const YESTERDAY = new Date(2026, 7, 3, 9, 0);
  const TODAY = new Date(2026, 7, 4, 9, 0);

  function pullUpsOn(day: { scheduledFor?: Date; startedAt?: Date }): Workout {
    return {
      id: "w1",
      userId: "u1",
      name: "Pull day",
      isTemplate: false,
      exercises: [
        {
          id: "ex0",
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
          sets: [{ id: "s0", weightUnit: "lbs" as const, isCompleted: false }],
        },
      ],
      createdAt: TODAY,
      ...day,
    };
  }

  beforeEach(() => {
    mockBodyweightLog = [
      { date: YESTERDAY, lbs: 195 },
      { date: TODAY, lbs: 190 },
    ];
  });

  it("uses the weigh-in from the day being logged, not the day it was typed", async () => {
    // Written up this morning, but it belongs to yesterday.
    await loadWorkout(pullUpsOn({ scheduledFor: YESTERDAY }));

    expect(screen.getByText(/BW 195 lbs/)).toBeTruthy();
  });

  it("uses today's weigh-in for a workout happening today", async () => {
    await loadWorkout(pullUpsOn({ startedAt: TODAY }));

    expect(screen.getByText(/BW 190 lbs/)).toBeTruthy();
  });

  describe("in a template", () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
      jest.setSystemTime(TODAY);
    });
    afterEach(() => jest.useRealTimers());

    it("shows the weight rather than saying none is set", async () => {
      await loadWorkout({ ...pullUpsOn({}), isTemplate: true });

      expect(screen.queryByText(/BW not set/)).toBeNull();
      expect(screen.getByText(/BW 190 lbs/)).toBeTruthy();
    });

    it("uses the latest weigh-in, not the one nearest the day it was made", async () => {
      // Made yesterday. It stands for the session you'd start now.
      await loadWorkout({ ...pullUpsOn({}), isTemplate: true, createdAt: YESTERDAY });

      expect(screen.getByText(/BW 190 lbs/)).toBeTruthy();
    });
  });
});

describe("renaming a workout", () => {
  const titleField = () => screen.getByDisplayValue("Push day");

  it("saves the new name", async () => {
    await loadWith(["Bench Press"]);

    fireEvent(titleField(), "endEditing", { nativeEvent: { text: "Chest day" } });

    expect(mockUpdateWorkout).toHaveBeenCalledWith("w1", { name: "Chest day" });
  });

  it("falls back to a name rather than saving a blank one", async () => {
    await loadWith(["Bench Press"]);

    fireEvent(titleField(), "endEditing", { nativeEvent: { text: "   " } });

    expect(mockUpdateWorkout).toHaveBeenCalledWith("w1", { name: "Workout" });
  });

  it("says so when the rename fails to save", async () => {
    // The bug: this write's promise was dropped. A failure left the name you
    // typed on screen — it is already in local state — with the old one
    // returning on the next load, far too late to connect the two.
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockUpdateWorkout.mockRejectedValueOnce(new Error("offline") as never);
    await loadWith(["Bench Press"]);

    await act(async () => {
      fireEvent(titleField(), "endEditing", { nativeEvent: { text: "Chest day" } });
    });

    expect(alert).toHaveBeenCalledWith(
      "Couldn't rename",
      expect.stringContaining("connection")
    );
  });
});

/**
 * Next and Back "sometimes jump a place or two". Every set input records itself
 * on press-in, so the keypad bar can open before the keyboard — but a scroll
 * that starts with a finger on another set's box presses it without focusing
 * it. Counting from the last press then sent Next on from the box scrolled
 * over, not from the one being typed in.
 */
describe("the keypad's Back and Next", () => {
  // Three exercises of one set each: weight, reps, weight, reps, weight, reps.
  const names = ["Bench Press", "Barbell Row", "Curl"];
  let focused: unknown = null;
  let registry: jest.SpyInstance;

  // The set inputs in reading order — the first TextInput is the title.
  const setInputs = () => screen.UNSAFE_getAllByType(TextInput).slice(1);
  const proto = TextInput.prototype as unknown as { focus: jest.Mock; isFocused: jest.Mock };

  beforeEach(() => {
    focused = null;
    proto.focus.mockClear();
    // Mirrors React Native's focus registry: whichever input was last really
    // focused, by a tap or by focus(), is the one that answers true.
    proto.isFocused.mockImplementation(function (this: unknown) {
      return this === focused;
    });
    proto.focus.mockImplementation(function (this: unknown) {
      focused = this;
    });
    registry = jest
      .spyOn(TextInput.State, "currentlyFocusedInput")
      // The registry only needs to be non-empty while something is focused.
      .mockImplementation((() => (focused ? {} : null)) as never);
  });

  afterEach(() => {
    proto.isFocused.mockReset();
    proto.focus.mockReset();
    registry.mockRestore();
  });

  /** Tap into an input the way a finger does: press, then focus. */
  function tapInto(index: number) {
    const input = setInputs()[index];
    fireEvent(input, "pressIn");
    focused = input.instance;
    fireEvent(input, "focus");
  }

  // Which set input, by position, focus() was last called on. A position
  // rather than the instance itself: a failing toBe on two component instances
  // makes Jest try to print them, and they're circular enough to exhaust memory.
  const lastFocused = () => {
    const target = proto.focus.mock.contexts.at(-1);
    return setInputs().findIndex((input) => input.instance === target);
  };

  it("moves on from the field being typed in, not one a scroll started on", async () => {
    await loadWith(names);
    tapInto(1); // first set's reps

    // A scroll that begins with a finger on the third set's weight.
    fireEvent(setInputs()[4], "pressIn");
    fireEvent.press(screen.getByText("Next"));

    // Second set's weight — the field after reps 1, not after weight 3.
    expect(lastFocused()).toBe(2);
  });

  it("steps back from the field being typed in, too", async () => {
    await loadWith(names);
    tapInto(3); // second set's reps

    fireEvent(setInputs()[0], "pressIn");
    fireEvent.press(screen.getByText("Back"));

    expect(lastFocused()).toBe(2);
  });

  it("counts two quick taps on Next as two steps", async () => {
    await loadWith(names);
    tapInto(0);

    // No focus events in between: the second tap arrives before the first
    // field's onFocus would have.
    fireEvent.press(screen.getByText("Next"));
    fireEvent.press(screen.getByText("Next"));

    expect(lastFocused()).toBe(2);
  });
});

/**
 * Reordering a template left the screen unresponsive for a beat after every
 * drop. The drag list locks itself until the drop's spring finishes, and its
 * default spring was tuned for Reanimated 2/3's "within 0.2px" stopping rule;
 * Reanimated 4 ignores that and waits for the energy to reach 6e-9 of its
 * start, which that overdamped spring took ~1.8s to do.
 */
describe("reordering a template", () => {
  const template = () => ({ ...workoutWith(["Bench Press", "Barbell Row", "Curl"]), isTemplate: true });

  it("settles drops with a spring Reanimated 4 lets finish promptly", async () => {
    await loadWorkout(template());

    const spring = mockDragListProps.animationConfig;
    // A stopping point it can reach, rather than Reanimated 4's 6e-9 default.
    expect(spring.energyThreshold).toBeGreaterThanOrEqual(1e-5);
    // Near-critical damping: no overshoot, and none of the overdamped crawl.
    const zeta = spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass));
    expect(zeta).toBeGreaterThanOrEqual(1);
    expect(zeta).toBeLessThan(1.2);
  });

  it("saves the new order, touching only the cards that moved", async () => {
    await loadWorkout(template());
    const [bench, row, curl] = mockDragListProps.data;

    await act(async () => {
      mockDragListProps.onDragEnd({ from: 2, to: 1, data: [bench, curl, row] });
    });

    const lastCall = mockUpdateWorkout.mock.calls.at(-1) as unknown as [string, { exercises: any[] }];
    const saved = lastCall[1].exercises;
    expect(saved.map((ex: { exercise: { name: string } }) => ex.exercise.name)).toEqual([
      "Bench Press",
      "Curl",
      "Barbell Row",
    ]);
    expect(saved.map((ex: { orderIndex: number }) => ex.orderIndex)).toEqual([0, 1, 2]);
    // Bench never moved, so it is the same object and its card needn't redraw.
    expect(saved[0]).toBe(bench);
  });
});

/**
 * A workout already under way couldn't be reordered at all — only templates
 * had the drag list. Reorder mode collapses the cards to one row each.
 */
describe("reordering a workout in progress", () => {
  /** Opens the ⋯ menu and presses the named option. */
  function pressMenuOption(label: string) {
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === label)?.onPress?.();
    });
    fireEvent.press(screen.getByTestId("workout-menu"));
    return alert;
  }

  it("offers reordering from the menu once there are two exercises", async () => {
    await loadWith(["Bench Press", "Barbell Row"]);
    let offered: string[] = [];
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      offered = (buttons ?? []).map((b) => b.text ?? "");
    });

    fireEvent.press(screen.getByTestId("workout-menu"));

    expect(offered).toContain("Reorder exercises");
  });

  it("doesn't offer it with only one exercise", async () => {
    let offered: string[] = [];
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      offered = (buttons ?? []).map((b) => b.text ?? "");
    });

    await loadWith(["Bench Press"]);
    fireEvent.press(screen.getByTestId("workout-menu"));
    expect(offered).not.toContain("Reorder exercises");
  });

  it("doesn't offer it once the workout is finished", async () => {
    let offered: string[] = [];
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      offered = (buttons ?? []).map((b) => b.text ?? "");
    });
    await loadWorkout({ ...workoutWith(["Bench Press", "Barbell Row"]), completedAt: new Date() });

    fireEvent.press(screen.getByTestId("workout-menu"));

    expect(offered).not.toContain("Reorder exercises");
  });

  it("saves the new order with the logged sets travelling with their exercise", async () => {
    const w = workoutWith(["Bench Press", "Barbell Row", "Curl"]);
    w.exercises[2].sets = [{ id: "done", weightUnit: "lbs", weight: 30, reps: 12, isCompleted: true }];
    await loadWorkout(w);
    pressMenuOption("Reorder exercises");
    // One grip per exercise. (The list's header isn't drawn by the stand-in.)
    expect(screen.getAllByTestId("reorder-handle")).toHaveLength(3);
    const [bench, row, curl] = mockDragListProps.data;

    await act(async () => {
      mockDragListProps.onDragEnd({ from: 2, to: 0, data: [curl, bench, row] });
    });

    const saved = (mockUpdateWorkout.mock.calls.at(-1) as unknown as [string, { exercises: any[] }])[1].exercises;
    expect(saved.map((ex: { exercise: { name: string } }) => ex.exercise.name)).toEqual(["Curl", "Bench Press", "Barbell Row"]);
    expect(saved.map((ex: { orderIndex: number }) => ex.orderIndex)).toEqual([0, 1, 2]);
    expect(saved[0].sets).toEqual(curl.sets);
  });

  it("swaps Finish for Done while reordering, and Done brings the sets back", async () => {
    await loadWith(["Bench Press", "Barbell Row"]);
    pressMenuOption("Reorder exercises");

    expect(screen.queryByText("Finish workout")).toBeNull();
    fireEvent.press(screen.getByText("Done"));

    expect(screen.getByText("Finish workout")).toBeTruthy();
    expect(screen.queryAllByTestId("reorder-handle")).toHaveLength(0);
  });
});

describe("which live workout the bar leads with", () => {
  it("becomes the workout you open, if it's live", async () => {
    await loadWith(["Bench Press"]);
    expect(mockMarkCurrent).toHaveBeenCalledWith("w1");
  });

  it("isn't changed by opening a finished workout or a template", async () => {
    await loadWorkout({ ...workoutWith(["Bench Press"]), completedAt: new Date() });
    await loadWorkout({ ...workoutWith(["Bench Press"]), isTemplate: true, startedAt: undefined });
    expect(mockMarkCurrent).not.toHaveBeenCalled();
  });
});

describe("cardio", () => {
  const MILE = 1609.344;
  const runningExercise = {
    id: "running",
    name: "Running",
    category: "Cardio",
    musclesWorked: ["Legs"],
    description: "",
  };

  function runWorkout(sets: Workout["exercises"][number]["sets"], overrides: Partial<Workout> = {}): Workout {
    return {
      id: "w1",
      userId: "u1",
      name: "Morning run",
      isTemplate: false,
      exercises: [{ id: "ex0", exerciseId: "running", exercise: runningExercise, orderIndex: 0, sets }],
      createdAt: new Date("2026-10-20T07:00:00Z"),
      startedAt: new Date("2026-10-20T07:00:00Z"),
      ...overrides,
    };
  }

  const savedSets = () =>
    (mockUpdateWorkout.mock.calls.at(-1) as unknown as [string, { exercises: Workout["exercises"] }])[1].exercises[0]
      .sets;

  it("takes a distance beside the time, in the unit setting's miles", async () => {
    await loadWorkout(runWorkout([{ id: "s1", weightUnit: "lbs", isCompleted: false }]));
    expect(screen.getByText("MILES")).toBeTruthy();

    const distance = screen.getByLabelText("Distance, miles");
    await act(async () => {
      fireEvent.changeText(distance, "3.1");
    });
    await act(async () => {
      fireEvent(distance, "endEditing");
    });

    // Stored in metres, and a distance alone is enough to count the set done.
    const [set] = savedSets();
    expect(set.distance).toBeCloseTo(3.1 * MILE);
    expect(set.isCompleted).toBe(true);
  });

  it("keeps the set done when its time is cleared but its distance stays", async () => {
    await loadWorkout(runWorkout([{ id: "s1", weightUnit: "lbs", isCompleted: true, duration: 1500, distance: 5000 }]));
    const time = screen.getByDisplayValue("25:00");
    await act(async () => {
      fireEvent.changeText(time, "");
    });
    await act(async () => {
      fireEvent(time, "endEditing");
    });
    const [set] = savedSets();
    expect(set.duration).toBeUndefined();
    expect(set.isCompleted).toBe(true);
  });

  // Typed before or during the run, a distance would otherwise start the
  // rest countdown while still running.
  it("doesn't start the rest timer for a distance typed in", async () => {
    mockRestSeconds = 90;
    await loadWorkout(runWorkout([{ id: "s1", weightUnit: "lbs", isCompleted: false }]));
    const distance = screen.getByLabelText("Distance, miles");
    await act(async () => {
      fireEvent.changeText(distance, "3.1");
    });
    await act(async () => {
      fireEvent(distance, "endEditing");
    });
    expect(savedSets()[0].isCompleted).toBe(true);
    expect(mockStartRest).not.toHaveBeenCalled();
  });

  it("starts the rest timer when the stopwatch stops, even on a set a distance already finished", async () => {
    mockRestSeconds = 90;
    mockTimer = { workoutId: "w1", exerciseId: "ex0", setId: "s1", startedAt: Date.now() - 600_000 };
    await loadWorkout(runWorkout([{ id: "s1", weightUnit: "lbs", isCompleted: true, distance: 1609 }]));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Stop timer"));
    });
    expect(savedSets()[0]).toMatchObject({ duration: 600, distance: 1609, isCompleted: true });
    expect(mockStartRest).toHaveBeenCalledWith("w1");
  });

  it("shows the pace under each set when there's more than one", async () => {
    await loadWorkout(
      runWorkout([
        { id: "s1", weightUnit: "lbs", isCompleted: true, duration: 1500, distance: 5000 },
        { id: "s2", weightUnit: "lbs", isCompleted: true, duration: 600, distance: 1609.344 },
      ])
    );
    expect(screen.getByText("8:03 /mi")).toBeTruthy();
    expect(screen.getByText("10:00 /mi")).toBeTruthy();
  });

  // One run, one pace: it's in the headline, and only there.
  it("doesn't repeat the headline's pace under a single set", async () => {
    await loadWorkout(runWorkout([{ id: "s1", weightUnit: "lbs", isCompleted: true, duration: 1500, distance: 5000 }]));
    expect(screen.getAllByText("8:03 /mi")).toHaveLength(1);
  });

  it("reads as distance and time at the top, not pounds and sets", async () => {
    await loadWorkout(runWorkout([{ id: "s1", weightUnit: "lbs", isCompleted: true, duration: 1500, distance: 5000 }]));
    expect(screen.getByText("3.11 mi")).toBeTruthy();
    expect(screen.queryByText(/lbs$/)).toBeNull();
    expect(screen.queryByText("1/1 sets")).toBeNull();
  });

  it("shows what the watch measured on a set that came from Apple Health", async () => {
    await loadWorkout(
      runWorkout(
        [
          {
            id: "s1",
            weightUnit: "lbs",
            isCompleted: true,
            duration: 1530,
            distance: 3.2 * MILE,
            tracked: { healthId: "H-1", avgHeartRate: 152, maxHeartRate: 171, activeCalories: 312, splitsMi: [490, 470, 480] },
          },
        ],
        { completedAt: new Date("2026-10-20T07:26:00Z") }
      )
    );
    expect(screen.getByText(/from Apple Health/)).toBeTruthy();
    expect(screen.getByLabelText("Avg · max 171: 152 bpm")).toBeTruthy();
    expect(screen.getByLabelText("Active: 312 cal")).toBeTruthy();
    expect(screen.getByText("Splits · per mile")).toBeTruthy();
    // The splits' average, against which each bar is read.
    expect(screen.getByText("avg 7:58 /mi")).toBeTruthy();
    // Three whole miles, then the 0.20 past them: 1530 - 1440 = 90 s.
    expect(screen.getByLabelText("Mile 2, 7:50")).toBeTruthy();
    expect(screen.getByLabelText("Last 0.20 mi, 1:30")).toBeTruthy();
  });
});
