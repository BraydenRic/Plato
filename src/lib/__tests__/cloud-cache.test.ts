import AsyncStorage from "@react-native-async-storage/async-storage";

import { makeWorkout } from "./factories";
import type { Workout } from "@/types";

/**
 * cloud-cache is what makes a signed-in account work without signal. Each test
 * here stands for a way that used to fail. The workout list went empty on a
 * launch with no signal. Finish spun until the signal came back. Sets logged
 * offline vanished if iOS closed the app. A library edit could wipe the
 * account's custom exercises.
 *
 * Firestore is replaced by a hand-driven fake: the test decides when the
 * cache answers, when the server answers, and whether a write is ever acked.
 * AsyncStorage is the shared in-memory disk from jest.setup.js, so "killing
 * the app" is jest.resetModules() with the disk left as it was.
 */

type Pending = { write: Record<string, unknown>; resolve: () => void; reject: (e: unknown) => void };
interface FakeFirestore {
  workouts: { onChange: (c: { id: string; workout: Workout | null }[], fromCache: boolean) => void; onError: (e: Error) => void } | null;
  docs: Record<string, { onChange: (d: Record<string, unknown> | null, fromCache: boolean) => void } | null>;
  pending: Pending[];
  confirmedUid: string | null;
  authListeners: ((uid: string | null) => void)[];
  nextId: number;
  sendWrite: jest.Mock;
  restartNetwork: jest.Mock;
  getBodyweightLog: jest.Mock;
}

const fake = ((globalThis as Record<string, unknown>).__fakeFirestore ??= {
  workouts: null,
  docs: {},
  pending: [],
  confirmedUid: null,
  authListeners: [],
  nextId: 0,
  sendWrite: jest.fn(),
  restartNetwork: jest.fn(),
  getBodyweightLog: jest.fn(),
}) as FakeFirestore;

jest.mock("../firestore", () => {
  const f = (globalThis as any).__fakeFirestore as FakeFirestore;
  const strip = (value: unknown): unknown => {
    if (value === null || typeof value !== "object" || value instanceof Date) return value;
    if (Array.isArray(value)) return value.map(strip);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, strip(v)])
    );
  };
  return {
    listenWorkouts: (_uid: string, onChange: never, onError: never) => {
      f.workouts = { onChange, onError };
      return () => {
        f.workouts = null;
      };
    },
    listenUserDoc: (collection: string, _uid: string, onChange: never) => {
      f.docs[collection] = { onChange };
      return () => {
        f.docs[collection] = null;
      };
    },
    sendWrite: (write: Record<string, unknown>) => f.sendWrite(write),
    restartNetwork: () => f.restartNetwork(),
    getBodyweightLog: (uid: string) => f.getBodyweightLog(uid),
    onConfirmedUid: (listener: (uid: string | null) => void) => {
      f.authListeners.push(listener);
      listener(f.confirmedUid);
      return () => {
        f.authListeners = f.authListeners.filter((l) => l !== listener);
      };
    },
    newWorkoutId: () => `new-${++f.nextId}`,
    stripUndefined: strip,
    computeStats: (workouts: Workout[]) => ({
      totalCompletedWorkouts: workouts.filter((w) => w.completedAt).length,
    }),
  };
});

const UID = "aB3xY7zQ1mN5pR8sT2vW4yZ6cD0e";
type CloudCache = typeof import("../cloud-cache");

/**
 * Every "process" a test launched. A module reset doesn't stop the old one's
 * timers, so a delayed save from one test could land on the next test's disk.
 * Each is closed when its test ends.
 */
const launched: CloudCache[] = [];
afterEach(async () => {
  await Promise.all(launched.splice(0).map((cc) => cc.closeCloudSession()));
});

/** A fresh process: new module state, same disk. */
function launch(): { cc: CloudCache; appState: (state: string) => void } {
  jest.resetModules();
  fake.workouts = null;
  fake.docs = {};
  fake.pending = [];
  fake.authListeners = [];
  // A new process hasn't heard from Firebase yet.
  fake.confirmedUid = null;
  let handler: ((state: string) => void) | null = null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppState } = require("react-native");
  jest.spyOn(AppState, "addEventListener").mockImplementation((...args: unknown[]) => {
    handler = args[1] as (state: string) => void;
    return { remove: () => {} };
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cc = require("../cloud-cache") as CloudCache;
  launched.push(cc);
  return { cc, appState: (state) => handler?.(state) };
}

/** Lets promise chains (disk reads, then-callbacks) run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function confirmAuth(uid: string | null = UID) {
  fake.confirmedUid = uid;
  fake.authListeners.forEach((listener) => listener(uid));
}

function serverSends(workouts: Workout[], fromCache = false) {
  fake.workouts!.onChange(
    workouts.map((w) => ({ id: w.id, workout: w })),
    fromCache
  );
}

/** Opens a session, lets it load, and collects what subscribers are shown. */
async function openWithList(cc: CloudCache) {
  const shown: Workout[][] = [];
  const session = cc.openCloudSession(UID);
  cc.subscribeWorkouts(UID, (list) => shown.push(list));
  await session.loaded;
  await settle();
  return { session, shown };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  fake.confirmedUid = null;
  fake.nextId = 0;
  fake.sendWrite.mockReset().mockImplementation(
    (write: Record<string, unknown>) =>
      new Promise<void>((resolve, reject) => fake.pending.push({ write, resolve, reject }))
  );
  fake.restartNetwork.mockReset().mockResolvedValue(undefined);
  fake.getBodyweightLog.mockReset().mockResolvedValue([]);
});

describe("opening with no signal", () => {
  it("shows the saved copy straight away, before Firestore says anything", async () => {
    const workout = makeWorkout({ id: "w1", userId: UID, name: "Push" });
    let { cc } = launch();
    const first = await openWithList(cc);
    serverSends([workout]);
    await first.session.persistNow();

    ({ cc } = launch());
    const { shown } = await openWithList(cc);

    expect(shown.at(-1)?.map((w) => w.name)).toEqual(["Push"]);
  });

  it("ignores the cache's empty answer instead of emptying the list", async () => {
    const workout = makeWorkout({ id: "w1", userId: UID });
    let { cc } = launch();
    const first = await openWithList(cc);
    serverSends([workout]);
    await first.session.persistNow();

    ({ cc } = launch());
    const { shown } = await openWithList(cc);
    // What Firestore reports on React Native after ~10s with no network.
    serverSends([], true);

    expect(shown.at(-1)?.map((w) => w.id)).toEqual(["w1"]);
  });

  it("on a fresh install, stops waiting once the cache answers, even with nothing to show", async () => {
    const { cc } = launch();
    const { shown } = await openWithList(cc);
    expect(shown).toHaveLength(0);

    serverSends([], true);

    expect(shown).toEqual([[]]);
  });

  it("lets the server's answer replace the copy, including deletions made elsewhere", async () => {
    const kept = makeWorkout({ id: "kept", userId: UID });
    const deletedOnWeb = makeWorkout({ id: "gone", userId: UID });
    let { cc } = launch();
    const first = await openWithList(cc);
    serverSends([kept, deletedOnWeb]);
    await first.session.persistNow();

    ({ cc } = launch());
    const { shown } = await openWithList(cc);
    serverSends([kept]);

    expect(shown.at(-1)?.map((w) => w.id)).toEqual(["kept"]);
  });
});

describe("writing with no signal", () => {
  it("resolves once the change is on the phone, with the server never answering", async () => {
    const { cc } = launch();
    const { shown } = await openWithList(cc);
    confirmAuth();

    const { id, saved } = cc.createWorkoutLocalFirst(makeWorkout({ userId: UID, name: "Legs" }));
    await expect(saved).resolves.toBeUndefined();

    expect(fake.pending).toHaveLength(1);
    expect(shown.at(-1)?.find((w) => w.id === id)?.name).toBe("Legs");
  });

  it("holds every write back until Firebase confirms who is signed in", async () => {
    const { cc } = launch();
    await openWithList(cc);

    await cc.createWorkout(makeWorkout({ userId: UID, name: "Pull" }));
    expect(fake.sendWrite).not.toHaveBeenCalled();

    confirmAuth();
    expect(fake.sendWrite).toHaveBeenCalledTimes(1);
  });

  it("doesn't send anything while a different account is confirmed", async () => {
    const { cc } = launch();
    await openWithList(cc);
    confirmAuth("someone-else");

    await cc.createWorkout(makeWorkout({ userId: UID }));

    expect(fake.sendWrite).not.toHaveBeenCalled();
  });

  it("stamps createdAt on the phone, not whenever the server finally hears", async () => {
    const { cc } = launch();
    await openWithList(cc);
    confirmAuth();

    await cc.createWorkout({ ...makeWorkout({ userId: UID }), createdAt: new Date("2026-09-01T10:00:00Z") });

    expect(fake.sendWrite.mock.calls[0][0].data.createdAt).toEqual(new Date("2026-09-01T10:00:00Z"));
  });
});

describe("the app being killed with changes unsent", () => {
  it("keeps the change on the phone and sends it again on the next launch", async () => {
    let { cc } = launch();
    await openWithList(cc);
    confirmAuth();
    const { id, saved } = cc.createWorkoutLocalFirst(makeWorkout({ userId: UID, name: "Offline session" }));
    await saved;
    // Killed before the copy's delayed save, and before any ack.

    ({ cc } = launch());
    const { shown } = await openWithList(cc);
    expect(shown.at(-1)?.find((w) => w.id === id)?.name).toBe("Offline session");

    fake.sendWrite.mockClear();
    confirmAuth();
    expect(fake.sendWrite).toHaveBeenCalledWith(expect.objectContaining({ docId: id, kind: "set" }));
  });

  it("keeps the change through a cache answer that doesn't know about it yet", async () => {
    let { cc } = launch();
    await openWithList(cc);
    confirmAuth();
    const { id, saved } = cc.createWorkoutLocalFirst(makeWorkout({ userId: UID }));
    await saved;

    ({ cc } = launch());
    const { shown } = await openWithList(cc);
    serverSends([], true);

    expect(shown.at(-1)?.map((w) => w.id)).toEqual([id]);
  });

  it("lays a change still waiting on sign-in back over the server's answer", async () => {
    let { cc } = launch();
    await openWithList(cc);
    const { id, saved } = cc.createWorkoutLocalFirst(makeWorkout({ userId: UID }));
    await saved;

    ({ cc } = launch());
    const { shown } = await openWithList(cc);
    // The server answers before sign-in is confirmed, so the write hasn't
    // been handed to Firestore and isn't in its answer.
    serverSends([]);

    expect(shown.at(-1)?.map((w) => w.id)).toEqual([id]);
  });

  it("stops sending a change once the server acks it", async () => {
    let { cc } = launch();
    await openWithList(cc);
    confirmAuth();
    await cc.createWorkout(makeWorkout({ userId: UID }));
    fake.pending[0].resolve();
    await settle();

    ({ cc } = launch());
    await openWithList(cc);
    fake.sendWrite.mockClear();
    confirmAuth();

    expect(fake.sendWrite).not.toHaveBeenCalled();
  });

  it("drops a change the server refuses for good, rather than retrying it forever", async () => {
    let { cc } = launch();
    await openWithList(cc);
    confirmAuth();
    await cc.createWorkout(makeWorkout({ userId: UID }));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    fake.pending[0].reject({ code: "permission-denied" });
    await settle();

    ({ cc } = launch());
    await openWithList(cc);
    fake.sendWrite.mockClear();
    confirmAuth();

    expect(fake.sendWrite).not.toHaveBeenCalled();
  });
});

describe("an hour of sets with no signal", () => {
  it("keeps one entry per workout rather than one per set", async () => {
    const { cc } = launch();
    const { session } = await openWithList(cc);
    const { id, saved } = cc.createWorkoutLocalFirst(makeWorkout({ userId: UID }));
    await saved;

    for (let set = 0; set < 50; set++) {
      await cc.updateWorkout(id, { exercises: [] });
    }

    expect(session.pendingCount()).toBe(2); // the create, and the latest exercise list
  });
});

describe("supersedes", () => {
  let supersedes: CloudCache["supersedes"];
  beforeAll(() => {
    supersedes = launch().cc.supersedes;
  });
  const doc = { collection: "workouts" as const, docId: "w1" };

  it("lets an update replace an earlier update of the same fields", () => {
    expect(
      supersedes({ ...doc, kind: "update", data: { exercises: [], name: "x" } }, { ...doc, kind: "update", data: { exercises: [] } })
    ).toBe(true);
  });

  it("keeps an earlier update that set a field the later one doesn't", () => {
    expect(
      supersedes({ ...doc, kind: "update", data: { exercises: [] } }, { ...doc, kind: "update", data: { name: "x" } })
    ).toBe(false);
  });

  it("never lets an update absorb the set that may be what creates the document", () => {
    expect(supersedes({ ...doc, kind: "update", data: { exercises: [] } }, { ...doc, kind: "set", data: {} })).toBe(false);
    expect(
      supersedes({ ...doc, kind: "update", data: { a: 1 } }, { ...doc, kind: "set", merge: true, data: { a: 1 } })
    ).toBe(false);
  });

  it("lets a delete or a full set replace anything before it", () => {
    expect(supersedes({ ...doc, kind: "delete" }, { ...doc, kind: "update", data: { a: 1 } })).toBe(true);
    expect(supersedes({ ...doc, kind: "set", data: {} }, { ...doc, kind: "update", data: { a: 1 } })).toBe(true);
  });

  it("counts deleted fields as fields written", () => {
    expect(
      supersedes({ ...doc, kind: "update", data: {}, deleteFields: ["completedAt"] }, { ...doc, kind: "update", data: { completedAt: new Date() } })
    ).toBe(true);
  });

  it("never touches another document", () => {
    expect(supersedes({ ...doc, kind: "delete" }, { collection: "workouts", docId: "w2", kind: "update", data: {} })).toBe(false);
  });
});

describe("the exercise library", () => {
  const library = { custom: [], removedIds: ["bench-press"], overrides: [] };

  it("refuses a write while the library has never loaded, so it can't replace the real one", async () => {
    const { cc } = launch();
    await openWithList(cc);

    await expect(cc.updateExerciseLibrary(UID, library)).rejects.toBeInstanceOf(cc.LibraryNotLoadedError);
    expect(fake.sendWrite).not.toHaveBeenCalled();
  });

  it("still refuses after the cache's answer, which knows nothing", async () => {
    const { cc } = launch();
    await openWithList(cc);
    fake.docs.exerciseLibrary!.onChange(null, true);

    await expect(cc.updateExerciseLibrary(UID, library)).rejects.toBeInstanceOf(cc.LibraryNotLoadedError);
  });

  it("accepts writes once the server has answered, even that there's no library yet", async () => {
    const { cc } = launch();
    await openWithList(cc);
    fake.docs.exerciseLibrary!.onChange(null, false);

    await expect(cc.updateExerciseLibrary(UID, library)).resolves.toBeUndefined();
  });

  it("remembers the library across launches, so it can be edited offline", async () => {
    let { cc } = launch();
    const first = await openWithList(cc);
    fake.docs.exerciseLibrary!.onChange({ custom: [], removedIds: ["squat"], overrides: [] }, false);
    await first.session.persistNow();

    ({ cc } = launch());
    await openWithList(cc);
    const shown: unknown[] = [];
    cc.subscribeExerciseLibrary(UID, (lib) => shown.push(lib));
    await settle();

    expect(shown.at(-1)).toEqual({ custom: [], removedIds: ["squat"], overrides: [] });
    await expect(cc.updateExerciseLibrary(UID, library)).resolves.toBeUndefined();
  });
});

describe("lifetime stats", () => {
  it("defers them until the full history has arrived, then computes them from it", async () => {
    const { cc } = launch();
    await openWithList(cc);
    confirmAuth();

    await cc.upsertUserStats({ userId: UID, totalCompletedWorkouts: 0 } as never);
    expect(fake.sendWrite).not.toHaveBeenCalled();

    serverSends([
      makeWorkout({ id: "a", userId: UID, completedAt: new Date() }),
      makeWorkout({ id: "b", userId: UID, completedAt: new Date() }),
    ]);
    await settle();

    const statsWrite = fake.sendWrite.mock.calls.map(([w]) => w).find((w) => w.collection === "userStats");
    expect(statsWrite.data.totalCompletedWorkouts).toBe(2);
  });

  it("writes them directly once the history is complete", async () => {
    const { cc } = launch();
    await openWithList(cc);
    confirmAuth();
    serverSends([]);

    await cc.upsertUserStats({ userId: UID, totalCompletedWorkouts: 7 } as never);

    expect(fake.sendWrite).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "userStats", data: expect.objectContaining({ totalCompletedWorkouts: 7 }) })
    );
  });
});

describe("one workout", () => {
  it("doesn't call a workout gone just because it hasn't arrived yet", async () => {
    const { cc } = launch();
    await openWithList(cc);
    const seen: (Workout | null)[] = [];
    cc.subscribeWorkout("not-here", (w) => seen.push(w));
    serverSends([], true);
    await settle();
    expect(seen).toEqual([]);

    serverSends([]);
    expect(seen).toEqual([null]);
  });

  it("waits for the session when it subscribes first, as on a cold start into a workout", async () => {
    const { cc } = launch();
    const seen: (Workout | null)[] = [];
    cc.subscribeWorkout("w1", (w) => seen.push(w));

    const session = cc.openCloudSession(UID);
    await session.loaded;
    serverSends([makeWorkout({ id: "w1", userId: UID, name: "Arms" })]);

    expect(seen.at(-1)?.name).toBe("Arms");
  });

  it("shows an update without waiting for the server", async () => {
    const { cc } = launch();
    await openWithList(cc);
    serverSends([makeWorkout({ id: "w1", userId: UID, name: "Before" })]);
    const seen: (Workout | null)[] = [];
    cc.subscribeWorkout("w1", (w) => seen.push(w));
    await settle();

    await cc.updateWorkout("w1", { name: "After" });

    expect(seen.at(-1)?.name).toBe("After");
  });
});

describe("reopening a workout", () => {
  it("removes the finish fields from the copy, as Firestore's deleteField would", async () => {
    const { cc } = launch();
    const { shown } = await openWithList(cc);
    const finished = makeWorkout({
      id: "w1",
      userId: UID,
      startedAt: new Date(),
      completedAt: new Date(),
      durationMinutes: 40,
      totalVolume: 1000,
    });
    serverSends([finished]);

    await cc.reopenWorkout(finished);

    const reopened = shown.at(-1)!.find((w) => w.id === "w1")!;
    expect(reopened.completedAt).toBeUndefined();
    expect(reopened.totalVolume).toBeUndefined();
  });
});

describe("the weigh-in log", () => {
  it("prefers a change still waiting to upload over the server's older copy", async () => {
    const { cc } = launch();
    await openWithList(cc);
    fake.getBodyweightLog.mockResolvedValue([{ date: new Date("2026-01-01"), lbs: 190 }]);

    await cc.setBodyweightLog(UID, [{ date: new Date("2026-09-20"), lbs: 198 }]);

    expect((await cc.getBodyweightLog(UID)).map((e) => e.lbs)).toEqual([198]);
  });
});

describe("coming back to the front", () => {
  it("restarts the connection when there are changes waiting, so they don't sit out Firestore's backoff", async () => {
    const { cc, appState } = launch();
    await openWithList(cc);
    serverSends([]);
    await cc.createWorkout(makeWorkout({ userId: UID }));

    appState("active");

    expect(fake.restartNetwork).toHaveBeenCalled();
  });

  it("leaves a healthy connection alone", async () => {
    const { cc, appState } = launch();
    await openWithList(cc);
    serverSends([]);

    appState("active");

    expect(fake.restartNetwork).not.toHaveBeenCalled();
  });
});

describe("signing out", () => {
  it("deletes the account's copy and unsent changes from the phone", async () => {
    const { cc } = launch();
    const { session } = await openWithList(cc);
    serverSends([makeWorkout({ id: "w1", userId: UID })]);
    await cc.createWorkout(makeWorkout({ userId: UID }));
    await session.persistNow();
    expect((await AsyncStorage.getAllKeys()).some((k) => k.includes(UID))).toBe(true);

    await cc.forgetCloudData(UID);

    expect((await AsyncStorage.getAllKeys()).some((k) => k.includes(UID))).toBe(false);
    expect(fake.workouts).toBeNull();
  });

  it("counts unsent changes for the sign-out warning", async () => {
    const { cc } = launch();
    await openWithList(cc);
    expect(cc.pendingChangeCount(UID)).toBe(0);

    await cc.createWorkout(makeWorkout({ userId: UID }));

    expect(cc.pendingChangeCount(UID)).toBe(1);
  });

  it("writes nothing to disk for a session that learned nothing", async () => {
    const { cc } = launch();
    await openWithList(cc);

    await cc.closeCloudSession();

    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});

describe("after review", () => {
  it("won't let late work bring a signed-out account's data back onto the phone", async () => {
    const { cc } = launch();
    await openWithList(cc);
    await cc.forgetCloudData(UID);

    // A retry timer or repair loop that started before sign-out finishes now.
    await expect(cc.setBodyweightLog(UID, [])).rejects.toThrow("Signed out.");
    await expect(cc.getCompletedWorkouts(UID)).rejects.toThrow("Signed out.");
    const stop = cc.subscribeWorkouts(UID, () => {});
    stop();
    await settle();

    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(fake.workouts).toBeNull();
  });

  it("opens the account normally again when it signs back in", async () => {
    const { cc } = launch();
    await openWithList(cc);
    await cc.forgetCloudData(UID);

    cc.openCloudSession(UID);

    await expect(cc.createWorkout(makeWorkout({ userId: UID }))).resolves.toEqual(expect.any(String));
  });

  it("lets a restarted listener's first answer drop what was deleted while it was down", async () => {
    const { cc } = launch();
    const { shown } = await openWithList(cc);
    confirmAuth();
    serverSends([makeWorkout({ id: "a", userId: UID }), makeWorkout({ id: "b", userId: UID })]);

    jest.spyOn(console, "warn").mockImplementation(() => {});
    fake.workouts!.onError(Object.assign(new Error("unavailable"), { code: "unavailable" }));
    confirmAuth(); // re-attaches
    serverSends([makeWorkout({ id: "a", userId: UID })]);

    expect(shown.at(-1)?.map((w) => w.id)).toEqual(["a"]);
  });

  it("keeps a write that Firestore hasn't folded into its answer yet", async () => {
    const { cc } = launch();
    const { shown } = await openWithList(cc);
    confirmAuth();
    const { id, saved } = cc.createWorkoutLocalFirst(makeWorkout({ userId: UID }));
    await saved;

    // An answer computed a tick before the write reached Firestore.
    serverSends([]);

    expect(shown.at(-1)?.map((w) => w.id)).toEqual([id]);
  });

  it("lets anyone waiting for the server go when the session ends", async () => {
    const { cc } = launch();
    await openWithList(cc);
    const waiting = cc.whenCloudSynced(UID);

    await cc.forgetCloudData(UID);

    await expect(waiting).resolves.toBeUndefined();
  });

  it("saves a long history in slices, all of it", async () => {
    const { cc } = launch();
    const { session } = await openWithList(cc);
    serverSends(Array.from({ length: 60 }, (_, i) => makeWorkout({ id: `w${i}`, userId: UID })));

    await session.persistNow();

    const saved = (await AsyncStorage.getAllKeys()).filter((k) => k.includes(":w:"));
    expect(saved).toHaveLength(60);
  });
});

describe("a phone that has never been online since installing", () => {
  it("says the history isn't here yet, rather than that there is none", async () => {
    const { cc } = launch();
    await openWithList(cc);
    serverSends([], true);

    expect(cc.awaitingFirstSync(UID)).toBe(true);
  });

  it("stops saying so once the server has answered", async () => {
    const { cc } = launch();
    await openWithList(cc);
    serverSends([]);

    expect(cc.awaitingFirstSync(UID)).toBe(false);
  });

  it("never says so offline once a copy has been kept, even an empty one", async () => {
    let { cc } = launch();
    const first = await openWithList(cc);
    serverSends([]);
    await first.session.persistNow();

    ({ cc } = launch());
    await openWithList(cc);
    serverSends([], true);

    expect(cc.awaitingFirstSync(UID)).toBe(false);
  });
});

describe("saving whatever a real account holds", () => {
  it("saves a workout carrying a circular or non-plain object instead of failing the whole save", async () => {
    const { cc } = launch();
    const { session } = await openWithList(cc);
    class DocumentReferenceLike {
      self = this;
    }
    const odd = makeWorkout({ id: "odd", userId: UID }) as Workout & Record<string, unknown>;
    const loop: Record<string, unknown> = { name: "loop" };
    loop.me = loop;
    (odd.exercises as unknown as unknown[]).push({ ref: new DocumentReferenceLike(), loop } as never);
    serverSends([odd, makeWorkout({ id: "fine", userId: UID })]);

    await session.persistNow();

    const saved = (await AsyncStorage.getAllKeys()).filter((k) => k.includes(":w:"));
    expect(saved).toHaveLength(2);
  });

  it("tries a failed save again rather than treating it as saved", async () => {
    const { cc } = launch();
    const { session } = await openWithList(cc);
    const multiSet = jest.spyOn(AsyncStorage, "multiSet").mockRejectedValueOnce(new Error("disk full"));
    serverSends([makeWorkout({ id: "w1", userId: UID })]);
    await session.persistNow();
    expect((await AsyncStorage.getAllKeys()).some((k) => k.endsWith(":w:w1"))).toBe(false);

    await session.persistNow();

    expect((await AsyncStorage.getAllKeys()).some((k) => k.endsWith(":w:w1"))).toBe(true);
    multiSet.mockRestore();
  });

  it("reads entries one by one when the bulk read fails", async () => {
    let { cc } = launch();
    const first = await openWithList(cc);
    serverSends([makeWorkout({ id: "w1", userId: UID, name: "Kept" })]);
    await first.session.persistNow();

    ({ cc } = launch());
    const multiGet = jest.spyOn(AsyncStorage, "multiGet").mockRejectedValueOnce(new Error("bad entry"));
    const { shown } = await openWithList(cc);

    expect(shown.at(-1)?.map((w) => w.name)).toEqual(["Kept"]);
    multiGet.mockRestore();
  });

  it("reports what the copy is doing, including the last save before this launch", async () => {
    let { cc } = launch();
    const first = await openWithList(cc);
    serverSends([makeWorkout({ id: "w1", userId: UID })]);
    await first.session.persistNow();

    ({ cc } = launch());
    await openWithList(cc);
    const report = await cc.offlineDiagnostics(UID);

    expect(report).toContain("On disk: 1 workouts for this account");
    expect(report).toContain("Workouts in the copy: 1");
    expect(report).toMatch(/Last save before this launch: .*1 saved of 1/);
  });
});

describe("encoding", () => {
  it("round-trips dates, including Firestore Timestamps nested in sets", () => {
    const { encode, decode } = launch().cc;
    const when = new Date("2026-09-24T12:00:00Z");
    const timestampLike = { seconds: 1, nanoseconds: 0, toDate: () => when };

    const back = decode(JSON.parse(JSON.stringify(encode({ a: when, sets: [{ completedAt: timestampLike }], gone: undefined })))) as Record<string, unknown>;

    expect(back).toEqual({ a: when, sets: [{ completedAt: when }] });
  });
});
