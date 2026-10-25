import { requireOptionalNativeModule, type NativeModule } from "expo";

import type { CardioSessionKind } from "@/types";

declare class PlatoHealthModule extends NativeModule {
  /** False on an iPad without Health, and wherever HealthKit isn't. */
  isAvailable(): boolean;
  /**
   * Shows iOS's Health permission sheet, the first time only — afterwards it
   * resolves at once. What it asks for is what the watch needs to track a
   * session and save it to Health; the watch app shares this access.
   */
  requestAccess(): Promise<void>;
  /**
   * Wakes Plato's watch app into a session of this kind. False with no watch
   * to wake. `poolMetres` is the lap length a pool swim is counted against.
   */
  startWatchWorkout(kind: CardioSessionKind, indoor: boolean, poolMetres: number): Promise<boolean>;
}

/**
 * Apple Health on the phone (modules/plato-health/ios), for cardio sessions
 * the Apple Watch tracks.
 *
 * Optional because it only exists in a native iOS build: Jest, web and Expo Go
 * get null, and sessions there run on the phone's own clock.
 */
export default requireOptionalNativeModule<PlatoHealthModule>("PlatoHealth");
