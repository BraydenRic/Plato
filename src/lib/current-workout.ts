import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

/**
 * Which live workout you're on, when more than one is running.
 *
 * The resume bar and the Live Activity used to follow whichever workout started
 * last. With two going, picking the other from the bar opened it but left the
 * bar leading with the first, so the bar named one session while you were in
 * the other. Now the workout you last opened leads. Starting one opens it, so
 * a new workout still takes over the way it always did.
 *
 * Saved to the phone so it survives the app being closed mid-session. It's
 * only a workout id; anything it names that is no longer live is ignored (see
 * leadWorkout), so it can't go stale in a way anyone sees.
 */

const KEY = "plato.currentWorkout.v1";

let currentId: string | null = null;
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((saved) => {
    // Something opened in the moment before this read landed is newer.
    if (saved && currentId === null) {
      currentId = saved;
      listeners.forEach((listener) => listener());
    }
  })
  .catch(() => {});

/** Called when a live workout is opened. */
export function markCurrentWorkout(id: string): void {
  if (currentId === id) return;
  currentId = id;
  listeners.forEach((listener) => listener());
  AsyncStorage.setItem(KEY, id).catch(() => {});
}

export function readCurrentWorkoutId(): string | null {
  return currentId;
}

export function useCurrentWorkoutId(): string | null {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, readCurrentWorkoutId);
}
