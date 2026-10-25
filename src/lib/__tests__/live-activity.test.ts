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

/**
 * The Apple Watch showed a blank square for the logo: the 512px images are far
 * bigger than its Smart Stack slot, which then draws nothing. It gets its own
 * small copy, sent alongside the main one.
 */
describe("on the Apple Watch", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path");
  const dir = path.join(__dirname, "..", "..", "..", "assets", "liveActivity");

  it("has a small logo on disk for every theme, small enough for the watch", () => {
    for (const theme of Object.values(THEMES)) {
      const file = path.join(dir, `${activity.watchImage(theme)}.png`);
      expect(fs.existsSync(file)).toBe(true);
      // PNG width and height live at bytes 16–24 of the header.
      const header = fs.readFileSync(file).subarray(16, 24);
      expect([header.readUInt32BE(0), header.readUInt32BE(4)]).toEqual([48, 48]);
    }
  });

  it("sends the small logo when the activity starts, updates and ends", () => {
    activity.startWorkoutActivity(workout, 3, 12, THEMES.cobalt, null);
    activity.updateWorkoutActivity("activity-1", workout, 4, 12, THEMES.cobalt, null);
    activity.stopWorkoutActivity("activity-1", "Workout finished", THEMES.cobalt);

    const small = "plato-logo-cobalt-small";
    expect((mockStartActivity.mock.calls[0][0] as Record<string, unknown>).smallImageName).toBe(small);
    expect((mockUpdateActivity.mock.calls[0][1] as Record<string, unknown>).smallImageName).toBe(small);
    expect((mockStopActivity.mock.calls[0][1] as Record<string, unknown>).smallImageName).toBe(small);
  });

  it("draws it at the watch's size, not the lock screen's", () => {
    activity.startWorkoutActivity(workout, 3, 12, THEMES.violet, null);
    expect(mockStartActivity.mock.calls[0][1]).toEqual(
      expect.objectContaining({ smallImageSize: { width: 24, height: 24 } })
    );
  });
});

/**
 * A run is stored as one exercise holding one set that stays incomplete until
 * End, so the lifting state read "0/1 sets" on every run — and its clock
 * counted straight through pauses, running ahead of the session screen.
 */
describe("a cardio session", () => {
  const run = {
    ...workout,
    name: "Outdoor Run",
    cardio: { kind: "run" },
    exercises: [{ id: "e1", exerciseId: "running", sets: [{ id: "s1", isCompleted: false }] }],
  } as unknown as Workout;

  it("has no set count", () => {
    activity.startWorkoutActivity(run, 0, 1, THEMES.violet, null);
    const state = mockStartActivity.mock.calls[0][0];
    expect(state).not.toHaveProperty("subtitle");
    expect(JSON.stringify(state)).not.toMatch(/sets/);
  });

  it("counts moving time, leaving out the pauses that are over", () => {
    const afterAPause = { ...run, cardio: { kind: "run", pausedSeconds: 300 } } as unknown as Workout;
    activity.updateWorkoutActivity("activity-1", afterAPause, 0, 1, THEMES.violet, null);
    const [, state] = mockUpdateActivity.mock.calls[0];
    expect(state.progressBar).toEqual({ elapsedTimer: { startDate: STARTED.getTime() + 300_000 } });
  });

  it("stops counting while paused, and says where it stopped", () => {
    // 20 minutes in, with 5 of them already spent paused at a light.
    const pausedAtMs = STARTED.getTime() + 20 * 60_000;
    const paused = {
      ...run,
      cardio: { kind: "run", pausedSeconds: 300, pausedAtMs },
    } as unknown as Workout;
    activity.updateWorkoutActivity("activity-1", paused, 0, 1, THEMES.violet, null);
    const [, state] = mockUpdateActivity.mock.calls[0];
    // A native timer can't be frozen, so there is none to keep ticking.
    expect(state).not.toHaveProperty("progressBar");
    expect(state.subtitle).toBe("Paused · 15:00");
  });
});

/**
 * ActivityKit caps an activity at about 4 KB, and the name is the part a user
 * controls. Over it, a start is refused and — worse — an update is dropped
 * while JS is told it worked, freezing the pill.
 */
describe("a very long workout name", () => {
  const essay = "Leg day ".repeat(600);
  const titleOf = (state: unknown) => (state as { title: string }).title;

  it("is cut to one line's worth with an ellipsis", () => {
    activity.startWorkoutActivity({ ...workout, name: essay }, 3, 12, THEMES.violet, null);
    const title = titleOf(mockStartActivity.mock.calls[0][0]);
    expect(Array.from(title)).toHaveLength(100);
    expect(title.endsWith("…")).toBe(true);
    expect(essay.startsWith(title.slice(0, -1))).toBe(true);
  });

  it("is cut on updates too", () => {
    activity.updateWorkoutActivity("activity-1", { ...workout, name: essay }, 3, 12, THEMES.violet, null);
    expect(titleOf(mockUpdateActivity.mock.calls[0][1]).length).toBeLessThanOrEqual(100);
  });

  it("never splits an emoji in half", () => {
    const title = activity.activityTitle("💪".repeat(150));
    // Every character left is a whole emoji or the ellipsis, not half a pair.
    expect(Array.from(title).every((char) => char === "💪" || char === "…")).toBe(true);
  });

  it("leaves an ordinary name alone", () => {
    expect(activity.activityTitle("Push Day")).toBe("Push Day");
  });
});
