import { Timestamp } from "firebase/firestore";

import { workoutFromDoc } from "../firestore";

jest.mock("../firebase", () => ({ db: {}, auth: {} }));
// Reading a doc only ever touches Timestamp. This one does what the real one
// does for the reader: holds a moment, and hands it back as a Date.
jest.mock("firebase/firestore", () => ({
  Timestamp: class Timestamp {
    millis: number;
    constructor(millis: number) {
      this.millis = millis;
    }
    toDate() {
      return new Date(this.millis);
    }
  },
}));
jest.mock("firebase/auth", () => ({ onAuthStateChanged: jest.fn() }));

/**
 * Every date Firestore hands back is a Timestamp, including the completedAt on
 * each set. Only the top-level ones were converted, so a set finished before
 * this launch held a Timestamp in memory, and the watch's edit to it called
 * getTime(), threw, and was dropped after its retries.
 */

const at = (iso: string) => new (Timestamp as unknown as new (ms: number) => Timestamp)(Date.parse(iso));

function readBack(sets: Record<string, unknown>[]) {
  return workoutFromDoc("w1", {
    userId: "u1",
    name: "Push",
    isTemplate: false,
    createdAt: at("2026-10-25T10:00:00Z"),
    exercises: [
      {
        id: "e1",
        exerciseId: "bench-press",
        exercise: { id: "bench-press", name: "Bench Press", category: "Chest", musclesWorked: [], description: "" },
        orderIndex: 0,
        sets,
      },
    ],
  });
}

it("turns a set's completedAt into a Date", () => {
  const workout = readBack([
    { id: "s1", reps: 5, weight: 225, weightUnit: "lbs", isCompleted: true, completedAt: at("2026-10-25T10:05:00Z") },
  ]);

  const completedAt = workout.exercises[0].sets[0].completedAt;
  expect(completedAt).toBeInstanceOf(Date);
  expect(completedAt?.getTime()).toBe(Date.parse("2026-10-25T10:05:00Z"));
});

it("leaves a set that was never finished without one", () => {
  const workout = readBack([{ id: "s1", weightUnit: "lbs", isCompleted: false }]);

  expect(workout.exercises[0].sets[0]).not.toHaveProperty("completedAt");
});

it("keeps everything else on the set as it was", () => {
  const workout = readBack([
    { id: "s1", reps: 8, weight: 25, weightUnit: "bodyweight", isCompleted: true, completedAt: at("2026-10-25T10:05:00Z") },
  ]);

  expect(workout.exercises[0].sets[0]).toMatchObject({ id: "s1", reps: 8, weight: 25, weightUnit: "bodyweight", isCompleted: true });
});
