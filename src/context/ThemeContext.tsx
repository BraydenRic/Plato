import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { AppState } from "react-native";

import {
  DEFAULT_THEME_ID,
  THEMES,
  isThemeId,
  resolveTheme,
  type ResolvedTheme,
  type ThemeId,
} from "@/constants/theme";
import { useMode } from "@/context/AppearanceContext";

const STORAGE_KEY = "theme_id";

// Alternate icons are compiled into dev/production builds by the config plugin,
// so the module is missing in Expo Go — same lazy-require dance as
// live-activity.ts, for the same reason: a top-level import would resolve the
// native module the moment this file is evaluated and take Expo Go down with it.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function iconModule(): typeof import("expo-alternate-app-icons") | null {
  if (isExpoGo) return null;
  try {
    return require("expo-alternate-app-icons");
  } catch {
    return null;
  }
}

/**
 * Pushes the home screen icon to match the theme.
 *
 * Deliberately fire-and-forget: on failure there is nothing useful to tell
 * someone who just tapped a colour swatch. The in-app theme is the thing they
 * asked for and it has already applied — a missing icon shouldn't undo it.
 *
 * Called on the way to the background rather than at the tap; see the effect in
 * ThemeProvider for why.
 */
async function applyAppIcon(iconName: string | null) {
  const mod = iconModule();
  if (!mod?.supportsAlternateIcons) return;
  try {
    // getAppIconName() returns null for the default icon, which is exactly the
    // shape iconName uses — so this no-ops when the icon is already right and
    // iOS never shows its alert for a theme that didn't move the icon.
    if (mod.getAppIconName() === iconName) return;
    await mod.setAlternateAppIcon(iconName);
  } catch {
    // Swallowed on purpose — see above.
  }
}

// Only the id is held. Which of the theme's two accent sets applies depends on
// the mode, which lives in AppearanceContext — so the flattening happens in the
// hooks below, where both are in scope.
const ThemeContext = createContext<{
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}>({
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (isThemeId(raw)) setThemeIdState(raw);
    });
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id);
  }, []);

  /*
   * The icon is swapped on the way out of the app, not when the swatch is
   * tapped.
   *
   * iOS answers every icon change with "You have changed the icon for Plato",
   * presented by the system with no public way to decline it — so tapping
   * through seven accents to find one meant seven alerts. (A previous attempt
   * swizzled UIViewController.present to swallow the alert. It shipped, it
   * compiled, and it did not intercept: whatever presents that alert on current
   * iOS does not go through the app's own present. It was removed.)
   *
   * Backgrounding is the honest fix rather than a trick. There is no foreground
   * UI to raise an alert over at that point, and the home screen icon is a thing
   * you can only *see* once you have left — so the moment you leave is exactly
   * when it needs to be right, and never a moment sooner. Browsing accents is
   * silent because nothing is applied while you browse.
   *
   * Keyed on themeId rather than a pending flag so it also repairs drift: if a
   * change was ever missed, the next trip to the background puts the icon back
   * in step. applyAppIcon no-ops when it already matches.
   */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") applyAppIcon(THEMES[themeId].iconName);
    });
    return () => sub.remove();
  }, [themeId]);

  const value = useMemo(() => ({ themeId, setThemeId }), [themeId, setThemeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active accent set, flattened for the current mode. */
export function useTheme(): ResolvedTheme {
  const { themeId } = useContext(ThemeContext);
  const mode = useMode();
  return useMemo(() => resolveTheme(THEMES[themeId], mode), [themeId, mode]);
}

/** For the picker, which needs to write the theme as well as read it. */
export function useThemePicker() {
  const { themeId, setThemeId } = useContext(ThemeContext);
  const theme = useTheme();
  return { theme, themeId, setThemeId };
}
