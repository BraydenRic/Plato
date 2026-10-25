import { requireOptionalNativeModule, type NativeModule } from "expo";

import type { DistanceSample, HealthWorkout } from "@/lib/health-import";

declare class PlatoHealthModule extends NativeModule {
  /** False on an iPad without Health, and wherever HealthKit isn't. */
  isAvailable(): boolean;
  /**
   * Shows iOS's Health permission sheet, the first time only — afterwards it
   * resolves at once. iOS never says what was allowed: a denied read looks
   * exactly like having nothing to read.
   */
  requestAccess(): Promise<void>;
  /** Workouts of these activities that started at or after `sinceMs`, oldest first. */
  getWorkouts(sinceMs: number, activities: string[]): Promise<HealthWorkout[]>;
  /** The distance readings one workout was recorded as, for its splits. */
  getDistanceSamples(id: string): Promise<DistanceSample[]>;
}

/**
 * Read-only access to Apple Health (modules/plato-health/ios).
 *
 * Optional because it only exists in a native iOS build: Jest, web and Expo Go
 * get null, and the Apple Health setting doesn't appear there.
 */
export default requireOptionalNativeModule<PlatoHealthModule>("PlatoHealth");
