import { render, screen } from "@testing-library/react-native";

import { ExerciseProgress } from "../exercise-progress";
import { EXERCISES } from "@/lib/exercises";
import type { Exercise, Workout, WorkoutSet } from "@/types";

/**
 * Bodyweight sets are stored as "bodyweight", with only the added load in the
 * weight field. The lifting card reads lbs and kg, so for pull-ups, push-ups
 * and dips it found nothing and said "No sets logged yet" over any number of
 * sessions — the same mistake timed exercises once had.
 */

let mockCompleted: Workout[] = [];

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@/context/UnitContext", () => ({ useWeightUnit: () => ({ unit: "lbs" }) }));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ accent: "#8b5cf6", accentSoft: "rgba(0,0,0,0.1)", accentText: "#c4b5fd" }),
}));
jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: () => ({ completed: mockCompleted, active: [], loading: false }),
}));

const exercise = (id: string): Exercise => EXERCISES.find((e) => e.id === id)!;

function session(id: string, exerciseId: string, daysAgo: number, sets: Partial<WorkoutSet>[]): Workout {
  const when = new Date();
  when.setDate(when.getDate() - daysAgo);
  return {
    id,
    userId: "u1",
    name: "Session",
    isTemplate: false,
    createdAt: when,
    completedAt: when,
    exercises: [
      {
        id: "e",
        exerciseId,
        exercise: exercise(exerciseId),
        orderIndex: 0,
        sets: sets.map((set, i) => ({ id: `s${i}`, weightUnit: "bodyweight", isCompleted: true, ...set })),
      },
    ],
  };
}

beforeEach(() => {
  mockCompleted = [];
});

it("shows a bodyweight exercise's sets instead of saying none were logged", () => {
  mockCompleted = [
    session("b", "push-up", 1, [{ reps: 20 }, { reps: 18 }]),
    session("a", "push-up", 8, [{ reps: 15 }, { reps: 12 }, { reps: 10 }]),
  ];

  render(<ExerciseProgress exerciseId="push-up" exercise={exercise("push-up")} />);

  expect(screen.queryByText(/No sets logged yet/)).toBeNull();
  // Best set, total reps across both sessions, and how many sessions.
  expect(screen.getByText("Best set")).toBeTruthy();
  expect(screen.getByText("75")).toBeTruthy();
  expect(screen.getByText("2")).toBeTruthy();
  expect(screen.getByText("Most reps · last 2 sessions")).toBeTruthy();
  expect(screen.getByText("2 sets  ·  38 reps  ·  best BW × 20")).toBeTruthy();
});

it("names the load added to the best set", () => {
  mockCompleted = [session("a", "weighted-dips-chest", 1, [{ reps: 8, weight: 25 }, { reps: 8, weight: 45 }, { reps: 6 }])];

  render(<ExerciseProgress exerciseId="weighted-dips-chest" exercise={exercise("weighted-dips-chest")} />);

  // Same reps, so the heavier set is the better one.
  expect(screen.getByText("Best set · BW+45")).toBeTruthy();
});

it("counts sets with no added load, which carry no weight at all", () => {
  // Plain push-ups have no weight; the lifting card skipped them for that too.
  mockCompleted = [session("a", "push-up", 1, [{ reps: 12, weight: undefined }])];

  render(<ExerciseProgress exerciseId="push-up" exercise={exercise("push-up")} />);

  expect(screen.queryByText(/No sets logged yet/)).toBeNull();
  expect(screen.getByText("1 set  ·  12 reps  ·  best BW × 12")).toBeTruthy();
});

it("still says nothing is logged when nothing is", () => {
  mockCompleted = [session("a", "push-up", 1, [{ reps: 12, isCompleted: false }])];

  render(<ExerciseProgress exerciseId="push-up" exercise={exercise("push-up")} />);

  expect(screen.getByText(/No sets logged yet/)).toBeTruthy();
});

it("keeps the lifting card for a lift", () => {
  mockCompleted = [session("a", "bench-press", 1, [{ reps: 5, weight: 225, weightUnit: "lbs" }])];

  render(<ExerciseProgress exerciseId="bench-press" exercise={exercise("bench-press")} />);

  expect(screen.getAllByText("Est. 1RM").length).toBeGreaterThan(0);
  expect(screen.queryByText("Total reps")).toBeNull();
});
