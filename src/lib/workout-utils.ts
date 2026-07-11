import type { Workout, WorkoutSet } from "@/types";

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

/** The calendar day a workout belongs to: when it happened, or when it's planned. */
export function workoutDay(workout: Workout): Date {
  return startOfDay(
    workout.completedAt ?? workout.startedAt ?? workout.scheduledFor ?? workout.createdAt
  );
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
