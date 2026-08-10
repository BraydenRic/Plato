import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Appearance,
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import {
  DEFAULT_APPEARANCE,
  PALETTES,
  isAppearancePref,
  type AppearancePref,
  type Mode,
  type PaletteColors,
} from "@/constants/theme";

const STORAGE_KEY = "appearance";

/**
 * Light/dark, kept deliberately apart from ThemeContext.
 *
 * They look like the same concern and aren't: the accent is a preference with
 * one source (the picker), while the mode has two (the picker *and* the phone,
 * when it's set to follow along). Keeping them separate also means the nine
 * test files that stub ThemeContext don't have to grow a mode — they fall
 * through to the default below and render dark, exactly as they did before.
 */
const AppearanceContext = createContext<{
  pref: AppearancePref;
  mode: Mode;
  setPref: (pref: AppearancePref) => void;
  /**
   * How many times the user has changed this, which is not the same as how many
   * times `mode` has changed — restoring the stored preference at launch moves
   * the mode without anyone having asked for anything.
   *
   * ThemeContext needs the difference: the app icon follows the mode, and iOS
   * raises an alert on every icon change, so a cold start must not look like a
   * choice.
   */
  changes: number;
}>({
  pref: DEFAULT_APPEARANCE,
  // DEFAULT_APPEARANCE is a concrete mode rather than "system", so this needs no
  // resolving. If that ever changes this default has to start at a real palette
  // anyway — there is no phone to ask outside a provider.
  mode: "dark",
  setPref: () => {},
  changes: 0,
});

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<AppearancePref>(DEFAULT_APPEARANCE);
  const [changes, setChanges] = useState(0);
  const system = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (isAppearancePref(raw)) setPrefState(raw);
    });
  }, []);

  // `useColorScheme` reports null when the native module hasn't answered yet.
  // Falling back to dark rather than light keeps a "system" user from getting a
  // white flash on every cold start.
  const mode: Mode = pref === "system" ? (system ?? "dark") : pref;

  /*
   * Hand the choice down to UIKit as well.
   *
   * A pile of chrome is drawn by the OS rather than by us — Alert dialogs, the
   * keyboard, action sheets, the text-selection menu, the scroll indicators.
   * Left alone those follow the *phone*, so someone running the app in light
   * mode on a dark phone taps "Delete account" and gets a black alert over a
   * white screen. Passing null hands control back for the "system" case.
   *
   * This is also why app.json now sets `userInterfaceStyle: "automatic"`. Pinned
   * to "dark" the native side ignores both the phone and this call.
   */
  useEffect(() => {
    Appearance.setColorScheme(pref === "system" ? null : pref);
  }, [pref]);

  const setPref = useCallback((next: AppearancePref) => {
    setPrefState(next);
    setChanges((n) => n + 1);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ pref, mode, setPref, changes }),
    [pref, mode, setPref, changes]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

/** The palette actually rendering, after "system" has been resolved. */
export function useMode(): Mode {
  return useContext(AppearanceContext).mode;
}

/** For the Profile control, which needs the raw preference to show "System". */
export function useAppearance() {
  return useContext(AppearanceContext);
}

/** Neutral chrome for the current mode. Accents still come from `useTheme()`. */
export function usePalette(): PaletteColors {
  return PALETTES[useMode()];
}

/**
 * The mode to paint with when there is no provider to ask — which in practice
 * means the root error boundary, since that renders *instead of* the tree
 * holding the provider rather than inside it.
 *
 * Reads UIKit rather than storage because the provider has already pushed the
 * choice down there with `setColorScheme`, so this gives back the app's own mode
 * and not the phone's. Before that first push — a crash in the first frames —
 * it returns the system value, which is the best guess available and still
 * better than assuming.
 */
export function modeWithoutProvider(): Mode {
  return Appearance.getColorScheme() === "light" ? "light" : "dark";
}

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * A `StyleSheet.create` that can see the palette.
 *
 * Every screen used to build its styles once at module load, which is only
 * possible while the colours are constants. They aren't any more, so the sheet
 * has to be built per mode — but rebuilding it on every render would allocate a
 * fresh stylesheet for every row of every list, so each call site keeps its two
 * (one per mode) and hands back the same object forever after.
 *
 * Accents are deliberately not passed in. They would multiply the cache by the
 * seven themes for no gain: accent-coloured pieces are already applied inline at
 * the point of use, because they change while the screen is mounted.
 */
export function makeStyles<T extends NamedStyles>(factory: (c: PaletteColors) => T): () => T {
  const cache = new Map<Mode, T>();

  return function useStyles(): T {
    const mode = useMode();
    let sheet = cache.get(mode);
    if (!sheet) {
      sheet = StyleSheet.create(factory(PALETTES[mode]));
      cache.set(mode, sheet);
    }
    return sheet;
  };
}
