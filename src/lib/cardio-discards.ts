import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { measuredByWatch } from "./cardio-tracking";
import { isGuestUserId } from "./local-store";
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

/**
 * What's kept of one. `userId` and `indoor` stay on the phone — the snapshot
 * carries only the EndedCardio part — and are absent from entries written
 * before they were kept, which match whoever and wherever.
 */
type Discard = EndedCardio & { userId?: string; indoor?: boolean };

/**
 * Whether a discard made by `owner` is `userId`'s: their own, or a guest's
 * carried into the account they signed in to — the rule claimInbox keeps for
 * the watch's ops, which move across with them.
 */
function discardBelongsTo(owner: string | undefined, userId: string | null | undefined): boolean {
  return userId == null || owner == null || owner === userId || (isGuestUserId(owner) && !isGuestUserId(userId));
}

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

function remember(workout: Workout, startOpId: string | null, now: number) {
  const cardio = workout.cardio!;
  discards = prune(
    [
      ...discards,
      {
        id: workout.id,
        startOpId,
        kind: cardio.kind,
        startedAt: (workout.startedAt ?? workout.createdAt).getTime(),
        discard: true,
        at: now,
        userId: workout.userId,
        ...(cardio.indoor != null ? { indoor: cardio.indoor } : {}),
      },
    ],
    now
  );
  persist();
}

function persist() {
  changed();
  AsyncStorage.setItem(KEY, JSON.stringify(discards)).catch(() => {});
}

/**
 * Call when a session is thrown away on the phone. Only ones a watch has, or
 * was woken for, need it: a watch still starting up would otherwise carry on
 * into a run nobody wants.
 */
export function recordCardioDiscard(workout: Workout, now = Date.now()): void {
  // No watch involved, or the watch already sent what it measured: there's
  // nothing out there still to stop.
  if (!workout.cardio || measuredByWatch(workout.exercises[0]?.sets[0]?.tracked)) return;
  if (!workout.cardio.watch && !watchWasWoken(workout.id)) return;
  remember(workout, workout.cardio.watchStartOpId ?? null, now);
}

/**
 * A woken watch whose start arrived after the phone had already ended the
 * session: it began tracking once the session was over, so it's told to stop
 * and keep nothing — by its own start op, the one way it's sure to know
 * itself. The session stays as the phone saved it.
 */
export function discardWatchStart(workout: Workout, startOpId: string, now = Date.now()): void {
  if (!workout.cardio) return;
  remember(workout, startOpId, now);
}

/** The discards to put in this account's snapshot. */
export function cardioDiscards(userId?: string | null): EndedCardio[] {
  return discards
    .filter((d) => discardBelongsTo(d.userId, userId))
    .map(({ userId: _userId, indoor: _indoor, ...ended }) => ended);
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

type DiscardRef = {
  workoutId: string | null;
  startOpId: string | null;
  /** Who the op is being applied to: another account's discards never match by kind and start. */
  userId?: string | null;
  session?: string;
  indoor?: boolean;
  startedAt?: number;
  /**
   * When a session still here that the op could equally be about started.
   * A discard then matches by kind and start only if it started nearer: a
   * run discarded and started again seconds later wakes the watch for the
   * new one, and that start mustn't be taken for the old one's.
   */
  rivalStartedAt?: number;
};

function findDiscard(ref: DiscardRef): Discard | undefined {
  return discards.find((d) => {
    if (ref.workoutId != null && d.id === ref.workoutId) return true;
    if (ref.startOpId != null && d.startOpId === ref.startOpId) return true;
    // Thrown away before the watch's start had linked it: by kind and start.
    if (d.startOpId != null || ref.session !== d.kind || ref.startedAt == null) return false;
    if (!discardBelongsTo(d.userId, ref.userId)) return false;
    if (ref.indoor != null && d.indoor != null && ref.indoor !== d.indoor) return false;
    const gap = Math.abs(ref.startedAt - d.startedAt);
    return gap < SAME_START_MS && (ref.rivalStartedAt == null || gap < Math.abs(ref.startedAt - ref.rivalStartedAt));
  });
}

/** Whether an op from the watch is about a session thrown away here. */
export function isDiscarded(ref: DiscardRef): boolean {
  return findDiscard(ref) != null;
}

/**
 * A woken watch's start turned away as being for a session thrown away here
 * before that start arrived: the watch is told by its own start op as well.
 * It takes a discard by kind and start only if it was made after the phone
 * woke it (CardioMatch.ended), so one made in the seconds the wake took to
 * reach it would otherwise leave it tracking a run nobody keeps.
 */
export function discardStartFor(ref: DiscardRef, startOpId: string, now = Date.now()): void {
  const found = findDiscard(ref);
  if (!found || found.startOpId != null) return;
  discards = prune([...discards, { ...found, startOpId, at: now }], now);
  persist();
}

/** For tests: forget everything, on disk and off. */
export function resetCardioDiscards(): void {
  discards = [];
  loaded = null;
  changed();
}
