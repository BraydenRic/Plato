import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";

import { markCurrentWorkout, useCurrentWorkoutId } from "../current-workout";
import { leadWorkout } from "../workout-utils";
import type { Workout } from "@/types";

/**
 * With two workouts running, picking the other one from the resume bar opened
 * it but left the bar leading with the first. The bar (and the Live Activity)
 * now lead with the live workout you last opened.
 */

const live = (id: string, minutesAgo: number): Workout => ({
  id,
  userId: "u1",
  name: id,
  isTemplate: false,
  exercises: [],
  createdAt: new Date(),
  startedAt: new Date(Date.now() - minutesAgo * 60_000),
});

describe("leadWorkout", () => {
  const push = live("push", 60);
  const legs = live("legs", 5);

  it("leads with the one you last opened, even when another started later", () => {
    expect(leadWorkout([push, legs], "push")?.id).toBe("push");
  });

  it("falls back to the newest once the one you opened isn't live any more", () => {
    expect(leadWorkout([push, legs], "finished-yesterday")?.id).toBe("legs");
    expect(leadWorkout([push, legs], null)?.id).toBe("legs");
  });
});

describe("the current workout", () => {
  it("follows whichever live workout was opened", () => {
    const { result } = renderHook(() => useCurrentWorkoutId());

    act(() => markCurrentWorkout("legs"));

    expect(result.current).toBe("legs");
  });

  it("comes back after the app is closed", async () => {
    await AsyncStorage.clear();
    markCurrentWorkout("push");
    await act(async () => {});

    // A fresh process: new module state, same disk.
    jest.resetModules();
    const relaunched = require("../current-workout") as typeof import("../current-workout"); // eslint-disable-line @typescript-eslint/no-require-imports
    await act(async () => {});

    expect(relaunched.readCurrentWorkoutId()).toBe("push");
  });
});
