import { EXERCISES } from "../exercises";
import {
  FORM_GUIDES,
  exercisesMissingGuides,
  formGuideFor,
  orphanedGuides,
} from "../exercise-form";

/**
 * "Every exercise has instructions" is a claim about 180-odd hand-written
 * entries matching 180-odd hand-written exercises, which is exactly the kind of
 * thing that is true the day it ships and quietly false a month later. The
 * first two tests are the ones that keep it honest: add an exercise without a
 * guide, or rename an id, and they name the offender.
 */

it("has a guide for every bundled exercise", () => {
  expect(exercisesMissingGuides()).toEqual([]);
});

it("has no guide left over from a renamed or deleted exercise", () => {
  expect(orphanedGuides()).toEqual([]);
});

it("covers the whole library, not a lucky subset", () => {
  // Guards the two tests above: both pass vacuously if the library fails to
  // load and every list comes back empty.
  expect(EXERCISES.length).toBeGreaterThan(150);
  expect(Object.keys(FORM_GUIDES)).toHaveLength(EXERCISES.length);
});

it("says something in all three sections of every guide", () => {
  const thin = Object.entries(FORM_GUIDES)
    .filter(
      ([, g]) =>
        g.setup.length === 0 || g.execution.length === 0 || g.watchFor.length === 0
    )
    .map(([id]) => id);

  expect(thin).toEqual([]);
});

it("leaves no placeholder or truncated line behind", () => {
  // Deliberately loose on length. An earlier version of this demanded 15
  // characters and flagged "Core braced." and "Stand tall." — which are not
  // stubs, they are the terse cues a coach actually says. The floor is only
  // there to catch a "TODO" or an empty string; the punctuation rule is what
  // catches a line that got cut off mid-write.
  const suspect = Object.entries(FORM_GUIDES)
    .flatMap(([id, g]) => [...g.setup, ...g.execution, ...g.watchFor].map((line) => [id, line]))
    .filter(([, line]) => line.trim().length < 8 || !/[.?]$/.test(line));

  expect(suspect).toEqual([]);
});

it("hands back nothing for an exercise a user made up themselves", () => {
  // Custom exercises are created at runtime with generated ids, so there can
  // never be a guide — the screen has to cope with that, not blow up.
  expect(formGuideFor("some-custom-id-1234")).toBeUndefined();
});

it("finds the guide for an exercise by id", () => {
  const guide = formGuideFor("bench-press");

  expect(guide?.setup.join(" ")).toContain("shoulder blades");
  expect(guide?.watchFor.join(" ")).toMatch(/elbow|hip/i);
});
