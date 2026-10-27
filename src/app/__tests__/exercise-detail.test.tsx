import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";

import ExerciseDetailScreen from "../exercise/[id]";
import type { Exercise } from "@/types";

/**
 * The form guidance is three sections of cues, which is right when you came to
 * learn the movement and clutter every other time — and this screen is also how
 * you check what you lifted last. So it stays folded until asked for.
 *
 * Worth pinning rather than eyeballing: nothing looks broken if it defaults to
 * open, the tests all still pass, and the screen just quietly becomes a wall of
 * text again.
 */

const benchPress: Exercise = {
  id: "bench-press",
  name: "Bench Press",
  category: "Chest",
  musclesWorked: ["chest", "triceps"],
  description: "The fundamental compound pressing movement.",
};

const homemade: Exercise = {
  id: "custom-1712",
  name: "My Weird Machine Thing",
  category: "Chest",
  musclesWorked: ["chest"],
  description: "The one in the corner nobody uses.",
  isCustom: true,
};

let mockExercises: Exercise[] = [];
let mockId = "bench-press";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: mockId }),
}));

jest.mock("@/hooks/use-exercise-library", () => ({
  useExerciseLibrary: () => ({ exercises: mockExercises, deleteExercise: jest.fn() }),
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ accent: "#8b5cf6", accentSoft: "rgba(0,0,0,0.1)", accentText: "#c4b5fd" }),
}));

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@/components/exercise-progress", () => ({ ExerciseProgress: () => null }));
jest.mock("@/components/muscle-map", () => ({ MuscleMap: () => null }));

beforeEach(() => {
  mockExercises = [benchPress, homemade];
  mockId = "bench-press";
});

const toggle = () => screen.getByLabelText(/How to do it/);

it("keeps the guidance folded away until it is asked for", () => {
  render(<ExerciseDetailScreen />);

  expect(toggle()).toBeTruthy();
  expect(screen.queryByText("Set up")).toBeNull();
  expect(screen.queryByText("Watch for")).toBeNull();
});

it("opens all three sections on the first tap", () => {
  render(<ExerciseDetailScreen />);

  fireEvent.press(toggle());

  expect(screen.getByText("Set up")).toBeTruthy();
  expect(screen.getByText("The lift")).toBeTruthy();
  expect(screen.getByText("Watch for")).toBeTruthy();
  // The real content, not just the headings.
  expect(screen.getByText(/Eyes under the bar/)).toBeTruthy();
});

it("shows what to do about a mistake, not just the mistake", () => {
  render(<ExerciseDetailScreen />);

  fireEvent.press(toggle());

  // The complaint that produced this shape: naming a fault without saying what
  // to do left a reader who didn't already know none the wiser.
  expect(screen.getByText(/Hips lifting off the bench/)).toBeTruthy();
  expect(screen.getByText(/Drop the weight/)).toBeTruthy();
});

it("folds it away again on a second tap", () => {
  render(<ExerciseDetailScreen />);

  fireEvent.press(toggle());
  fireEvent.press(toggle());

  expect(screen.queryByText("Set up")).toBeNull();
});

it("tells a screen reader which way the tap goes", () => {
  render(<ExerciseDetailScreen />);

  expect(toggle().props.accessibilityState).toEqual({ expanded: false });
  fireEvent.press(toggle());
  expect(toggle().props.accessibilityState).toEqual({ expanded: true });
});

it("shows no toggle at all on an exercise the user invented", () => {
  mockId = "custom-1712";

  render(<ExerciseDetailScreen />);

  // There is no guidance for it, so a control that opens onto nothing would be
  // worse than no control.
  expect(screen.queryByLabelText(/How to do it/)).toBeNull();
  expect(screen.getByText("The one in the corner nobody uses.")).toBeTruthy();
});

// A demo is one tap away on every exercise: a YouTube search, which opens the
// YouTube app where it's installed and Safari where it isn't.
describe("Watch a demo", () => {
  const demo = () => screen.getByLabelText("Watch a demo");

  it("searches YouTube for the exercise", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<ExerciseDetailScreen />);

    await act(async () => fireEvent.press(demo()));

    expect(open).toHaveBeenCalledWith("https://www.youtube.com/results?search_query=Bench%20Press%20tutorial");
    expect(demo().props.accessibilityHint).toBe("Opens YouTube");
    open.mockRestore();
  });

  it("searches a renamed built-in by its real name, which is what the videos are called", async () => {
    mockExercises = [{ ...benchPress, name: "Bench – Gym A" }, homemade];
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<ExerciseDetailScreen />);

    await act(async () => fireEvent.press(demo()));

    expect(open).toHaveBeenCalledWith("https://www.youtube.com/results?search_query=Bench%20Press%20tutorial");
    open.mockRestore();
  });

  it("is there for an exercise the user invented, which has no written guide", async () => {
    mockId = "custom-1712";
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<ExerciseDetailScreen />);

    await act(async () => fireEvent.press(demo()));

    expect(open).toHaveBeenCalledWith(expect.stringContaining("My%20Weird%20Machine%20Thing%20tutorial"));
    open.mockRestore();
  });

  it("says what to search for when nothing can open the link", async () => {
    const open = jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no handler"));
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    render(<ExerciseDetailScreen />);

    await act(async () => fireEvent.press(demo()));

    expect(alert).toHaveBeenCalledWith("Couldn't open YouTube", 'Search YouTube for "Bench Press tutorial".');
    open.mockRestore();
    alert.mockRestore();
  });
});
