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
import { sameDay } from "./workout-utils";
import type { Exercise, Workout, UserStatistics, WorkoutExercise } from "@/types";

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
    exercises: (data.exercises as Workout["exercises"]) ?? [],
    createdAt: toDate(data.createdAt) ?? new Date(),
    scheduledFor: toDate(data.scheduledFor),
    startedAt: toDate(data.startedAt),
    completedAt: toDate(data.completedAt),
    durationMinutes: data.durationMinutes as number | undefined,
    totalVolume: data.totalVolume as number | undefined,
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

export async function deleteWorkout(id: string): Promise<void> {
  await deleteDoc(doc(db, "workouts", id));
}

// ── Exercise library ─────────────────────────────────────────────────────────
// Per-user customization of the built-in exercise list: custom exercises the
// user created plus ids of defaults they removed. The 61 defaults live in the
// app bundle, so resetting is just clearing this doc.

export interface ExerciseLibrary {
  custom: Exercise[];
  removedIds: string[];
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
    });
  });
}

export async function updateExerciseLibrary(userId: string, library: ExerciseLibrary): Promise<void> {
  await setDoc(doc(db, "exerciseLibrary", userId), { userId, ...library }, { merge: true });
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

export async function getUserStats(userId: string): Promise<UserStatistics | null> {
  const snap = await getDoc(doc(db, "userStats", userId));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    userId,
    totalCompletedWorkouts: (d.totalCompletedWorkouts as number) ?? 0,
    totalWorkoutTimeMinutes: (d.totalWorkoutTimeMinutes as number) ?? 0,
    totalVolumeLbs: (d.totalVolumeLbs as number) ?? 0,
    totalSetsCompleted: (d.totalSetsCompleted as number) ?? 0,
    currentStreak: (d.currentStreak as number) ?? 0,
    longestStreak: (d.longestStreak as number) ?? 0,
    lastWorkoutDate: toDate(d.lastWorkoutDate),
  };
}

export async function upsertUserStats(stats: UserStatistics): Promise<void> {
  await setDoc(doc(db, "userStats", stats.userId), stats, { merge: true });
}

export function computeStats(workouts: Workout[]): Omit<UserStatistics, "userId"> {
  const completed = workouts.filter((w) => w.completedAt);
  const sortedDates = completed
    .map((w) => w.completedAt!)
    .sort((a, b) => b.getTime() - a.getTime());

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  let prevDay: Date | null = null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const uniqueDays = [
    ...new Set(sortedDates.map((d) => {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      return day.getTime();
    })),
  ].sort((a, b) => b - a);

  for (const dayTs of uniqueDays) {
    const day = new Date(dayTs);
    if (!prevDay) {
      const diff = (today.getTime() - day.getTime()) / (1000 * 60 * 60 * 24);
      if (diff <= 1) streak = 1;
      else break;
    } else {
      const diff = (prevDay.getTime() - day.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) streak++;
      else break;
    }
    prevDay = day;
    longestStreak = Math.max(longestStreak, streak);
  }
  currentStreak = streak;

  const totalVolumeLbs = completed.reduce((sum, w) => sum + (w.totalVolume ?? 0), 0);
  const totalSetsCompleted = completed.reduce(
    (sum, w) => sum + w.exercises.reduce((s, e) => s + e.sets.length, 0),
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
