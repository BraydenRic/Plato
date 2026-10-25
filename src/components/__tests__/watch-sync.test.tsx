import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";

import { APPLIED_KEY, RETRY_MS, START_TTL_MS, WatchSync } from "../watch-sync";
import { recordCardioDiscard, resetCardioDiscards } from "@/lib/cardio-discards";
import type { Workout } from "@/types";

/**
 * The phone's side of the watch link, with the native bridge faked.
 *
 * What matters is what reaches the data layer: a set logged on the watch must
 * land exactly once, on the right workout, only once the right account is
 * loaded — and the watch must hear back which of its changes have landed, or
 * it keeps showing its own copy forever.
 */

type Entry = { id: string; json: string };

// Built inside the factory: jest.mock runs before this file's own top-level
// code, so the fake can't refer to anything declared out here.
type FakeBridge = {
  inbox: Entry[];
  sent: string[];
  listener: null | (() => void);
  liveListener: null | ((event: { json: string }) => void);
  updateContext: jest.Mock;
  takeInbox: jest.Mock;
  ackInbox: jest.Mock;
  addListener: jest.Mock;
};

jest.mock("../../../modules/plato-watch", () => {
  const bridge: FakeBridge = {
    inbox: [],
    sent: [],
    listener: null,
    liveListener: null,
    updateContext: jest.fn((json: string) => {
      bridge.sent.push(json);
    }),
    takeInbox: jest.fn((): Entry[] => [...bridge.inbox]),
    ackInbox: jest.fn((ids: string[]) => {
      bridge.inbox = bridge.inbox.filter((e: Entry) => !ids.includes(e.id));
    }),
    // One listener per event: the inbox's and the live readings'.
    addListener: jest.fn((event: string, listener: () => void) => {
      if (event === "onLive") {
        bridge.liveListener = listener;
        return { remove: () => (bridge.liveListener = null) };
      }
      bridge.listener = listener;
      return { remove: () => (bridge.listener = null) };
    }),
  };
  return { __esModule: true, default: bridge };
});

const mockBridge: FakeBridge = jest.requireMock("../../../modules/plato-watch").default;

let mockAuth = { dataUserId: "u1" as string | null, loading: false };
jest.mock("@/context/AuthContext", () => ({ useAuth: () => mockAuth }));

let mockWorkouts = { active: [] as Workout[], templates: [] as Workout[], completed: [] as Workout[], loading: false };
jest.mock("@/hooks/use-workouts", () => ({ useWorkouts: () => mockWorkouts }));

const mockMarkCurrent = jest.fn();
jest.mock("@/lib/current-workout", () => ({
  useCurrentWorkoutId: () => null,
  markCurrentWorkout: (id: string) => mockMarkCurrent(id),
}));

let mockSettingsLoaded = true;
jest.mock("@/context/UnitContext", () => ({ useWeightUnit: () => ({ unit: "lbs", loaded: mockSettingsLoaded }) }));

const mockStartRest = jest.fn();
const mockExtendRest = jest.fn();
const mockEndRest = jest.fn();
let mockRest: { workoutId: string; endsAt: number } | null = null;
jest.mock("@/context/RestTimerContext", () => ({
  useRestTimer: () => ({
    restSeconds: 90,
    rest: mockRest,
    startRest: mockStartRest,
    extendRest: mockExtendRest,
    endRest: mockEndRest,
    loaded: mockSettingsLoaded,
  }),
}));

jest.mock("@/context/SetTimerContext", () => ({ useSetTimer: () => ({ timer: null, clearTimer: jest.fn() }) }));
jest.mock("@/context/ThemeContext", () => ({ useThemePicker: () => ({ themeId: "violet" }) }));
jest.mock("@/lib/bodyweight-cache", () => ({ readCachedBodyweight: async () => [] }));

const mockStore = new Map<string, Workout>();
const mockUpdateWorkout = jest.fn(async (id: string, updates: Partial<Workout>) => {
  const current = mockStore.get(id);
  if (current) mockStore.set(id, { ...current, ...updates });
});
const mockStartFromTemplate = jest.fn((_t: Workout, _u: string) => ({ id: "w-new", saved: Promise.resolve() }));
let mockCreated = 0;
const mockCreate = jest.fn((w: Omit<Workout, "id">) => {
  const id = `created-${++mockCreated}`;
  mockStore.set(id, { ...w, id } as Workout);
  return { id, saved: Promise.resolve() };
});
const mockSetLive = jest.fn();
jest.mock("@/lib/watch-live", () => ({ setWatchLive: (live: unknown) => mockSetLive(live) }));
const mockUpsertStats = jest.fn(async () => {});
let mockAwaitingSync = false;
// The real stripUndefined lives beside the Firestore SDK, which Jest can't load.
function mockStrip(value: unknown): unknown {
  if (value === null || typeof value !== "object" || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(mockStrip);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, mockStrip(v)])
  );
}
jest.mock("@/lib/data", () => {
  return {
    computeStats: () => ({ totalCompletedWorkouts: 1 }),
    stripUndefined: (value: unknown) => mockStrip(value),
    getWorkout: async (id: string) => mockStore.get(id) ?? null,
    updateWorkout: (id: string, updates: Partial<Workout>) => mockUpdateWorkout(id, updates),
    startFromTemplate: (t: Workout, u: string) => mockStartFromTemplate(t, u),
    createWorkoutLocalFirst: (w: Omit<Workout, "id">) => mockCreate(w),
    getCompletedWorkouts: async () => [...mockStore.values()].filter((w) => w.completedAt),
    upsertUserStats: () => mockUpsertStats(),
    getBodyweightLog: async () => [],
    awaitingFirstSync: () => mockAwaitingSync,
  };
});

const START = new Date(Date.UTC(2026, 9, 23, 18, 0, 0));

function live(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "w1",
    userId: "u1",
    name: "Push Day",
    isTemplate: false,
    createdAt: START,
    startedAt: START,
    exercises: [
      {
        id: "e1",
        exerciseId: "bench-press",
        exercise: { id: "bench-press", name: "Bench Press", category: "Chest", musclesWorked: [], description: "" },
        orderIndex: 0,
        sets: [
          { id: "s1", weightUnit: "lbs", isCompleted: false },
          { id: "s2", weightUnit: "lbs", isCompleted: false },
        ],
      },
    ],
    ...overrides,
  };
}

function entry(op: Record<string, unknown>): Entry {
  return { id: String(op.opId), json: JSON.stringify(op) };
}

function logSet(opId: string, at = Date.now() - 1000) {
  return entry({ opId, kind: "logSet", at, workoutId: "w1", exerciseId: "e1", setId: "s1", weight: 185, reps: 5, unit: "lbs" });
}

/** Lets AsyncStorage reads, the debounce and the op chain all run out. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
  }
}

function lastSnapshot() {
  return JSON.parse(mockBridge.sent[mockBridge.sent.length - 1]);
}

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  mockBridge.inbox = [];
  mockBridge.sent = [];
  mockBridge.listener = null;
  mockBridge.liveListener = null;
  mockCreated = 0;
  resetCardioDiscards();
  jest.clearAllMocks();
  mockStore.clear();
  mockAuth = { dataUserId: "u1", loading: false };
  mockRest = null;
  mockSettingsLoaded = true;
  mockAwaitingSync = false;
  const workout = live();
  mockStore.set(workout.id, workout);
  mockWorkouts = { active: [workout], templates: [], completed: [], loading: false };
});

afterEach(() => {
  jest.useRealTimers();
});

describe("the snapshot", () => {
  it("sends the workout in progress once everything has loaded", async () => {
    render(<WatchSync />);
    await settle();
    const snapshot = lastSnapshot();
    expect(snapshot.account).toBe("signedIn");
    expect(snapshot.workout.id).toBe("w1");
    expect(snapshot.accent).toBe("#8b5cf6");
    expect(snapshot.sentAt).toBeGreaterThan(0);
  });

  it("sends nothing while sign-in is still being worked out", async () => {
    mockAuth = { dataUserId: null, loading: true };
    render(<WatchSync />);
    await settle();
    expect(mockBridge.updateContext).not.toHaveBeenCalled();
  });

  it("waits for the unit and rest settings, so it never sends the defaults", async () => {
    mockSettingsLoaded = false;
    mockBridge.inbox = [logSet("op-1")];
    render(<WatchSync />);
    await settle();
    expect(mockBridge.updateContext).not.toHaveBeenCalled();
    expect(mockBridge.takeInbox).not.toHaveBeenCalled();
  });

  it("doesn't resend a snapshot that hasn't changed", async () => {
    const view = render(<WatchSync />);
    await settle();
    view.rerender(<WatchSync />);
    await settle();
    expect(mockBridge.updateContext).toHaveBeenCalledTimes(1);
  });

  it("clears the watch on sign-out", async () => {
    mockAuth = { dataUserId: null, loading: false };
    mockWorkouts = { active: [], templates: [], completed: [], loading: false };
    render(<WatchSync />);
    await settle();
    expect(lastSnapshot()).toMatchObject({ account: "none", workout: null, templates: [] });
  });
});

describe("ops from the watch", () => {
  it("logs a set, starts the rest from when it was lifted, and tells the watch", async () => {
    const at = Date.now() - 2000;
    mockBridge.inbox = [logSet("op-1", at)];
    render(<WatchSync />);
    await settle();

    expect(mockUpdateWorkout).toHaveBeenCalledTimes(1);
    const [, updates] = mockUpdateWorkout.mock.calls[0];
    expect(updates.exercises![0].sets[0]).toMatchObject({ weight: 185, reps: 5, isCompleted: true });
    expect(mockStartRest).toHaveBeenCalledWith("w1", at);
    expect(mockBridge.inbox).toEqual([]);
    expect(JSON.parse((await AsyncStorage.getItem(APPLIED_KEY))!)).toEqual(["op-1"]);
    expect(lastSnapshot().applied).toEqual(["op-1"]);
  });

  it("applies an op the watch sent twice only once", async () => {
    await AsyncStorage.setItem(APPLIED_KEY, JSON.stringify(["op-1"]));
    mockBridge.inbox = [logSet("op-1")];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout).not.toHaveBeenCalled();
    expect(mockBridge.ackInbox).toHaveBeenCalledWith(["op-1"]);
  });

  it("drops a malformed op instead of letting it block the queue", async () => {
    mockBridge.inbox = [{ id: "bad", json: "{not json" }, logSet("op-2")];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout).toHaveBeenCalledTimes(1);
    expect(mockBridge.inbox).toEqual([]);
  });

  it("leaves ops waiting until an account is loaded", async () => {
    mockAuth = { dataUserId: null, loading: true };
    mockBridge.inbox = [logSet("op-1")];
    const view = render(<WatchSync />);
    await settle();
    expect(mockBridge.takeInbox).not.toHaveBeenCalled();

    mockAuth = { dataUserId: "u1", loading: false };
    view.rerender(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout).toHaveBeenCalledTimes(1);
  });

  it("keeps ops for later while signed out rather than dropping them", async () => {
    mockAuth = { dataUserId: null, loading: false };
    mockBridge.inbox = [logSet("op-1")];
    render(<WatchSync />);
    await settle();
    expect(mockBridge.takeInbox).not.toHaveBeenCalled();
    expect(mockBridge.inbox).toHaveLength(1);
  });

  it("picks up ops that arrive while it's running", async () => {
    render(<WatchSync />);
    await settle();
    mockBridge.inbox = [logSet("op-3")];
    await act(async () => mockBridge.listener?.());
    await settle();
    expect(mockUpdateWorkout).toHaveBeenCalledTimes(1);
  });

  it("won't touch another account's workout", async () => {
    mockStore.set("w1", live({ userId: "someone-else" }));
    mockBridge.inbox = [logSet("op-1")];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout).not.toHaveBeenCalled();
    expect(mockBridge.inbox).toEqual([]);
  });

  it("ignores a set logged after the workout was finished", async () => {
    mockStore.set("w1", live({ completedAt: new Date(Date.now() - 60_000) }));
    mockBridge.inbox = [logSet("op-1", Date.now() - 1000)];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout).not.toHaveBeenCalled();
  });
});

describe("ops arriving out of order", () => {
  it("still puts a set logged before the finish into the finished workout", async () => {
    const finishedAt = Date.now() - 60_000;
    mockStore.set("w1", live({ completedAt: new Date(finishedAt), totalVolume: 0 }));
    mockBridge.inbox = [logSet("op-late", finishedAt - 30_000)];
    render(<WatchSync />);
    await settle();
    const [, updates] = mockUpdateWorkout.mock.calls[0];
    expect(updates.exercises![0].sets[0]).toMatchObject({ weight: 185, reps: 5, isCompleted: true });
    expect(updates.totalVolume).toBe(185 * 5);
    expect(mockUpsertStats).toHaveBeenCalled();
    // No rest for a workout that's over.
    expect(mockStartRest).not.toHaveBeenCalled();
  });

  it("skips an edit that arrives after a newer one for the same set", async () => {
    const now = Date.now();
    mockBridge.inbox = [
      entry({ opId: "op-new", kind: "logSet", at: now - 1000, workoutId: "w1", exerciseId: "e1", setId: "s1", weight: 190, reps: 5, unit: "lbs" }),
      entry({ opId: "op-old", kind: "logSet", at: now - 5000, workoutId: "w1", exerciseId: "e1", setId: "s1", weight: 185, reps: 5, unit: "lbs" }),
    ];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout).toHaveBeenCalledTimes(1);
    expect(mockStore.get("w1")!.exercises[0].sets[0].weight).toBe(190);
    expect(mockBridge.inbox).toEqual([]);
  });

  it("keeps a set cleared when the clear overtakes the set it undoes", async () => {
    const now = Date.now();
    mockBridge.inbox = [
      entry({ opId: "op-undo", kind: "undoSet", at: now - 1000, workoutId: "w1", exerciseId: "e1", setId: "s1" }),
      logSet("op-log", now - 5000),
    ];
    render(<WatchSync />);
    await settle();
    expect(mockStore.get("w1")!.exercises[0].sets[0].isCompleted).toBe(false);
    expect(mockBridge.inbox).toEqual([]);
  });

  it("doesn't overwrite a set changed on the phone after the watch logged it", async () => {
    const workout = live();
    workout.exercises[0].sets[0] = { id: "s1", weightUnit: "lbs", weight: 200, reps: 3, isCompleted: true, completedAt: new Date() };
    mockStore.set("w1", workout);
    mockBridge.inbox = [logSet("op-1", Date.now() - 60_000)];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout).not.toHaveBeenCalled();
  });
});

describe("a phone that has only just signed in", () => {
  it("holds an op for a workout that hasn't arrived yet, then applies it", async () => {
    mockStore.clear();
    mockAwaitingSync = true;
    mockBridge.inbox = [logSet("op-1")];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout).not.toHaveBeenCalled();
    expect(mockBridge.inbox).toHaveLength(1);

    mockAwaitingSync = false;
    mockStore.set("w1", live());
    await act(async () => {
      jest.advanceTimersByTime(RETRY_MS);
    });
    await settle();
    expect(mockUpdateWorkout).toHaveBeenCalledTimes(1);
    expect(mockBridge.inbox).toEqual([]);
  });
});

describe("starting from the watch", () => {
  const template: Workout = { ...live({ id: "t1", isTemplate: true, startedAt: undefined }) };
  const start = (opId: string, at = Date.now()) => entry({ opId, kind: "startTemplate", at, templateId: "t1" });

  beforeEach(() => {
    mockWorkouts = { active: [], templates: [template], completed: [], loading: false };
  });

  it("starts the template and makes it the workout everything leads with", async () => {
    mockBridge.inbox = [start("op-s")];
    render(<WatchSync />);
    await settle();
    expect(mockStartFromTemplate).toHaveBeenCalledWith(template, "u1");
    expect(mockMarkCurrent).toHaveBeenCalledWith("w-new");
  });

  it("won't start a second workout over one begun on the phone meanwhile", async () => {
    mockWorkouts = { ...mockWorkouts, active: [live()] };
    mockBridge.inbox = [start("op-s")];
    render(<WatchSync />);
    await settle();
    expect(mockStartFromTemplate).not.toHaveBeenCalled();
  });

  it("starts only one workout when a retry arrives with the first", async () => {
    mockBridge.inbox = [start("op-s1"), start("op-s2")];
    render(<WatchSync />);
    await settle();
    expect(mockStartFromTemplate).toHaveBeenCalledTimes(1);
  });

  it("drops a start that arrives too late to still be wanted", async () => {
    mockBridge.inbox = [start("op-s", Date.now() - START_TTL_MS - 1000)];
    render(<WatchSync />);
    await settle();
    expect(mockStartFromTemplate).not.toHaveBeenCalled();
    expect(lastSnapshot().applied).toEqual(["op-s"]);
  });
});

describe("finishing and resting from the watch", () => {
  it("finishes the workout with the screen's fields and refreshes the stats", async () => {
    mockBridge.inbox = [entry({ opId: "op-f", kind: "finish", at: Date.now(), workoutId: "w1" })];
    render(<WatchSync />);
    await settle();
    const [, updates] = mockUpdateWorkout.mock.calls[0];
    expect(updates.completedAt).toBeInstanceOf(Date);
    expect(updates.durationMinutes).toBeGreaterThanOrEqual(1);
    expect(updates.totalVolume).toBe(0);
    expect(mockUpsertStats).toHaveBeenCalled();
  });

  it("extends and ends only this workout's rest", async () => {
    mockRest = { workoutId: "w1", endsAt: Date.now() + 30_000 };
    mockBridge.inbox = [
      entry({ opId: "op-x", kind: "extendRest", at: Date.now(), workoutId: "w1", seconds: 15 }),
      entry({ opId: "op-y", kind: "endRest", at: Date.now(), workoutId: "w1" }),
      entry({ opId: "op-z", kind: "endRest", at: Date.now(), workoutId: "w-other" }),
    ];
    render(<WatchSync />);
    await settle();
    expect(mockExtendRest).toHaveBeenCalledWith(15_000);
    expect(mockEndRest).toHaveBeenCalledTimes(1);
  });
});

describe("cardio sessions from the watch", () => {
  const MILE = 1609.344;
  const runExercise = { id: "running", name: "Running", category: "Cardio", musclesWorked: [], description: "" };

  function session(overrides: Partial<Workout> = {}): Workout {
    return {
      id: "run1",
      userId: "u1",
      name: "Outdoor Run",
      isTemplate: false,
      createdAt: START,
      startedAt: START,
      cardio: { kind: "run", indoor: false, watch: true, watchStartOpId: "start-1" },
      exercises: [{ id: "e1", exerciseId: "running", exercise: runExercise, orderIndex: 0, sets: [{ id: "s1", weightUnit: "lbs", isCompleted: false }] }],
      ...overrides,
    };
  }

  /** Five kilometres at five minutes each, as the watch sends it: metres, seconds, alternating. */
  const fiveK = Array.from({ length: 51 }, (_, i) => [i * 100, i * 30]).flat();

  function finish(overrides: Record<string, unknown> = {}) {
    return entry({
      opId: "fin-1",
      kind: "finishCardio",
      at: START.getTime() + 1500_000,
      workoutId: null,
      startOpId: "start-1",
      session: "run",
      indoor: false,
      startedAt: START.getTime(),
      duration: 1500,
      distance: 5000,
      activeCalories: 320.4,
      avgHeartRate: 151.2,
      maxHeartRate: 170.8,
      healthId: "HK-1",
      curve: fiveK,
      ...overrides,
    });
  }

  beforeEach(() => {
    mockWorkouts = { active: [], templates: [], completed: [], loading: false };
  });

  it("starts a session the watch started, marked as tracked there, and leads with it", async () => {
    mockBridge.inbox = [entry({ opId: "start-9", kind: "startCardio", at: START.getTime(), session: "bike", indoor: true })];
    render(<WatchSync />);
    await settle();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      name: "Indoor Cycle",
      startedAt: START,
      cardio: { kind: "bike", indoor: true, watch: true, watchStartOpId: "start-9" },
    });
    expect(mockMarkCurrent).toHaveBeenCalledWith("created-1");
  });

  it("doesn't start it twice when the start arrives again", async () => {
    mockWorkouts.active = [session({ cardio: { kind: "run", watch: true, watchStartOpId: "start-9" } })];
    mockBridge.inbox = [entry({ opId: "start-9", kind: "startCardio", at: START.getTime(), session: "run", indoor: false })];
    render(<WatchSync />);
    await settle();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("pauses and resumes it at the moments the watch did", async () => {
    const run = session();
    mockStore.set(run.id, run);
    mockWorkouts.active = [run];
    mockBridge.inbox = [
      entry({ opId: "p1", kind: "pauseCardio", at: START.getTime() + 600_000, workoutId: null, startOpId: "start-1" }),
      entry({ opId: "r1", kind: "resumeCardio", at: START.getTime() + 660_000, workoutId: null, startOpId: "start-1" }),
    ];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout.mock.calls[0][1].cardio).toMatchObject({ pausedAtMs: START.getTime() + 600_000 });
    expect(mockStore.get("run1")!.cardio).toEqual({ kind: "run", indoor: false, watch: true, watchStartOpId: "start-1", pausedSeconds: 60 });
  });

  it("finishes it with what the watch measured, splits and records worked out here", async () => {
    const run = session();
    mockStore.set(run.id, run);
    mockWorkouts.active = [run];
    mockBridge.inbox = [finish()];
    render(<WatchSync />);
    await settle();
    const saved = mockStore.get("run1")!;
    expect(saved.completedAt).toEqual(new Date(START.getTime() + 1500_000));
    expect(saved.durationMinutes).toBe(25);
    expect(saved.exercises[0].sets[0]).toMatchObject({
      duration: 1500,
      distance: 5000,
      isCompleted: true,
      tracked: {
        healthId: "HK-1",
        source: "Apple Watch",
        activeCalories: 320,
        avgHeartRate: 151,
        maxHeartRate: 171,
        splitsKm: [300, 300, 300, 300, 300],
        splitsMi: [483, 483, 483],
        best: { "1k": 300, "1mi": 483, "5k": 1500 },
      },
    });
    expect(mockUpsertStats).toHaveBeenCalled();
  });

  // Started on the phone, the watch woken into it: when the watch says it's
  // tracking, that's the same session, now marked as tracked there.
  it("takes a watch's start as tracking a session the phone started, not a new one", async () => {
    const run = session({ cardio: { kind: "run", indoor: false } });
    mockStore.set(run.id, run);
    mockWorkouts.active = [run];
    mockBridge.inbox = [entry({ opId: "start-w", kind: "startCardio", at: START.getTime() + 6000, session: "run", indoor: false })];
    render(<WatchSync />);
    await settle();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockStore.get("run1")!.cardio).toEqual({ kind: "run", indoor: false, watch: true, watchStartOpId: "start-w" });
  });

  // The watch may end it before ever hearing the phone's id or its own start
  // landing: matched by kind and start, with no ids at all.
  it("finds a session the phone started by its kind and start time", async () => {
    const run = session({ cardio: { kind: "run", watch: true } });
    mockStore.set(run.id, run);
    mockWorkouts.active = [run];
    mockBridge.inbox = [finish({ startOpId: null, startedAt: START.getTime() + 4000 })];
    render(<WatchSync />);
    await settle();
    expect(mockCreate).not.toHaveBeenCalled();
    const set = mockStore.get("run1")!.exercises[0].sets[0];
    expect(set.distance).toBe(5000);
    // The four seconds before the watch's clock began were spent in the session too.
    expect(set.duration).toBe(1504);
  });

  it("brings nothing in for a false start with no session behind it", async () => {
    mockBridge.inbox = [finish({ startOpId: "blip", duration: 4, distance: null, curve: null })];
    render(<WatchSync />);
    await settle();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("tells the watch about a session thrown away on the phone, and turns away its finish", async () => {
    recordCardioDiscard(session({ id: "gone", cardio: { kind: "run", watch: true, watchStartOpId: "start-1" } }));
    mockBridge.inbox = [finish()];
    render(<WatchSync />);
    await settle();
    expect(lastSnapshot().endedCardio).toContainEqual({ id: "gone", startOpId: "start-1", kind: "run", startedAt: START.getTime(), discard: true });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("brings the whole session in when its start never landed", async () => {
    mockBridge.inbox = [finish({ startOpId: "lost-start", distance: 3 * MILE })];
    render(<WatchSync />);
    await settle();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const created = mockCreate.mock.calls[0][0];
    expect(created).toMatchObject({
      name: "Outdoor Run",
      startedAt: START,
      completedAt: new Date(START.getTime() + 1500_000),
      cardio: { kind: "run", watch: true, watchStartOpId: "lost-start" },
    });
    expect(created.exercises[0].sets[0]).toMatchObject({ duration: 1500, isCompleted: true });
    expect(created.exercises[0].sets[0].distance).toBeCloseTo(3 * MILE, 0);
  });

  it("keeps the moment it was ended on the phone, adding what the watch measured", async () => {
    const endedAt = new Date(START.getTime() + 1400_000);
    const run = session({
      completedAt: endedAt,
      exercises: [{ id: "e1", exerciseId: "running", exercise: runExercise, orderIndex: 0, sets: [{ id: "s1", weightUnit: "lbs", isCompleted: true, duration: 1380 }] }],
    });
    mockStore.set(run.id, run);
    mockWorkouts.completed = [run];
    mockBridge.inbox = [finish()];
    render(<WatchSync />);
    await settle();
    const saved = mockStore.get("run1")!;
    expect(saved.completedAt).toEqual(endedAt);
    expect(saved.exercises[0].sets[0]).toMatchObject({ duration: 1500, distance: 5000, tracked: expect.objectContaining({ healthId: "HK-1" }) });
  });

  it("tells the watch about a session it's tracking, and one the phone has ended", async () => {
    const running = session();
    mockWorkouts.active = [running];
    mockWorkouts.completed = [
      session({ id: "ended", completedAt: new Date(Date.now() - 60_000), cardio: { kind: "walk", watch: true, watchStartOpId: "start-2" } }),
    ];
    render(<WatchSync />);
    await settle();
    const snapshot = lastSnapshot();
    expect(snapshot.workout.cardio).toEqual({ kind: "run", indoor: false, pausedAtMs: null, pausedSeconds: 0, watch: true, startOpId: "start-1" });
    expect(snapshot.endedCardio).toEqual([
      { id: "ended", startOpId: "start-2", kind: "walk", startedAt: START.getTime(), discard: false },
    ]);
  });

  it("passes the watch's live readings on to the session screen", async () => {
    render(<WatchSync />);
    await settle();
    const reading = { workoutId: null, startOpId: "start-1", kind: "run", startedAt: START.getTime(), elapsed: 300, distance: 1000, heartRate: 150, paused: false, at: Date.now() };
    await act(async () => mockBridge.liveListener?.({ json: JSON.stringify(reading) }));
    expect(mockSetLive).toHaveBeenCalledWith(reading);
    await act(async () => mockBridge.liveListener?.({ json: "{not json" }));
    expect(mockSetLive).toHaveBeenCalledTimes(1);
  });
});
