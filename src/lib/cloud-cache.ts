import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

import {
  computeStats,
  getBodyweightLog as fetchBodyweightLog,
  listenUserDoc,
  listenWorkouts,
  newWorkoutId,
  onConfirmedUid,
  restartNetwork,
  sendWrite,
  stripUndefined,
  type CloudCollection,
  type CloudWrite,
} from "./firestore";
import { EMPTY_WEEKLY_PLAN, newId, reopenTiming, sanitizeExercises } from "./workout-utils";
import type { BodyweightEntry, ExerciseLibrary, UserStatistics, WeeklyPlan, Workout } from "@/types";

/**
 * The signed-in counterpart of local-store: a copy of the account's data kept
 * on the phone, so Plato works with no signal the way it already did for
 * guests.
 *
 * It exists because the Firebase JS SDK can't do this itself on React Native.
 * Its offline cache needs IndexedDB, which React Native doesn't have, so it
 * keeps everything in memory, and that fails in three ways:
 *
 *  - Open the app with no signal and there is nothing to show. The workout
 *    list arrives as an empty list, which looks exactly like an account with no
 *    history.
 *  - A write only settles when the server acks it. Every screen that waited on
 *    one — Finish, Start, Save as template, editing an exercise — spun until
 *    the signal came back, and never told anyone why.
 *  - Writes queued with no signal live in memory. If iOS closed the app before
 *    the signal returned, the sets were gone.
 *
 * So three pieces, per account:
 *
 *  - **The copy.** Workouts, the exercise library and the weekly split, saved
 *    to disk as they change. Screens read from it, never from Firestore.
 *  - **The outbox.** Every change is saved here before anything else happens,
 *    and leaves only when the server has acked it. Replayed on every launch, so
 *    a change survives the app being killed. Each one writes whole values (a
 *    workout's exercise list, never "add one set"), which is what makes sending
 *    one twice harmless.
 *  - **Firestore listeners.** They update the copy, but only with answers from
 *    the server. The cache's answers are the empty lists described above, so
 *    until the server has spoken once this launch, they are ignored.
 *
 * Firestore still does the sending. Its own queue, retries and ordering are
 * kept; the outbox only adds the part it can't do, surviving a restart.
 */

// ── Encoding ────────────────────────────────────────────────────────────────
// JSON turns Dates into strings, and nothing downstream expects a string. Dates
// are tagged on the way to disk and revived on the way back. Firestore
// Timestamps nested in sets (workoutFromDoc only converts top-level fields) are
// saved as Dates too; Firestore stores either kind the same way.

const DATE_TAG = "$date";

export function encode(value: unknown): unknown {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : { [DATE_TAG]: value.toISOString() };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    const maybeTimestamp = value as { toDate?: unknown };
    if (typeof maybeTimestamp.toDate === "function") {
      return encode((maybeTimestamp.toDate as () => Date).call(value));
    }
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (v !== undefined) out[key] = encode(v);
    }
    return out;
  }
  return value;
}

export function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const tagged = record[DATE_TAG];
    if (typeof tagged === "string" && Object.keys(record).length === 1) {
      const date = new Date(tagged);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(record)) out[key] = decode(v);
    return out;
  }
  return value;
}

// ── Pending writes ──────────────────────────────────────────────────────────

/** A write waiting for the server's ack. `id` names this entry, not the doc. */
export interface PendingWrite extends CloudWrite {
  id: string;
}

function fieldsTouched(write: CloudWrite): string[] {
  return [...Object.keys(write.data ?? {}), ...(write.deleteFields ?? [])];
}

/**
 * Whether `later` makes `earlier` pointless, so the outbox can drop it.
 *
 * Without this, an hour-long workout logged with no signal leaves hundreds of
 * entries behind, each one the whole exercise list again. Each write sets
 * whole values, so a later write that sets every field an earlier one did
 * leaves nothing of the earlier one on the server. That makes it safe to drop.
 *
 * One pairing is excluded on purpose: an update never absorbs the merge-set
 * before it. The set may be what creates the document, and an update on a
 * document that doesn't exist fails.
 */
export function supersedes(later: CloudWrite, earlier: CloudWrite): boolean {
  if (later.collection !== earlier.collection || later.docId !== earlier.docId) return false;
  // Both leave the document as they alone define it, whatever came before.
  if (later.kind === "delete" || (later.kind === "set" && !later.merge)) return true;
  const coversFields = () => {
    const covered = new Set(fieldsTouched(later));
    return fieldsTouched(earlier).every((field) => covered.has(field));
  };
  if (later.kind === "set") {
    // A merge-set covers an earlier merge-set or update of fewer fields. Not a
    // full set or a delete, which also cleared fields this one doesn't write.
    return (earlier.kind === "update" || (earlier.kind === "set" && !!earlier.merge)) && coversFields();
  }
  return earlier.kind === "update" && coversFields();
}

// ── The copy itself ─────────────────────────────────────────────────────────

const EMPTY_LIBRARY: ExerciseLibrary = { custom: [], removedIds: [], overrides: [] };

export interface MirrorState {
  workouts: Map<string, Workout>;
  /** Null until known. Writes would otherwise replace it with a blank one. */
  library: ExerciseLibrary | null;
  /** Null until known, for the same reason as the library. */
  weeklyPlan: WeeklyPlan | null;
}

function libraryFrom(data: Record<string, unknown> | null | undefined, base: ExerciseLibrary): ExerciseLibrary {
  const pick = <T,>(key: keyof ExerciseLibrary, fallback: T[]): T[] =>
    Array.isArray(data?.[key]) ? (data![key] as T[]) : fallback;
  return {
    custom: pick("custom", base.custom),
    removedIds: pick("removedIds", base.removedIds),
    overrides: pick("overrides", base.overrides),
  };
}

function planFrom(data: Record<string, unknown> | null | undefined): WeeklyPlan {
  const days = Array.isArray(data?.days) ? (data!.days as unknown[]) : [];
  return Array.from({ length: 7 }, (_, i) => (typeof days[i] === "string" ? (days[i] as string) : null));
}

function workoutFrom(id: string, data: Record<string, unknown>): Workout {
  const createdAt = data.createdAt instanceof Date ? data.createdAt : new Date();
  return {
    ...(data as unknown as Workout),
    id,
    isTemplate: Boolean(data.isTemplate),
    createdAt,
    exercises: sanitizeExercises(data.exercises, data.name),
  };
}

/**
 * Applies one write to the copy, the way Firestore would apply it to the
 * document. Returns the workout id it touched, if any, so the caller knows
 * what to save.
 */
export function applyWrite(state: MirrorState, write: CloudWrite): string | null {
  const data = write.data ?? {};
  switch (write.collection) {
    case "workouts": {
      const existing = state.workouts.get(write.docId);
      if (write.kind === "delete") {
        state.workouts.delete(write.docId);
      } else if (write.kind === "set") {
        const merged = write.merge && existing ? { ...existing, ...data } : data;
        state.workouts.set(write.docId, workoutFrom(write.docId, merged));
      } else if (existing) {
        // Firestore refuses an update to a missing document, so this skips it too.
        const next: Record<string, unknown> = { ...existing, ...data };
        for (const field of write.deleteFields ?? []) delete next[field];
        state.workouts.set(write.docId, workoutFrom(write.docId, next));
      }
      return write.docId;
    }
    case "exerciseLibrary":
      state.library =
        write.kind === "delete"
          ? EMPTY_LIBRARY
          : libraryFrom(data, write.merge ? (state.library ?? EMPTY_LIBRARY) : EMPTY_LIBRARY);
      return null;
    case "weeklyPlans":
      state.weeklyPlan = write.kind === "delete" ? EMPTY_WEEKLY_PLAN : planFrom(data);
      return null;
    default:
      // Weigh-ins and stats are sent but not kept here. The weigh-in log has
      // its own copy (bodyweight-cache), and nothing on the phone reads stats.
      return null;
  }
}

// ── Storage ─────────────────────────────────────────────────────────────────

const PREFIX = "plato.cloud.v1";
const metaKey = (uid: string) => `${PREFIX}:${uid}:meta`;
const outboxKey = (uid: string) => `${PREFIX}:${uid}:outbox`;
const workoutPrefix = (uid: string) => `${PREFIX}:${uid}:w:`;

interface Meta {
  /** The copy of the workouts has matched the server at least once. */
  workoutsSynced: boolean;
  library: ExerciseLibrary | null;
  weeklyPlan: WeeklyPlan | null;
  /**
   * Lifetime stats need recomputing from a history known to be complete.
   * See upsertUserStats.
   */
  statsDirty: boolean;
}

/**
 * How long the copy waits before saving. Saving is batched because a snapshot
 * lands after every set. The outbox itself saves immediately, and it alone is
 * enough to rebuild anything this delay could lose.
 */
const PERSIST_DELAY_MS = 400;
/** Workouts encoded per slice of a save, between yields to the UI. */
const PERSIST_BATCH = 25;

type Listener = () => void;

export class LibraryNotLoadedError extends Error {
  constructor(what: string) {
    super(`Your ${what} hasn't loaded on this phone yet. Connect once and it will.`);
    this.name = "LibraryNotLoadedError";
  }
}

class Session {
  readonly uid: string;
  readonly state: MirrorState = { workouts: new Map(), library: null, weeklyPlan: null };
  private meta: Meta = { workoutsSynced: false, library: null, weeklyPlan: null, statsDirty: false };
  private outbox: PendingWrite[] = [];
  /** Entries handed to Firestore this launch. Its queue is in memory, so after a restart this starts empty. */
  private sent = new Set<string>();
  readonly loaded: Promise<void>;
  private closed = false;
  private authConfirmed = false;
  private listeners = new Set<Listener>();

  // Each Firestore stream: what it last reported, and whether the server has
  // answered it yet this launch.
  private fsWorkouts = new Map<string, Workout>();
  private workoutsHeard = false;
  private workoutsServerSynced = false;
  private libraryHeard = false;
  private libraryServerSynced = false;
  private planHeard = false;
  private planServerSynced = false;
  private workoutErrors = new Set<(e: Error) => void>();

  private unsubscribers: { workouts?: () => void; library?: () => void; plan?: () => void } = {};
  private stopAuthWatch: (() => void) | null = null;

  /** Workout ids changed since the last save, and what was last saved per id. */
  private touched = new Set<string>();
  private savedJson = new Map<string, string>();
  /** Starts as the default, so a session that learns nothing writes nothing. */
  private savedMetaJson: string | null = JSON.stringify(encode(this.meta));
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** Serializes disk writes, so an older snapshot can't land after a newer one. */
  private diskChain: Promise<unknown> = Promise.resolve();

  private listCache: { version: number; list: Workout[] } | null = null;
  private version = 0;
  private syncWaiters: (() => void)[] = [];

  constructor(uid: string) {
    this.uid = uid;
    this.loaded = this.load().finally(() => {
      if (this.closed) return;
      this.attachListeners();
      this.stopAuthWatch = onConfirmedUid((confirmed) => this.onAuth(confirmed));
    });
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  private async load(): Promise<void> {
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(`${PREFIX}:${this.uid}:`));
      const pairs = await AsyncStorage.multiGet(keys);
      const prefix = workoutPrefix(this.uid);
      for (const [key, raw] of pairs) {
        if (raw == null) continue;
        try {
          const value = decode(JSON.parse(raw));
          if (key === metaKey(this.uid)) {
            this.meta = { ...this.meta, ...(value as Partial<Meta>) };
            this.savedMetaJson = raw;
          } else if (key === outboxKey(this.uid)) {
            this.outbox = Array.isArray(value) ? (value as PendingWrite[]) : [];
          } else if (key.startsWith(prefix)) {
            const id = key.slice(prefix.length);
            this.state.workouts.set(id, workoutFrom(id, value as Record<string, unknown>));
            this.savedJson.set(id, raw);
          }
        } catch (e) {
          // One unreadable entry costs that entry, not the whole copy. The
          // server's next answer puts it back.
          console.warn(`Skipped an unreadable offline entry (${key})`, e);
        }
      }
    } catch (e) {
      console.warn("Couldn't read the offline copy; starting from the server", e);
    }
    this.state.library = this.meta.library ? libraryFrom({ ...this.meta.library }, EMPTY_LIBRARY) : null;
    this.state.weeklyPlan = this.meta.weeklyPlan ? planFrom({ days: this.meta.weeklyPlan }) : null;
    // The copy is saved on a delay and the outbox isn't, so the outbox can be
    // ahead. Replaying it is harmless when it isn't, since every write sets
    // whole values.
    for (const write of this.outbox) this.markTouched(applyWrite(this.state, write));
    this.version++;
  }

  // ── Firestore ────────────────────────────────────────────────────────────

  private attachListeners(): void {
    if (this.closed) return;
    this.unsubscribers.workouts ??= listenWorkouts(
      this.uid,
      (changes, fromCache) => this.onWorkouts(changes, fromCache),
      (e) => {
        // A listener that errors is finished for good. Forget it so the next
        // sign-in confirmation or return to the front can start a new one,
        // and forget what it reported: the new one's first answer has to
        // replace the copy wholesale, or anything deleted elsewhere in the
        // meantime would stay in it.
        this.unsubscribers.workouts = undefined;
        this.fsWorkouts = new Map();
        this.workoutsServerSynced = false;
        console.warn(`Workout sync stopped: ${(e as { code?: string }).code ?? e.message}`, e);
        this.workoutErrors.forEach((onError) => onError(e));
      }
    );
    this.unsubscribers.library ??= listenUserDoc(
      "exerciseLibrary",
      this.uid,
      (data, fromCache) => this.onLibrary(data, fromCache),
      (e) => {
        this.unsubscribers.library = undefined;
        this.libraryServerSynced = false;
        console.warn("Exercise library sync stopped", e);
      }
    );
    this.unsubscribers.plan ??= listenUserDoc(
      "weeklyPlans",
      this.uid,
      (data, fromCache) => this.onPlan(data, fromCache),
      (e) => {
        this.unsubscribers.plan = undefined;
        this.planServerSynced = false;
        console.warn("Weekly split sync stopped", e);
      }
    );
  }

  /**
   * Writes not yet acked, to lay back over what the server reports.
   *
   * All of them, including ones already handed to Firestore. Firestore lays
   * its own pending writes over its answers too, but it delivers answers on a
   * later tick. An answer computed just before a write reached it would
   * otherwise briefly drop that write, showing "Workout not found" for a
   * workout started a moment ago. Every write sets whole values, so applying
   * one Firestore already applied changes nothing.
   */
  private pendingFor(collection: CloudCollection): PendingWrite[] {
    return this.outbox.filter((w) => w.collection === collection);
  }

  private onWorkouts(changes: { id: string; workout: Workout | null }[], fromCache: boolean): void {
    for (const { id, workout } of changes) {
      if (workout) this.fsWorkouts.set(id, workout);
      else this.fsWorkouts.delete(id);
    }
    this.workoutsHeard = true;
    const firstServerAnswer = !fromCache && !this.workoutsServerSynced;
    if (!fromCache) this.workoutsServerSynced = true;

    // Metadata only: an ack landing, or the connection dropping. Nothing a
    // screen shows has changed.
    if (changes.length === 0 && !firstServerAnswer) {
      if (!this.workoutsServerSynced) this.notify();
      return;
    }

    if (!this.workoutsServerSynced) {
      // Only the cache has answered. On React Native that's whatever this
      // launch happened to touch, often nothing, so it can't replace the copy.
      // Hearing from it still means Firestore gave up waiting for the network,
      // though, so screens holding out for data can stop waiting and show the
      // copy.
      this.notify();
      return;
    }

    if (firstServerAnswer) {
      // The server's full answer replaces the copy wholesale, with this
      // phone's unacked writes laid back on top.
      const before = [...this.state.workouts.keys()];
      this.state.workouts = new Map(this.fsWorkouts);
      for (const write of this.pendingFor("workouts")) applyWrite(this.state, write);
      before.forEach((id) => this.touched.add(id));
      this.state.workouts.forEach((_, id) => this.touched.add(id));
      this.meta.workoutsSynced = true;
      if (this.meta.statsDirty) this.recomputeStats();
      this.syncWaiters.splice(0).forEach((resolve) => resolve());
    } else {
      for (const { id, workout } of changes) {
        if (workout) this.state.workouts.set(id, workout);
        else this.state.workouts.delete(id);
        this.touched.add(id);
      }
      for (const write of this.pendingFor("workouts")) this.markTouched(applyWrite(this.state, write));
    }
    this.changed();
  }

  private onLibrary(data: Record<string, unknown> | null, fromCache: boolean): void {
    this.libraryHeard = true;
    if (!fromCache) this.libraryServerSynced = true;
    if (!this.libraryServerSynced) {
      this.notify();
      return;
    }
    const probe: MirrorState = { ...this.state, library: libraryFrom(data, EMPTY_LIBRARY) };
    for (const write of this.pendingFor("exerciseLibrary")) applyWrite(probe, write);
    if (JSON.stringify(probe.library) === JSON.stringify(this.state.library)) return;
    this.state.library = probe.library;
    this.changed();
  }

  private onPlan(data: Record<string, unknown> | null, fromCache: boolean): void {
    this.planHeard = true;
    if (!fromCache) this.planServerSynced = true;
    if (!this.planServerSynced) {
      this.notify();
      return;
    }
    const probe: MirrorState = { ...this.state, weeklyPlan: planFrom(data) };
    for (const write of this.pendingFor("weeklyPlans")) applyWrite(probe, write);
    if (JSON.stringify(probe.weeklyPlan) === JSON.stringify(this.state.weeklyPlan)) return;
    this.state.weeklyPlan = probe.weeklyPlan;
    this.changed();
  }

  private onAuth(confirmedUid: string | null): void {
    this.authConfirmed = confirmedUid === this.uid;
    if (!this.authConfirmed) return;
    this.attachListeners();
    this.flush();
  }

  /**
   * Hands every entry not yet sent this launch to Firestore, oldest first.
   *
   * Nothing is sent until Firebase confirms this uid is really signed in. The
   * app opens on the remembered account before that confirmation arrives, so
   * it doesn't stall on a bad signal. A write sent in that window would go out
   * signed out, and the rules would refuse it for good.
   */
  private flush(): void {
    if (!this.authConfirmed || this.closed) return;
    for (const write of this.outbox) this.send(write);
  }

  private send(write: PendingWrite): void {
    if (!this.authConfirmed || this.closed || this.sent.has(write.id)) return;
    this.sent.add(write.id);
    const { id, ...cloudWrite } = write;
    sendWrite(cloudWrite as CloudWrite).then(
      () => this.settle(id),
      (e) => {
        // Firestore only rejects what the server refused for good. Retrying
        // would be refused forever, so drop it. Firestore has already rolled
        // it back out of what it reports, so the copy follows on the next
        // snapshot.
        console.warn(`The server refused a change and it was dropped (${(e as { code?: string }).code ?? e})`, write);
        this.settle(id);
      }
    );
  }

  private settle(id: string): void {
    if (this.closed) return;
    const before = this.outbox.length;
    this.outbox = this.outbox.filter((w) => w.id !== id);
    if (this.outbox.length !== before) void this.saveOutbox().catch(() => {});
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  /**
   * Records a change. Resolves once it's safe on the phone, not on the server:
   * with no signal the server may be hours away, and nobody should wait that
   * long at the gym.
   */
  async write(change: CloudWrite): Promise<void> {
    await this.loaded;
    if (this.closed) throw new Error("Signed out before the change could be saved.");
    if (change.collection === "exerciseLibrary" && !this.state.library) {
      // A library write carries the whole library. Built from a copy that
      // never loaded, it would replace the real one with the defaults.
      throw new LibraryNotLoadedError("exercise library");
    }
    if (change.collection === "weeklyPlans" && !this.state.weeklyPlan) {
      throw new LibraryNotLoadedError("weekly split");
    }
    const entry: PendingWrite = {
      ...change,
      data: change.data ? (stripUndefined(change.data) as Record<string, unknown>) : undefined,
      id: newId(),
    };
    this.markTouched(applyWrite(this.state, entry));
    this.outbox = this.outbox.filter((earlier) => !supersedes(entry, earlier));
    this.outbox.push(entry);
    this.changed();
    this.send(entry);
    await this.saveOutbox();
  }

  /**
   * Saves the stored lifetime totals, or defers them.
   *
   * They're computed from the workouts the caller can see. Until the server
   * has answered once this launch, that list can be missing whatever was
   * logged on another device. Totals from it would overwrite good ones, and
   * plato-web reads these. So the request is noted instead, and redone from
   * the full history once it arrives.
   */
  upsertUserStats(stats: UserStatistics): Promise<void> {
    if (!this.workoutsServerSynced) {
      this.meta.statsDirty = true;
      this.schedulePersist();
      return Promise.resolve();
    }
    return this.write({ collection: "userStats", docId: this.uid, kind: "set", merge: true, data: { ...stats } });
  }

  private recomputeStats(): void {
    this.meta.statsDirty = false;
    const stats: UserStatistics = { userId: this.uid, ...computeStats(this.completed()) };
    this.write({ collection: "userStats", docId: this.uid, kind: "set", merge: true, data: { ...stats } }).catch(
      (e) => console.warn("Couldn't queue the lifetime stats", e)
    );
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  completed(): Workout[] {
    return [...this.state.workouts.values()]
      .filter((w) => !w.isTemplate && !!w.completedAt)
      .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
  }

  /** Newest first, and the same array until something changes, so React can skip re-renders. */
  list(): Workout[] {
    if (this.listCache?.version !== this.version) {
      const list = [...this.state.workouts.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      this.listCache = { version: this.version, list };
    }
    return this.listCache.list;
  }

  /**
   * Whether the copy is worth showing yet, or screens should keep their spinner.
   *
   * Anything in it counts. On a fresh install with no signal, a workout started
   * a moment ago is the one thing the copy has, and it should show up at once,
   * not after Firestore spends up to ten seconds deciding it's offline.
   */
  workoutsReady(): boolean {
    return this.meta.workoutsSynced || this.workoutsHeard || this.state.workouts.size > 0;
  }

  libraryReady(): boolean {
    return !!this.state.library || this.libraryHeard;
  }

  planReady(): boolean {
    return !!this.state.weeklyPlan || this.planHeard;
  }

  /** Whether a missing workout is known to be gone, rather than not arrived yet. */
  workoutsComplete(): boolean {
    return this.workoutsServerSynced;
  }

  /** The pending entry for the weigh-in log, newest wins. See getBodyweightLog. */
  pendingBodyweight(): BodyweightEntry[] | null {
    for (let i = this.outbox.length - 1; i >= 0; i--) {
      const write = this.outbox[i];
      if (write.collection !== "bodyweight") continue;
      const raw = Array.isArray(write.data?.entries) ? (write.data!.entries as Record<string, unknown>[]) : [];
      return raw
        .map((e) => ({ date: e.date as Date, lbs: Number(e.lbs) }))
        .filter((e) => e.date instanceof Date && Number.isFinite(e.lbs));
    }
    return null;
  }

  pendingCount(): number {
    return this.outbox.length;
  }

  whenSynced(): Promise<void> {
    if (this.workoutsServerSynced) return Promise.resolve();
    return new Promise((resolve) => this.syncWaiters.push(resolve));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onWorkoutError(onError: (e: Error) => void): () => void {
    this.workoutErrors.add(onError);
    return () => {
      this.workoutErrors.delete(onError);
    };
  }

  // ── Plumbing ─────────────────────────────────────────────────────────────

  private markTouched(id: string | null): void {
    if (id) this.touched.add(id);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  private changed(): void {
    this.version++;
    this.meta.library = this.state.library;
    this.meta.weeklyPlan = this.state.weeklyPlan;
    this.schedulePersist();
    this.notify();
  }

  private saveOutbox(): Promise<void> {
    const run = this.diskChain.then(async () => {
      if (this.closed) return;
      if (this.outbox.length === 0) await AsyncStorage.removeItem(outboxKey(this.uid));
      else await AsyncStorage.setItem(outboxKey(this.uid), JSON.stringify(encode(this.outbox)));
    });
    this.diskChain = run.catch((e) => console.warn("Couldn't save pending changes", e));
    return run;
  }

  private schedulePersist(): void {
    if (this.persistTimer || this.closed) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistNow();
    }, PERSIST_DELAY_MS);
  }

  /**
   * Saves what changed since the last save. Also called when the app goes to
   * the background.
   *
   * In batches, yielding between them. The server's first answer each launch
   * marks the whole history as changed, and encoding a long one in one go
   * (1,500 workouts is about 7 MB of JSON) freezes the screen just after it
   * appears. Unchanged workouts are skipped once encoded, so after the first
   * save of a launch this is only what actually changed.
   */
  persistNow(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    const ids = [...this.touched];
    this.touched.clear();
    const prefix = workoutPrefix(this.uid);
    const run = this.diskChain.then(async () => {
      for (let from = 0; from < ids.length; from += PERSIST_BATCH) {
        if (from > 0) await new Promise((resolve) => setTimeout(resolve, 0));
        if (this.closed) return;
        const sets: [string, string][] = [];
        const removals: string[] = [];
        for (const id of ids.slice(from, from + PERSIST_BATCH)) {
          const workout = this.state.workouts.get(id);
          if (!workout) {
            if (this.savedJson.delete(id)) removals.push(prefix + id);
            continue;
          }
          const json = JSON.stringify(encode(workout));
          if (this.savedJson.get(id) === json) continue;
          this.savedJson.set(id, json);
          sets.push([prefix + id, json]);
        }
        if (sets.length) await AsyncStorage.multiSet(sets);
        if (removals.length) await AsyncStorage.multiRemove(removals);
      }
      if (this.closed) return;
      const metaJson = JSON.stringify(encode(this.meta));
      if (metaJson !== this.savedMetaJson) {
        this.savedMetaJson = metaJson;
        await AsyncStorage.setItem(metaKey(this.uid), metaJson);
      }
    });
    this.diskChain = run.catch((e) => console.warn("Couldn't save the offline copy", e));
    return this.diskChain.then(() => {});
  }

  /** Called when the app comes back to the front. */
  resume(): void {
    if (this.closed) return;
    if (this.authConfirmed) this.attachListeners();
    if (this.outbox.length > 0 || !this.workoutsServerSynced) {
      restartNetwork().catch((e) => console.warn("Couldn't restart the connection", e));
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    await this.persistNow();
    this.closed = true;
    this.detach();
  }

  /**
   * Lets go of anyone waiting for a server answer this session will never
   * get. Migration waits on one, and a wait that never ends would keep it
   * from running again when the account signs back in this launch. Callers
   * check whether their session is still the current one after waking.
   */
  private releaseWaiters(): void {
    this.syncWaiters.splice(0).forEach((resolve) => resolve());
  }

  /** Stops everything and deletes this account's copy and outbox from the phone. */
  async forget(): Promise<void> {
    this.closed = true;
    this.detach();
    await this.diskChain;
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(`${PREFIX}:${this.uid}:`));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  }

  private detach(): void {
    this.releaseWaiters();
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    Object.values(this.unsubscribers).forEach((unsubscribe) => unsubscribe?.());
    this.unsubscribers = {};
    this.stopAuthWatch?.();
    this.stopAuthWatch = null;
    this.listeners.clear();
    this.workoutErrors.clear();
  }
}

// ── The current account ─────────────────────────────────────────────────────

let current: Session | null = null;
let appStateWatch: { remove: () => void } | null = null;
/** Told whenever `current` changes, for subscribers that only know a workout id. */
const sessionWatchers = new Set<() => void>();

function watchAppState(): void {
  appStateWatch ??= AppState.addEventListener("change", (next) => {
    if (next === "active") current?.resume();
    // iOS can close a backgrounded app without warning. Nothing is lost if it
    // does, because the outbox is already on disk, but saving the copy now
    // saves re-deriving it on the next launch.
    else if (next === "background") void current?.persistNow();
  });
}

/**
 * Accounts signed out of during this launch.
 *
 * Signing out deletes the copy, but work that started before it can still
 * finish afterwards: a weigh-in read retrying on a timer, a volume repair
 * partway through its loop. Each would open a fresh session for the account
 * and write its data straight back to the phone. So these accounts are refused
 * until a sign-in opens them again.
 */
const signedOut = new Set<string>();

/**
 * Starts (or returns) the session for this account, ending any other one.
 * For AuthContext, which calls it the moment an account is signed in; that's
 * what lifts a sign-out's refusal.
 */
export function openCloudSession(uid: string): Session {
  signedOut.delete(uid);
  return sessionFor(uid)!;
}

/** The session for this account, or null if it has been signed out of. */
function sessionFor(uid: string): Session | null {
  if (signedOut.has(uid)) return null;
  if (current?.uid !== uid) {
    void current?.close();
    current = new Session(uid);
    watchAppState();
    sessionWatchers.forEach((watcher) => watcher());
  }
  return current;
}

/** Ends the session and keeps its data on disk. Unsent changes wait for the next sign-in. */
export async function closeCloudSession(): Promise<void> {
  const session = current;
  current = null;
  await session?.close();
}

/**
 * Deletes an account's copy and unsent changes from this phone, for sign-out
 * and account deletion. It's someone's training history, and it shouldn't
 * outstay them on a shared phone any more than the weigh-in copy does.
 */
export async function forgetCloudData(uid: string): Promise<void> {
  signedOut.add(uid);
  if (current?.uid === uid) {
    const session = current;
    current = null;
    await session.forget();
    return;
  }
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(`${PREFIX}:${uid}:`));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}

/** Changes on this phone the server hasn't acked yet, for the sign-out warning. */
export function pendingChangeCount(uid: string): number {
  return current?.uid === uid ? current.pendingCount() : 0;
}

/** Resolves once the server has answered for this account's workouts this launch. */
export function whenCloudSynced(uid: string): Promise<void> {
  return sessionFor(uid)?.whenSynced() ?? Promise.resolve();
}

/** Records a change for this account, or rejects once it has been signed out of. */
function writeFor(uid: string, change: CloudWrite): Promise<void> {
  const session = sessionFor(uid);
  return session ? session.write(change) : Promise.reject(new Error("Signed out."));
}

/** For async entry points: the session, or a rejection once signed out. */
function activeSession(uid: string): Session {
  const session = sessionFor(uid);
  if (!session) throw new Error("Signed out.");
  return session;
}

function requireSession(): Session {
  if (!current) throw new Error("No signed-in account.");
  return current;
}

// ── The data.ts surface ─────────────────────────────────────────────────────
// Same names and shapes as firestore.ts and local-store.ts, so data.ts routes
// signed-in calls here without any screen knowing.

export function subscribeWorkouts(
  userId: string,
  onChange: (workouts: Workout[]) => void,
  onError?: (e: Error) => void
): () => void {
  const session = sessionFor(userId);
  if (!session) return () => {};
  let last: Workout[] | null = null;
  const emit = () => {
    if (!session.workoutsReady()) return;
    const list = session.list();
    if (list === last) return;
    last = list;
    onChange(list);
  };
  const stopListening = session.subscribe(emit);
  const stopErrors = onError ? session.onWorkoutError(onError) : () => {};
  session.loaded.then(emit);
  return () => {
    stopListening();
    stopErrors();
  };
}

/**
 * One workout, by id.
 *
 * An id alone doesn't say whose session to read, so this follows whichever is
 * open, and waits if none is yet. That happens on a cold start straight into a
 * workout, such as from the Live Activity. React runs the screen's effects
 * before AuthProvider's, so the screen subscribes before the session opens.
 */
export function subscribeWorkout(id: string, onChange: (workout: Workout | null) => void): () => void {
  let detach = () => {};
  let attachedTo: Session | null = null;
  const attach = () => {
    if (current === attachedTo) return;
    detach();
    attachedTo = current;
    detach = current ? watchWorkout(current, id, onChange) : () => {};
  };
  attach();
  sessionWatchers.add(attach);
  return () => {
    sessionWatchers.delete(attach);
    detach();
  };
}

function watchWorkout(session: Session, id: string, onChange: (workout: Workout | null) => void): () => void {
  let last: Workout | null | undefined;
  const emit = () => {
    const workout = session.state.workouts.get(id) ?? null;
    // A workout missing from the copy may simply not have arrived yet. Say
    // "gone" only once the server has confirmed it, or the screen would read
    // "deleted on another device" over a workout that's merely offline.
    if (!workout && !session.workoutsComplete()) return;
    if (workout === last) return;
    last = workout;
    onChange(workout);
  };
  const stop = session.subscribe(emit);
  session.loaded.then(emit);
  return stop;
}

export async function getWorkout(id: string): Promise<Workout | null> {
  const session = requireSession();
  await session.loaded;
  return session.state.workouts.get(id) ?? null;
}

export async function getCompletedWorkouts(userId: string): Promise<Workout[]> {
  const session = activeSession(userId);
  await session.loaded;
  return session.completed();
}

/**
 * The client stamps createdAt. Firestore's serverTimestamp would stamp the
 * moment the write finally reached the server, which for a workout started
 * with no signal could be hours after it began.
 */
export function createWorkoutLocalFirst(workout: Omit<Workout, "id">): { id: string; saved: Promise<void> } {
  const id = newWorkoutId();
  const saved = writeFor(workout.userId, {
    collection: "workouts",
    docId: id,
    kind: "set",
    data: { ...workout, createdAt: workout.createdAt ?? new Date() },
  });
  return { id, saved };
}

export async function createWorkout(workout: Omit<Workout, "id">): Promise<string> {
  const { id, saved } = createWorkoutLocalFirst(workout);
  await saved;
  return id;
}

export function updateWorkout(id: string, updates: Partial<Workout>): Promise<void> {
  return requireSession().write({ collection: "workouts", docId: id, kind: "update", data: { ...updates } });
}

export async function deleteWorkout(workout: Workout): Promise<void> {
  const session = activeSession(workout.userId);
  await session.write({ collection: "workouts", docId: workout.id, kind: "delete" });
  // Removing a finished workout changes the lifetime totals plato-web reads.
  if (workout.completedAt && !workout.isTemplate) {
    await session.upsertUserStats({ userId: workout.userId, ...computeStats(session.completed()) });
  }
}

/** See firestore.reopenWorkout, which this mirrors field for field. */
export function reopenWorkout(workout: Workout): Promise<void> {
  const data: Record<string, unknown> = {};
  const deleteFields = ["completedAt", "durationMinutes", "totalVolume"];
  const timing = reopenTiming(workout);
  if (timing.kind === "backlog") {
    deleteFields.push("startedAt");
    data.scheduledFor = timing.scheduledFor;
  } else if (timing.kind === "resume") {
    data.startedAt = timing.startedAt;
  }
  return writeFor(workout.userId, {
    collection: "workouts",
    docId: workout.id,
    kind: "update",
    data,
    deleteFields,
  });
}

export function subscribeExerciseLibrary(userId: string, onChange: (library: ExerciseLibrary) => void): () => void {
  const session = sessionFor(userId);
  if (!session) return () => {};
  let last: ExerciseLibrary | null | undefined;
  const emit = () => {
    if (!session.libraryReady()) return;
    if (session.state.library === last && last !== undefined) return;
    last = session.state.library;
    onChange(session.state.library ?? EMPTY_LIBRARY);
  };
  const stop = session.subscribe(emit);
  session.loaded.then(emit);
  return stop;
}

export function updateExerciseLibrary(userId: string, library: ExerciseLibrary): Promise<void> {
  return writeFor(userId, {
    collection: "exerciseLibrary",
    docId: userId,
    kind: "set",
    merge: true,
    data: { userId, ...library },
  });
}

export function subscribeWeeklyPlan(userId: string, onChange: (plan: WeeklyPlan) => void): () => void {
  const session = sessionFor(userId);
  if (!session) return () => {};
  let last: WeeklyPlan | null | undefined;
  const emit = () => {
    if (!session.planReady()) return;
    if (session.state.weeklyPlan === last && last !== undefined) return;
    last = session.state.weeklyPlan;
    onChange(session.state.weeklyPlan ?? EMPTY_WEEKLY_PLAN);
  };
  const stop = session.subscribe(emit);
  session.loaded.then(emit);
  return stop;
}

export function setWeeklyPlan(userId: string, days: WeeklyPlan): Promise<void> {
  return writeFor(userId, {
    collection: "weeklyPlans",
    docId: userId,
    kind: "set",
    merge: true,
    data: { userId, days },
  });
}

/**
 * The weigh-in log. A pending change wins over the server's copy, because it's
 * newer. Firestore would say the same while its own queue holds that change,
 * but after a restart its queue is empty until the outbox refills it.
 */
export async function getBodyweightLog(userId: string): Promise<BodyweightEntry[]> {
  const session = activeSession(userId);
  await session.loaded;
  const pending = session.pendingBodyweight();
  if (pending) return pending.sort((a, b) => a.date.getTime() - b.date.getTime());
  return fetchBodyweightLog(userId);
}

export function setBodyweightLog(userId: string, log: BodyweightEntry[]): Promise<void> {
  return writeFor(userId, {
    collection: "bodyweight",
    docId: userId,
    kind: "set",
    data: { entries: log.map((e) => ({ date: e.date, lbs: e.lbs })) },
  });
}

export function upsertUserStats(stats: UserStatistics): Promise<void> {
  const session = sessionFor(stats.userId);
  return session ? session.upsertUserStats(stats) : Promise.reject(new Error("Signed out."));
}
