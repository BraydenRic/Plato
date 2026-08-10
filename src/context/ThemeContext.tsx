import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";

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

/**
 * How long the icon waits for the tapping to stop.
 *
 * Long enough to sit out a run along the swatch row, short enough that the
 * alert still reads as a consequence of what you just did rather than arriving
 * out of nowhere.
 */
const ICON_SETTLE_MS = 2000;

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
 * Called once the tapping has settled rather than at each tap; see the effect
 * in ThemeProvider for why.
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
  // undefined means "nothing asked for"; null is a real value meaning the
  // bundled icon, so the two can't be collapsed.
  const pendingIcon = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (isThemeId(raw)) setThemeIdState(raw);
    });
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id);
    pendingIcon.current = THEMES[id].iconName;
  }, []);

  /*
   * The icon follows once you've settled on an accent, not on every tap.
   *
   * iOS answers each successful change with "You have changed the icon for
   * Plato" — raised by the system, with no public way to decline it — so
   * applying per tap meant an alert for every swatch tried on the way past.
   *
   * Two attempts at removing the alert outright are recorded here so they don't
   * get made a third time:
   *
   *  - Swizzling UIViewController.present to swallow it. Shipped and compiled
   *    (the selector is in build 41's binary) and did not intercept — whatever
   *    presents that alert does not go through the app's own present.
   *  - Applying it on the way to the background, where there is no foreground
   *    to alert over. The alert stayed away and so did the icon change: the app
   *    suspends before the call lands, and it fails silently.
   *
   * There is no sanctioned way to have the icon follow the accent *and* stay
   * silent. What's left is to ask as rarely as possible: the swap waits for a
   * pause in the tapping and then applies once, so trying on all seven accents
   * costs one alert rather than seven, at the moment you've stopped.
   *
   * A pending ref rather than the theme itself, because only a deliberate
   * choice should move the icon — restoring the stored theme at launch must
   * not, or every cold start would open with an alert.
   */
  useEffect(() => {
    if (pendingIcon.current === undefined) return;
    const timer = setTimeout(() => {
      const icon = pendingIcon.current;
      pendingIcon.current = undefined;
      if (icon !== undefined) applyAppIcon(icon);
    }, ICON_SETTLE_MS);
    // Each further tap restarts the wait, so only where you land is applied.
    return () => clearTimeout(timer);
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
