import AsyncStorage from "@react-native-async-storage/async-storage";

import type { BodyweightEntry } from "@/types";

/**
 * An on-device copy of the last weigh-in log read from the cloud.
 *
 * Firestore's cache on React Native lives in memory only, so a cold start
 * with no signal — which in a gym is routine, not an edge case — has nothing
 * to fall back on, and the one-shot read of the log fails. The workout screen
 * then has no weight to value bodyweight sets with: it says "BW not set" over
 * a log that plainly has entries in it, and finishing the workout freezes those
 * sets at zero. Keeping the last good copy here means the log is available
 * whether or not the network is.
 *
 * Keyed per account so a second account on the same phone never sees it, and
 * dropped by account deletion — this is a record of someone's weight.
 */

const KEY_PREFIX = "bodyweight_log_cache_v1";

const keyFor = (userId: string) => `${KEY_PREFIX}:${userId}`;

export async function readCachedBodyweight(userId: string): Promise<BodyweightEntry[] | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    // Dates come back from JSON as strings; anything that doesn't revive into a
    // real date and weight is dropped rather than trusted.
    return parsed
      .map((e) => ({
        date: new Date((e as { date: string }).date),
        lbs: Number((e as { lbs: unknown }).lbs),
      }))
      .filter((e) => !Number.isNaN(e.date.getTime()) && Number.isFinite(e.lbs) && e.lbs > 0)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  } catch {
    // A corrupt copy is no copy. The cloud read is still on its way.
    return null;
  }
}

export async function writeCachedBodyweight(userId: string, log: BodyweightEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      keyFor(userId),
      JSON.stringify(log.map((e) => ({ date: e.date.toISOString(), lbs: e.lbs })))
    );
  } catch {
    // Best effort: failing to keep a spare copy must never fail a weigh-in.
  }
}

export async function forgetCachedBodyweight(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    // Nothing to do — the key is scoped to a uid that no longer exists.
  }
}
