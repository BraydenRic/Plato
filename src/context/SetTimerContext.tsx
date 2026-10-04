import { createContext, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The one running set stopwatch (timed exercises — cardio, holds).
 *
 * This lives above the navigator rather than inside the workout screen because
 * that screen unmounts the moment you leave it, which used to cancel a running
 * timer. A plank or a treadmill block keeps counting while you're off checking
 * another tab, and the elapsed value is derived from `startedAt` rather than
 * accumulated by an interval, so time spent with the app backgrounded counts too.
 *
 * Only one can run at a time, matching the workout screen's own rule: starting
 * a second set's timer banks the first.
 *
 * It's also saved to the phone. Living above the navigator survives leaving
 * the screen, but not iOS ending the app: swipe Plato away mid-plank and the
 * running timer was gone, back to zero on reopening. Because the elapsed time
 * comes from `startedAt`, saving that one number is all it takes to come back
 * still counting, with the time the app was closed included.
 */
export interface RunningSetTimer {
  /** Which workout owns it, so another workout's screen doesn't claim the readout. */
  workoutId: string;
  exerciseId: string;
  setId: string;
  /** Wall-clock ms, backdated by any already-logged duration so start acts as resume. */
  startedAt: number;
}

const STORAGE_KEY = "running_set_timer";

/**
 * Older than this when the app reopens, a running timer is taken as forgotten
 * rather than resumed. Nobody holds a plank or runs a treadmill block for half
 * a day, and resuming one would log a duration in the tens of hours.
 */
export const MAX_RESUMED_TIMER_MS = 12 * 60 * 60 * 1000;

function parseTimer(raw: string | null): RunningSetTimer | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Partial<RunningSetTimer>;
    const valid =
      typeof t.workoutId === "string" &&
      typeof t.exerciseId === "string" &&
      typeof t.setId === "string" &&
      typeof t.startedAt === "number" &&
      Number.isFinite(t.startedAt);
    if (!valid || Date.now() - t.startedAt! > MAX_RESUMED_TIMER_MS) return null;
    return t as RunningSetTimer;
  } catch {
    return null;
  }
}

const SetTimerContext = createContext<{
  timer: RunningSetTimer | null;
  startTimer: (timer: RunningSetTimer) => void;
  clearTimer: () => void;
}>({ timer: null, startTimer: () => {}, clearTimer: () => {} });

export function SetTimerProvider({ children }: { children: React.ReactNode }) {
  const [timer, setTimer] = useState<RunningSetTimer | null>(null);
  /** A timer was started or cleared this launch, so the saved one is out of date. */
  const touched = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        // Anything done in the moment before this read landed is newer.
        if (touched.current) return;
        const saved = parseTimer(raw);
        if (saved) setTimer(saved);
        else if (raw) AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      })
      .catch(() => {});
  }, []);

  function startTimer(next: RunningSetTimer) {
    touched.current = true;
    setTimer(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }

  function clearTimer() {
    touched.current = true;
    setTimer(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }

  return (
    <SetTimerContext.Provider value={{ timer, startTimer, clearTimer }}>
      {children}
    </SetTimerContext.Provider>
  );
}

export function useSetTimer() {
  return useContext(SetTimerContext);
}
