import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

/**
 * What happened between the phone and the watch around cardio sessions, for
 * finding out on a real device where a session went missing.
 *
 * Two parts. A short trace of steps — the watch woken or not, its start and
 * finish arriving, what they matched — kept on the phone and shown in the
 * diagnostics behind a long press on Profile's version line. And, per
 * session, how waking the watch went, which the session screen shows in a
 * line under the clock: a watch that didn't take over says so there, rather
 * than the session quietly running on the phone's clock.
 */

const KEY = "plato.watch.trace.v1";
const LIMIT = 60;

let lines: string[] = [];
let loaded: Promise<void> | null = null;
/** Bumped by a clear, so a read already in flight can't merge the old trace back. */
let generation = 0;

/**
 * Merges what earlier launches stored in ahead of this launch's lines, once.
 * Every write waits on it: written before, a launch's first line would
 * replace the trace from the launch before — the one being looked into.
 */
function load(): Promise<void> {
  const gen = generation;
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (gen !== generation) return;
      const stored = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(stored)) lines = [...(stored as string[]), ...lines].slice(-LIMIT);
    })
    .catch(() => {
      // Nothing worth crashing diagnostics over.
    });
  return loaded;
}

export function traceWatch(step: string, now = new Date()): void {
  const stamp = now.toTimeString().slice(0, 8);
  lines = [...lines, `${stamp} ${step}`].slice(-LIMIT);
  const gen = generation;
  load()
    .then(() => (gen === generation ? AsyncStorage.setItem(KEY, JSON.stringify(lines)) : undefined))
    .catch(() => {});
}

/** The trace, oldest first, for the diagnostics alert. */
export async function readWatchTrace(): Promise<string[]> {
  await load();
  return lines;
}

/**
 * Drops the trace, here and on disk, when the person it describes leaves the
 * phone: sign-out, account deletion, deleting guest data. Its lines carry the
 * time, length and distance of their sessions, and the next person to use the
 * phone can open the diagnostics.
 */
export async function clearWatchTrace(): Promise<void> {
  generation += 1;
  lines = [];
  // Nothing left on disk to merge, so later writes needn't wait for a read.
  loaded = Promise.resolve();
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing worth failing a sign-out over.
  }
}

/** How waking the watch went for a session started on the phone. */
export type WatchStart =
  | { state: "waking"; at: number }
  | { state: "woken"; at: number }
  | { state: "failed"; reason: string };

const starts = new Map<string, WatchStart>();
const listeners = new Set<() => void>();

export function setWatchStart(sessionId: string, start: WatchStart): void {
  starts.set(sessionId, start);
  listeners.forEach((listener) => listener());
}

/** Whether a watch was woken for this session — so a discard of it has a watch to stop. */
export function watchWasWoken(sessionId: string): boolean {
  const state = starts.get(sessionId)?.state;
  return state === "waking" || state === "woken";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The value comes back through useSyncExternalStore, not read beside it: the
 * React Compiler caches a plain read like `starts.get(id)` per id, and the
 * line under the clock would say "Waking your watch…" forever.
 */
export function useWatchStart(sessionId: string): WatchStart | undefined {
  return useSyncExternalStore(
    subscribe,
    () => starts.get(sessionId),
    () => undefined
  );
}

/** For tests. */
export function resetWatchTrace(): void {
  lines = [];
  loaded = null;
  starts.clear();
  listeners.forEach((listener) => listener());
}
