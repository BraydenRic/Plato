import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import { CardioSession } from "../cardio-session";
import { EXERCISES } from "@/lib/exercises";
import { resetWatchTrace, setWatchStart } from "@/lib/watch-trace";
import type { Workout, WorkoutSet } from "@/types";

/**
 * The session screen: a clock with Pause and End while it runs, the run
 * itself once it's done. What matters most is that ending saves what was
 * done — the moving time, and the distance only if one was given.
 */

const mockBack = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }) }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@/context/UnitContext", () => ({ useWeightUnit: () => ({ unit: "lbs" }) }));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ accent: "#8b5cf6", accentSoft: "rgba(0,0,0,0.1)", accentText: "#c4b5fd", onAccent: "#fff" }),
}));

const mockUpdate = jest.fn(async (_id: string, _patch: Partial<Workout>) => {});
const mockDelete = jest.fn(async (_w: Workout) => {});
const mockUpsertStats = jest.fn(async (_s: unknown) => {});
jest.mock("@/lib/data", () => ({
  updateWorkout: (id: string, patch: Partial<Workout>) => mockUpdate(id, patch),
  deleteWorkout: (w: Workout) => mockDelete(w),
  getCompletedWorkouts: jest.fn(async () => []),
  upsertUserStats: (s: unknown) => mockUpsertStats(s),
  computeStats: () => ({ totalCompletedWorkouts: 1 }),
  stripUndefined: (v: unknown) => v,
}));

let mockLive: unknown = null;
jest.mock("@/lib/watch-live", () => {
  const actual = jest.requireActual("@/lib/watch-live");
  return { ...actual, useWatchLive: () => mockLive };
});

const T0 = Date.UTC(2026, 9, 25, 7, 0, 0);
const MILE = 1609.344;

function session(kind: "run" | "stairs", overrides: Partial<Workout> = {}, set: Partial<WorkoutSet> = {}): Workout {
  const exerciseId = kind === "run" ? "running" : "stairmaster";
  return {
    id: "s1",
    userId: "u1",
    name: kind === "run" ? "Outdoor Run" : "Stair Stepper",
    isTemplate: false,
    createdAt: new Date(T0),
    startedAt: new Date(T0),
    cardio: { kind, indoor: kind === "stairs" },
    exercises: [
      {
        id: "e1",
        exerciseId,
        exercise: EXERCISES.find((e) => e.id === exerciseId)!,
        orderIndex: 0,
        sets: [{ id: "set1", weightUnit: "lbs", isCompleted: false, ...set }],
      },
    ],
    ...overrides,
  };
}

const lastPatch = () => mockUpdate.mock.calls.at(-1)![1];

beforeEach(() => {
  mockLive = null;
  resetWatchTrace();
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(T0 + 65_000);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function show(workout: Workout) {
  const onLocalChange = jest.fn();
  render(<CardioSession workout={workout} onLocalChange={onLocalChange} />);
  return onLocalChange;
}

it("shows the moving time while it runs", () => {
  show(session("run"));
  expect(screen.getByText("1:05")).toBeTruthy();
  expect(screen.getByText("Moving time")).toBeTruthy();
});

it("pauses, keeping when the pause began", async () => {
  show(session("run"));
  await act(async () => {
    fireEvent.press(screen.getByLabelText("Pause"));
  });
  expect(lastPatch().cardio).toEqual({ kind: "run", indoor: false, pausedAtMs: T0 + 65_000 });
});

it("reads as paused, with the pause left out of the clock", () => {
  show(session("run", { cardio: { kind: "run", pausedAtMs: T0 + 30_000 } }));
  expect(screen.getByText("0:30")).toBeTruthy();
  expect(screen.getByText("Paused")).toBeTruthy();
  expect(screen.getByLabelText("Resume")).toBeTruthy();
});

it("asks how far on End, then saves the time and distance", async () => {
  show(session("run"));
  await act(async () => {
    fireEvent.press(screen.getByLabelText("End"));
  });
  expect(screen.getByText("How far did you go?")).toBeTruthy();
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText("Distance in miles"), "3.1");
  });
  await act(async () => {
    fireEvent.press(screen.getByText("Save outdoor run"));
  });
  const patch = lastPatch();
  expect(patch.completedAt).toEqual(new Date(T0 + 65_000));
  expect(patch.exercises![0].sets[0]).toMatchObject({ duration: 65, isCompleted: true });
  expect(patch.exercises![0].sets[0].distance).toBeCloseTo(3.1 * MILE);
  // The streak and plato-web's totals count it, as finishing any workout does.
  expect(mockUpsertStats).toHaveBeenCalledWith({ userId: "u1", totalCompletedWorkouts: 1 });
});

it("saves without a distance when it's skipped", async () => {
  show(session("run"));
  await act(async () => {
    fireEvent.press(screen.getByLabelText("End"));
  });
  await act(async () => {
    fireEvent.press(screen.getByText("Skip"));
  });
  const set = lastPatch().exercises![0].sets[0];
  expect(set.isCompleted).toBe(true);
  expect(set.distance).toBeUndefined();
});

it("doesn't ask how far on a stair stepper", async () => {
  show(session("stairs"));
  await act(async () => {
    fireEvent.press(screen.getByLabelText("End"));
  });
  expect(screen.queryByText("How far did you go?")).toBeNull();
  expect(lastPatch().completedAt).toEqual(new Date(T0 + 65_000));
});

it("shows a finished run's distance, pace, and what the watch measured", () => {
  show(
    session(
      "run",
      { completedAt: new Date(T0 + 1530_000) },
      {
        isCompleted: true,
        duration: 1530,
        distance: 3.2 * MILE,
        tracked: { healthId: "H", avgHeartRate: 152, maxHeartRate: 171, activeCalories: 312, splitsMi: [490, 470, 480] },
      }
    )
  );
  expect(screen.getByText("Completed")).toBeTruthy();
  expect(screen.getByText(/^3\.20/)).toBeTruthy();
  expect(screen.getByText("25:30")).toBeTruthy();
  expect(screen.getByLabelText("Avg · max 171: 152 bpm")).toBeTruthy();
  expect(screen.getByText("Splits · per mile")).toBeTruthy();
  expect(screen.getByLabelText("Mile 2, 7:50")).toBeTruthy();
});

it("deletes a finished run from the menu, after a confirmation", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.style === "destructive")?.onPress?.();
  });
  show(session("run", { completedAt: new Date(T0 + 1500_000) }, { isCompleted: true, duration: 1500, distance: 5000 }));
  await act(async () => {
    fireEvent.press(screen.getByTestId("session-menu"));
  });
  expect(alert).toHaveBeenCalledTimes(2);
  expect(mockBack).toHaveBeenCalled();
  expect(mockDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
});

describe("tracked on the watch", () => {
  const onWatch = () => session("run", { cardio: { kind: "run", indoor: false, watch: true } });

  it("shows the watch's clock, distance, pace and heart rate", () => {
    mockLive = { workoutId: "s1", startOpId: null, kind: "run", startedAt: T0, elapsed: 600, distance: 2 * MILE, heartRate: 151, paused: false, at: T0 + 60_000 };
    show(onWatch());
    // Ten minutes at the reading, five seconds since.
    expect(screen.getByText("10:05")).toBeTruthy();
    expect(screen.getByLabelText("Distance: 2.00 mi")).toBeTruthy();
    expect(screen.getByLabelText("Avg pace: 5:03 /mi")).toBeTruthy();
    expect(screen.getByLabelText("Heart rate: 151 bpm")).toBeTruthy();
    expect(screen.getByText("Tracking on your Apple Watch")).toBeTruthy();
  });

  // Pausing is done on the watch, where the sensors are.
  it("leaves pausing to the watch and ends without asking how far", async () => {
    show(onWatch());
    expect(screen.queryByLabelText("Pause")).toBeNull();
    expect(screen.getByText("Pause on your watch")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("End"));
    });
    expect(screen.queryByText("How far did you go?")).toBeNull();
    expect(lastPatch().completedAt).toEqual(new Date(T0 + 65_000));
  });

  it("goes back to its own clock when the watch goes quiet", () => {
    mockLive = { workoutId: "s1", startOpId: null, kind: "run", startedAt: T0, elapsed: 30, distance: 100, heartRate: 120, paused: false, at: T0 };
    show(onWatch());
    // The reading is 65 s old, past fresh: the phone's 1:05 stands.
    expect(screen.getByText("1:05")).toBeTruthy();
    expect(screen.getByText("Your Apple Watch is tracking this")).toBeTruthy();
  });
});

// Build 67 woke a watch that asked for Health access and never came back, and
// the phone said nothing: the session just ran on its clock. Now each step
// shows under the clock until the watch takes over.
describe("waking the watch", () => {
  it("says it's waking the watch", () => {
    setWatchStart("s1", { state: "waking", at: T0 });
    show(session("run"));
    expect(screen.getByText("Waking your watch…")).toBeTruthy();
  });

  it("waits a little for the watch to start before worrying", () => {
    setWatchStart("s1", { state: "woken", at: T0 + 30_000 });
    show(session("run"));
    expect(screen.getByText("Starting on your watch…")).toBeTruthy();
  });

  it("points at the watch when it hasn't started tracking", () => {
    setWatchStart("s1", { state: "woken", at: T0 });
    show(session("run"));
    expect(screen.getByText(/Your watch hasn't started tracking/)).toBeTruthy();
  });

  it("says why the watch couldn't be woken", () => {
    setWatchStart("s1", { state: "failed", reason: "Your watch couldn't be woken. Is it on your wrist?" });
    show(session("run"));
    expect(screen.getByText("Your watch couldn't be woken. Is it on your wrist?")).toBeTruthy();
  });

  it("goes quiet once the watch is tracking", () => {
    setWatchStart("s1", { state: "woken", at: T0 });
    show(session("run", { cardio: { kind: "run", indoor: false, watch: true } }));
    expect(screen.queryByText(/Your watch hasn't started/)).toBeNull();
  });

  it("says nothing for a session with no watch to wake", () => {
    show(session("run"));
    expect(screen.queryByText(/watch/i)).toBeNull();
  });
});
