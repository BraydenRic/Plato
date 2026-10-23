import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";

import { APPLIED_KEY, RETRY_MS, START_TTL_MS, WatchSync } from "../watch-sync";
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
    updateContext: jest.fn((json: string) => {
      bridge.sent.push(json);
    }),
    takeInbox: jest.fn((): Entry[] => [...bridge.inbox]),
    ackInbox: jest.fn((ids: string[]) => {
      bridge.inbox = bridge.inbox.filter((e: Entry) => !ids.includes(e.id));
    }),
    addListener: jest.fn((_event: string, listener: () => void) => {
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
