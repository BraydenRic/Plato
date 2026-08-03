import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";

import { DEFAULT_THEME_ID, THEMES, isThemeId, type Theme, type ThemeId } from "@/constants/theme";

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
 * Deliberately fire-and-forget: iOS puts up its own "You have changed the icon
 * for Plato" alert on success, and on failure there is nothing useful to tell
 * someone who just tapped a colour swatch. The in-app theme is the thing they
 * asked for and it has already applied — a missing icon shouldn't undo it.
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

const ThemeContext = createContext<{
  theme: Theme;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}>({
  theme: THEMES[DEFAULT_THEME_ID],
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

  function setThemeId(id: ThemeId) {
    setThemeIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id);
    applyAppIcon(THEMES[id].iconName);
  }

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeId], themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** The active accent palette. Neutral chrome still comes from `Palette`. */
export function useTheme() {
  return useContext(ThemeContext).theme;
}

/** For the picker, which needs to write the theme as well as read it. */
export function useThemePicker() {
  return useContext(ThemeContext);
}
