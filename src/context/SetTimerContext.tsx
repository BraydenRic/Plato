import { createContext, useContext, useState } from "react";

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
 */
export interface RunningSetTimer {
  /** Which workout owns it, so another workout's screen doesn't claim the readout. */
  workoutId: string;
  exerciseId: string;
  setId: string;
  /** Wall-clock ms, backdated by any already-logged duration so start acts as resume. */
  startedAt: number;
}

const SetTimerContext = createContext<{
  timer: RunningSetTimer | null;
  startTimer: (timer: RunningSetTimer) => void;
  clearTimer: () => void;
}>({ timer: null, startTimer: () => {}, clearTimer: () => {} });

export function SetTimerProvider({ children }: { children: React.ReactNode }) {
  const [timer, setTimer] = useState<RunningSetTimer | null>(null);

  return (
    <SetTimerContext.Provider
      value={{ timer, startTimer: setTimer, clearTimer: () => setTimer(null) }}>
      {children}
    </SetTimerContext.Provider>
  );
}

export function useSetTimer() {
  return useContext(SetTimerContext);
}
