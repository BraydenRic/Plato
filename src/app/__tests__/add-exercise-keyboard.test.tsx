import { render, screen } from "@testing-library/react-native";
import { FlatList } from "react-native";

import AddExerciseModal from "../add-exercise";
import type { Exercise } from "@/types";

/**
 * The picker's results have to scroll clear of the keyboard while you're still
 * typing. The keyboard sits over the bottom of the list, and without the inset
 * the last few matches rest underneath the keys — reachable only after pressing
 * Search, which is exactly the step the search-as-you-type list exists to skip.
 *
 * A prop assertion, because the bug is the missing prop: nothing in a test
 * renderer has a keyboard to cover anything.
 */

const library: Exercise[] = [
  { id: "hlr", name: "Hanging Leg Raise", category: "Core", musclesWorked: ["abs"], description: "" },
];

jest.mock("@/hooks/use-exercise-library", () => ({
  useExerciseLibrary: () => ({ exercises: library }),
}));

jest.mock("@/lib/data", () => ({
  subscribeWorkout: () => () => {},
  updateWorkout: jest.fn(),
  stripUndefined: (v: unknown) => v,
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ workoutId: "w1" }),
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

it("insets the results by the keyboard so every match can be scrolled to", () => {
  render(<AddExerciseModal />);

  const list = screen.UNSAFE_getByType(FlatList);
  expect(list.props.automaticallyAdjustKeyboardInsets).toBe(true);
  expect(list.props.keyboardShouldPersistTaps).toBe("handled");
});
