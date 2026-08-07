import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import BodyweightScreen from "../bodyweight";
import type { BodyweightEntry, Workout } from "@/types";

/**
 * Fixing a weigh-in has to move two things: the log, and the volume of anything
 * logged that day, which was priced from the number being corrected. Fixing
 * only the first is the bug this screen exists to close — the graph would look
 * right while History kept showing a total derived from the typo.
 */

const mockRecord = jest.fn(async () => {});
const mockRemove = jest.fn(async () => {});
let mockLog: BodyweightEntry[] = [];

jest.mock("@/hooks/use-bodyweight", () => ({
  useBodyweight: () => ({
    log: mockLog,
    loading: false,
    record: mockRecord,
    remove: mockRemove,
  }),
}));

const AUG_4 = new Date(2026, 7, 4);
const AUG_5 = new Date(2026, 7, 5);

let mockCompleted: Workout[] = [];

const pullDay = (): Workout => ({
  id: "w1",
  userId: "u1",
  name: "Pull Day",
  isTemplate: false,
  createdAt: AUG_4,
  scheduledFor: AUG_4,
  completedAt: AUG_4,
  totalVolume: 2500,
  exercises: [
    {
      id: "e1",
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
      sets: [{ id: "s1", reps: 10, weightUnit: "bodyweight", isCompleted: true }],
    },
  ],
});

jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: () => ({ completed: mockCompleted, active: [], loading: false }),
}));

jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ dataUserId: "u1" }) }));
jest.mock("@/context/UnitContext", () => ({ useWeightUnit: () => ({ unit: "lbs" }) }));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ accent: "#8b5cf6", accentSoft: "rgba(0,0,0,0.1)", accentText: "#c4b5fd" }),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@/components/active-workout-bar", () => ({ ActiveWorkoutBar: () => null }));
jest.mock("@/components/bodyweight-chart", () => ({ BodyweightChart: () => null }));

let promptSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 7, 6, 12, 0));
  // The typo: 250 on the 4th, when they weigh 190.
  mockLog = [
    { date: AUG_4, lbs: 250 },
    { date: AUG_5, lbs: 191 },
  ];
  mockCompleted = [pullDay()];
  promptSpy = jest.spyOn(Alert, "prompt").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** The prompt raised by tapping a log row, by its date title. */
function promptFor(title: string) {
  const call = [...promptSpy.mock.calls].reverse().find((c) => c[0] === title);
  if (!call) {
    throw new Error(`No prompt "${title}". Saw: ${promptSpy.mock.calls.map((c) => c[0]).join(", ")}`);
  }
  return { message: call[1] as string, buttons: (call[2] ?? []) as AlertButton[] };
}

const press = (buttons: AlertButton[], text: string, value?: string) => {
  const button = buttons.find((b) => b.text === text);
  if (!button) throw new Error(`No "${text}". Saw: ${buttons.map((b) => b.text).join(", ")}`);
  (button.onPress as ((v?: string) => void) | undefined)?.(value);
};

const openAug4 = () => {
  render(<BodyweightScreen />);
  fireEvent.press(screen.getByLabelText(/8\/4\/2026, 250 lbs/));
  return promptFor("August 4, 2026");
};

it("lists every weigh-in with the day it belongs to", () => {
  render(<BodyweightScreen />);

  expect(screen.getByLabelText(/8\/4\/2026, 250 lbs/)).toBeTruthy();
  // 191 is also the big current-weight figure, so match the row, not the text.
  expect(screen.getByLabelText(/8\/5\/2026, 191 lbs/)).toBeTruthy();
});

it("warns that fixing a number will re-price that day's workouts", () => {
  const { message } = openAug4();

  expect(message).toContain("re-prices 1 workout");
});

it("says nothing about workouts on a day that has none", () => {
  render(<BodyweightScreen />);
  fireEvent.press(screen.getByLabelText(/8\/5\/2026, 191 lbs/));

  expect(promptFor("August 5, 2026").message).not.toContain("re-price");
});

it("saves the corrected weight", async () => {
  const { buttons } = openAug4();

  press(buttons, "Save", "190");

  await waitFor(() => expect(mockRecord).toHaveBeenCalledWith(190, AUG_4));
});

it("deletes a weigh-in", async () => {
  const { buttons } = openAug4();

  press(buttons, "Delete");

  // What follows from it — re-pricing that day — is useBodyweight's job now,
  // and has its own tests.
  await waitFor(() => expect(mockRemove).toHaveBeenCalledWith(AUG_4));
});

it("ignores a value that isn't a weight", async () => {
  const { buttons } = openAug4();

  press(buttons, "Save", "not a number");

  expect(mockRecord).not.toHaveBeenCalled();
});

it("ignores zero and negative weights", () => {
  const { buttons } = openAug4();

  press(buttons, "Save", "0");
  press(buttons, "Save", "-5");

  expect(mockRecord).not.toHaveBeenCalled();
});

it("offers an empty state rather than a chart with nothing in it", () => {
  mockLog = [];
  render(<BodyweightScreen />);

  expect(screen.getByText("No weigh-ins yet")).toBeTruthy();
});
