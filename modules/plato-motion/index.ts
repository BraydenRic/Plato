import { requireOptionalNativeModule, type NativeModule } from "expo";

/** Distance since the start given to startUpdates, or why there's none. */
export type MotionReading = { distance: number; at: number } | { error: number };

type PlatoMotionEvents = {
  onDistance(reading: MotionReading): void;
};

declare class PlatoMotionModule extends NativeModule<PlatoMotionEvents> {
  /** False on an iPhone without a step counter that measures distance. */
  isAvailable(): boolean;
  /** Whether Plato may read Motion & Fitness. */
  authorization(): "notDetermined" | "restricted" | "denied" | "authorized";
  /**
   * Metres in each window, flat — from, to, from, to… in epoch ms. Rejects
   * when the step counter won't answer; the first call shows iOS's sheet.
   */
  distances(windows: number[]): Promise<number[]>;
  /** Sends onDistance every few seconds, counting from `fromMs`. */
  startUpdates(fromMs: number): void;
  stopUpdates(): void;
}

/**
 * The iPhone's step counter (modules/plato-motion/ios), for sessions on foot
 * with no watch tracking them.
 *
 * Optional because it only exists in a native iOS build: Jest, web and Expo Go
 * get null, and a session there asks how far it went, as it always did.
 */
export default requireOptionalNativeModule<PlatoMotionModule>("PlatoMotion");
