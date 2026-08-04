import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";

import { DefaultSetsProvider, MAX_SETS, MIN_SETS, useDefaultSets } from "../DefaultSetsContext";
import {
  REST_OPTIONS,
  RestTimerProvider,
  nearestRestIndex,
  useRestTimer,
} from "../RestTimerContext";
import { SetTimerProvider, useSetTimer } from "../SetTimerContext";
import { UnitProvider, useWeightUnit } from "../UnitContext";
import { formatClock } from "@/lib/workout-utils";

/**
 * The four device-local preference contexts.
 *
 * Each hydrates from AsyncStorage in an effect, so every test has to let that
 * settle before asserting — an assertion made on the first render is really
 * only testing the hardcoded default.
 */

beforeEach(async () => {
  await AsyncStorage.clear();
});

/** Renders a hook inside its provider and hands back a live view of its value. */
function mountHook<T>(useHook: () => T, Provider: React.ComponentType<{ children: React.ReactNode }>) {
  const box: { current: T | undefined } = { current: undefined };
  function Probe() {
    box.current = useHook();
    return null;
  }
  render(
    <Provider>
      <Probe />
    </Provider>
  );
  return box as { current: T };
}

/** Lets the storage-hydration promise resolve and React apply the result. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("the running rest countdown", () => {
  /**
   * Lifted out of the workout screen so leaving that screen no longer cancels a
   * rest in progress — the same reason the set stopwatch lives above the
   * navigator — and so the Live Activity can draw it on the lock screen.
   */

  it("does nothing while the timer is switched off", async () => {
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    await act(async () => ctx.current.startRest("w1"));
    expect(ctx.current.rest).toBeNull();
  });

  it("sets a deadline the configured distance ahead", async () => {
    await AsyncStorage.setItem("rest_seconds", "90");
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();

    const before = Date.now();
    await act(async () => ctx.current.startRest("w1"));
    expect(ctx.current.rest?.endsAt).toBeGreaterThanOrEqual(before + 90_000);
    expect(ctx.current.rest?.endsAt).toBeLessThanOrEqual(Date.now() + 90_000);
  });

  it("pushes the deadline out for +15s", async () => {
    await AsyncStorage.setItem("rest_seconds", "60");
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    await act(async () => ctx.current.startRest("w1"));

    const first = ctx.current.rest?.endsAt!;
    await act(async () => ctx.current.extendRest(15_000));
    expect(ctx.current.rest?.endsAt).toBe(first + 15_000);
  });

  it("has nothing to extend when no rest is running", async () => {
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    await act(async () => ctx.current.extendRest(15_000));
    expect(ctx.current.rest).toBeNull();
  });

  it("clears on skip", async () => {
    await AsyncStorage.setItem("rest_seconds", "60");
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    await act(async () => ctx.current.startRest("w1"));
    await act(async () => ctx.current.endRest());
    expect(ctx.current.rest).toBeNull();
  });

  it("belongs to the workout that started it", async () => {
    await AsyncStorage.setItem("rest_seconds", "60");
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    await act(async () => ctx.current.startRest("workout-a"));
    expect(ctx.current.rest?.workoutId).toBe("workout-a");
  });

  it("does not follow the user into the next workout", async () => {
    // Rest outlives the workout screen on purpose, which means it also outlives
    // the workout. Without an owner, finishing a session and starting another
    // left the first one's countdown running in the second.
    await AsyncStorage.setItem("rest_seconds", "60");
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    await act(async () => ctx.current.startRest("workout-a"));

    const rest = ctx.current.rest;
    expect(rest?.workoutId).toBe("workout-a");
    // The consumer's own check: a different workout gets nothing from this.
    expect(rest?.workoutId === "workout-b").toBe(false);
  });

  it("hands the countdown over when a new workout starts one", async () => {
    await AsyncStorage.setItem("rest_seconds", "60");
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    await act(async () => ctx.current.startRest("workout-a"));
    await act(async () => ctx.current.startRest("workout-b"));
    expect(ctx.current.rest?.workoutId).toBe("workout-b");
  });

  it("keeps the owner when the deadline is pushed out", async () => {
    await AsyncStorage.setItem("rest_seconds", "60");
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    await act(async () => ctx.current.startRest("workout-a"));
    const before = ctx.current.rest!.endsAt;
    await act(async () => ctx.current.extendRest(15_000));
    expect(ctx.current.rest?.workoutId).toBe("workout-a");
    expect(ctx.current.rest?.endsAt).toBe(before + 15_000);
  });

  it("keeps a deadline that has already passed", async () => {
    // The Live Activity draws its countdown from this and holds at 0:00 once
    // the deadline is behind it. Clearing it on expiry would work only while
    // the app is awake to notice — on a locked phone nothing of ours runs, so
    // the deadline has to be what persists.
    await AsyncStorage.setItem("rest_seconds", "60");
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    await act(async () => ctx.current.startRest("w1"));
    const deadline = ctx.current.rest?.endsAt;

    jest.spyOn(Date, "now").mockReturnValue(deadline! + 60_000);
    await settle();
    expect(ctx.current.rest?.endsAt).toBe(deadline);
    jest.spyOn(Date, "now").mockRestore();
  });

  it("starts a fresh rest over a stale one", async () => {
    await AsyncStorage.setItem("rest_seconds", "60");
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    await act(async () => ctx.current.startRest("w1"));
    const first = ctx.current.rest?.endsAt!;

    jest.spyOn(Date, "now").mockReturnValue(first + 5_000);
    await act(async () => ctx.current.startRest("w1"));
    expect(ctx.current.rest?.endsAt).toBe(first + 5_000 + 60_000);
    jest.spyOn(Date, "now").mockRestore();
  });
});

describe("nearestRestIndex", () => {
  /**
   * Profile drives its rest stepper from this, so it decides which option the
   * − / + buttons move away from. Anything it can't place would strand the
   * stepper at "Off" no matter what the user had actually chosen.
   */

  it.each(REST_OPTIONS.map((o, i): [string, number, number] => [o.label, o.seconds, i]))(
    "places the exact value %s at its own position",
    (_label, seconds, index) => {
      expect(nearestRestIndex(seconds)).toBe(index);
    }
  );

  it("rounds a between-the-stops value to the closer stop", () => {
    // 105s sits between 1:30 and 2:00, nearer the former.
    expect(REST_OPTIONS[nearestRestIndex(105)].label).toBe("1:30");
    expect(REST_OPTIONS[nearestRestIndex(115)].label).toBe("2:00");
  });

  it("clamps past either end rather than falling off", () => {
    expect(REST_OPTIONS[nearestRestIndex(-50)].label).toBe("Off");
    expect(REST_OPTIONS[nearestRestIndex(99_999)].label).toBe("5:00");
  });

  it("keeps a 3:00 preference chosen before 4:00 and 5:00 existed", () => {
    expect(REST_OPTIONS[nearestRestIndex(180)].label).toBe("3:00");
  });

  it("prefers the earlier option when a value sits exactly between two", () => {
    // 45s is equidistant from Off and 1:00. Ties resolving downward is the
    // safer default — it under-rests rather than silently adding a minute.
    expect(REST_OPTIONS[nearestRestIndex(30)].label).toBe("Off");
  });
});

describe("RestTimerContext", () => {
  it("starts off, because the countdown is opt-in", async () => {
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    expect(ctx.current.restSeconds).toBe(0);
  });

  it("restores a previously chosen duration", async () => {
    await AsyncStorage.setItem("rest_seconds", "90");
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    expect(ctx.current.restSeconds).toBe(90);
  });

  it("persists a change so it survives the next launch", async () => {
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    await act(async () => ctx.current.setRestSeconds(120));
    expect(ctx.current.restSeconds).toBe(120);
    expect(await AsyncStorage.getItem("rest_seconds")).toBe("120");
  });

  it("accepts the full 5:00 the picker now offers", async () => {
    // The context has no ceiling of its own, so extending REST_OPTIONS is all
    // that a longer rest needs — no migration for anyone already set to 3:00.
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    await act(async () => ctx.current.setRestSeconds(300));
    expect(ctx.current.restSeconds).toBe(300);
    expect(await AsyncStorage.getItem("rest_seconds")).toBe("300");
  });

  it("keeps a 3:00 preference set before 4:00 and 5:00 existed", async () => {
    await AsyncStorage.setItem("rest_seconds", "180");
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    expect(ctx.current.restSeconds).toBe(180);
  });

  it.each([["nonsense"], ["-30"], ["NaN"]])("falls back to off for stored %s", async (raw) => {
    await AsyncStorage.setItem("rest_seconds", raw);
    const ctx = mountHook(useRestTimer, RestTimerProvider);
    await settle();
    expect(ctx.current.restSeconds).toBe(0);
  });
});

describe("REST_OPTIONS", () => {
  it("runs from off up to five minutes", () => {
    expect(REST_OPTIONS[0].seconds).toBe(0);
    expect(REST_OPTIONS[REST_OPTIONS.length - 1].seconds).toBe(300);
  });

  it("ascends, so the picker reads left to right", () => {
    const seconds = REST_OPTIONS.map((o) => o.seconds);
    expect(seconds).toEqual([...seconds].sort((a, b) => a - b));
  });

  it("offers no duplicate durations", () => {
    const seconds = REST_OPTIONS.map((o) => o.seconds);
    expect(new Set(seconds).size).toBe(seconds.length);
  });

  it("labels every duration the way the app formats clocks elsewhere", () => {
    // "Off" is the one deliberate exception — 0:00 would read as a duration.
    for (const option of REST_OPTIONS.filter((o) => o.seconds > 0)) {
      expect(option.label).toBe(formatClock(option.seconds));
    }
    expect(REST_OPTIONS[0].label).toBe("Off");
  });
});

describe("UnitContext", () => {
  it("defaults to lbs", async () => {
    const ctx = mountHook(useWeightUnit, UnitProvider);
    await settle();
    expect(ctx.current.unit).toBe("lbs");
  });

  it("restores a stored kg preference", async () => {
    await AsyncStorage.setItem("weight_unit", "kg");
    const ctx = mountHook(useWeightUnit, UnitProvider);
    await settle();
    expect(ctx.current.unit).toBe("kg");
  });

  it("ignores a stored value that is not a unit", async () => {
    await AsyncStorage.setItem("weight_unit", "stone");
    const ctx = mountHook(useWeightUnit, UnitProvider);
    await settle();
    expect(ctx.current.unit).toBe("lbs");
  });

  it("persists a switch to kg", async () => {
    const ctx = mountHook(useWeightUnit, UnitProvider);
    await settle();
    await act(async () => ctx.current.setUnit("kg"));
    expect(await AsyncStorage.getItem("weight_unit")).toBe("kg");
  });
});

describe("DefaultSetsContext", () => {
  it("defaults to three sets", async () => {
    const ctx = mountHook(useDefaultSets, DefaultSetsProvider);
    await settle();
    expect(ctx.current.defaultSets).toBe(3);
  });

  it("restores an in-range stored count", async () => {
    await AsyncStorage.setItem("default_sets", "5");
    const ctx = mountHook(useDefaultSets, DefaultSetsProvider);
    await settle();
    expect(ctx.current.defaultSets).toBe(5);
  });

  it.each([["0"], ["99"], ["2.5"], ["junk"]])(
    "refuses stored %s so no one ever gets 0 or 99 sets",
    async (raw) => {
      await AsyncStorage.setItem("default_sets", raw);
      const ctx = mountHook(useDefaultSets, DefaultSetsProvider);
      await settle();
      expect(ctx.current.defaultSets).toBe(3);
    }
  );

  it("clamps a set value into range instead of rejecting it", async () => {
    const ctx = mountHook(useDefaultSets, DefaultSetsProvider);
    await settle();
    await act(async () => ctx.current.setDefaultSets(99));
    expect(ctx.current.defaultSets).toBe(MAX_SETS);
    await act(async () => ctx.current.setDefaultSets(-4));
    expect(ctx.current.defaultSets).toBe(MIN_SETS);
  });

  it("rounds a fractional count", async () => {
    const ctx = mountHook(useDefaultSets, DefaultSetsProvider);
    await settle();
    await act(async () => ctx.current.setDefaultSets(3.6));
    expect(ctx.current.defaultSets).toBe(4);
  });
});

describe("SetTimerContext", () => {
  const timer = { workoutId: "w1", exerciseId: "e1", setId: "s1", startedAt: 1_000 };

  it("starts with nothing running", () => {
    const ctx = mountHook(useSetTimer, SetTimerProvider);
    expect(ctx.current.timer).toBeNull();
  });

  it("holds the running set once started", () => {
    const ctx = mountHook(useSetTimer, SetTimerProvider);
    act(() => ctx.current.startTimer(timer));
    expect(ctx.current.timer).toEqual(timer);
  });

  it("replaces the running one rather than stacking a second", () => {
    // Only one stopwatch at a time — starting another set banks the first.
    const ctx = mountHook(useSetTimer, SetTimerProvider);
    act(() => ctx.current.startTimer(timer));
    const second = { ...timer, setId: "s2", startedAt: 2_000 };
    act(() => ctx.current.startTimer(second));
    expect(ctx.current.timer).toEqual(second);
  });

  it("clears back to nothing running", () => {
    const ctx = mountHook(useSetTimer, SetTimerProvider);
    act(() => ctx.current.startTimer(timer));
    act(() => ctx.current.clearTimer());
    expect(ctx.current.timer).toBeNull();
  });

  it("survives a consumer unmounting, which is why it lives above the navigator", () => {
    // The workout screen unmounts the moment you switch tabs; the timer used to
    // live in its state and died with it.
    const box: { current: ReturnType<typeof useSetTimer> | undefined } = { current: undefined };
    function Probe() {
      box.current = useSetTimer();
      return null;
    }
    function Screen() {
      useSetTimer();
      return <Text>workout</Text>;
    }
    const view = render(
      <SetTimerProvider>
        <Probe />
        <Screen />
      </SetTimerProvider>
    );
    act(() => box.current!.startTimer(timer));

    view.rerender(
      <SetTimerProvider>
        <Probe />
      </SetTimerProvider>
    );

    expect(screen.queryByText("workout")).toBeNull();
    expect(box.current!.timer).toEqual(timer);
  });
});
