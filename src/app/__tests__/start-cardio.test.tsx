import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";

import StartCardioScreen, { LAST_CARDIO_KEY, PERMISSION_PATIENCE_MS } from "../start-cardio";
import { readWatchTrace, resetWatchTrace, useWatchStart } from "@/lib/watch-trace";
import type { Workout } from "@/types";

/** Picking a session: what, indoors or out, and straight onto its clock. */

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: mockReplace }) }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ dataUserId: "u1" }) }));
jest.mock("@/context/UnitContext", () => ({ useWeightUnit: () => ({ unit: "lbs" }) }));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ accent: "#8b5cf6", accentSoft: "rgba(0,0,0,0.1)", accentText: "#c4b5fd", onAccent: "#fff" }),
}));
let mockActive: Workout[] = [];
jest.mock("@/hooks/use-workouts", () => ({ useWorkouts: () => ({ active: mockActive }) }));
const mockCreate = jest.fn((_w: Omit<Workout, "id">) => ({ id: "new-session", saved: Promise.resolve() }));
const mockUpdate = jest.fn(async (_id: string, _patch: Partial<Workout>) => {});
jest.mock("@/lib/data", () => ({
  createWorkoutLocalFirst: (w: Omit<Workout, "id">) => mockCreate(w),
  updateWorkout: (id: string, patch: Partial<Workout>) => mockUpdate(id, patch),
  stripUndefined: (v: unknown) => v,
}));
let mockWatchInstalled = false;
jest.mock("../../../modules/plato-watch", () => ({
  __esModule: true,
  default: { isWatchAppInstalled: () => mockWatchInstalled },
}));
const mockHealth = { requestAccess: jest.fn(async () => {}), startWatchWorkout: jest.fn(async (_k: string, _i: boolean) => true) };
const mockMotion = {
  status: "notDetermined",
  isAvailable: () => true,
  authorization: () => mockMotion.status,
  distances: jest.fn(async (_windows: number[]) => [0]),
};
let mockMotionModule: typeof mockMotion | null = null;
jest.mock("../../../modules/plato-motion", () => ({
  __esModule: true,
  get default() {
    return mockMotionModule;
  },
}));
jest.mock("../../../modules/plato-health", () => ({
  __esModule: true,
  get default() {
    return mockHealth;
  },
}));

beforeEach(async () => {
  jest.clearAllMocks();
  mockActive = [];
  mockWatchInstalled = false;
  mockHealth.requestAccess.mockImplementation(async () => {});
  mockMotionModule = null;
  mockMotion.status = "notDetermined";
  mockHealth.startWatchWorkout.mockImplementation(async () => true);
  resetWatchTrace();
  await AsyncStorage.clear();
});

async function startRun() {
  await mount();
  await act(async () => {
    fireEvent.press(screen.getByText("Start outdoor run"));
  });
}

/** What the session screen's line under the clock will say. */
function watchStart() {
  return renderHook(() => useWatchStart("new-session")).result.current;
}

async function mount() {
  render(<StartCardioScreen />);
  await act(async () => {});
}

it("starts an outdoor run by default and opens it", async () => {
  await mount();
  await act(async () => {
    fireEvent.press(screen.getByText("Start outdoor run"));
  });
  expect(mockCreate.mock.calls[0][0]).toMatchObject({
    userId: "u1",
    name: "Outdoor Run",
    cardio: { kind: "run", indoor: false },
    exercises: [expect.objectContaining({ exerciseId: "running" })],
  });
  expect(mockReplace).toHaveBeenCalledWith("/workout/new-session");
});

it("starts what was picked, indoors when chosen", async () => {
  await mount();
  await act(async () => {
    fireEvent.press(screen.getByLabelText("Bike"));
  });
  await act(async () => {
    fireEvent.press(screen.getByText("Indoor"));
  });
  await act(async () => {
    fireEvent.press(screen.getByText("Start indoor cycle"));
  });
  expect(mockCreate.mock.calls[0][0]).toMatchObject({ name: "Indoor Cycle", cardio: { kind: "bike", indoor: true } });
});

// A rower is only ever indoors: no choice to make, so none offered.
it("offers no indoors-or-out choice where there isn't one", async () => {
  await mount();
  await act(async () => {
    fireEvent.press(screen.getByLabelText("Row"));
  });
  expect(screen.queryByText("Outdoor")).toBeNull();
  expect(screen.getByText("Start indoor row")).toBeTruthy();
});

it("opens on the last session started, so a runner's next tap is Start", async () => {
  await AsyncStorage.setItem(LAST_CARDIO_KEY, JSON.stringify({ kind: "swim", place: "outdoor" }));
  await mount();
  expect(screen.getByText("Start open water swim")).toBeTruthy();
});

it("refuses a sixth session in progress, as Start workout does", async () => {
  mockActive = Array.from({ length: 5 }, (_, i) => ({ id: `a${i}` }) as Workout);
  const { Alert } = jest.requireActual("react-native") as typeof import("react-native");
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await mount();
  await act(async () => {
    fireEvent.press(screen.getByText("Start outdoor run"));
  });
  expect(alert).toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
});

describe("with a watch", () => {
  // Waking the app proves nothing: the session's marked as tracked on the
  // watch only when the watch says it is (see watch-sync).
  it("asks for Health access and wakes the watch, without claiming it's tracking yet", async () => {
    mockWatchInstalled = true;
    await mount();
    await act(async () => {
      fireEvent.press(screen.getByText("Start outdoor run"));
    });
    expect(mockHealth.requestAccess.mock.invocationCallOrder[0]).toBeLessThan(mockHealth.startWatchWorkout.mock.invocationCallOrder[0]);
    // 25 yards, for someone in pounds.
    expect(mockHealth.startWatchWorkout).toHaveBeenCalledWith("run", false, 22.86);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/workout/new-session");
  });

  it("doesn't ask for Health access with no watch to track it", async () => {
    await startRun();
    expect(mockHealth.requestAccess).not.toHaveBeenCalled();
    // Nothing to say on the session screen about a watch that isn't there.
    expect(watchStart()).toBeUndefined();
    expect((await readWatchTrace()).join("\n")).toMatch(/no watch with Plato/);
  });

  // The session screen's line under the clock reads this: build 67 woke a
  // watch that never came back, and the phone said nothing about it.
  it("records the watch as woken, for the session screen to wait on", async () => {
    mockWatchInstalled = true;
    await startRun();
    expect(watchStart()).toMatchObject({ state: "woken" });
    expect((await readWatchTrace()).join("\n")).toMatch(/waking the watch for run[\s\S]*watch woken/);
  });

  it("says so when the watch couldn't be woken", async () => {
    mockWatchInstalled = true;
    mockHealth.startWatchWorkout.mockImplementation(async () => false);
    await startRun();
    expect(watchStart()).toEqual({ state: "failed", reason: expect.stringMatching(/couldn't be woken/) });
  });

  it("says why when waking the watch throws", async () => {
    mockWatchInstalled = true;
    mockHealth.startWatchWorkout.mockImplementation(async () => {
      throw new Error("No paired watch");
    });
    await startRun();
    expect(watchStart()).toEqual({ state: "failed", reason: expect.stringMatching(/No paired watch/) });
    // The session itself still started: it runs on the phone's clock.
    expect(mockReplace).toHaveBeenCalledWith("/workout/new-session");
  });

  it("doesn't wake the watch without Health access, and says so", async () => {
    mockWatchInstalled = true;
    mockHealth.requestAccess.mockImplementation(async () => {
      throw new Error("denied");
    });
    await startRun();
    expect(mockHealth.startWatchWorkout).not.toHaveBeenCalled();
    expect(watchStart()).toEqual({ state: "failed", reason: expect.stringMatching(/Apple Health access/) });
  });
});

// Build 67 asked for Health access from the session screen, while this one
// was being dismissed: the sheet never showed, and the watch asked on its own
// wrist instead. Now every first-time question is asked here, before the clock.
describe("asking before the clock starts", () => {
  it("waits for the Health sheet on the picker, then starts", async () => {
    mockWatchInstalled = true;
    let answer!: () => void;
    mockHealth.requestAccess.mockImplementation(() => new Promise<void>((resolve) => (answer = resolve)));
    await mount();
    await act(async () => {
      fireEvent.press(screen.getByText("Start outdoor run"));
    });
    // The sheet is up: no session yet, still on the picker.
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => answer());
    expect(mockReplace).toHaveBeenCalledWith("/workout/new-session");
    expect(mockHealth.startWatchWorkout).toHaveBeenCalled();
    expect(mockHealth.requestAccess.mock.invocationCallOrder[0]).toBeLessThan(mockReplace.mock.invocationCallOrder[0]);
  });

  it("starts anyway if the sheet never answers", async () => {
    jest.useFakeTimers();
    try {
      mockWatchInstalled = true;
      mockHealth.requestAccess.mockImplementation(() => new Promise<void>(() => {}));
      await mount();
      await act(async () => {
        fireEvent.press(screen.getByText("Start outdoor run"));
      });
      expect(mockReplace).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(PERMISSION_PATIENCE_MS);
      });
      expect(mockReplace).toHaveBeenCalledWith("/workout/new-session");
    } finally {
      jest.useRealTimers();
    }
  });

  it("asks for Motion & Fitness for a run, the first time, before starting", async () => {
    mockMotionModule = mockMotion;
    await startRun();
    expect(mockMotion.distances).toHaveBeenCalledTimes(1);
    expect(mockMotion.distances.mock.invocationCallOrder[0]).toBeLessThan(mockReplace.mock.invocationCallOrder[0]);
  });

  it("doesn't ask again once answered", async () => {
    mockMotionModule = mockMotion;
    mockMotion.status = "authorized";
    await startRun();
    expect(mockMotion.distances).not.toHaveBeenCalled();
  });

  it("starts even when Motion & Fitness is refused", async () => {
    mockMotionModule = mockMotion;
    mockMotion.distances.mockImplementationOnce(async () => {
      throw new Error("not authorized");
    });
    await startRun();
    expect(mockReplace).toHaveBeenCalledWith("/workout/new-session");
  });

  it("doesn't ask about steps for a ride", async () => {
    mockMotionModule = mockMotion;
    await mount();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Bike"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Start outdoor cycle"));
    });
    expect(mockMotion.distances).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalled();
  });
});
