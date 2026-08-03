import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "rest_seconds";
// Off by default — the countdown is opt-in from Profile.
const DEFAULT_SECONDS = 0;

/**
 * The choices Profile offers. Half-step at 1:30 because that's where most
 * working sets land and the difference is felt; past 2:00 (heavy compounds,
 * max-effort singles) whole minutes are enough.
 *
 * Lives here rather than in the screen so the setting and its options stay
 * together — and so the labels can be checked against their seconds.
 */
export const REST_OPTIONS = [
  { label: "Off", seconds: 0 },
  { label: "1:00", seconds: 60 },
  { label: "1:30", seconds: 90 },
  { label: "2:00", seconds: 120 },
  { label: "3:00", seconds: 180 },
  { label: "4:00", seconds: 240 },
  { label: "5:00", seconds: 300 },
] as const;

/**
 * Where a stored duration sits on the options list.
 *
 * Nearest rather than exact, because the context accepts any duration while
 * this list is only the handful Profile offers. A value saved when the options
 * were different — or anything unexpected off the disk — still lands somewhere
 * sensible instead of silently pinning the picker to "Off".
 */
export function nearestRestIndex(seconds: number): number {
  return REST_OPTIONS.reduce(
    (best, option, i) =>
      Math.abs(option.seconds - seconds) < Math.abs(REST_OPTIONS[best].seconds - seconds)
        ? i
        : best,
    0
  );
}

// 0 means the auto rest countdown is off.
const RestTimerContext = createContext<{
  restSeconds: number;
  setRestSeconds: (seconds: number) => void;
  /**
   * Wall-clock ms the current rest is due to end, or null when not resting.
   *
   * Deliberately *not* cleared when it passes. The Live Activity draws its
   * countdown from this deadline and holds at 0:00 on its own once the deadline
   * is behind it — which is the only behaviour that survives a locked phone,
   * where no JavaScript is running to clear anything. Callers that want the
   * in-app "still resting" answer should compare it against the clock.
   */
  restEndsAt: number | null;
  /** Begins a rest of the configured length. No-op when the timer is off. */
  startRest: () => void;
  /** Pushes the deadline out, for the "+15s" control. */
  extendRest: (ms: number) => void;
  endRest: () => void;
}>({
  restSeconds: DEFAULT_SECONDS,
  setRestSeconds: () => {},
  restEndsAt: null,
  startRest: () => {},
  extendRest: () => {},
  endRest: () => {},
});

export function RestTimerProvider({ children }: { children: React.ReactNode }) {
  const [restSeconds, setRestSecondsState] = useState(DEFAULT_SECONDS);
  // Above the navigator for the same reason the set stopwatch is: the workout
  // screen unmounts the moment you leave it, which used to cancel a rest that
  // was still running. The deadline is wall-clock, so it resumes correctly.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);

  function startRest() {
    if (restSeconds <= 0) return;
    setRestEndsAt(Date.now() + restSeconds * 1000);
  }

  function extendRest(ms: number) {
    setRestEndsAt((current) => (current == null ? null : current + ms));
  }

  function endRest() {
    setRestEndsAt(null);
  }

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      const parsed = Number(raw);
      if (raw != null && Number.isFinite(parsed) && parsed >= 0) setRestSecondsState(parsed);
    });
  }, []);

  function setRestSeconds(seconds: number) {
    setRestSecondsState(seconds);
    AsyncStorage.setItem(STORAGE_KEY, String(seconds));
  }

  return (
    <RestTimerContext.Provider
      value={{ restSeconds, setRestSeconds, restEndsAt, startRest, extendRest, endRest }}>
      {children}
    </RestTimerContext.Provider>
  );
}

export function useRestTimer() {
  return useContext(RestTimerContext);
}
