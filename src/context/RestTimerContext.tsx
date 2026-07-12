import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "rest_seconds";
const DEFAULT_SECONDS = 90;

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
