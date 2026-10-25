import { requireOptionalNativeModule, type NativeModule } from "expo";

type PlatoWatchEvents = {
  /** Something new arrived from the watch; read it with takeInbox(). */
  onInbox(): void;
  /** A tracked session's live numbers. `json` is a WatchLive. */
  onLive(event: { json: string }): void;
};

/** One op from the watch, still unapplied. `json` is a WatchOp. */
export type InboxEntry = { id: string; json: string };

declare class PlatoWatchModule extends NativeModule<PlatoWatchEvents> {
  /** Hands the watch the latest snapshot. Only the newest one matters. */
  updateContext(json: string): void;
  /** Everything the watch has sent that hasn't been acknowledged, oldest first. */
  takeInbox(): InboxEntry[];
  /** Forgets ops once they've been applied (or rejected for good). */
  ackInbox(ids: string[]): void;
  /** A watch is paired and has Plato on it. */
  isWatchAppInstalled(): boolean;
}

/**
 * The WatchConnectivity bridge (modules/plato-watch/ios).
 *
 * Optional because it only exists in a native iOS build: Jest, web and Expo Go
 * get null, and the watch sync simply doesn't run there.
 */
export default requireOptionalNativeModule<PlatoWatchModule>("PlatoWatch");
