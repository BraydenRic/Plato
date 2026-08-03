import { act, render } from "@testing-library/react-native";

import { EXERCISES } from "@/lib/exercises";
import { GUEST_USER_ID } from "@/lib/local-store";
import { MAX_CUSTOM_EXERCISES } from "@/lib/workout-utils";
import type { ExerciseLibrary } from "@/lib/data";
import { useExerciseLibrary } from "../use-exercise-library";
import { makeExercise } from "@/lib/__tests__/factories";

/**
 * The hook that turns stored customisations into the list every picker shows.
 *
 * The data layer and auth are mocked because the merge — defaults minus removed,
 * overrides swapped in place, customs appended — is the part with the bugs in
 * it, and it's the part a screen can't easily be inspected for.
 */

const mockUpdate = jest.fn<Promise<void>, [string, ExerciseLibrary]>(async () => {});
let mockOnLibraryChange: ((lib: ExerciseLibrary) => void) | undefined;
const mockUnsubscribe = jest.fn();

jest.mock("@/lib/data", () => ({
  subscribeExerciseLibrary: (_userId: string, cb: (lib: ExerciseLibrary) => void) => {
    mockOnLibraryChange = cb;
    return mockUnsubscribe;
  },
  updateExerciseLibrary: (userId: string, lib: ExerciseLibrary) => mockUpdate(userId, lib),
}));

let mockDataUserId: string | null = "user-1";
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ dataUserId: mockDataUserId }),
}));

type Hook = ReturnType<typeof useExerciseLibrary>;

function mountHook() {
  const box: { current?: Hook } = {};
  function Probe() {
    box.current = useExerciseLibrary();
    return null;
  }
  const view = render(<Probe />);
  return { hook: box as { current: Hook }, view };
}

/** Pushes a library snapshot through the subscription, as the store would. */
function emit(lib: Partial<ExerciseLibrary>) {
  act(() => {
    mockOnLibraryChange!({ custom: [], removedIds: [], overrides: [], ...lib });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnLibraryChange = undefined;
  mockDataUserId = "user-1";
});

describe("the effective exercise list", () => {
  it("is the bundled defaults before anything is customised", () => {
    const { hook } = mountHook();
    emit({});
    expect(hook.current.exercises).toHaveLength(EXERCISES.length);
  });

  it("drops a removed default", () => {
    const { hook } = mountHook();
    const victim = EXERCISES[0];
    emit({ removedIds: [victim.id] });
    expect(hook.current.exercises.find((e) => e.id === victim.id)).toBeUndefined();
    expect(hook.current.exercises).toHaveLength(EXERCISES.length - 1);
  });

  it("appends custom exercises after the defaults", () => {
    const { hook } = mountHook();
    const custom = makeExercise({ id: "custom-1", name: "Sled Push", isCustom: true });
    emit({ custom: [custom] });
    expect(hook.current.exercises).toHaveLength(EXERCISES.length + 1);
    expect(hook.current.exercises[hook.current.exercises.length - 1]).toEqual(custom);
  });

  it("swaps an overridden default in place rather than duplicating it", () => {
    const { hook } = mountHook();
    const original = EXERCISES[0];
    const edited = { ...original, name: "My Renamed Lift" };
    emit({ overrides: [edited] });

    const matches = hook.current.exercises.filter((e) => e.id === original.id);
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("My Renamed Lift");
    expect(hook.current.exercises).toHaveLength(EXERCISES.length);
  });

  it("keeps a default removed even when an override for it still exists", () => {
    const { hook } = mountHook();
    const victim = EXERCISES[0];
    emit({ removedIds: [victim.id], overrides: [{ ...victim, name: "Stale" }] });
    expect(hook.current.exercises.find((e) => e.id === victim.id)).toBeUndefined();
  });

  it("reports whether the library has been touched, which gates the reset action", () => {
    const { hook } = mountHook();
    emit({});
    expect(hook.current.isModified).toBe(false);
    emit({ removedIds: ["bench-press"] });
    expect(hook.current.isModified).toBe(true);
  });

  it("counts customs for the cap the create screen shows", () => {
    const { hook } = mountHook();
    emit({ custom: [makeExercise({ id: "custom-1", isCustom: true })] });
    expect(hook.current.customCount).toBe(1);
  });
});

describe("session handling", () => {
  it("never subscribes without a session, and stops loading", () => {
    mockDataUserId = null;
    const { hook } = mountHook();
    expect(mockOnLibraryChange).toBeUndefined();
    expect(hook.current.loading).toBe(false);
    expect(hook.current.exercises).toHaveLength(EXERCISES.length);
  });

  it("refuses to write when there is no session to write to", async () => {
    mockDataUserId = null;
    const { hook } = mountHook();
    await expect(hook.current.createExercise({ name: "X" } as never)).rejects.toThrow(
      "No active session."
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("reads and writes guest data under the guest id", async () => {
    mockDataUserId = GUEST_USER_ID;
    const { hook } = mountHook();
    emit({});
    await act(async () => {
      await hook.current.createExercise({ name: "Sled Push" } as never);
    });
    expect(mockUpdate).toHaveBeenCalledWith(GUEST_USER_ID, expect.anything());
  });

  it("unsubscribes on unmount so a stale account can't keep pushing", () => {
    const { view } = mountHook();
    emit({});
    view.unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe("createExercise", () => {
  it("marks the new exercise custom and gives it a custom- id", async () => {
    const { hook } = mountHook();
    emit({});
    let created: { id: string; isCustom?: boolean } | undefined;
    await act(async () => {
      created = await hook.current.createExercise({ name: "Sled Push" } as never);
    });
    expect(created!.isCustom).toBe(true);
    expect(created!.id).toMatch(/^custom-/);
  });

  it("adds it to the stored library without disturbing what's there", async () => {
    const { hook } = mountHook();
    const existing = makeExercise({ id: "custom-1", isCustom: true });
    emit({ custom: [existing], removedIds: ["bench-press"] });
    await act(async () => {
      await hook.current.createExercise({ name: "Sled Push" } as never);
    });
    const [, written] = mockUpdate.mock.calls[0];
    expect(written.custom).toHaveLength(2);
    expect(written.custom[0]).toEqual(existing);
    expect(written.removedIds).toEqual(["bench-press"]);
  });

  it("refuses once the cap is reached, backstopping the UI's own check", async () => {
    const { hook } = mountHook();
    const full = Array.from({ length: MAX_CUSTOM_EXERCISES }, (_, i) =>
      makeExercise({ id: `custom-${i}`, isCustom: true })
    );
    emit({ custom: full });
    await expect(hook.current.createExercise({ name: "One too many" } as never)).rejects.toThrow(
      "custom exercise limit reached"
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("updateExercise", () => {
  it("edits a custom in place", async () => {
    const { hook } = mountHook();
    const custom = makeExercise({ id: "custom-1", name: "Old", isCustom: true });
    emit({ custom: [custom] });
    await act(async () => {
      await hook.current.updateExercise({ ...custom, name: "New" });
    });
    const [, written] = mockUpdate.mock.calls[0];
    expect(written.custom).toEqual([{ ...custom, name: "New" }]);
    expect(written.overrides).toEqual([]);
  });

  it("stores an edited default as an override instead of touching the bundle", async () => {
    const { hook } = mountHook();
    emit({});
    const original = EXERCISES[0];
    await act(async () => {
      await hook.current.updateExercise({ ...original, name: "Renamed" });
    });
    const [, written] = mockUpdate.mock.calls[0];
    expect(written.overrides).toEqual([{ ...original, name: "Renamed" }]);
    expect(written.custom).toEqual([]);
  });

  it("replaces an existing override rather than stacking another", async () => {
    const { hook } = mountHook();
    const original = EXERCISES[0];
    emit({ overrides: [{ ...original, name: "First" }] });
    await act(async () => {
      await hook.current.updateExercise({ ...original, name: "Second" });
    });
    const [, written] = mockUpdate.mock.calls[0];
    expect(written.overrides).toHaveLength(1);
    expect(written.overrides[0].name).toBe("Second");
  });
});

describe("deleteExercise", () => {
  it("drops a custom outright", async () => {
    const { hook } = mountHook();
    const custom = makeExercise({ id: "custom-1", isCustom: true });
    emit({ custom: [custom] });
    await act(async () => {
      await hook.current.deleteExercise(custom);
    });
    const [, written] = mockUpdate.mock.calls[0];
    expect(written.custom).toEqual([]);
  });

  it("tombstones a default and clears any override it had", async () => {
    const { hook } = mountHook();
    const original = EXERCISES[0];
    emit({ overrides: [{ ...original, name: "Renamed" }] });
    await act(async () => {
      await hook.current.deleteExercise(original);
    });
    const [, written] = mockUpdate.mock.calls[0];
    expect(written.removedIds).toContain(original.id);
    expect(written.overrides).toEqual([]);
  });

  it("does not write again for a default that is already removed", async () => {
    const { hook } = mountHook();
    const original = EXERCISES[0];
    emit({ removedIds: [original.id] });
    await act(async () => {
      await hook.current.deleteExercise(original);
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("resetLibrary", () => {
  it("clears every customisation at once", async () => {
    const { hook } = mountHook();
    emit({
      custom: [makeExercise({ id: "custom-1", isCustom: true })],
      removedIds: ["bench-press"],
      overrides: [{ ...EXERCISES[0], name: "Renamed" }],
    });
    await act(async () => {
      await hook.current.resetLibrary();
    });
    expect(mockUpdate).toHaveBeenCalledWith("user-1", {
      custom: [],
      removedIds: [],
      overrides: [],
    });
  });
});
