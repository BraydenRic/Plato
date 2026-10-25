import { useSyncExternalStore } from "react";

import type { WatchLive } from "./watch-protocol";
import type { Workout } from "@/types";

/**
 * The newest live numbers from a session the watch is tracking, for the
 * phone's session screen. Held here rather than in state anywhere: watch-sync
 * receives them, the session screen shows them, and nothing else cares.
 * Never stored — a reading a minute old is just wrong.
 */

let current: WatchLive | null = null;
const listeners = new Set<() => void>();

export function setWatchLive(live: WatchLive | null): void {
  current = live;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWatchLive(): WatchLive | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Older than this and the watch has gone quiet; the phone's own clock takes over. */
export const LIVE_FRESH_MS = 20_000;
/** A session the watch didn't name, but started this close to it, is the same one. */
const SAME_START_MS = 5 * 60 * 1000;

/**
 * Whether a live reading is about this session. By id once the watch knows
 * it, by its start op for one it started, and otherwise — a session started
 * on the phone, the watch woken into it before it heard the id — by kind and
 * a start within a few minutes.
 */
export function liveBelongsTo(live: WatchLive, workout: Workout): boolean {
  if (live.workoutId) return live.workoutId === workout.id;
  if (live.startOpId && workout.cardio?.watchStartOpId) return live.startOpId === workout.cardio.watchStartOpId;
  return (
    workout.cardio?.kind === live.kind &&
    !!workout.startedAt &&
    Math.abs(workout.startedAt.getTime() - live.startedAt) < SAME_START_MS
  );
}

/** This session's reading, if there's a fresh one. */
export function liveFor(live: WatchLive | null, workout: Workout, nowMs: number): WatchLive | null {
  if (!live || nowMs - live.at > LIVE_FRESH_MS) return null;
  return liveBelongsTo(live, workout) ? live : null;
}
