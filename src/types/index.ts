export interface Exercise {
  id: string;
  name: string;
  category: string;
  musclesWorked: string[];
  description: string;
  isCustom?: boolean;
}

export interface WorkoutSet {
  id: string;
  reps?: number;
  weight?: number;
  weightUnit: "lbs" | "kg" | "bodyweight";
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
  notes?: string;
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
  notes?: string;
  exercises: WorkoutExercise[];
  durationMinutes?: number;
  totalVolume?: number;
}

export type WorkoutStatus = "none" | "inProgress" | "completed";

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

export interface ScheduledWorkout {
  id: string;
  userId: string;
  templateId: string;
  scheduledDate: Date;
  isCompleted: boolean;
  completedWorkoutId?: string;
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

export interface VolumeDataPoint {
  date: string;
  volume: number;
  workouts: number;
}
