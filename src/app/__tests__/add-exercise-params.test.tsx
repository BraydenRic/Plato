import { render, screen } from "@testing-library/react-native";

import AddExerciseModal from "../add-exercise";
import type { Exercise } from "@/types";

/**
 * The picker is a plain route, so anything that can open a plato:// link can
 * open it with any query it likes. A repeated key arrives from expo-router as
 * an array, and the store underneath calls id.startsWith — which threw inside
 * an effect and replaced the whole app with the crash screen, on cold start
 * too, and again on every "Try again".
 */

const library: Exercise[] = [
  { id: "hlr", name: "Hanging Leg Raise", category: "Core", musclesWorked: ["abs"], description: "" },
];

jest.mock("@/hooks/use-exercise-library", () => ({
  useExerciseLibrary: () => ({ exercises: library }),
}));

// Throws exactly as local-store's isLocalWorkoutId does on anything but a string.
const mockSubscribe = jest.fn((id: unknown, _onChange: unknown) => {
  if (typeof id !== "string") throw new TypeError("id.startsWith is not a function");
  return () => {};
});
jest.mock("@/lib/data", () => ({
  subscribeWorkout: (id: unknown, onChange: unknown) => mockSubscribe(id, onChange),
  updateWorkout: jest.fn(),
  stripUndefined: (v: unknown) => v,
}));

let mockParams: Record<string, string | string[]> = {};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    accent: "#7c3aed",
    accentSoft: "rgba(124,58,237,0.12)",
    accentText: "#a78bfa",
    onAccent: "#ffffff",
  }),
}));

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

beforeEach(() => mockSubscribe.mockClear());

it("survives a link that names the workout twice", () => {
  mockParams = { workoutId: ["a", "b"] };

  render(<AddExerciseModal />);

  expect(mockSubscribe).not.toHaveBeenCalled();
  expect(screen.getByText("Hanging Leg Raise")).toBeTruthy();
});

it("still follows the workout a normal link names", () => {
  mockParams = { workoutId: "w1" };

  render(<AddExerciseModal />);

  expect(mockSubscribe).toHaveBeenCalledWith("w1", expect.any(Function));
});
