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

// Reading 5000 m off a rower, or leaving the question up through a cool-down,
// isn't moving time: the session ends when End is tapped.
it("ends at End, not when the distance is given", async () => {
  show(session("run"));
  await act(async () => {
    fireEvent.press(screen.getByLabelText("End"));
  });
  // Held paused there, so a question left up adds nothing either.
  expect(mockUpdate.mock.calls[0][1].cardio).toEqual({ kind: "run", indoor: false, pausedAtMs: T0 + 65_000 });
  jest.spyOn(Date, "now").mockReturnValue(T0 + 65_000 + 15 * 60_000);
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText("Distance in miles"), "3.1");
  });
  await act(async () => {
    fireEvent.press(screen.getByText("Save outdoor run"));
  });
  expect(lastPatch().completedAt).toEqual(new Date(T0 + 65_000));
  expect(lastPatch().exercises![0].sets[0].duration).toBe(65);
});

it("ends at End when the distance is skipped later", async () => {
  show(session("run"));
  await act(async () => {
    fireEvent.press(screen.getByLabelText("End"));
  });
  jest.spyOn(Date, "now").mockReturnValue(T0 + 65_000 + 10 * 60_000);
  await act(async () => {
    fireEvent.press(screen.getByText("Skip"));
  });
  expect(lastPatch().completedAt).toEqual(new Date(T0 + 65_000));
  expect(lastPatch().exercises![0].sets[0].duration).toBe(65);
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

  // Ended on the phone while the watch tracked it: the watch's distance is
  // on its way, and a typed one would only be overwritten.
  it("waits for the watch's distance rather than offering to type one", () => {
    show(timeOnly({ cardio: { kind: "run", watch: true } }));
    expect(screen.getByText("Your watch is sending the distance")).toBeTruthy();
    expect(screen.queryByText("Add distance")).toBeNull();
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

  // Taken over 40 s in, after the phone had the session: the clock carries on
  // from the phone's time rather than jumping back to the watch's.
  it("keeps the phone's time before a late takeover on the clock", () => {
    mockLive = { workoutId: "s1", startOpId: null, kind: "run", startedAt: T0 + 40_000, elapsed: 20, distance: 100, heartRate: 140, paused: false, at: T0 + 60_000 };
    show(onWatch());
    // 40 s on the phone, 20 at the reading, 5 since.
    expect(screen.getByText("1:05")).toBeTruthy();
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

  // In the app the React Compiler cached the first value and the line never
  // moved on; it has to follow every change after the screen is up.
  it("moves on as waking the watch goes on", async () => {
    setWatchStart("s1", { state: "waking", at: T0 });
    show(session("run"));
    expect(screen.getByText("Waking your watch…")).toBeTruthy();
    await act(async () => {
      setWatchStart("s1", { state: "failed", reason: "Your watch couldn't be woken. Is it on your wrist?" });
    });
    expect(screen.getByText("Your watch couldn't be woken. Is it on your wrist?")).toBeTruthy();
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
    expect(screen.getByLabelText(/^Avg pace: /)).toBeTruthy();
    // The figure says the phone's measuring it; no line repeating that.
    expect(screen.queryByText(/Counting steps/)).toBeNull();
  });

  // Worked out every second from a distance that moves in jumps and a clock
  // that moves every second, the average pace twitched. It moves every 5 s.
  it("moves the average pace every few seconds, not every second", async () => {
    jest.useFakeTimers({ now: T0 + 65_000 });
    try {
      show(session("run"));
      await act(async () => {});
      await act(async () => {
        mockMotion.listener!({ distance: 400, at: T0 + 65_000 });
      });
      // 65 s for 400 m.
      expect(screen.getByLabelText("Avg pace: 4:22 /mi")).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(3_000);
      });
      // The clock's moved on; the pace waits.
      expect(screen.getByLabelText("Avg pace: 4:22 /mi")).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(2_000);
      });
      // Caught up with the clock: 68–70 s for 400 m. (act holds renders until
      // it ends, so the tick can see the clock as of a render or two back.)
      expect(screen.queryByLabelText("Avg pace: 4:22 /mi")).toBeNull();
      expect(screen.getByLabelText(/^Avg pace: 4:(3[4-9]|4[0-2]) \/mi$/)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
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

  // Resumed in the same millisecond the count started — or the clock stepped
  // back while paused — there was no stretch since the resume yet: the live
  // count started from the session's start, under a tag the figure never
  // matched, and stuck at what was banked until the next pause.
  it("counts live from the last resume, whatever the clock says", async () => {
    show(session("run", { cardio: { kind: "run", pausedSeconds: 60, pauses: [{ fromMs: T0 + 5_000, toMs: T0 + 65_000 }] } }));
    await act(async () => {});
    expect(mockMotion.distances).toHaveBeenCalledWith([T0, T0 + 5_000]);
    expect(mockMotion.startUpdates).toHaveBeenCalledWith(T0 + 65_000);
    await act(async () => {
      mockMotion.listener!({ distance: 100, at: T0 + 65_000 });
    });
    // 200 m banked + 100 m live.
    expect(screen.getByLabelText("Distance: 0.19 mi")).toBeTruthy();
  });

  // The live count was from the start; once paused, what it covered is in
  // the banked figure, and adding the old reading too would count it twice.
  it("doesn't count a reading from before a pause on top of it", async () => {
    const running = session("run");
    const { rerender } = render(<CardioSession workout={running} onLocalChange={jest.fn()} />);
    await act(async () => {});
    await act(async () => {
      mockMotion.listener!({ distance: 300, at: T0 + 50_000 });
    });
    expect(screen.getByLabelText("Distance: 0.19 mi")).toBeTruthy();
    const pausedRun = { ...running, cardio: { kind: "run" as const, pausedAtMs: T0 + 60_000 } };
    await act(async () => {
      rerender(<CardioSession workout={pausedRun} onLocalChange={jest.fn()} />);
    });
    // One closed stretch, start to the pause: 200 m by the mock, and nothing live.
    expect(mockMotion.distances).toHaveBeenLastCalledWith([T0, T0 + 60_000]);
    expect(screen.getByLabelText("Distance: 0.12 mi")).toBeTruthy();
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
    expect(screen.queryByLabelText(/^Distance: /)).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("End"));
    });
    expect(screen.getByText("How far did you go?")).toBeTruthy();
  });

  it("measures at End even if the live count never showed", async () => {
    mockMotion.distances.mockImplementationOnce(async () => {
      throw new Error("not yet");
    });
    show(session("run", { cardio: { kind: "run", pausedSeconds: 10, pauses: [{ fromMs: T0 + 10_000, toMs: T0 + 20_000 }] } }));
    await act(async () => {});
    await act(async () => {
      fireEvent.press(screen.getByLabelText("End"));
    });
    expect(screen.queryByText("How far did you go?")).toBeNull();
    expect(lastPatch().exercises![0].sets[0]).toMatchObject({ distance: 400, tracked: { source: "iPhone" } });
  });

  // Nothing counted — the phone set down — is still an answer: no distance,
  // and Add distance on the finished screen, not a question.
  it("saves without a distance, rather than asking, when it counted nothing", async () => {
    mockMotion.distances.mockImplementation(async (windows: number[]) => windows.filter((_, i) => i % 2 === 0).map(() => 3));
    show(session("run"));
    await act(async () => {});
    await act(async () => {
      fireEvent.press(screen.getByLabelText("End"));
    });
    expect(screen.queryByText("How far did you go?")).toBeNull();
    expect(lastPatch().completedAt).toEqual(new Date(T0 + 65_000));
    expect(lastPatch().exercises![0].sets[0].distance).toBeUndefined();
  });

  // Build 68 showed 0.02 mi on the screen, then asked "How far did you go?":
  // the minute-by-minute history trails the live count.
  it("never saves less than the screen showed", async () => {
    mockMotion.distances.mockImplementation(async (windows: number[]) => windows.filter((_, i) => i % 2 === 0).map(() => 5));
    show(session("run"));
    await act(async () => {});
    await act(async () => {
      mockMotion.listener!({ distance: 32, at: T0 + 60_000 });
    });
    expect(screen.getByLabelText("Distance: 0.02 mi")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("End"));
    });
    expect(screen.queryByText("How far did you go?")).toBeNull();
    expect(lastPatch().exercises![0].sets[0]).toMatchObject({ distance: 32, tracked: { source: "iPhone" } });
  });

  it("goes by the live count when the minutes can't be read", async () => {
    mockMotion.distances.mockImplementation(async (windows: number[]) => {
      if (windows.length > 0) throw new Error("not available yet");
      return [];
    });
    show(session("run"));
    await act(async () => {});
    await act(async () => {
      mockMotion.listener!({ distance: 300, at: T0 + 60_000 });
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("End"));
    });
    expect(screen.queryByText("How far did you go?")).toBeNull();
    expect(lastPatch().exercises![0].sets[0]).toMatchObject({ distance: 300, tracked: { source: "iPhone" } });
  });

  it("stops counting when Motion & Fitness is turned off mid-run", async () => {
    show(session("run"));
    await act(async () => {});
    mockMotion.status = "denied";
    await act(async () => {
      mockMotion.listener!({ error: 105 });
    });
    expect(screen.queryByLabelText(/^Distance: /)).toBeNull();
    expect(mockMotion.stopUpdates).toHaveBeenCalled();
  });

  // A failure that isn't a refusal — the sheet still up, a hiccup — is tried
  // again, not taken as the end of counting for the whole run.
  it("tries again after a hiccup, and keeps counting", async () => {
    jest.useFakeTimers({ now: T0 + 65_000 });
    try {
      show(session("run"));
      await act(async () => {});
      await act(async () => {
        mockMotion.listener!({ error: 103 });
      });
      expect(screen.getByLabelText(/^Distance: /)).toBeTruthy();
      mockMotion.startUpdates.mockClear();
      await act(async () => {
        jest.advanceTimersByTime(5_000);
      });
      expect(mockMotion.startUpdates).toHaveBeenCalledWith(T0);
    } finally {
      jest.useRealTimers();
    }
  });

  // A run begun on build 67 kept only its paused total: which minutes to
  // leave out is unknown, so it's asked how far rather than mis-measured.
  it("asks how far for a session from before pauses were kept", async () => {
    show(session("run", { cardio: { kind: "run", pausedSeconds: 120 } }));
    await act(async () => {});
    expect(mockMotion.startUpdates).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("End"));
    });
    expect(screen.getByText("How far did you go?")).toBeTruthy();
  });

  it("adds what it counted before a late watch takeover to the watch's distance", async () => {
    mockLive = { workoutId: "s1", startOpId: null, kind: "run", startedAt: T0 + 40_000, elapsed: 20, distance: 100, heartRate: 140, paused: false, at: T0 + 60_000 };
    show(session("run", { cardio: { kind: "run", watch: true } }));
    await act(async () => {});
    // The 40 s before the watch: one window, 200 m by the mock.
    expect(mockMotion.distances).toHaveBeenCalledWith([T0, T0 + 40_000]);
    expect(screen.getByLabelText("Distance: 0.19 mi")).toBeTruthy();
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
