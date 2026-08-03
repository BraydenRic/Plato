import { THEMES } from "@/constants/theme";
import type { Workout } from "@/types";

/**
 * What the Live Activity is told to draw.
 *
 * None of this can be checked by looking at the app — it renders in a widget
 * process, on a lock screen, during a workout. And the two failure modes are
 * quiet ones: a progress bar that shows the wrong timer looks perfectly normal,
 * and a subtitle that never says "Resting" just leaves two identical-looking
 * bars with no way to tell which is which.
 */

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "standalone" },
  ExecutionEnvironment: { StoreClient: "storeClient", Standalone: "standalone" },
}));

type ActivityState = { subtitle: string; progressBar: Record<string, unknown>; imageName: string };
type ActivityConfig = { progressViewTint: string };

const mockStartActivity = jest.fn((_state: ActivityState, _config: ActivityConfig) => "activity-1");
const mockUpdateActivity = jest.fn((_id: string, _state: ActivityState) => {});
const mockStopActivity = jest.fn((_id: string, _state: ActivityState) => {});

jest.mock("expo-live-activity", () => ({
  startActivity: (state: ActivityState, config: ActivityConfig) => mockStartActivity(state, config),
  updateActivity: (id: string, state: ActivityState) => mockUpdateActivity(id, state),
  stopActivity: (id: string, state: ActivityState) => mockStopActivity(id, state),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const activity = require("../live-activity") as typeof import("../live-activity");

const STARTED = new Date("2026-08-03T10:00:00Z");
const workout = {
  id: "w1",
  name: "Push Day",
  startedAt: STARTED,
  createdAt: STARTED,
  exercises: [],
} as unknown as Workout;

beforeEach(() => jest.clearAllMocks());

function startedState(restEndsAt: number | null) {
  activity.startWorkoutActivity(workout, 3, 12, THEMES.violet, restEndsAt);
  return mockStartActivity.mock.calls[0][0];
}

describe("while no rest is running", () => {
  it("counts the workout up from when it started", () => {
    const state = startedState(null);
    expect(state.progressBar).toEqual({ elapsedTimer: { startDate: STARTED.getTime() } });
  });

  it("shows the set count on its own", () => {
    expect(startedState(null).subtitle).toBe("3/12 sets");
  });
});

describe("while resting", () => {
  it("carries both timers, so the workout clock keeps running", () => {
    const deadline = Date.now() + 90_000;
    // The published types call these mutually exclusive; the native side reads
    // them from separate fields, and the patched widget view draws both. If
    // this ever collapses back to one, the workout timer disappears for the
    // length of every rest.
    expect(startedState(deadline).progressBar).toEqual({
      elapsedTimer: { startDate: STARTED.getTime() },
      date: deadline,
    });
  });

  it("leaves the countdown out entirely when not resting", () => {
    // Not `date: undefined` — the widget branches on the key being present.
    expect(startedState(null).progressBar).not.toHaveProperty("date");
  });

  it("says it is resting, since both bars look the same", () => {
    expect(startedState(Date.now() + 90_000).subtitle).toBe("Resting · 3/12 sets");
  });

  it("reads the same after the deadline as before it", () => {
    // No text swap at zero on purpose: it would need a push at that exact
    // moment, which a locked phone can't send. The bar holding at 0:00 is what
    // says rest is over, and it does that natively.
    expect(startedState(Date.now() - 1_000).subtitle).toBe("Resting · 3/12 sets");
  });
});

describe("updates", () => {
  it("carry the rest countdown too, not just the start", () => {
    const deadline = Date.now() + 45_000;
    activity.updateWorkoutActivity("activity-1", workout, 5, 12, THEMES.violet, deadline);
    const [, state] = mockUpdateActivity.mock.calls[0];
    expect(state.progressBar).toEqual({
      elapsedTimer: { startDate: STARTED.getTime() },
      date: deadline,
    });
  });
});

describe("the themed logo", () => {
  it("names the image for the active theme", () => {
    expect(startedState(null).imageName).toBe("plato-logo-violet");
    jest.clearAllMocks();
    activity.startWorkoutActivity(workout, 3, 12, THEMES.crimson, null);
    expect(mockStartActivity.mock.calls[0][0].imageName).toBe("plato-logo-crimson");
  });

  it("tints the progress bar from the theme, and only at start", () => {
    activity.startWorkoutActivity(workout, 3, 12, THEMES.crimson, null);
    const [, config] = mockStartActivity.mock.calls[0];
    expect(config.progressViewTint).toBe(THEMES.crimson.activityTint);

    // updateActivity takes state only — iOS freezes an activity's style at
    // start, which is why the bar keeps the old theme until the next workout.
    activity.updateWorkoutActivity("activity-1", workout, 3, 12, THEMES.crimson, null);
    expect(mockUpdateActivity.mock.calls[0]).toHaveLength(2);
  });
});
