import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import StartCardioScreen, { LAST_CARDIO_KEY } from "../start-cardio";
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
  mockHealth.startWatchWorkout.mockImplementation(async () => true);
  await AsyncStorage.clear();
});

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
    await mount();
    await act(async () => {
      fireEvent.press(screen.getByText("Start outdoor run"));
    });
    expect(mockHealth.requestAccess).not.toHaveBeenCalled();
  });
});
