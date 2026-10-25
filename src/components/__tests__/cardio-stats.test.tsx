import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { CardioStats } from "../cardio-stats";
import { EXERCISES } from "@/lib/exercises";
import type { Workout, WorkoutSet } from "@/types";

/**
 * The cardio section on Stats. It must not exist for someone who only lifts —
 * an empty "Running" card would be a nag in disguise — and once it does, the
 * number it leads with has to be this week's.
 */

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@/context/UnitContext", () => ({ useWeightUnit: () => ({ unit: "lbs" }) }));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ accent: "#8b5cf6", accentSoft: "rgba(0,0,0,0.1)", accentText: "#c4b5fd" }),
}));

const MILE = 1609.344;

function session(exerciseId: string, daysAgo: number, set: Partial<WorkoutSet>): Workout {
  const when = new Date();
  when.setDate(when.getDate() - daysAgo);
  return {
    id: `${exerciseId}-${daysAgo}`,
    userId: "u1",
    name: exerciseId,
    isTemplate: false,
    createdAt: when,
    completedAt: when,
    exercises: [
      {
        id: "e",
        exerciseId,
        exercise: EXERCISES.find((e) => e.id === exerciseId)!,
        orderIndex: 0,
        sets: [{ id: "s", weightUnit: "lbs", isCompleted: true, ...set }],
      },
    ],
  };
}

it("isn't there for someone who only lifts", () => {
  const bench: Workout = { ...session("running", 0, {}), exercises: [] };
  render(<CardioStats completed={[bench]} />);
  expect(screen.queryByText("Running")).toBeNull();
});

it("leads with this week's distance and lists records", () => {
  render(
    <CardioStats
      completed={[
        session("running", 0, { distance: 2 * MILE, duration: 960, tracked: { healthId: "a", best: { "1mi": 455 } } }),
        session("treadmill", 14, { distance: 6 * MILE, duration: 3000 }),
      ]}
    />
  );
  expect(screen.getByText("Running")).toBeTruthy();
  // This week only — the six miles two weeks back aren't in it.
  expect(screen.getByText("2.00 mi")).toBeTruthy();
  expect(screen.getByText("Mile")).toBeTruthy();
  expect(screen.getByText("7:35")).toBeTruthy();
  expect(screen.getByText("Longest run")).toBeTruthy();
  expect(screen.getByText("6.00 mi")).toBeTruthy();
});

it("keeps walks and runs apart, one at a time", async () => {
  render(
    <CardioStats
      completed={[session("walking", 0, { distance: 3 * MILE, duration: 3600 }), session("running", 1, { distance: MILE, duration: 480 })]}
    />
  );
  // Opens on the most recent: the walk.
  expect(screen.getByText("Walking")).toBeTruthy();
  expect(screen.getByText("Longest walk")).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByText("Run"));
  });
  expect(screen.getByText("Running")).toBeTruthy();
  expect(screen.getByText("Longest run")).toBeTruthy();
});

it("reads out the week whose bar was tapped", async () => {
  render(<CardioStats completed={[session("running", 0, { distance: MILE, duration: 480 }), session("running", 7, { distance: 4 * MILE, duration: 2000 })]} />);
  const bars = screen.getAllByRole("button", { name: /^Week of/ });
  expect(bars).toHaveLength(8);
  expect(screen.getByText(/^this week/)).toBeTruthy();
  await act(async () => {
    fireEvent.press(bars[6]);
  });
  expect(screen.getByText(/^week of .* · 1 run · 33:20$/)).toBeTruthy();
  // The big number, and the longest run among the records.
  expect(screen.getAllByText("4.00 mi")).toHaveLength(2);
});
