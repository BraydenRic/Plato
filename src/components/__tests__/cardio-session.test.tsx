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

let mockCompleted: Workout[] = [];
jest.mock("@/hooks/use-workouts", () => ({ useWorkouts: () => ({ completed: mockCompleted }) }));

// The iPhone's step counter. Absent unless a test puts it there, as on any
// device without it: the session asks how far.
const mockMotion = {
  status: "authorized" as string,
  listener: null as ((reading: unknown) => void) | null,
  isAvailable: () => true,
  authorization: () => mockMotion.status,
  distances: jest.fn(async (windows: number[]) => windows.filter((_, i) => i % 2 === 0).map(() => 200)),
  startUpdates: jest.fn(),
  stopUpdates: jest.fn(),
  addListener: jest.fn((_event: string, listener: (reading: unknown) => void) => {
    mockMotion.listener = listener;
    return { remove: jest.fn() };
  }),
};
let mockMotionModule: typeof mockMotion | null = null;
jest.mock("../../../modules/plato-motion", () => ({
  __esModule: true,
  get default() {
    return mockMotionModule;
  },
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
  mockMotionModule = null;
  mockMotion.status = "authorized";
  mockMotion.listener = null;
  mockMotion.distances.mockImplementation(async (windows: number[]) => windows.filter((_, i) => i % 2 === 0).map(() => 200));
  mockLive = null;
  mockCompleted = [];
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

// Build 67's finished run was a time in the corner and nothing else.
describe("a finished session with only a time", () => {
  const timeOnly = (overrides: Partial<Workout> = {}) =>
    session("run", { completedAt: new Date(T0 + 1800_000), ...overrides }, { isCompleted: true, duration: 1500 });

  it("shows the time as the headline, and the session from start to end", () => {
    show(timeOnly({ cardio: { kind: "run", indoor: false, pausedSeconds: 300 } }));
    expect(screen.getByText("25:00")).toBeTruthy();
    expect(screen.getByText("Moving time")).toBeTruthy();
    expect(screen.getByLabelText(/25:00 moving, 5:00 paused\.$/)).toBeTruthy();
  });

  it("says so when there were no pauses", () => {
    show(session("run", { completedAt: new Date(T0 + 1500_000) }, { isCompleted: true, duration: 1500 }));
    expect(screen.getByText("No pauses")).toBeTruthy();
  });

  it("offers to add the distance right there, and saves it", async () => {
    show(timeOnly());
    await act(async () => {
      fireEvent.press(screen.getByText("Add distance"));
    });
    expect(screen.getByText("How far was it?")).toBeTruthy();
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Distance in miles"), "3");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(lastPatch().exercises![0].sets[0].distance).toBeCloseTo(3 * MILE);
  });

  it("doesn't offer a distance a stair stepper can't have", () => {
    show(session("stairs", { completedAt: new Date(T0 + 1800_000) }, { isCompleted: true, duration: 1500 }));
    expect(screen.queryByText("Add distance")).toBeNull();
  });
});

describe("against the last few of its kind", () => {
  const earlier = (id: string, day: number, set: Partial<WorkoutSet>, kind: "run" | "stairs" = "run") =>
    session(kind, { id, startedAt: new Date(T0 - day * 86_400_000), completedAt: new Date(T0 - day * 86_400_000 + 1800_000) }, {
      isCompleted: true,
      ...set,
    });

  it("draws the trend by distance and says how this run compares with the last", () => {
    mockCompleted = [earlier("a", 3, { duration: 1500, distance: 3 * MILE }), earlier("b", 1, { duration: 1700, distance: 3.5 * MILE })];
    show(session("run", { completedAt: new Date(T0 + 1500_000) }, { isCompleted: true, duration: 1500, distance: 3.25 * MILE }));
    expect(screen.getByText("Your last 3 runs")).toBeTruthy();
    expect(screen.getByText("Distance")).toBeTruthy();
    expect(screen.getByText("0.25 mi short of your last run")).toBeTruthy();
  });

  it("calls out the furthest of them", () => {
    mockCompleted = [earlier("a", 3, { duration: 1500, distance: 3 * MILE }), earlier("b", 1, { duration: 1700, distance: 3.5 * MILE })];
    show(session("run", { completedAt: new Date(T0 + 2000_000) }, { isCompleted: true, duration: 2000, distance: 4 * MILE }));
    expect(screen.getByText("Your furthest of the last 3")).toBeTruthy();
  });

  it("compares by time when there's no distance", () => {
    mockCompleted = [earlier("a", 2, { duration: 1200 }, "stairs")];
    show(session("stairs", { completedAt: new Date(T0 + 1500_000) }, { isCompleted: true, duration: 1500 }));
    expect(screen.getByText("Your last 2 stair sessions")).toBeTruthy();
    expect(screen.getByText("5:00 longer than your last stair session")).toBeTruthy();
  });

  it("draws nothing for the first of its kind", () => {
    mockCompleted = [earlier("a", 2, { duration: 1200 }, "stairs")];
    show(session("run", { completedAt: new Date(T0 + 1500_000) }, { isCompleted: true, duration: 1500, distance: 5000 }));
    expect(screen.queryByText(/Your last/)).toBeNull();
  });
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

// Build 67 asked "How far did you go?" after a run with the phone in a
// pocket that had counted every step.
describe("with the iPhone's step counter", () => {
  beforeEach(() => {
    mockMotionModule = mockMotion;
  });

  it("shows how far it's counted, and the pace", async () => {
    show(session("run"));
    await act(async () => {});
    expect(mockMotion.startUpdates).toHaveBeenCalledWith(T0);
    await act(async () => {
      mockMotion.listener!({ distance: 250, at: T0 + 60_000 });
    });
    expect(screen.getByLabelText("Distance: 0.16 mi")).toBeTruthy();
    expect(screen.getByText("Counting steps on your iPhone")).toBeTruthy();
  });

  it("adds what it counted before a pause to what it's counting since", async () => {
    show(session("run", { cardio: { kind: "run", pausedSeconds: 10, pauses: [{ fromMs: T0 + 10_000, toMs: T0 + 20_000 }] } }));
    await act(async () => {});
    // Before the pause, asked about once; since it, counted live.
    expect(mockMotion.distances).toHaveBeenCalledWith([T0, T0 + 10_000]);
    expect(mockMotion.startUpdates).toHaveBeenCalledWith(T0 + 20_000);
    await act(async () => {
      mockMotion.listener!({ distance: 100, at: T0 + 60_000 });
    });
    // 200 m banked + 100 m live.
    expect(screen.getByLabelText("Distance: 0.19 mi")).toBeTruthy();
  });

  it("saves what it counted on End, with splits, without asking how far", async () => {
    show(session("run", { cardio: { kind: "run", pausedSeconds: 10, pauses: [{ fromMs: T0 + 10_000, toMs: T0 + 20_000 }] } }));
    await act(async () => {});
    mockMotion.distances.mockClear();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("End"));
    });
    expect(screen.queryByText("How far did you go?")).toBeNull();
    // The pause left out, the rest in minutes at most.
    expect(mockMotion.distances).toHaveBeenCalledWith([T0, T0 + 10_000, T0 + 20_000, T0 + 65_000]);
    const set = lastPatch().exercises![0].sets[0];
    expect(set).toMatchObject({ duration: 55, distance: 400, isCompleted: true, tracked: { source: "iPhone" } });
    expect(lastPatch().completedAt).toEqual(new Date(T0 + 65_000));
  });

  it("asks how far when Plato's been refused Motion & Fitness", async () => {
    mockMotion.status = "denied";
    show(session("run"));
    await act(async () => {});
    expect(mockMotion.startUpdates).not.toHaveBeenCalled();
    expect(screen.queryByText("Counting steps on your iPhone")).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("End"));
    });
    expect(screen.getByText("How far did you go?")).toBeTruthy();
  });

  it("asks how far when it counted next to nothing", async () => {
    mockMotion.distances.mockImplementation(async (windows: number[]) => windows.filter((_, i) => i % 2 === 0).map(() => 3));
    show(session("run"));
    await act(async () => {});
    await act(async () => {
      fireEvent.press(screen.getByLabelText("End"));
    });
    expect(screen.getByText("How far did you go?")).toBeTruthy();
  });

  it("stops counting, and asks, when the live count fails", async () => {
    show(session("run"));
    await act(async () => {});
    await act(async () => {
      mockMotion.listener!({ error: 105 });
    });
    expect(screen.queryByText("Counting steps on your iPhone")).toBeNull();
    expect(mockMotion.stopUpdates).toHaveBeenCalled();
  });

  it("leaves a session the watch is tracking to the watch", async () => {
    show(session("run", { cardio: { kind: "run", watch: true } }));
    await act(async () => {});
    expect(mockMotion.startUpdates).not.toHaveBeenCalled();
  });

  it("doesn't count steps on a stair stepper", async () => {
    show(session("stairs"));
    await act(async () => {});
    expect(mockMotion.startUpdates).not.toHaveBeenCalled();
    expect(mockMotion.distances).not.toHaveBeenCalled();
  });
});
