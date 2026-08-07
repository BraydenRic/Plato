export interface Exercise {
  id: string;
  name: string;
  category: string;
  musclesWorked: string[];
  description: string;
  isCustom?: boolean;
  /** Logged as a start/stop timer per set (cardio, holds) instead of weight × reps. */
  isTimed?: boolean;
  /**
   * Your own body is the load. The weight field then means *added* load — a
   * plate on a dip belt, or a negative for the assisted machine — rather than
   * the total, and blank reads as plain bodyweight.
   */
  isBodyweight?: boolean;
}

export interface WorkoutSet {
  id: string;
  reps?: number;
  /**
   * The load. For "lbs"/"kg" sets this is the total, in that unit. For
   * "bodyweight" sets it is only what was *added* — and always in lbs, because
   * "bodyweight" leaves no room to say which unit was meant. Absent or 0 is
   * plain bodyweight; negative is assistance.
   */
  weight?: number;
  weightUnit: "lbs" | "kg" | "bodyweight";
  /** Seconds, for timed exercises (see Exercise.isTimed) — replaces weight/reps. */
  duration?: number;
  restTime?: number;
  isCompleted: boolean;
  completedAt?: Date;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exercise: Exercise;
  orderIndex: number;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  /** Day this workout is planned for. Set without startedAt = a plan, not a session. */
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  isTemplate: boolean;
  exercises: WorkoutExercise[];
  durationMinutes?: number;
  totalVolume?: number;
  /** Manual sort position for templates. Absent until the user reorders them. */
  orderIndex?: number;
}

export type WorkoutStatus = "none" | "inProgress" | "completed";

/** One weigh-in. Dated, so a set can be valued against the weight at the time. */
export interface BodyweightEntry {
  /** Day of the weigh-in. One entry per day; a second replaces the first. */
  date: Date;
  /** Always stored in lbs, like totalVolumeLbs — display converts. */
  lbs: number;
}

export interface UserStatistics {
  userId: string;
  totalCompletedWorkouts: number;
  totalWorkoutTimeMinutes: number;
  totalVolumeLbs: number;
  totalSetsCompleted: number;
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate?: Date;
}


export type MuscleGroup =
  | "All"
  | "Chest"
  | "Back"
  | "Shoulders"
  | "Biceps"
  | "Triceps"
  | "Legs"
  | "Glutes"
  | "Core"
  | "Cardio"
  | "Full Body";

/**
 * A user's customisations to the bundled exercise list. The defaults ship in the
 * app bundle, so this holds only the deltas — resetting is clearing this doc.
 */
export interface ExerciseLibrary {
  custom: Exercise[];
  removedIds: string[];
  /** Edited copies of default exercises, keeping the original id so workout
   *  history and last-weight tracking still line up. */
  overrides: Exercise[];
}

/**
 * A recurring weekday → template map. Purely a suggestion layer: it never
 * creates workout docs on its own. Indexed by JS getDay() (0 = Sunday …
 * 6 = Saturday); null means a rest day.
 */
export type WeeklyPlan = (string | null)[];

export interface VolumeDataPoint {
  date: string;
  volume: number;
  workouts: number;
}
