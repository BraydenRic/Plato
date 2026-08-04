import { fireEvent, render, screen } from "@testing-library/react-native";

import ExercisesScreen from "../(tabs)/exercises";
import type { Exercise } from "@/types";

/**
 * The search field must stay *uncontrolled*.
 *
 * A controlled TextInput has its native text forced to match the prop on every
 * render. Each keystroke here re-filters the whole library and redraws the
 * list, so the round-trip through state lags the keyboard, the input gets set
 * back to the previous string, and the caret lands mid-word — typing, deleting
 * and typing again reliably ended up inserting into the middle of the word.
 *
 * This is an assertion about a prop rather than about behaviour, which is
 * usually a smell. It's here because the prop *is* the bug: `value` reads like
 * the more correct choice, nothing on screen looks wrong when you make that
 * change, and the damage only shows up on a real keyboard at typing speed.
 */

const library: Exercise[] = [
  { id: "pull-up", name: "Pull-Up", category: "Back", musclesWorked: ["lats"], description: "" },
  { id: "bench", name: "Bench Press", category: "Chest", musclesWorked: ["chest"], description: "" },
];

jest.mock("@/hooks/use-exercise-library", () => ({
  useExerciseLibrary: () => ({
    exercises: library,
    isModified: false,
    deleteExercise: jest.fn(),
    resetLibrary: jest.fn(),
  }),
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
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

const searchField = () => screen.getByPlaceholderText("Search exercises");

it("leaves the search field's text to the native input", () => {
  render(<ExercisesScreen />);

  // Controlled would mean a `value` prop, and a caret that jumps at speed.
  expect(searchField().props.value).toBeUndefined();
});

it("still filters as you type", () => {
  render(<ExercisesScreen />);

  expect(screen.getByText("Bench Press")).toBeTruthy();

  fireEvent.changeText(searchField(), "pull ups");

  expect(screen.getByText("Pull-Up")).toBeTruthy();
  expect(screen.queryByText("Bench Press")).toBeNull();
});
