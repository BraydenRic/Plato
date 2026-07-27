import * as cloud from "./firestore";
import * as local from "./local-store";
import { GUEST_USER_ID, isGuestUserId, isLocalWorkoutId } from "./local-store";
import type { ExerciseLibrary, WeeklyPlan } from "./firestore";
import type { UserStatistics, Workout, WorkoutExercise } from "@/types";

/**
 * The app's single data entry point. Screens and hooks call these instead of
 * reaching for Firestore directly, and each call is routed to the cloud or to
 * the on-device guest store.
 *
 * Routing is derived from the data itself — a guest userId, or a workout id
 * created locally — rather than from a global "am I a guest?" flag. That means
 * a call can never be sent to the wrong backend because some flag was stale,
 * including mid-migration when both stores briefly hold data.
 */

export { GUEST_USER_ID, isGuestUserId } from "./local-store";
export { computeStats, sanitizeExercises, stripUndefined, EMPTY_WEEKLY_PLAN } from "./firestore";
export type { ExerciseLibrary, WeeklyPlan } from "./firestore";

// ── Workouts ─────────────────────────────────────────────────────────────────

export function subscribeWorkouts(
  userId: string,
  onChange: (workouts: Workout[]) => void,
  onError?: (e: Error) => void
): () => void {
  const store = isGuestUserId(userId) ? local : cloud;
  return store.subscribeWorkouts(userId, onChange, onError);
}

export function subscribeWorkout(
  id: string,
  onChange: (workout: Workout | null) => void
): () => void {
  const store = isLocalWorkoutId(id) ? local : cloud;
  return store.subscribeWorkout(id, onChange);
}

export function getWorkout(id: string): Promise<Workout | null> {
  return isLocalWorkoutId(id) ? local.getWorkout(id) : cloud.getWorkout(id);
}

export function getCompletedWorkouts(userId: string): Promise<Workout[]> {
  return isGuestUserId(userId) ? local.getCompletedWorkouts(userId) : cloud.getCompletedWorkouts(userId);
}

export function createWorkout(
  workout: Omit<Workout, "id">,
  preserveCreatedAt = false
): Promise<string> {
  return isGuestUserId(workout.userId)
    ? local.createWorkout(workout)
    : cloud.createWorkout(workout, preserveCreatedAt);
}

export function updateWorkout(id: string, updates: Partial<Workout>): Promise<void> {
  return isLocalWorkoutId(id) ? local.updateWorkout(id, updates) : cloud.updateWorkout(id, updates);
}

export function deleteWorkout(workout: Workout): Promise<void> {
  return isGuestUserId(workout.userId) ? local.deleteWorkout(workout) : cloud.deleteWorkout(workout);
}

export function reopenWorkout(workout: Workout): Promise<void> {
  return isGuestUserId(workout.userId) ? local.reopenWorkout(workout) : cloud.reopenWorkout(workout);
}

// Templates are pure structure — exercises in order with a set count. Strip
// weights/reps (older templates may still carry them) so users fill in each
// session fresh, guided by their previous numbers.
function blankSets(exercises: WorkoutExercise[]): WorkoutExercise[] {
  return exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => ({ id: s.id, weightUnit: s.weightUnit, isCompleted: false })),
  }));
}

// Without `scheduledFor` the workout starts immediately; with it, it becomes a
// plan for that day — no startedAt until the user actually begins it.
export function startFromTemplate(
  template: Workout,
  userId: string,
  scheduledFor?: Date
): Promise<string> {
  return createWorkout(
    cloud.stripUndefined({
      userId,
      name: template.name,
      isTemplate: false,
      exercises: blankSets(template.exercises),
      createdAt: new Date(),
      scheduledFor,
      startedAt: scheduledFor ? undefined : new Date(),
    })
  );
}

export function saveAsTemplate(workout: Workout, name: string): Promise<string> {
  return createWorkout(
    cloud.stripUndefined({
      userId: workout.userId,
      name,
      isTemplate: true,
      exercises: blankSets(workout.exercises),
      createdAt: new Date(),
    })
  );
}

// ── Exercise library ─────────────────────────────────────────────────────────

export function subscribeExerciseLibrary(
  userId: string,
  onChange: (library: ExerciseLibrary) => void
): () => void {
  const store = isGuestUserId(userId) ? local : cloud;
  return store.subscribeExerciseLibrary(userId, onChange);
}

export function updateExerciseLibrary(userId: string, library: ExerciseLibrary): Promise<void> {
  return isGuestUserId(userId)
    ? local.updateExerciseLibrary(userId, library)
    : cloud.updateExerciseLibrary(userId, library);
}

// ── Weekly split ─────────────────────────────────────────────────────────────

export function subscribeWeeklyPlan(
  userId: string,
  onChange: (plan: WeeklyPlan) => void
): () => void {
  const store = isGuestUserId(userId) ? local : cloud;
  return store.subscribeWeeklyPlan(userId, onChange);
}

export function setWeeklyPlan(userId: string, days: WeeklyPlan): Promise<void> {
  return isGuestUserId(userId) ? local.setWeeklyPlan(userId, days) : cloud.setWeeklyPlan(userId, days);
}

// ── Statistics ───────────────────────────────────────────────────────────────

export function upsertUserStats(stats: UserStatistics): Promise<void> {
  return isGuestUserId(stats.userId) ? local.upsertUserStats() : cloud.upsertUserStats(stats);
}
