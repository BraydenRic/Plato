import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from "@/types";

/**
 * Builders for test fixtures. Domain objects here are wide enough that inline
 * literals bury the one field a test actually cares about, so each builder
 * fills in a plausible default and takes an override patch.
 */

export function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: `set-${Math.random().toString(36).slice(2, 8)}`,
    weight: 100,
    reps: 10,
    weightUnit: "lbs",
    isCompleted: true,
    ...overrides,
  };
}

/** A set that exists on the row but was never filled in — the "skipped" case. */
export function emptySet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: `set-${Math.random().toString(36).slice(2, 8)}`,
    weightUnit: "lbs",
    isCompleted: false,
    ...overrides,
  };
}

export function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "bench-press",
    name: "Bench Press",
    category: "Chest",
    musclesWorked: ["Chest", "Triceps"],
    description: "Press it.",
    ...overrides,
  };
}

export function makeWorkoutExercise(
  exerciseId: string,
  sets: WorkoutSet[],
  overrides: Partial<WorkoutExercise> = {}
): WorkoutExercise {
  return {
    id: `we-${exerciseId}-${Math.random().toString(36).slice(2, 8)}`,
    exerciseId,
    exercise: makeExercise({ id: exerciseId }),
    orderIndex: 0,
    sets,
    ...overrides,
  };
}

export function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: `w-${Math.random().toString(36).slice(2, 8)}`,
    userId: "user-1",
    name: "Push Day",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    isTemplate: false,
    exercises: [],
    ...overrides,
  };
}

/** Days before "now", as a Date — keeps history fixtures readable. */
export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
