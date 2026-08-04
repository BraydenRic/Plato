import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  EMPTY_WEEKLY_PLAN,
  isActiveWorkout,
  reopenTiming,
  sanitizeExercises,
  workoutVolumeLbs,
} from "./workout-utils";
import type { Exercise, ExerciseLibrary, UserStatistics, WeeklyPlan, Workout } from "@/types";

// Re-exported so existing importers of this module keep working; both now live
// in Firebase-free modules so the guest store can share them.
export { sanitizeExercises, EMPTY_WEEKLY_PLAN };
export type { ExerciseLibrary, WeeklyPlan };

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return undefined;
}

function workoutFromDoc(id: string, data: Record<string, unknown>): Workout {
  return {
    id,
    userId: data.userId as string,
    name: data.name as string,
    isTemplate: Boolean(data.isTemplate),
    notes: data.notes as string | undefined,
    exercises: sanitizeExercises(data.exercises, data.name),
    createdAt: toDate(data.createdAt) ?? new Date(),
    scheduledFor: toDate(data.scheduledFor),
    startedAt: toDate(data.startedAt),
    completedAt: toDate(data.completedAt),
    durationMinutes: data.durationMinutes as number | undefined,
    totalVolume: data.totalVolume as number | undefined,
    orderIndex: data.orderIndex as number | undefined,
  };
}

// ── Workouts ──────────────────────────────────────────────────────────────────

export async function getWorkouts(userId: string, templatesOnly = false): Promise<Workout[]> {
  const q = query(
    collection(db, "workouts"),
    where("userId", "==", userId),
    where("isTemplate", "==", templatesOnly),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => workoutFromDoc(d.id, d.data() as Record<string, unknown>));
}

export async function getCompletedWorkouts(userId: string): Promise<Workout[]> {
  // Filter client-side so no composite index is required.
  const q = query(collection(db, "workouts"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => workoutFromDoc(d.id, d.data() as Record<string, unknown>))
    .filter((w) => !w.isTemplate && !!w.completedAt)
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
}

/**
 * How many workouts are started but unfinished.
 *
 * Same unlimited read as getCompletedWorkouts, filtered client-side, so it needs
 * no composite index and — unlike getWorkouts, which stops at 50 — cannot miss
 * an old abandoned session sitting behind a long history.
 */
export async function countActiveWorkouts(userId: string): Promise<number> {
  const q = query(collection(db, "workouts"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => workoutFromDoc(d.id, d.data() as Record<string, unknown>))
    .filter(isActiveWorkout).length;
}

/** Live subscription to one workout — the workout screen's source of truth. */
export function subscribeWorkout(
  id: string,
  onChange: (workout: Workout | null) => void
): () => void {
  return onSnapshot(doc(db, "workouts", id), (snap) => {
    if (!snap.exists()) {
      onChange(null);
      return;
    }
    onChange(workoutFromDoc(snap.id, snap.data() as Record<string, unknown>));
  });
}

export async function getWorkout(id: string): Promise<Workout | null> {
  const snap = await getDoc(doc(db, "workouts", id));
  if (!snap.exists()) return null;
  return workoutFromDoc(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * `preserveCreatedAt` keeps the date already on the workout instead of stamping
 * it server-side. Only migration passes it: guest workouts were created days or
 * weeks ago, and re-stamping them would drop the whole backlog onto today.
 * Everything else prefers the server clock over a possibly-wrong device clock.
 */
export async function createWorkout(
  workout: Omit<Workout, "id">,
  preserveCreatedAt = false
): Promise<string> {
  const ref = await addDoc(collection(db, "workouts"), {
    ...workout,
    createdAt: preserveCreatedAt && workout.createdAt ? workout.createdAt : serverTimestamp(),
  });
  return ref.id;
}

export async function updateWorkout(id: string, updates: Partial<Workout>): Promise<void> {
  await updateDoc(doc(db, "workouts", id), updates);
}

export async function deleteWorkout(workout: Workout): Promise<void> {
  await deleteDoc(doc(db, "workouts", workout.id));
  // Removing a finished workout changes lifetime stats — re-derive the synced
  // doc so other readers (plato-web) don't see stale totals or streaks.
  if (workout.completedAt && !workout.isTemplate) {
    const remaining = await getCompletedWorkouts(workout.userId);
    await upsertUserStats({ userId: workout.userId, ...computeStats(remaining) });
  }
}

// Wipes everything the user owns, for account deletion (App Store requires
// in-app account deletion). The auth user itself is deleted afterwards.
export async function deleteAllUserData(userId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, "workouts"), where("userId", "==", userId)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "exerciseLibrary", userId));
  await deleteDoc(doc(db, "userStats", userId));
}

// ── Exercise library ─────────────────────────────────────────────────────────
// Per-user customization of the built-in exercise list: custom exercises the
// user created plus ids of defaults they removed. The default exercises live in
// the app bundle, so resetting is just clearing this doc.

export function subscribeExerciseLibrary(
  userId: string,
  onChange: (library: ExerciseLibrary) => void
): () => void {
  return onSnapshot(doc(db, "exerciseLibrary", userId), (snap) => {
    const d = snap.data();
    onChange({
      custom: (d?.custom as Exercise[]) ?? [],
      removedIds: (d?.removedIds as string[]) ?? [],
      overrides: (d?.overrides as Exercise[]) ?? [],
    });
  });
}

export async function updateExerciseLibrary(userId: string, library: ExerciseLibrary): Promise<void> {
  await setDoc(doc(db, "exerciseLibrary", userId), { userId, ...library }, { merge: true });
}

/** One-shot read, for merging guest data into an account that may already have some. */
export async function getExerciseLibrary(userId: string): Promise<ExerciseLibrary> {
  const snap = await getDoc(doc(db, "exerciseLibrary", userId));
  const d = snap.data();
  return {
    custom: (d?.custom as Exercise[]) ?? [],
    removedIds: (d?.removedIds as string[]) ?? [],
    overrides: (d?.overrides as Exercise[]) ?? [],
  };
}

// ── Weekly split ────────────────────────────────────────────────────────────
// A recurring weekday → template map. Purely a suggestion layer: it never
// creates workout docs on its own, so it adds zero ongoing writes. Indexed by
// JS getDay() (0 = Sunday … 6 = Saturday); null means a rest day.
export function subscribeWeeklyPlan(
  userId: string,
  onChange: (plan: WeeklyPlan) => void
): () => void {
  return onSnapshot(doc(db, "weeklyPlans", userId), (snap) => {
    const stored = (snap.data()?.days as (string | null)[] | undefined) ?? [];
    // Normalize to exactly 7 slots so callers can index by weekday safely.
    onChange(Array.from({ length: 7 }, (_, i) => stored[i] ?? null));
  });
}

/** One-shot read, so migration only fills weekdays the account left empty. */
export async function getWeeklyPlan(userId: string): Promise<WeeklyPlan> {
  const snap = await getDoc(doc(db, "weeklyPlans", userId));
  const stored = (snap.data()?.days as (string | null)[] | undefined) ?? [];
  return Array.from({ length: 7 }, (_, i) => stored[i] ?? null);
}

export async function setWeeklyPlan(userId: string, days: WeeklyPlan): Promise<void> {
  // Arrays are replaced wholesale on merge (not deep-merged), so writing the
  // full 7-slot array both assigns and clears days in one call.
  await setDoc(doc(db, "weeklyPlans", userId), { userId, days }, { merge: true });
}

// Reopen a finished workout so an accidental finish can be undone or missed
// sets filled in. A workout finished today resumes as a live session; one from
// a past day becomes a backlog edit anchored to its original calendar day, so
// re-finishing it doesn't silently move it to today.
export async function reopenWorkout(workout: Workout): Promise<void> {
  const updates: Record<string, unknown> = {
    completedAt: deleteField(),
    durationMinutes: deleteField(),
    totalVolume: deleteField(),
  };
  const timing = reopenTiming(workout);
  if (timing.kind === "backlog") {
    updates.startedAt = deleteField();
    updates.scheduledFor = timing.scheduledFor;
  } else if (timing.kind === "resume") {
    updates.startedAt = timing.startedAt;
  }
  await updateDoc(doc(db, "workouts", workout.id), updates);
}

// Live subscription for the workouts list — keeps the UI in sync while a
// workout is in progress without manual refetching.
// Single equality filter + client-side sort: needs no composite Firestore index.
export function subscribeWorkouts(
  userId: string,
  onChange: (workouts: Workout[]) => void,
  onError?: (e: Error) => void
): () => void {
  const q = query(collection(db, "workouts"), where("userId", "==", userId));
  return onSnapshot(
    q,
    (snap) => {
      const workouts = snap.docs
        .map((d) => workoutFromDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onChange(workouts);
    },
    onError
  );
}

// Firestore rejects `undefined` field values, so strip them before writing.
// Dates must survive untouched — a JSON round-trip would turn them into strings.
export function stripUndefined<T>(value: T): T {
  if (value === null || typeof value !== "object" || value instanceof Date || value instanceof Timestamp) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) out[k] = stripUndefined(v);
  }
  return out as T;
}

// ── Statistics ────────────────────────────────────────────────────────────────

export async function upsertUserStats(stats: UserStatistics): Promise<void> {
  // Strip undefined before writing — Firestore rejects undefined field values
  // with `invalid-argument`. This happens when the user has no completed
  // workouts left (e.g. resuming or deleting their most recent one), which makes
  // computeStats' `lastWorkoutDate` undefined. With merge:true the omitted field
  // simply keeps its previous value rather than crashing the write.
  await setDoc(doc(db, "userStats", stats.userId), stripUndefined(stats), { merge: true });
}

export function computeStats(workouts: Workout[]): Omit<UserStatistics, "userId"> {
  const completed = workouts.filter((w) => w.completedAt);
  const sortedDates = completed
    .map((w) => w.completedAt!)
    .sort((a, b) => b.getTime() - a.getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const uniqueDays = [
    ...new Set(sortedDates.map((d) => {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      return day.getTime();
    })),
  ].sort((a, b) => b - a);

  // Rounded day gaps so DST's 23/25-hour days don't break streaks.
  const dayGap = (laterTs: number, earlierTs: number) =>
    Math.round((laterTs - earlierTs) / (1000 * 60 * 60 * 24));

  // Longest streak scans the full history — every chain counts, not just the
  // most recent one.
  let longestStreak = uniqueDays.length > 0 ? 1 : 0;
  let chain = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    chain = dayGap(uniqueDays[i - 1], uniqueDays[i]) === 1 ? chain + 1 : 1;
    longestStreak = Math.max(longestStreak, chain);
  }

  // Current streak is the newest chain, alive only if it reaches today or
  // yesterday (a workout today extends it; missing yesterday breaks it).
  let currentStreak = 0;
  if (uniqueDays.length > 0 && dayGap(today.getTime(), uniqueDays[0]) <= 1) {
    currentStreak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      if (dayGap(uniqueDays[i - 1], uniqueDays[i]) !== 1) break;
      currentStreak++;
    }
  }

  const totalVolumeLbs = completed.reduce(
    (sum, w) => sum + (w.totalVolume ?? workoutVolumeLbs(w)),
    0
  );
  const totalSetsCompleted = completed.reduce(
    (sum, w) => sum + w.exercises.reduce((s, e) => s + e.sets.filter((x) => x.isCompleted).length, 0),
    0
  );
  const totalWorkoutTimeMinutes = completed.reduce((sum, w) => sum + (w.durationMinutes ?? 0), 0);

  return {
    totalCompletedWorkouts: completed.length,
    totalWorkoutTimeMinutes,
    totalVolumeLbs,
    totalSetsCompleted,
    currentStreak,
    longestStreak,
    lastWorkoutDate: sortedDates[0],
  };
}
