import { EXERCISES, MUSCLE_GROUPS, filterExercises, isTimedExercise } from "../exercises";
import { makeExercise } from "./factories";

describe("filterExercises", () => {
  const library = [
    makeExercise({ id: "bench-press", name: "Bench Press", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"] }),
    makeExercise({ id: "shoulder-press", name: "Shoulder Press", category: "Shoulders", musclesWorked: ["Shoulders"] }),
    makeExercise({ id: "lateral-raise", name: "Lateral Raise", category: "Shoulders", musclesWorked: ["Side Delts"] }),
    makeExercise({ id: "squat", name: "Barbell Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"] }),
  ];

  it("returns everything when no term and no category are set", () => {
    expect(filterExercises(library, "", "All")).toHaveLength(4);
  });

  // The regression this filter exists for: "shoulder" used to also match the
  // musclesWorked list, burying Shoulder Press under every press and dip that
  // lists shoulders as a secondary mover.
  it("matches the name only, never the muscles worked", () => {
    const names = filterExercises(library, "shoulder", "All").map((e) => e.name);
    expect(names).toEqual(["Shoulder Press"]);
    expect(names).not.toContain("Bench Press");
  });

  it("does not match against the description either", () => {
    const withTell = [makeExercise({ id: "x", name: "Cable Row", description: "Great for shoulder health." })];
    expect(filterExercises(withTell, "shoulder", "All")).toHaveLength(0);
  });

  it("is case-insensitive", () => {
    expect(filterExercises(library, "BENCH", "All")).toHaveLength(1);
    expect(filterExercises(library, "bench", "All")).toHaveLength(1);
  });

  it("ignores surrounding whitespace", () => {
    expect(filterExercises(library, "  squat  ", "All")).toHaveLength(1);
  });

  it("matches on a substring anywhere in the name", () => {
    expect(filterExercises(library, "press", "All").map((e) => e.name)).toEqual([
      "Bench Press",
      "Shoulder Press",
    ]);
  });

  it("filters by category alone", () => {
    expect(filterExercises(library, "", "Shoulders").map((e) => e.name)).toEqual([
      "Shoulder Press",
      "Lateral Raise",
    ]);
  });

  it("applies category and term together", () => {
    expect(filterExercises(library, "raise", "Shoulders").map((e) => e.name)).toEqual(["Lateral Raise"]);
    expect(filterExercises(library, "raise", "Chest")).toHaveLength(0);
  });

  it("returns nothing when the term matches no name", () => {
    expect(filterExercises(library, "zercher", "All")).toHaveLength(0);
  });

  it("holds against the real bundled library", () => {
    const names = filterExercises(EXERCISES, "shoulder", "All").map((e) => e.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => n.toLowerCase().includes("shoulder"))).toBe(true);
    expect(names).not.toContain("Bench Press");
  });
});

describe("isTimedExercise", () => {
  it("respects an explicit isTimed flag over anything else", () => {
    expect(isTimedExercise(makeExercise({ id: "bench-press", category: "Chest", isTimed: true }))).toBe(true);
    expect(isTimedExercise(makeExercise({ id: "plank", category: "Cardio", isTimed: false }))).toBe(false);
  });

  it("treats all cardio as timed", () => {
    expect(isTimedExercise(makeExercise({ id: "treadmill", category: "Cardio" }))).toBe(true);
  });

  it("treats the bundled holds as timed", () => {
    expect(isTimedExercise(makeExercise({ id: "plank", category: "Core" }))).toBe(true);
    expect(isTimedExercise(makeExercise({ id: "dead-hang", category: "Back" }))).toBe(true);
  });

  it("treats an ordinary lift as weight × reps", () => {
    expect(isTimedExercise(makeExercise({ id: "bench-press", category: "Chest" }))).toBe(false);
  });
});

/**
 * Nobody types an exercise the way the library spells it. "Pull ups" found
 * nothing, because the library says "Pull-Up" and one substring test over the
 * whole name can't see past the hyphen or the plural.
 *
 * Run against the real bundled library rather than a fixture: the point is that
 * what people actually type finds what's actually shipped.
 */
describe("searching the way people type", () => {
  const found = (term: string) => filterExercises(EXERCISES, term, "All").map((e) => e.name);

  it.each([
    ["pull ups", "Pull-Up"],
    ["pullups", "Pull-Up"],
    ["Pull-Ups", "Pull-Up"],
    ["pull up", "Pull-Up"],
    ["PULL UPS", "Pull-Up"],
    ["push ups", "Push-Up"],
    ["dips", "Chest Dips"],
    // Written on the machine as "4-Way Neck", typed every which way.
    ["4 way neck", "4-Way Neck Extension"],
    ["4-way", "4-Way Neck Extension"],
    ["4way neck", "4-Way Neck Extension"],
    ["4wayneck", "4-Way Neck Extension"],
  ])("%p finds %p", (term, expected) => {
    expect(found(term)).toContain(expected);
  });

  it("still matches inside a word", () => {
    expect(found("cline")).toContain("Incline Bench Press");
  });

  it("ignores the order the words are typed in", () => {
    expect(found("press bench")).toContain("Bench Press");
  });

  it("doesn't match across the gap between two words", () => {
    // Squash the name to one string and "abs" reaches through "cable" into
    // "row". Word-by-word, it can't.
    expect(found("abs")).not.toContain("Cable Row");
  });

  it("doesn't let a one-letter name word swallow every search", () => {
    // T-Bar Row's "T" is a prefix of any word starting with t.
    expect(found("tricep")).not.toContain("T-Bar Row");
    // Nor the 4 in 4-Way: a 4 has to be followed by the rest of the name.
    expect(found("45 degree")).not.toContain("4-Way Neck Extension");
  });

  it("still finds nothing for a real misspelling", () => {
    // A dropped letter survives, since "pul" is inside "pull" — but a wrong
    // one doesn't, and that's the line edit-distance matching would cross.
    expect(found("pul up")).toContain("Pull-Up");
    expect(found("benhc press")).toHaveLength(0);
  });

  it("finds neck work the way it's usually asked for", () => {
    expect(found("neck")).toEqual(
      expect.arrayContaining(["Plate Neck Flexion", "Neck Harness Extension", "4-Way Neck Extension"])
    );
  });
});

describe("the bundled library", () => {
  // Workouts store the exercise id forever, so two entries sharing one would
  // quietly merge their histories and last-weight lookups.
  it("never gives two exercises the same id", () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("offers a category chip for every category it uses, and none it doesn't", () => {
    const used = [...new Set(EXERCISES.map((e) => e.category))];
    expect(MUSCLE_GROUPS.filter((g) => g !== "All").sort()).toEqual(used.sort());
  });

  it("files every neck exercise under the Neck chip", () => {
    const neck = filterExercises(EXERCISES, "", "Neck");
    expect(neck.length).toBeGreaterThanOrEqual(8);
    expect(neck.every((e) => e.musclesWorked[0] === "Neck")).toBe(true);
  });

  it("logs the holds by stopwatch rather than weight × reps", () => {
    const holds = ["wall-sit", "copenhagen-plank", "l-sit", "neck-isometric-hold", "suitcase-carry"];
    const untimed = holds.filter((id) => {
      const exercise = EXERCISES.find((e) => e.id === id);
      return !exercise || !isTimedExercise(exercise);
    });
    expect(untimed).toEqual([]);
  });
});
