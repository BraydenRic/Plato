import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

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

jest.mock("@/context/RestTimerContext", () => ({
  useRestTimer: () => ({ restSeconds: 0, rest: null, startRest: jest.fn(), stopRest: jest.fn() }),
}));

jest.mock("@/context/SetTimerContext", () => ({
  useSetTimer: () => ({ timing: null, startTimer: jest.fn(), clearTimer: jest.fn() }),
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
jest.mock("react-native-draggable-flatlist", () => ({
  __esModule: true,
  default: () => null,
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
  // The re-read is a *server* read, so it can only ever describe the workout as
  // it was before an edit that hasn't been acked yet. It resolves here after the
  // delete, which is the race a user hits by deleting straight after reopening
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
});
