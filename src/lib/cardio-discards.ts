import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import type { EndedCardio } from "./watch-protocol";
import { watchWasWoken } from "./watch-trace";
import type { Workout } from "@/types";

/**
 * Watch-tracked sessions thrown away on the phone.
 *
 * A deleted workout leaves no trace in the data for the snapshot to read, so
 * without this a watch still tracking one would carry on, and when it ended,
 * its finish — finding no session — would bring the discarded run straight
 * back. Remembered here for a few hours instead: long enough for a watch out
 * of range to hear, and for any finish already on its way to be turned away.
 */

const KEY = "plato.cardio.discarded.v1";
/** As long as a session ended on the phone keeps asking the watch to stop. */
const KEEP_MS = 6 * 60 * 60 * 1000;
const LIMIT = 50;

type Discard = EndedCardio & { at: number };

let discards: Discard[] = [];
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function changed() {
  listeners.forEach((listener) => listener());
}

function prune(list: Discard[], now: number): Discard[] {
  return list.filter((d) => now - d.at < KEEP_MS).slice(-LIMIT);
}

/** Reads what's on disk, once. Safe to call repeatedly. */
export function loadCardioDiscards(): Promise<void> {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) {
        discards = prune([...(parsed as Discard[]), ...discards], Date.now());
        changed();
      }
    })
    .catch(() => {});
  return loaded;
}

/**
 * Call when a session is thrown away on the phone. Only ones a watch has, or
 * was woken for, need it: a watch still starting up would otherwise carry on
 * into a run nobody wants.
 */
export function recordCardioDiscard(workout: Workout, now = Date.now()): void {
  // No watch involved, or the watch already sent what it measured: there's
  // nothing out there still to stop.
  if (!workout.cardio || workout.exercises[0]?.sets[0]?.tracked) return;
  if (!workout.cardio.watch && !watchWasWoken(workout.id)) return;
  discards = prune(
    [
      ...discards,
      {
        id: workout.id,
        startOpId: workout.cardio.watchStartOpId ?? null,
        kind: workout.cardio.kind,
        startedAt: (workout.startedAt ?? workout.createdAt).getTime(),
        discard: true,
        at: now,
      },
    ],
    now
  );
  changed();
  AsyncStorage.setItem(KEY, JSON.stringify(discards)).catch(() => {});
}

/** The discards to put in the snapshot. */
export function cardioDiscards(): EndedCardio[] {
  return discards.map(({ at: _at, ...ended }) => ended);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => discards;

/** Re-renders when a session is discarded, so the snapshot goes out at once. */
export function useCardioDiscards(): readonly Discard[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** A session discarded before the watch's start reached the phone is matched this close to it. */
const SAME_START_MS = 5 * 60 * 1000;

/** Whether an op from the watch is about a session thrown away here. */
export function isDiscarded(ref: {
  workoutId: string | null;
  startOpId: string | null;
  session?: string;
  startedAt?: number;
}): boolean {
  return discards.some(
    (d) =>
      (ref.workoutId != null && d.id === ref.workoutId) ||
      (ref.startOpId != null && d.startOpId === ref.startOpId) ||
      // Thrown away before the watch's start had linked it: by kind and start.
      (d.startOpId == null &&
        ref.session === d.kind &&
        ref.startedAt != null &&
        Math.abs(ref.startedAt - d.startedAt) < SAME_START_MS)
  );
}

/** For tests: forget everything, on disk and off. */
export function resetCardioDiscards(): void {
  discards = [];
  loaded = null;
  changed();
}
