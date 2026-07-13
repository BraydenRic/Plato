import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "default_sets";
// How many sets a newly added exercise starts with. Matches the old hardcoded 3.
const DEFAULT_SETS = 3;
export const MIN_SETS = 1;
export const MAX_SETS = 5;

const DefaultSetsContext = createContext<{
  defaultSets: number;
  setDefaultSets: (count: number) => void;
}>({ defaultSets: DEFAULT_SETS, setDefaultSets: () => {} });

export function DefaultSetsProvider({ children }: { children: React.ReactNode }) {
  const [defaultSets, setDefaultSetsState] = useState(DEFAULT_SETS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      const parsed = Number(raw);
      // Guard against stale/out-of-range values so we never create 0 or 99 sets.
      if (raw != null && Number.isInteger(parsed) && parsed >= MIN_SETS && parsed <= MAX_SETS) {
        setDefaultSetsState(parsed);
      }
    });
  }, []);

  function setDefaultSets(count: number) {
    const clamped = Math.min(MAX_SETS, Math.max(MIN_SETS, Math.round(count)));
    setDefaultSetsState(clamped);
    AsyncStorage.setItem(STORAGE_KEY, String(clamped));
  }

  return (
    <DefaultSetsContext.Provider value={{ defaultSets, setDefaultSets }}>
      {children}
    </DefaultSetsContext.Provider>
  );
}

export function useDefaultSets() {
  return useContext(DefaultSetsContext);
}
