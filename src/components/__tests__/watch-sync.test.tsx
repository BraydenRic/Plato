import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";

import { APPLIED_KEY, INBOX_OWNER_KEY, PROMPT_START_MS, RETRY_MS, START_TTL_MS, WatchSync } from "../watch-sync";
import { recordCardioDiscard, resetCardioDiscards } from "@/lib/cardio-discards";
import { GUEST_USER_ID, writeGuestActive } from "@/lib/local-store";
import * as localStore from "@/lib/local-store";
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

type MockAuth = {
  dataUserId: string | null;
  loading: boolean;
  guestMoveUnderway?: boolean;
  user?: { uid: string; emailVerified: boolean; providerData: { providerId: string }[] };
};
let mockAuth: MockAuth = { dataUserId: "u1", loading: false };
jest.mock("@/context/AuthContext", () => ({ useAuth: () => mockAuth }));

let mockWorkouts = { active: [] as Workout[], templates: [] as Workout[], completed: [] as Workout[], loading: false };
// The guest's, for when the watch link asks for theirs rather than the account's.
let mockGuestWorkouts: typeof mockWorkouts | null = null;
jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: (userId?: string | null) => (userId === "local-guest" && mockGuestWorkouts ? mockGuestWorkouts : mockWorkouts),
}));

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
let mockThemeId = "violet";
jest.mock("@/context/ThemeContext", () => ({ useThemePicker: () => ({ themeId: mockThemeId }) }));
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
    movedGuestWorkoutId: (userId: string, localId: string) => `${userId}_${localId}`,
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
  mockThemeId = "violet";
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
  mockGuestWorkouts = null;
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

  // The watch is always dark, so it gets each theme's dark-mode accent.
  it("sends the new accent when the theme changes on the phone", async () => {
    const view = render(<WatchSync />);
    await settle();
    expect(lastSnapshot()).toMatchObject({ accent: "#8b5cf6" });
    mockThemeId = "amber";
    view.rerender(<WatchSync />);
    await settle();
    expect(mockBridge.updateContext).toHaveBeenCalledTimes(2);
    expect(lastSnapshot()).toMatchObject({ accent: "#f97316" });
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

  // Logged and undone on the watch out of range, then logged on the phone:
  // when the queued pair arrives, the undo mustn't wipe the phone's set.
  it("doesn't clear a set logged on the phone after the watch's clear", async () => {
    const now = Date.now();
    const workout = live();
    workout.exercises[0].sets[0] = { id: "s1", weightUnit: "lbs", weight: 200, reps: 3, isCompleted: true, completedAt: new Date(now) };
    mockStore.set("w1", workout);
    mockBridge.inbox = [
      logSet("op-log", now - 60_000),
      entry({ opId: "op-undo", kind: "undoSet", at: now - 55_000, workoutId: "w1", exerciseId: "e1", setId: "s1" }),
    ];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout).not.toHaveBeenCalled();
    expect(mockStore.get("w1")!.exercises[0].sets[0]).toMatchObject({ weight: 200, reps: 3, isCompleted: true });
    expect(mockBridge.inbox).toEqual([]);
  });

  // A nested date can reach memory as a Firestore Timestamp or a string; the
  // comparison has to read either rather than throw and lose the edit.
  it("reads a done set's time however it was stored", async () => {
    const now = Date.now();
    const stamp = { seconds: Math.floor(now / 1000), nanoseconds: 0, toMillis: () => Math.floor(now / 1000) * 1000 };
    const workout = live();
    workout.exercises[0].sets[0] = { id: "s1", weightUnit: "lbs", weight: 200, reps: 3, isCompleted: true, completedAt: stamp as unknown as Date };
    workout.exercises[0].sets[1] = {
      id: "s2",
      weightUnit: "lbs",
      weight: 200,
      reps: 3,
      isCompleted: true,
      completedAt: new Date(now - 120_000).toISOString() as unknown as Date,
    };
    mockStore.set("w1", workout);
    mockBridge.inbox = [
      logSet("op-1", now - 60_000),
      entry({ opId: "op-2", kind: "logSet", at: now - 60_000, workoutId: "w1", exerciseId: "e1", setId: "s2", weight: 185, reps: 5, unit: "lbs" }),
    ];
    render(<WatchSync />);
    await settle();
    // The Timestamp is newer: the phone's set stands. The string is older: the watch's edit lands.
    expect(mockUpdateWorkout).toHaveBeenCalledTimes(1);
    expect(mockStore.get("w1")!.exercises[0].sets[1]).toMatchObject({ weight: 185, reps: 5 });
    expect(mockBridge.inbox).toEqual([]);
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

// A guest signed in mid-workout. Their data moves into the account behind
// the app once the moving screen steps aside, and the watch's ops wait for as
// long as that runs, then land on the moved copy, which the watch may still
// name by its guest id.
describe("while a guest's data moves into the account", () => {
  const guestSet = (opId: string) =>
    entry({ opId, kind: "logSet", at: Date.now() - 1000, workoutId: "local-w1", exerciseId: "e1", setId: "s1", weight: 185, reps: 5, unit: "lbs" });

  beforeEach(() => {
    mockStore.clear();
    mockStore.set("local-w1", live({ id: "local-w1", userId: GUEST_USER_ID }));
    mockWorkouts = { active: [], templates: [], completed: [], loading: false };
  });

  // A move stuck on a dead signal can last the whole launch; sets logged on
  // the watch for the account's own workout mustn't wait behind it.
  it("lets ops about the account's own workouts through while the move runs", async () => {
    mockAuth = { dataUserId: "u1", loading: false, guestMoveUnderway: true };
    const own = live({ id: "w-own", userId: "u1" });
    mockStore.set(own.id, own);
    mockWorkouts = { ...mockWorkouts, active: [own] };
    mockBridge.inbox = [entry({ opId: "op-own", kind: "finish", at: Date.now(), workoutId: "w-own" })];
    render(<WatchSync />);
    await settle();
    expect(mockStore.get("w-own")!.completedAt).toBeInstanceOf(Date);
    expect(mockBridge.inbox).toEqual([]);
  });

  it("holds the watch's ops past the moving screen, then applies them to the moved copy", async () => {
    // The screen has stepped aside, so `migrating` is off; the move isn't done.
    mockAuth = { dataUserId: "u1", loading: false, guestMoveUnderway: true };
    mockBridge.inbox = [guestSet("op-g1"), entry({ opId: "op-gf", kind: "finish", at: Date.now(), workoutId: "local-w1" })];
    const view = render(<WatchSync />);
    await settle();
    expect(mockBridge.inbox).toHaveLength(2);
    expect(mockUpdateWorkout).not.toHaveBeenCalled();

    // Moved: gone from the guest store, in the account under its new id.
    mockStore.delete("local-w1");
    const moved = live({ id: "u1_local-w1" });
    mockStore.set(moved.id, moved);
    mockWorkouts = { ...mockWorkouts, active: [moved] };
    mockAuth = { ...mockAuth, guestMoveUnderway: false };
    view.rerender(<WatchSync />);
    await settle();

    expect(mockUpdateWorkout.mock.calls.map(([id]) => id)).toEqual(["u1_local-w1", "u1_local-w1"]);
    expect(mockStore.get("u1_local-w1")!.exercises[0].sets[0]).toMatchObject({ weight: 185, reps: 5, isCompleted: true });
    expect(mockStore.get("u1_local-w1")!.completedAt).toBeInstanceOf(Date);
    expect(mockBridge.inbox).toEqual([]);
  });

  it("goes to the moved copy over a guest copy the move hasn't let go of", async () => {
    mockStore.set("u1_local-w1", live({ id: "u1_local-w1" }));
    mockBridge.inbox = [guestSet("op-g1")];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout.mock.calls.map(([id]) => id)).toEqual(["u1_local-w1"]);
    expect(mockStore.get("local-w1")!.exercises[0].sets[0].isCompleted).toBe(false);
  });

  it("still goes to the guest's own copy in guest mode", async () => {
    mockAuth = { dataUserId: GUEST_USER_ID, loading: false };
    mockBridge.inbox = [guestSet("op-g1")];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout.mock.calls.map(([id]) => id)).toEqual(["local-w1"]);
  });
});

// The native inbox isn't per account, and keeps ops while signed out on
// purpose. One person's run finished on the wrist after they signed out must
// not land in whoever signs in next.
describe("ops another account left behind", () => {
  const lostFinish = (startedAt: number) =>
    entry({
      opId: "fin-other",
      kind: "finishCardio",
      at: startedAt + 1500_000,
      workoutId: "their-run",
      startOpId: "their-start",
      session: "run",
      indoor: false,
      startedAt,
      duration: 1500,
      distance: 5000,
      activeCalories: 300,
      avgHeartRate: 150,
      maxHeartRate: 170,
      healthId: "HK-THEIRS",
      curve: null,
    });

  it("drops what was waiting for another account", async () => {
    await AsyncStorage.setItem(INBOX_OWNER_KEY, JSON.stringify({ userId: "someone-else", since: 0 }));
    mockBridge.inbox = [logSet("op-1")];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout).not.toHaveBeenCalled();
    expect(mockBridge.inbox).toEqual([]);
    expect(JSON.parse((await AsyncStorage.getItem(INBOX_OWNER_KEY))!)).toMatchObject({ userId: "u1" });
  });

  it("keeps them for the same account signing back in", async () => {
    await AsyncStorage.setItem(INBOX_OWNER_KEY, JSON.stringify({ userId: "u1", since: 0 }));
    mockBridge.inbox = [logSet("op-1")];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout).toHaveBeenCalledTimes(1);
  });

  // A guest's data moves into the account they sign in to; so do their ops.
  it("keeps a guest's for the account they sign in to", async () => {
    await AsyncStorage.setItem(INBOX_OWNER_KEY, JSON.stringify({ userId: GUEST_USER_ID, since: 0 }));
    mockBridge.inbox = [logSet("op-1")];
    render(<WatchSync />);
    await settle();
    expect(mockUpdateWorkout).toHaveBeenCalledTimes(1);
  });

  it("doesn't bring in a run that began before this account signed in, arriving after", async () => {
    await AsyncStorage.setItem(INBOX_OWNER_KEY, JSON.stringify({ userId: "someone-else", since: 0 }));
    mockWorkouts = { active: [], templates: [], completed: [], loading: false };
    render(<WatchSync />);
    await settle();
    mockBridge.inbox = [lostFinish(Date.now() - 1600_000)];
    await act(async () => mockBridge.listener?.());
    await settle();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockBridge.inbox).toEqual([]);
  });

  it("still brings in a run begun since", async () => {
    await AsyncStorage.setItem(INBOX_OWNER_KEY, JSON.stringify({ userId: "someone-else", since: 0 }));
    mockWorkouts = { active: [], templates: [], completed: [], loading: false };
    render(<WatchSync />);
    await settle();
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    mockBridge.inbox = [lostFinish(Date.now() - 10_000)];
    await act(async () => mockBridge.listener?.());
    await settle();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("doesn't let another account's discard turn away this one's watch", async () => {
    recordCardioDiscard({ ...live({ id: "gone", userId: "someone-else" }), cardio: { kind: "run", watch: true } });
    mockWorkouts = { active: [], templates: [], completed: [], loading: false };
    mockBridge.inbox = [
      entry({ opId: "start-mine", kind: "startCardio", at: START.getTime() + 8_000, session: "run", indoor: false, fromPhone: true }),
    ];
    render(<WatchSync />);
    await settle();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(lastSnapshot().endedCardio).toEqual([]);
  });

  // A guest's discards are still theirs once they sign in, as their ops are.
  // Discarded at once on the phone, before the woken watch heard: the
  // account's snapshot has to say so, and its start is turned away.
  it("carries a guest's discard into the account they sign in to", async () => {
    recordCardioDiscard({ ...live({ id: "local-gone", userId: GUEST_USER_ID }), cardio: { kind: "run", watch: true } });
    mockWorkouts = { active: [], templates: [], completed: [], loading: false };
    mockBridge.inbox = [
      entry({ opId: "start-woken", kind: "startCardio", at: START.getTime() + 8_000, session: "run", indoor: false, fromPhone: true }),
    ];
    render(<WatchSync />);
    await settle();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(lastSnapshot().endedCardio).toContainEqual(expect.objectContaining({ id: "local-gone", startOpId: null, discard: true }));
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
    expect(mockStore.get("run1")!.cardio).toEqual({
      kind: "run",
      indoor: false,
      watch: true,
      watchStartOpId: "start-1",
      pausedSeconds: 60,
      pauses: [{ fromMs: START.getTime() + 600_000, toMs: START.getTime() + 660_000 }],
    });
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
    expect(lastSnapshot().endedCardio).toContainEqual({
      id: "gone",
      startOpId: "start-1",
      kind: "run",
      startedAt: START.getTime(),
      discard: true,
      at: expect.any(Number),
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // Discarded on the phone before the watch had linked it, so remembered only
  // by kind and start time. A run then started on the wrist is a new run.
  describe("after a session is discarded here", () => {
    beforeEach(() => {
      recordCardioDiscard(session({ id: "gone", cardio: { kind: "run", watch: true } }));
    });

    it("doesn't take a run started on the watch for the discarded one", async () => {
      mockBridge.inbox = [
        entry({ opId: "start-new", kind: "startCardio", at: START.getTime() + 60_000, session: "run", indoor: false, fromPhone: false }),
      ];
      render(<WatchSync />);
      await settle();
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate.mock.calls[0][0]).toMatchObject({ cardio: { kind: "run", watch: true, watchStartOpId: "start-new" } });
    });

    it("still turns away a woken watch's start for it", async () => {
      mockBridge.inbox = [
        entry({ opId: "start-late", kind: "startCardio", at: START.getTime() + 8_000, session: "run", indoor: false, fromPhone: true }),
      ];
      render(<WatchSync />);
      await settle();
      expect(mockCreate).not.toHaveBeenCalled();
      // And tells the watch by its own start op: woken in the seconds before
      // the discard, it doesn't take a discard by kind and start for its own.
      expect(lastSnapshot().endedCardio).toContainEqual(expect.objectContaining({ id: "gone", startOpId: "start-late", discard: true }));
    });

    it("finishes a watch-started run its own start op finds, though it's the same kind and minute", async () => {
      const fresh = session({ id: "run2", startedAt: new Date(START.getTime() + 60_000), cardio: { kind: "run", watch: true, watchStartOpId: "start-2" } });
      mockStore.set(fresh.id, fresh);
      mockWorkouts.active = [fresh];
      mockBridge.inbox = [finish({ startOpId: "start-2", startedAt: START.getTime() + 60_000 })];
      render(<WatchSync />);
      await settle();
      expect(mockStore.get("run2")!.exercises[0].sets[0]).toMatchObject({ duration: 1500, distance: 5000, isCompleted: true });
    });
  });

  // An Outdoor Run discarded on the phone to pick Indoor before the watch's
  // start for it landed — so remembered by kind and start alone — and the
  // new run started 20 s later, waking the watch again.
  describe("after a run is discarded and started again", () => {
    const restarted = (indoor: boolean) =>
      session({
        id: "run2",
        name: indoor ? "Indoor Run" : "Outdoor Run",
        startedAt: new Date(START.getTime() + 20_000),
        cardio: { kind: "run", indoor },
      });
    const wokenStart = (opId: string, afterMs: number, indoor: boolean) =>
      entry({ opId, kind: "startCardio", at: START.getTime() + afterMs, session: "run", indoor, fromPhone: true });

    beforeEach(() => {
      recordCardioDiscard(session({ id: "gone", cardio: { kind: "run", indoor: false, watch: true } }));
    });

    it("takes the woken watch's start for the new run, which started nearer", async () => {
      const run = restarted(false);
      mockStore.set(run.id, run);
      mockWorkouts.active = [run];
      mockBridge.inbox = [wokenStart("start-2", 26_000, false)];
      render(<WatchSync />);
      await settle();
      expect(mockStore.get("run2")!.cardio).toMatchObject({ watch: true, watchStartOpId: "start-2" });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("tells the two apart by indoors and out, too", async () => {
      const run = restarted(true);
      mockStore.set(run.id, run);
      mockWorkouts.active = [run];
      // Nearer the discarded run's start, but tracking indoors: the new one's.
      mockBridge.inbox = [wokenStart("start-2", 8_000, true)];
      render(<WatchSync />);
      await settle();
      expect(mockStore.get("run2")!.cardio).toMatchObject({ watch: true, watchStartOpId: "start-2" });
    });

    it("still turns away the discarded run's own late start", async () => {
      const run = restarted(false);
      mockStore.set(run.id, run);
      mockWorkouts.active = [run];
      mockBridge.inbox = [wokenStart("start-1", 3_000, false)];
      render(<WatchSync />);
      await settle();
      expect(mockStore.get("run2")!.cardio).toEqual({ kind: "run", indoor: false });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("finishes the new run by kind and start, not the discarded one", async () => {
      const run = restarted(false);
      mockStore.set(run.id, run);
      mockWorkouts.active = [run];
      mockBridge.inbox = [finish({ startOpId: null, startedAt: START.getTime() + 24_000 })];
      render(<WatchSync />);
      await settle();
      expect(mockStore.get("run2")!.exercises[0].sets[0]).toMatchObject({ distance: 5000, isCompleted: true });
    });
  });

  // The watch's start for a run the phone woke it for, slow — the Health sheet
  // on the wrist, or the system's queue — lands after End on the phone.
  describe("a woken watch's start after the phone ended the run", () => {
    // Recent, so the snapshot still lists it as ended.
    let t0 = 0;
    let endedAt = 0;

    beforeEach(() => {
      t0 = Date.now() - 120_000;
      endedAt = t0 + 50_000;
      const run = session({
        startedAt: new Date(t0),
        createdAt: new Date(t0),
        completedAt: new Date(endedAt),
        cardio: { kind: "run", indoor: false },
        exercises: [
          {
            id: "e1",
            exerciseId: "running",
            exercise: runExercise,
            orderIndex: 0,
            sets: [{ id: "s1", weightUnit: "lbs", isCompleted: true, duration: 50, distance: 150, tracked: { source: "iPhone" } }],
          },
        ],
      });
      mockStore.set(run.id, run);
      mockWorkouts.completed = [run];
    });

    it("marks the run as the watch's, so the watch hears it ended and sends what it has", async () => {
      mockBridge.inbox = [entry({ opId: "start-w", kind: "startCardio", at: t0 + 8_000, session: "run", indoor: false, fromPhone: true })];
      const view = render(<WatchSync />);
      await settle();
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockMarkCurrent).not.toHaveBeenCalled();
      expect(mockStore.get("run1")!.cardio).toMatchObject({ watch: true, watchStartOpId: "start-w" });
      mockWorkouts = { ...mockWorkouts, completed: [mockStore.get("run1")!] };
      view.rerender(<WatchSync />);
      await settle();
      expect(lastSnapshot().endedCardio).toContainEqual({
        id: "run1",
        startOpId: "start-w",
        kind: "run",
        startedAt: t0,
        discard: false,
        at: endedAt,
      });
    });

    // Began a minute after End, and heard at once: a watch in reach.
    it("tells a watch that only began once it was over, heard at once, to stop and keep nothing", async () => {
      const began = Date.now() - 5_000;
      mockBridge.inbox = [entry({ opId: "start-late", kind: "startCardio", at: began, session: "run", indoor: false, fromPhone: true })];
      render(<WatchSync />);
      await settle();
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockStore.get("run1")!.cardio).toEqual({ kind: "run", indoor: false });
      expect(lastSnapshot().endedCardio).toContainEqual({
        id: "run1",
        startOpId: "start-late",
        kind: "run",
        startedAt: t0,
        discard: true,
        at: expect.any(Number),
      });
    });

    // End tapped while the watch sat on its Health sheet, the phone left
    // behind, and the sheet approved out of range: the run was done with the
    // watch alone, and its start and finish arrive together, long after.
    it("keeps a run the watch began after End and tracked away from the phone", async () => {
      const began = endedAt + 10_000;
      mockBridge.inbox = [
        entry({ opId: "start-away", kind: "startCardio", at: began, session: "run", indoor: false, fromPhone: true }),
        finish({ opId: "fin-away", startOpId: "start-away", startedAt: began, at: began + 1500_000 }),
      ];
      // Heard once back in range, half an hour on.
      jest.setSystemTime(began + 1500_000 + PROMPT_START_MS);
      render(<WatchSync />);
      await settle();
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockStore.get("created-1")).toMatchObject({ startedAt: new Date(began), cardio: { watch: true, watchStartOpId: "start-away" } });
      expect(mockStore.get("created-1")!.exercises[0].sets[0]).toMatchObject({ duration: 1500, distance: 5000, isCompleted: true });
      // The phone's run is left as it was, and the watch isn't told to throw anything away.
      expect(mockStore.get("run1")!.cardio).toEqual({ kind: "run", indoor: false });
      expect(lastSnapshot().endedCardio.filter((e: { discard: boolean }) => e.discard)).toEqual([]);
    });

    // Its start never landed (refused at the limit, say), so the finish comes
    // alone — and mustn't be taken for the run the phone ended before it began.
    it("doesn't hand such a run's finish to the session ended before it began", async () => {
      const typed = { ...mockStore.get("run1")! };
      typed.exercises = [{ ...typed.exercises[0], sets: [{ id: "s1", weightUnit: "lbs", isCompleted: true, duration: 50, distance: 150 }] }];
      mockStore.set("run1", typed);
      mockWorkouts.completed = [typed];
      const began = endedAt + 10_000;
      mockBridge.inbox = [finish({ opId: "fin-away", startOpId: null, startedAt: began, at: began + 1500_000 })];
      jest.setSystemTime(began + 1500_000 + PROMPT_START_MS);
      render(<WatchSync />);
      await settle();
      expect(mockStore.get("run1")!.exercises[0].sets[0]).toMatchObject({ duration: 50, distance: 150 });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockStore.get("created-1")!.exercises[0].sets[0]).toMatchObject({ duration: 1500, distance: 5000 });
    });

    it("still takes a run begun on the wrist afterwards as a new run", async () => {
      mockBridge.inbox = [entry({ opId: "start-own", kind: "startCardio", at: endedAt + 10_000, session: "run", indoor: false, fromPhone: false })];
      render(<WatchSync />);
      await settle();
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  // A guest signed up with email mid-walk. Until the address is verified,
  // their data stays on the phone, guest flag and all — and the watch with it.
  describe("while a new email account waits on its link", () => {
    const unverified = { uid: "u1", emailVerified: false, providerData: [{ providerId: "password" }] };
    const walk = () =>
      session({
        id: "local-walk",
        userId: GUEST_USER_ID,
        name: "Outdoor Walk",
        cardio: { kind: "walk", indoor: false, watch: true, watchStartOpId: "start-g" },
      });
    const walkFinish = (overrides: Record<string, unknown> = {}) =>
      finish({ opId: "fin-g", startOpId: "start-g", session: "walk", ...overrides });

    beforeEach(async () => {
      await writeGuestActive(true);
      mockAuth = { dataUserId: "u1", loading: false, user: unverified };
      mockStore.set("local-walk", walk());
      mockGuestWorkouts = { active: [walk()], templates: [], completed: [], loading: false };
    });

    it("finishes the guest's walk in their copy, which moves in with the rest", async () => {
      mockBridge.inbox = [walkFinish({ workoutId: "local-walk" })];
      render(<WatchSync />);
      await settle();
      expect(mockStore.get("local-walk")).toMatchObject({ completedAt: new Date(START.getTime() + 1500_000) });
      expect(mockStore.get("local-walk")!.exercises[0].sets[0]).toMatchObject({ distance: 5000, isCompleted: true });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("finds it by its start op when the watch hadn't heard its id", async () => {
      mockBridge.inbox = [walkFinish()];
      render(<WatchSync />);
      await settle();
      expect(mockStore.get("local-walk")!.completedAt).toBeInstanceOf(Date);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("keeps showing the watch the guest's walk", async () => {
      render(<WatchSync />);
      await settle();
      expect(lastSnapshot().workout).toMatchObject({ id: "local-walk" });
    });

    it("is the account's for someone who was never a guest here", async () => {
      await writeGuestActive(false);
      render(<WatchSync />);
      await settle();
      expect(lastSnapshot().workout).toBeNull();
    });

    // Verified: the move runs, and nothing is applied until it's done, when
    // the walk is the account's under its new id, its start op kept.
    it("holds the watch's ops while the guest's data moves in, then applies them to the moved copy", async () => {
      mockAuth = { dataUserId: "u1", loading: false, user: { ...unverified, emailVerified: true }, guestMoveUnderway: true };
      // The walk is in the guest store until the move takes it, which is how
      // its finish — naming it only by start op — is known to be the guest's.
      const guestRead = jest
        .spyOn(localStore, "readGuestData")
        .mockResolvedValue({ workouts: [walk()], library: { custom: [], removedIds: [], overrides: [] }, weeklyPlan: [null, null, null, null, null, null, null] } as never);
      mockBridge.inbox = [walkFinish()];
      const view = render(<WatchSync />);
      await settle();
      expect(mockBridge.inbox).toHaveLength(1);
      expect(mockUpdateWorkout).not.toHaveBeenCalled();

      const moved = { ...walk(), id: "u1_local-walk", userId: "u1" };
      mockStore.delete("local-walk");
      mockStore.set(moved.id, moved);
      guestRead.mockRestore();
      mockWorkouts = { ...mockWorkouts, active: [moved] };
      mockAuth = { ...mockAuth, guestMoveUnderway: false };
      view.rerender(<WatchSync />);
      await settle();
      expect(mockStore.get("u1_local-walk")!.completedAt).toBeInstanceOf(Date);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockBridge.inbox).toEqual([]);
    });
  });

  // Paused on the phone while the watch was still waking: when the watch
  // takes over, the pause ends where the watch began, rather than counting
  // as moving time before it and making the watch's own pause do nothing.
  it("closes a pause left on here when the watch takes over", async () => {
    const run = session({ cardio: { kind: "run", indoor: false, pausedAtMs: START.getTime() + 10_000 } });
    mockStore.set(run.id, run);
    mockWorkouts.active = [run];
    mockBridge.inbox = [entry({ opId: "start-w", kind: "startCardio", at: START.getTime() + 90_000, session: "run", indoor: false, fromPhone: true })];
    render(<WatchSync />);
    await settle();
    expect(mockStore.get("run1")!.cardio).toEqual({
      kind: "run",
      indoor: false,
      watch: true,
      watchStartOpId: "start-w",
      pausedSeconds: 80,
      pauses: [{ fromMs: START.getTime() + 10_000, toMs: START.getTime() + 90_000 }],
    });
  });

  // The watch took over two minutes in, after a 30-second pause on the phone:
  // the session's time is the watch's plus the phone's 90 moving seconds.
  it("counts the phone's time before the watch took over, less a pause in it", async () => {
    const run = session({
      cardio: { kind: "run", watch: true, pausedSeconds: 30, pauses: [{ fromMs: START.getTime() + 20_000, toMs: START.getTime() + 50_000 }] },
    });
    mockStore.set(run.id, run);
    mockWorkouts.active = [run];
    mockBridge.inbox = [finish({ startOpId: null, startedAt: START.getTime() + 120_000 })];
    render(<WatchSync />);
    await settle();
    expect(mockStore.get("run1")!.exercises[0].sets[0].duration).toBe(1590);
  });

  // Run with only the watch — phone at home, no signal. Its start and finish
  // waited in the watch's queue and arrive together, long after.
  it("brings in a run done on the watch alone as one finished session", async () => {
    mockBridge.inbox = [
      entry({ opId: "start-solo", kind: "startCardio", at: START.getTime(), session: "run", indoor: false, fromPhone: false }),
      finish({ opId: "fin-solo", startOpId: "start-solo" }),
    ];
    render(<WatchSync />);
    await settle();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const saved = mockStore.get("created-1")!;
    expect(saved).toMatchObject({ startedAt: START, completedAt: new Date(START.getTime() + 1500_000), cardio: { kind: "run", watch: true } });
    expect(saved.exercises[0].sets[0]).toMatchObject({ duration: 1500, distance: 5000, isCompleted: true });
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
    const endedAt = new Date(Date.now() - 60_000);
    mockWorkouts.active = [running];
    mockWorkouts.completed = [
      session({ id: "ended", completedAt: endedAt, cardio: { kind: "walk", watch: true, watchStartOpId: "start-2" } }),
    ];
    render(<WatchSync />);
    await settle();
    const snapshot = lastSnapshot();
    expect(snapshot.workout.cardio).toEqual({ kind: "run", indoor: false, pausedAtMs: null, pausedSeconds: 0, watch: true, startOpId: "start-1" });
    expect(snapshot.endedCardio).toEqual([
      { id: "ended", startOpId: "start-2", kind: "walk", startedAt: START.getTime(), discard: false, at: endedAt.getTime() },
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
