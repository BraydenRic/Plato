import AsyncStorage from "@react-native-async-storage/async-storage";

import { sanitizeExercises, type ExerciseLibrary, type WeeklyPlan } from "./firestore";
import { newId, reopenTiming } from "./workout-utils";
import type { Workout } from "@/types";

/**
 * On-device mirror of the Firestore data layer, used before someone signs in.
 * Guest mode has to work with no signal at all (gyms are full of dead zones),
 * so nothing here touches the network and no account is created.
 *
 * Everything lives in one AsyncStorage key: the whole dataset is a few hundred
 * KB at most, and one write per change keeps the on-disk copy consistent — a
 * half-applied multi-key write would be far worse than the rewrite cost.
 */

const DATA_KEY = "plato.guest.data.v1";
const ACTIVE_KEY = "plato.guest.active.v1";

/**
 * Stand-in userId for guest data. Also the routing signal: `data.ts` sends any
 * call carrying this id (or a `local-` workout id) to this module instead of
 * Firestore, so dispatch never depends on mutable global state.
 */
export const GUEST_USER_ID = "local-guest";

export function isGuestUserId(userId: string | null | undefined): boolean {
  return userId === GUEST_USER_ID;
}

export function isLocalWorkoutId(id: string): boolean {
  return id.startsWith("local-");
}

export interface GuestData {
  workouts: Workout[];
  library: ExerciseLibrary;
  weeklyPlan: WeeklyPlan;
}

const emptyData = (): GuestData => ({
  workouts: [],
  library: { custom: [], removedIds: [], overrides: [] },
  weeklyPlan: [null, null, null, null, null, null, null],
});

// ── Persistence ──────────────────────────────────────────────────────────────

let cache: GuestData | null = null;
let loading: Promise<GuestData> | null = null;
const listeners = new Set<() => void>();

function toDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// JSON.stringify writes Dates as ISO strings, so reading has to turn every
// known date field back into a Date — the rest of the app compares and formats
// these directly and would break on strings.
function reviveWorkout(raw: Record<string, unknown>): Workout {
  return {
    ...(raw as unknown as Workout),
    createdAt: toDate(raw.createdAt) ?? new Date(),
    scheduledFor: toDate(raw.scheduledFor),
    startedAt: toDate(raw.startedAt),
    completedAt: toDate(raw.completedAt),
    exercises: sanitizeExercises(raw.exercises, raw.name).map((ex) => ({
      ...ex,
      sets: ex.sets.map((set) => ({
        ...set,
        completedAt: toDate(set.completedAt),
      })),
    })),
  };
}

async function load(): Promise<GuestData> {
  if (cache) return cache;
  // Memoize the in-flight read so concurrent callers share one parse and can
  // never end up mutating two different copies of the data.
  loading ??= (async () => {
    let data = emptyData();
    try {
      const stored = await AsyncStorage.getItem(DATA_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<GuestData>;
        data = {
          workouts: (Array.isArray(parsed.workouts) ? parsed.workouts : []).map((w) =>
            reviveWorkout(w as unknown as Record<string, unknown>)
          ),
          library: { ...emptyData().library, ...(parsed.library ?? {}) },
          weeklyPlan: Array.from({ length: 7 }, (_, i) => parsed.weeklyPlan?.[i] ?? null),
        };
      }
    } catch (e) {
      // Corrupt JSON would otherwise brick the app on every launch. Start
      // clean rather than crash — nothing has been signed in, so the blast
      // radius is this device's unsynced guest data.
      console.warn("Couldn't read guest data; starting fresh", e);
    }
    cache = data;
    loading = null;
    return data;
  })();
  return loading;
}

async function persist(): Promise<void> {
  if (cache) await AsyncStorage.setItem(DATA_KEY, JSON.stringify(cache));
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

async function commit(): Promise<void> {
  await persist();
  notify();
}

// ── Guest session flag ───────────────────────────────────────────────────────

/** Whether the last session was an un-signed-in guest, so relaunches resume it. */
export async function readGuestActive(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ACTIVE_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function writeGuestActive(active: boolean): Promise<void> {
  if (active) await AsyncStorage.setItem(ACTIVE_KEY, "1");
  else await AsyncStorage.removeItem(ACTIVE_KEY);
}

// ── Workouts ─────────────────────────────────────────────────────────────────

export function subscribeWorkouts(
  _userId: string,
  onChange: (workouts: Workout[]) => void,
  onError?: (e: Error) => void
): () => void {
  const emit = () =>
    onChange([...(cache?.workouts ?? [])].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  listeners.add(emit);
  load().then(emit).catch((e) => onError?.(e as Error));
  return () => {
    listeners.delete(emit);
  };
}

export function subscribeWorkout(
  id: string,
  onChange: (workout: Workout | null) => void
): () => void {
  const emit = () => onChange(cache?.workouts.find((w) => w.id === id) ?? null);
  listeners.add(emit);
  load().then(emit).catch(() => emit());
  return () => {
    listeners.delete(emit);
  };
}

export async function getWorkout(id: string): Promise<Workout | null> {
  const data = await load();
  return data.workouts.find((w) => w.id === id) ?? null;
}

export async function getCompletedWorkouts(_userId: string): Promise<Workout[]> {
  const data = await load();
  return data.workouts
    .filter((w) => !w.isTemplate && !!w.completedAt)
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
}

export async function createWorkout(workout: Omit<Workout, "id">): Promise<string> {
  const data = await load();
  const id = `local-${newId()}`;
  data.workouts.push({ ...workout, id, createdAt: workout.createdAt ?? new Date() });
  await commit();
  return id;
}

export async function updateWorkout(id: string, updates: Partial<Workout>): Promise<void> {
  const data = await load();
  const index = data.workouts.findIndex((w) => w.id === id);
  if (index === -1) return;
  data.workouts[index] = { ...data.workouts[index], ...updates };
  await commit();
}

export async function deleteWorkout(workout: Workout): Promise<void> {
  const data = await load();
  data.workouts = data.workouts.filter((w) => w.id !== workout.id);
  await commit();
}

export async function reopenWorkout(workout: Workout): Promise<void> {
  const data = await load();
  const index = data.workouts.findIndex((w) => w.id === workout.id);
  if (index === -1) return;
  const timing = reopenTiming(workout);
  const next: Workout = { ...data.workouts[index] };
  delete next.completedAt;
  delete next.durationMinutes;
  delete next.totalVolume;
  if (timing.kind === "backlog") {
    delete next.startedAt;
    next.scheduledFor = timing.scheduledFor;
  } else if (timing.kind === "resume") {
    next.startedAt = timing.startedAt;
  }
  data.workouts[index] = next;
  await commit();
}

// ── Exercise library ─────────────────────────────────────────────────────────

export function subscribeExerciseLibrary(
  _userId: string,
  onChange: (library: ExerciseLibrary) => void
): () => void {
  const emit = () => onChange(cache?.library ?? emptyData().library);
  listeners.add(emit);
  load().then(emit).catch(() => emit());
  return () => {
    listeners.delete(emit);
  };
}

export async function updateExerciseLibrary(
  _userId: string,
  library: ExerciseLibrary
): Promise<void> {
  const data = await load();
  data.library = library;
  await commit();
}

// ── Weekly split ─────────────────────────────────────────────────────────────

export function subscribeWeeklyPlan(
  _userId: string,
  onChange: (plan: WeeklyPlan) => void
): () => void {
  const emit = () => onChange(cache?.weeklyPlan ?? emptyData().weeklyPlan);
  listeners.add(emit);
  load().then(emit).catch(() => emit());
  return () => {
    listeners.delete(emit);
  };
}

export async function setWeeklyPlan(_userId: string, days: WeeklyPlan): Promise<void> {
  const data = await load();
  data.weeklyPlan = days;
  await commit();
}

// ── Statistics ───────────────────────────────────────────────────────────────

/**
 * No-op on device. The userStats doc exists so plato-web can read totals
 * without loading every workout; guest data has no other reader, and the Stats
 * tab derives its numbers from the workouts themselves.
 */
export async function upsertUserStats(): Promise<void> {}

// ── Bulk access (migration + wipe) ───────────────────────────────────────────

export async function readGuestData(): Promise<GuestData> {
  return load();
}

export function hasContent(data: GuestData): boolean {
  return (
    data.workouts.length > 0 ||
    data.library.custom.length > 0 ||
    data.library.removedIds.length > 0 ||
    data.library.overrides.length > 0 ||
    data.weeklyPlan.some((day) => day !== null)
  );
}

/** Drops one workout once it's safely in the cloud, so a retry can't duplicate it. */
export async function removeMigratedWorkout(id: string): Promise<void> {
  const data = await load();
  data.workouts = data.workouts.filter((w) => w.id !== id);
  await persist();
}

export async function clearGuestData(): Promise<void> {
  cache = emptyData();
  await AsyncStorage.removeItem(DATA_KEY);
  notify();
}
