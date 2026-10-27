import { act, fireEvent, render, screen } from "@testing-library/react-native";

import CreateExerciseModal from "../create-exercise";
import { EXERCISES } from "@/lib/exercises";
import type { ExerciseLibrary } from "@/lib/data";
import type { Exercise } from "@/types";

/**
 * The pencil on an exercise opened this form blank for a custom exercise, and
 * with stock values for an edited built-in — and saving wrote that back over
 * the real one.
 *
 * The library reaches a screen a moment after mount (both stores answer from a
 * promise), and the form took its starting values on the first render, when
 * all it had was the stock list. So these run the real library hook against a
 * store that answers late, the way both real ones do.
 */

let mockExerciseId: string | undefined;
let mockStored: ExerciseLibrary = { custom: [], removedIds: [], overrides: [] };
const mockWrite = jest.fn(async (_uid: string, _library: ExerciseLibrary) => {});

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ exerciseId: mockExerciseId }),
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ dataUserId: "u1" }) }));
jest.mock("@/lib/data", () => ({
  LibraryNotLoadedError: class LibraryNotLoadedError extends Error {},
  // Answers from a promise, never synchronously — as cloud-cache and the
  // local store both do.
  subscribeExerciseLibrary: (_uid: string, onChange: (library: ExerciseLibrary) => void) => {
    Promise.resolve().then(() => onChange(mockStored));
    return () => {};
  },
  updateExerciseLibrary: (uid: string, library: ExerciseLibrary) => mockWrite(uid, library),
}));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ accent: "#8b5cf6", accentSoft: "rgba(0,0,0,0.1)", accentText: "#c4b5fd", onAccent: "#fff" }),
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

const sledPush: Exercise = {
  id: "custom-sled",
  name: "Sled Push",
  category: "Legs",
  musclesWorked: ["Quads", "Glutes"],
  description: "Low hips, short choppy steps.",
  isTimed: true,
  isCustom: true,
};

const nameField = () => screen.getByPlaceholderText("e.g. Landmine Press");
const descriptionField = () => screen.getByPlaceholderText(/Setup cues/);
const chip = (label: string) => screen.getByRole("button", { name: label });

beforeEach(() => {
  mockWrite.mockClear();
  mockExerciseId = undefined;
  mockStored = { custom: [], removedIds: [], overrides: [] };
});

it("waits for the library before laying out an edit", async () => {
  mockExerciseId = sledPush.id;
  mockStored = { custom: [sledPush], removedIds: [], overrides: [] };
  render(<CreateExerciseModal />);

  // Before the store answers there is nothing to prefill from, so no form —
  // rather than a blank one under an "Edit exercise" title.
  expect(screen.getByText("Edit exercise")).toBeTruthy();
  expect(screen.queryByPlaceholderText("e.g. Landmine Press")).toBeNull();

  await act(async () => {});

  expect(nameField().props.value).toBe("Sled Push");
  expect(descriptionField().props.value).toBe("Low hips, short choppy steps.");
  expect(chip("Timed").props.accessibilityState).toEqual({ selected: true });
  expect(chip("Legs").props.accessibilityState).toEqual({ selected: true });
});

it("saves a custom exercise's edit without turning it into weight × reps", async () => {
  mockExerciseId = sledPush.id;
  mockStored = { custom: [sledPush], removedIds: [], overrides: [] };
  render(<CreateExerciseModal />);
  await act(async () => {});

  fireEvent.changeText(descriptionField(), "Low hips, short choppy steps. Arms locked.");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  });

  expect(mockWrite).toHaveBeenCalledTimes(1);
  const saved = mockWrite.mock.calls[0][1].custom;
  expect(saved).toEqual([
    {
      ...sledPush,
      description: "Low hips, short choppy steps. Arms locked.",
      isTimed: true,
      isBodyweight: false,
    },
  ]);
});

it("starts an edited built-in from the edit, not from the stock entry", async () => {
  const stock = EXERCISES.find((e) => e.id === "bench-press")!;
  const edited: Exercise = { ...stock, musclesWorked: ["Chest"], description: "Pause on the chest.", isBodyweight: false };
  mockExerciseId = stock.id;
  mockStored = { custom: [], removedIds: [], overrides: [edited] };
  render(<CreateExerciseModal />);
  await act(async () => {});

  expect(descriptionField().props.value).toBe("Pause on the chest.");
  expect(chip("Chest · primary").props.accessibilityState).toEqual({ selected: true });
  // Triceps was in the stock entry and came out in the earlier edit. (Two
  // chips carry the name: the category and the muscle. Neither is on.)
  for (const triceps of screen.getAllByRole("button", { name: "Triceps" })) {
    expect(triceps.props.accessibilityState).toEqual({ selected: false });
  }

  fireEvent.changeText(nameField(), "Paused Bench Press");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  });

  const [override] = mockWrite.mock.calls[0][1].overrides;
  expect(override).toMatchObject({
    id: "bench-press",
    name: "Paused Bench Press",
    musclesWorked: ["Chest"],
    description: "Pause on the chest.",
  });
});

it("opens a new exercise straight away, with nothing to wait for", async () => {
  render(<CreateExerciseModal />);

  expect(screen.getByText("New exercise")).toBeTruthy();
  expect(nameField().props.value).toBe("");
  await act(async () => {});
});

// An edited built-in can go back to how it ships, one at a time, without
// Restore defaults on Exercises undoing everything else too. Quiet: only on a
// built-in with an edit to undo, and it asks first, since the edit is lost.
it("caps a name at 60 characters and a description at 1,000", async () => {
  render(<CreateExerciseModal />);
  await act(async () => {});
  expect(nameField().props.maxLength).toBe(60);
  expect(descriptionField().props.maxLength).toBe(1000);
});

describe("Restore original", () => {
  const stock = EXERCISES[0];
  const restore = () => screen.queryByRole("button", { name: "Restore original" });

  it("is offered on an edited built-in, and puts it back once confirmed", async () => {
    const { Alert } = jest.requireActual<typeof import("react-native")>("react-native");
    const alert = jest.spyOn(Alert, "alert");
    mockExerciseId = stock.id;
    mockStored = { custom: [], removedIds: [], overrides: [{ ...stock, name: "My Name For It" }] };
    render(<CreateExerciseModal />);
    await act(async () => {});

    fireEvent.press(restore()!);
    expect(alert).toHaveBeenCalledWith(
      "Restore original?",
      `Undoes your changes and brings back "${stock.name}" as it came.`,
      expect.any(Array)
    );
    // Nothing is written until the confirm.
    expect(mockWrite).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
    await act(async () => {
      await buttons.find((b) => b.text === "Restore")!.onPress!();
    });
    expect(mockWrite).toHaveBeenCalledWith("u1", { custom: [], removedIds: [], overrides: [] });
    alert.mockRestore();
  });

  it("isn't offered on a built-in that hasn't been edited", async () => {
    mockExerciseId = stock.id;
    render(<CreateExerciseModal />);
    await act(async () => {});

    expect(nameField().props.value).toBe(stock.name);
    expect(restore()).toBeNull();
  });

  it("isn't offered on an exercise you made, which has no original", async () => {
    mockExerciseId = sledPush.id;
    mockStored = { custom: [sledPush], removedIds: [], overrides: [] };
    render(<CreateExerciseModal />);
    await act(async () => {});

    expect(restore()).toBeNull();
  });

  it("isn't offered when making a new exercise", async () => {
    render(<CreateExerciseModal />);
    await act(async () => {});

    expect(restore()).toBeNull();
  });
});
