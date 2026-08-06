import { act, renderHook } from "@testing-library/react-native";

import { REVEAL_DELAY_MS, useActiveWorkout } from "../use-active-workout";
import type { Workout } from "@/types";

/**
 * The delay is the whole point of this hook, and it is easy to mistake for
 * caution. It isn't: starting a workout pushes the workout screen, and that
 * push takes an animation to cover the tabs — a bar that appeared immediately
 * would slide in behind the arriving screen in full view. The Workouts list
 * already holds its new row back for the same window, for the same reason.
 *
 * It only ever applies to a workout that has just become live. Everything else
 * has to come through at once, because by then the bar is what the user is
 * looking at.
 */

let mockActive: Workout[] = [];

jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: () => ({ active: mockActive }),
}));

function workout(id: string, startedAt: Date, name = id): Workout {
  return {
    id,
    userId: "u1",
    name,
    isTemplate: false,
    createdAt: startedAt,
    startedAt,
    exercises: [],
  };
}

const NOW = new Date(2026, 7, 4, 18, 0, 0);

beforeEach(() => {
  mockActive = [];
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

const settle = () => act(() => jest.advanceTimersByTime(REVEAL_DELAY_MS));

it("offers nothing while there is no workout in progress", () => {
  const { result } = renderHook(() => useActiveWorkout());

  settle();

  expect(result.current).toBeNull();
});

it("holds a freshly started workout back until the push has covered the tabs", () => {
  mockActive = [workout("w1", NOW)];
  const { result } = renderHook(() => useActiveWorkout());

  expect(result.current).toBeNull();
  act(() => jest.advanceTimersByTime(REVEAL_DELAY_MS - 1));
  expect(result.current).toBeNull();

  act(() => jest.advanceTimersByTime(1));
  expect(result.current?.id).toBe("w1");
});

it("follows the most recently started of several live workouts", () => {
  mockActive = [
    workout("older", new Date(NOW.getTime() - 60 * 60_000)),
    workout("newest", NOW),
    workout("middle", new Date(NOW.getTime() - 10 * 60_000)),
  ];
  const { result } = renderHook(() => useActiveWorkout());

  settle();

  expect(result.current?.id).toBe("newest");
});

it("passes on edits to the workout it is already showing without a second delay", () => {
  mockActive = [workout("w1", NOW, "Push Day")];
  const { result, rerender } = renderHook(() => useActiveWorkout());
  settle();

  mockActive = [workout("w1", NOW, "Pull Day")];
  act(() => rerender({}));

  // Same id, so nothing was starting and there is no animation to hide behind.
  expect(result.current?.name).toBe("Pull Day");
});

it("drops the workout the moment it stops being live", () => {
  mockActive = [workout("w1", NOW)];
  const { result, rerender } = renderHook(() => useActiveWorkout());
  settle();
  expect(result.current?.id).toBe("w1");

  // Finished, so it is no longer in `active` at all.
  mockActive = [];
  act(() => rerender({}));

  expect(result.current).toBeNull();
});

it("holds a resumed workout back again rather than trusting a stale reveal", () => {
  mockActive = [workout("w1", NOW)];
  const { result, rerender } = renderHook(() => useActiveWorkout());
  settle();

  mockActive = [];
  act(() => rerender({}));

  // The same id comes back when a finished workout is reopened. A reveal
  // remembered from before it finished would match it and skip the delay.
  mockActive = [workout("w1", NOW)];
  act(() => rerender({}));
  expect(result.current).toBeNull();

  settle();
  expect(result.current?.id).toBe("w1");
});

it("re-delays when a second workout takes over as the live one", () => {
  mockActive = [workout("w1", NOW)];
  const { result, rerender } = renderHook(() => useActiveWorkout());
  settle();

  // Starting another navigates into it, so the same animation has to be covered.
  mockActive = [workout("w1", NOW), workout("w2", new Date(NOW.getTime() + 1000))];
  act(() => rerender({}));
  expect(result.current).toBeNull();

  settle();
  expect(result.current?.id).toBe("w2");
});
