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
let loaded = false;

export function traceWatch(step: string, now = new Date()): void {
  const stamp = now.toTimeString().slice(0, 8);
  lines = [...lines, `${stamp} ${step}`].slice(-LIMIT);
  AsyncStorage.setItem(KEY, JSON.stringify(lines)).catch(() => {});
}

/** The trace, oldest first, for the diagnostics alert. */
export async function readWatchTrace(): Promise<string[]> {
  if (!loaded) {
    loaded = true;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const stored = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(stored)) lines = [...(stored as string[]), ...lines].slice(-LIMIT);
    } catch {
      // Nothing worth crashing diagnostics over.
    }
  }
  return lines;
}

/** How waking the watch went for a session started on the phone. */
export type WatchStart =
  | { state: "waking"; at: number }
  | { state: "woken"; at: number }
  | { state: "failed"; reason: string };

const starts = new Map<string, WatchStart>();
const listeners = new Set<() => void>();
let version = 0;

export function setWatchStart(sessionId: string, start: WatchStart): void {
  starts.set(sessionId, start);
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWatchStart(sessionId: string): WatchStart | undefined {
  useSyncExternalStore(subscribe, () => version, () => version);
  return starts.get(sessionId);
}

/** For tests. */
export function resetWatchTrace(): void {
  lines = [];
  loaded = false;
  starts.clear();
  version += 1;
}
