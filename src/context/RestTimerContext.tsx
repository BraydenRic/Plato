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

// 0 means the auto rest countdown is off.
const RestTimerContext = createContext<{
  restSeconds: number;
  setRestSeconds: (seconds: number) => void;
}>({ restSeconds: DEFAULT_SECONDS, setRestSeconds: () => {} });

export function RestTimerProvider({ children }: { children: React.ReactNode }) {
  const [restSeconds, setRestSecondsState] = useState(DEFAULT_SECONDS);

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
    <RestTimerContext.Provider value={{ restSeconds, setRestSeconds }}>
      {children}
    </RestTimerContext.Provider>
  );
}

export function useRestTimer() {
  return useContext(RestTimerContext);
}
