import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import PlatoHealth from "../../modules/plato-health";
import { useAuth } from "@/context/AuthContext";
import { useWeightUnit } from "@/context/UnitContext";
import { useWorkouts } from "@/hooks/use-workouts";
import { computeStats, createWorkoutLocalFirst, getCompletedWorkouts, upsertUserStats } from "@/lib/data";
import {
  IMPORTED_ACTIVITIES,
  buildImportedWorkout,
  importedHealthIds,
  wantsDistanceSamples,
  workoutsToImport,
} from "@/lib/health-import";

/**
 * Bringing cardio in from Apple Health.
 *
 * Off until someone turns it on in Profile, and then it runs whenever Plato
 * comes to the front: a run finished on the watch is in History by the time
 * you look. Imported workouts are ordinary Plato workouts from then on — saved
 * to the account like any other, so they reach plato-web and survive being
 * deleted from Health.
 */

/**
 * Per account, not per phone: Health holds the phone owner's data, and a
 * second Plato account signed in on the same phone must not quietly fill up
 * with someone else's runs.
 */
export const HEALTH_KEY_PREFIX = "plato.health.v1:";
/** How far back turning it on reaches. A year of history, not a decade of walks. */
export const FIRST_IMPORT_DAYS = 365;
/**
 * Each import asks again about the week before the last one. A watch can take
 * a while to hand a workout to the phone, and apps like Strava save theirs when
 * they upload, so a workout can land in Health well after it ended.
 */
export const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
/** Ids remembered so a deleted import stays deleted — see workoutsToImport. */
const SEEN_LIMIT = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Stored = { enabled: boolean; lastSync?: number; seen: string[] };
const NOTHING_STORED: Stored = { enabled: false, seen: [] };

function parseStored(raw: string | null): Stored {
  if (!raw) return NOTHING_STORED;
  try {
    const value = JSON.parse(raw) as Partial<Stored>;
    return {
      enabled: value.enabled === true,
      lastSync: typeof value.lastSync === "number" ? value.lastSync : undefined,
      seen: Array.isArray(value.seen) ? value.seen.filter((id): id is string => typeof id === "string") : [],
    };
  } catch {
    return NOTHING_STORED;
  }
}

type HealthImportState = {
  /** There's a Health to read: an iPhone build, not Jest, the web or Android. */
  available: boolean;
  enabled: boolean;
  importing: boolean;
  /** Workouts in Plato that came from Health. */
  importedCount: number;
  /** The last attempt to read Health failed outright. */
  failed: boolean;
  /** Turning it on shows iOS's permission sheet first, the first time. */
  setEnabled: (on: boolean) => Promise<void>;
};

const UNAVAILABLE: HealthImportState = {
  available: false,
  enabled: false,
  importing: false,
  importedCount: 0,
  failed: false,
  setEnabled: async () => {},
};

const HealthImportContext = createContext<HealthImportState>(UNAVAILABLE);

export function HealthImportProvider({ children }: { children: React.ReactNode }) {
  // Asked once: whether the phone has Health doesn't change while Plato runs.
  const [available] = useState(() => {
    try {
      return PlatoHealth?.isAvailable() === true;
    } catch {
      return false;
    }
  });
  if (!available) {
    return <HealthImportContext.Provider value={UNAVAILABLE}>{children}</HealthImportContext.Provider>;
  }
  return <HealthImportRunner>{children}</HealthImportRunner>;
}

export function useHealthImport() {
  return useContext(HealthImportContext);
}

function HealthImportRunner({ children }: { children: React.ReactNode }) {
  const { dataUserId } = useAuth();
  const { unit, loaded: unitLoaded } = useWeightUnit();
  const { completed, loading, awaitingSync } = useWorkouts();
  // Null until this account's setting has been read, so nothing runs on a
  // guess — and reset on every account change, so one account's setting never
  // carries into the next.
  const [stored, setStored] = useState<Stored | null>(null);
  const [importing, setImporting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [foregrounds, setForegrounds] = useState(0);

  useEffect(() => {
    setStored(null);
    setFailed(false);
    if (!dataUserId) return;
    let cancelled = false;
    AsyncStorage.getItem(HEALTH_KEY_PREFIX + dataUserId)
      .then((raw) => {
        if (!cancelled) setStored(parseStored(raw));
      })
      .catch(() => {
        if (!cancelled) setStored(NOTHING_STORED);
      });
    return () => {
      cancelled = true;
    };
  }, [dataUserId]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setForegrounds((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const imported = useMemo(() => importedHealthIds(completed), [completed]);

  // What an import in flight reads: the newest render's values, not the ones
  // it started with — the account can change, or the setting be turned off,
  // between one workout and the next.
  // Declared before the effect that starts an import, so one started in the
  // same commit already reads this render.
  const latest = useRef({ dataUserId, unit, imported, stored });
  useEffect(() => {
    latest.current = { dataUserId, unit, imported, stored };
  });
  const running = useRef(false);

  function save(userId: string, next: Stored) {
    if (latest.current.dataUserId === userId) setStored(next);
    AsyncStorage.setItem(HEALTH_KEY_PREFIX + userId, JSON.stringify(next)).catch(() => {});
  }

  async function runImport() {
    const userId = latest.current.dataUserId;
    const startedWith = latest.current.stored;
    if (running.current || !PlatoHealth || !userId || !startedWith?.enabled) return;
    running.current = true;
    setImporting(true);
    try {
      const now = Date.now();
      const since =
        startedWith.lastSync != null ? startedWith.lastSync - LOOKBACK_MS : now - FIRST_IMPORT_DAYS * DAY_MS;
      const found = await PlatoHealth.getWorkouts(since, IMPORTED_ACTIVITIES);
      const seen = new Set(startedWith.seen);
      const fresh = workoutsToImport(found, latest.current.imported, seen);
      for (const workout of fresh) {
        if (latest.current.dataUserId !== userId || !latest.current.stored?.enabled) return;
        const samples = wantsDistanceSamples(workout.activity)
          ? // Without readings the workout still comes in, just without splits.
            await PlatoHealth.getDistanceSamples(workout.id).catch(() => [])
          : [];
        await createWorkoutLocalFirst(
          buildImportedWorkout(workout, samples, { userId, weightUnit: latest.current.unit })
        ).saved;
        seen.add(workout.id);
      }
      if (latest.current.dataUserId !== userId) return;
      if (fresh.length > 0) {
        // Same as finishing a workout: the lifetime totals plato-web reads,
        // and the streak, count these now.
        const all = await getCompletedWorkouts(userId);
        await upsertUserStats({ userId, ...computeStats(all) });
      }
      // Merged onto the setting as it is *now*, so turning it off while this
      // ran isn't undone by this saving its progress.
      save(userId, {
        ...(latest.current.stored ?? startedWith),
        lastSync: now,
        seen: [...seen].slice(-SEEN_LIMIT),
      });
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      running.current = false;
      setImporting(false);
    }
  }

  // Reached through a ref so the effect below runs on what it's about — the
  // setting, the workouts being loaded, the app coming forward — and not on
  // every render's new copy of the function. It reads the rest through `latest`.
  const runImportRef = useRef(runImport);
  useEffect(() => {
    runImportRef.current = runImport;
  });

  const ready = !!dataUserId && stored?.enabled === true && unitLoaded && !loading && !awaitingSync;
  // Not before the workouts have loaded and synced: what's already been
  // imported is read off them, and reading it off a half-loaded list would
  // bring the missing ones in a second time.
  useEffect(() => {
    if (ready) void runImportRef.current();
  }, [ready, foregrounds]);

  async function setEnabled(on: boolean) {
    const userId = dataUserId;
    if (!userId || !PlatoHealth || !stored) return;
    if (on) {
      try {
        await PlatoHealth.requestAccess();
      } catch {
        setFailed(true);
        return;
      }
    }
    // Turning it off forgets when it last looked, so turning it back on reaches
    // back the full year and picks up whatever was recorded in between.
    save(userId, on ? { ...stored, enabled: true } : { enabled: false, seen: stored.seen });
  }

  const value: HealthImportState = {
    available: true,
    enabled: stored?.enabled === true,
    importing,
    importedCount: imported.size,
    failed,
    setEnabled,
  };
  return <HealthImportContext.Provider value={value}>{children}</HealthImportContext.Provider>;
}
