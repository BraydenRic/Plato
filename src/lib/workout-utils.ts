import type { Workout, WorkoutSet } from "@/types";

// Templates are reusable and never auto-expire, so cap them per account to keep
// the collection from growing without bound. 20 comfortably covers real routines
// (most people keep 3–10) while stopping runaway creation.
export const MAX_TEMPLATES = 20;

// Cap simultaneously in-progress (started, unfinished) workouts. Nobody trains
// more than a couple at once; the limit stops runaway "start and abandon" from
// piling up live sessions. Finishing or deleting one frees a slot.
export const MAX_ACTIVE_WORKOUTS = 5;

const KG_TO_LBS = 2.20462;

export function setVolumeLbs(set: WorkoutSet): number {
  if (!set.isCompleted || !set.reps) return 0;
  if (set.weightUnit === "bodyweight" || !set.weight) return 0;
  const lbs = set.weightUnit === "kg" ? set.weight * KG_TO_LBS : set.weight;
  return set.reps * lbs;
}

export function workoutVolumeLbs(workout: Workout): number {
  return workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + setVolumeLbs(set), 0),
    0
  );
}

export function completedSetCount(workout: Workout): number {
  return workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length,
    0
  );
}

export function totalSetCount(workout: Workout): number {
  return workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
}

export function formatVolume(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M`;
  if (lbs >= 10_000) return `${Math.round(lbs / 1000)}k`;
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k`;
  return `${Math.round(lbs)}`;
}

// Sets remember the unit they were logged in; convert for display so old
// workouts follow the current preference. Rounded to 1 decimal for inputs.
export function convertWeight(value: number, from: "lbs" | "kg", to: "lbs" | "kg"): number {
  if (from === to) return value;
  const converted = from === "lbs" ? value / KG_TO_LBS : value * KG_TO_LBS;
  return Math.round(converted * 10) / 10;
}

// Volumes are stored in lbs; convert only at display time.
export function displayVolume(lbs: number, unit: "lbs" | "kg"): string {
  if (unit === "kg") return `${formatVolume(lbs / KG_TO_LBS)} kg`;
  return `${formatVolume(lbs)} lbs`;
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function relativeDay(date: Date): string {
  const diff = Math.round((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  if (Math.abs(diff) < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Calendar helpers for the week planner ────────────────────────────────────

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Monday-based week start — training weeks read Mon→Sun. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(d, -dow);
}

export function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * The calendar day a workout belongs to. A scheduled workout stays pinned to the
 * day it was planned for — even after you start or finish it — so starting a
 * workout planned for tomorrow never drags it onto today. Unscheduled workouts
 * fall back to when they actually happened.
 */
export function workoutDay(workout: Workout): Date {
  return startOfDay(
    workout.scheduledFor ?? workout.completedAt ?? workout.startedAt ?? workout.createdAt
  );
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
