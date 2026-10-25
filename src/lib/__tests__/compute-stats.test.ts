import { computeStats } from "../firestore";
import type { Workout } from "@/types";

jest.mock("../firebase", () => ({ db: {}, auth: {} }));
jest.mock("firebase/firestore", () => ({ Timestamp: class Timestamp {} }));
jest.mock("firebase/auth", () => ({ onAuthStateChanged: jest.fn() }));

/**
 * A plan for a later day can be logged ahead ("Log workout" on any off-day
 * plan), and finishing it stamps noon on that day. That day hasn't happened,
 * so it can't be part of a streak — at the head of one it broke the run that
 * actually reaches today — or be the last workout plato-web shows.
 */

const NOW = new Date(2026, 9, 25, 18, 0);

function finishedOn(daysFromToday: number, hour = 12): Workout {
  const when = new Date(NOW);
  when.setDate(when.getDate() + daysFromToday);
  when.setHours(hour, 0, 0, 0);
  return {
    id: `w${daysFromToday}`,
    userId: "u1",
    name: "Session",
    isTemplate: false,
    createdAt: when,
    completedAt: when,
    exercises: [],
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

it("counts yesterday and today as a streak of two", () => {
  expect(computeStats([finishedOn(0), finishedOn(-1)]).currentStreak).toBe(2);
});

it("doesn't let a plan logged for a later day break the streak that reaches today", () => {
  const stats = computeStats([finishedOn(3), finishedOn(0), finishedOn(-1)]);

  expect(stats.currentStreak).toBe(2);
  expect(stats.longestStreak).toBe(2);
});

it("doesn't let one logged for tomorrow stretch the streak either", () => {
  expect(computeStats([finishedOn(1), finishedOn(0)]).currentStreak).toBe(1);
});

it("still counts the plan's work in the totals", () => {
  expect(computeStats([finishedOn(3), finishedOn(0)]).totalCompletedWorkouts).toBe(2);
});

it("names the last workout that has happened, not the one planned ahead", () => {
  const today = finishedOn(0, 7);

  expect(computeStats([finishedOn(3), today]).lastWorkoutDate).toEqual(today.completedAt);
});

it("keeps a workout finished later today as the last one", () => {
  // Today's off-day plans are stamped noon too, and noon can be after now.
  const tonight = finishedOn(0, 23);

  expect(computeStats([tonight, finishedOn(-1)]).lastWorkoutDate).toEqual(tonight.completedAt);
});
