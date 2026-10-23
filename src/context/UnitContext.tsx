import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type WeightUnit = "lbs" | "kg";

// Volumes are stored in lbs everywhere (shared with plato-web); this context
// only controls how they're displayed. It lives at the root so a change in
// Profile immediately re-renders every screen showing weights.
const UnitContext = createContext<{
  unit: WeightUnit;
  setUnit: (u: WeightUnit) => void;
  /** The saved preference has been read, so `unit` is the real one, not the default. */
  loaded: boolean;
}>({
  unit: "lbs",
  setUnit: () => {},
  loaded: true,
});

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnitState] = useState<WeightUnit>("lbs");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("weight_unit")
      .then((u) => {
        if (u === "kg" || u === "lbs") setUnitState(u);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function setUnit(next: WeightUnit) {
    setUnitState(next);
    AsyncStorage.setItem("weight_unit", next);
  }

  return <UnitContext.Provider value={{ unit, setUnit, loaded }}>{children}</UnitContext.Provider>;
}

export function useWeightUnit() {
  return useContext(UnitContext);
}
