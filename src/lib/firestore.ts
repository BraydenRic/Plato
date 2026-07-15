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
import { sameDay, workoutVolumeLbs } from "./workout-utils";
import type { Exercise, Workout, UserStatistics, WorkoutExercise } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return undefined;
}

// Some stored docs carry null/undefined holes in their exercises/sets arrays
// (crashed build 9 the moment a set row rendered). Rendering, stats, and the
// keypad all assume every entry exists, so drop the holes at the read boundary
// and log them — writes should never produce these, so a warning here means a
// bug (or legacy data) worth chasing.
export function sanitizeExercises(raw: unknown, docName?: unknown): Workout["exercises"] {
  const entries = (Array.isArray(raw) ? raw : []) as Workout["exercises"];
  const exercises = entries.filter((ex) => ex && ex.exercise);
  if (exercises.length !== entries.length) {
    console.warn(`Dropped ${entries.length - exercises.length} corrupt exercise entries in "${String(docName ?? "?")}"`);
  }
  return exercises.map((ex) => {
    const rawSets = Array.isArray(ex.sets) ? ex.sets : [];
    const sets = rawSets.filter(Boolean);
    if (sets.length !== rawSets.length) {
      console.warn(
        `Dropped ${rawSets.length - sets.length} corrupt set entries in "${String(docName ?? "?")}" / ${ex.exercise?.name ?? ex.exerciseId}:`,
        JSON.stringify(rawSets)
      );
    }
    return { ...ex, sets };
  });
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

export async function getWorkout(id: string): Promise<Workout | null> {
  const snap = await getDoc(doc(db, "workouts", id));
  if (!snap.exists()) return null;
  return workoutFromDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function createWorkout(workout: Omit<Workout, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "workouts"), {
    ...workout,
    createdAt: serverTimestamp(),
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

export interface ExerciseLibrary {
  custom: Exercise[];
  removedIds: string[];
  // Edited copies of default exercises, keeping the original id so workout
  // history and last-weight tracking still line up.
  overrides: Exercise[];
}

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

// ── Weekly split ────────────────────────────────────────────────────────────
// A recurring weekday → template map. Purely a suggestion layer: it never
// creates workout docs on its own, so it adds zero ongoing writes. Indexed by
// JS getDay() (0 = Sunday … 6 = Saturday); null means a rest day.
export type WeeklyPlan = (string | null)[];

const EMPTY_WEEKLY_PLAN: WeeklyPlan = [null, null, null, null, null, null, null];

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

export async function setWeeklyPlan(userId: string, days: WeeklyPlan): Promise<void> {
  // Arrays are replaced wholesale on merge (not deep-merged), so writing the
  // full 7-slot array both assigns and clears days in one call.
  await setDoc(doc(db, "weeklyPlans", userId), { userId, days }, { merge: true });
}

export { EMPTY_WEEKLY_PLAN };

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
  if (workout.completedAt && !sameDay(workout.completedAt, new Date())) {
    updates.startedAt = deleteField();
    updates.scheduledFor = workout.completedAt;
  } else if (workout.completedAt && workout.startedAt) {
    // The clock was stopped while the workout sat finished — shift startedAt
    // forward by that gap so elapsed time resumes where it left off.
    const pausedMs = Date.now() - workout.completedAt.getTime();
    updates.startedAt = new Date(workout.startedAt.getTime() + pausedMs);
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

// Without `scheduledFor` the workout starts immediately; with it, it becomes a
// plan for that day — no startedAt until the user actually begins it.
export async function startFromTemplate(
  template: Workout,
  userId: string,
  scheduledFor?: Date
): Promise<string> {
  // Templates are pure structure — exercises in order with a set count. Strip
  // weights/reps (older templates may still carry them) so users fill in each
  // session fresh, guided by their previous numbers.
  const exercises: WorkoutExercise[] = template.exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => ({
      id: s.id,
      weightUnit: s.weightUnit,
      isCompleted: false,
    })),
  }));
  return createWorkout(
    stripUndefined({
      userId,
      name: template.name,
      isTemplate: false,
      exercises,
      createdAt: new Date(),
      scheduledFor,
      startedAt: scheduledFor ? undefined : new Date(),
    })
  );
}

export async function saveAsTemplate(workout: Workout, name: string): Promise<string> {
  const exercises: WorkoutExercise[] = workout.exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => ({ id: s.id, weightUnit: s.weightUnit, isCompleted: false })),
  }));
  return createWorkout(
    stripUndefined({
      userId: workout.userId,
      name,
      isTemplate: true,
      exercises,
      createdAt: new Date(),
    })
  );
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
