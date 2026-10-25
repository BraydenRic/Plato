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
import { useAppearance } from "@/context/AppearanceContext";

const STORAGE_KEY = "theme_id";

/**
 * How long after a tap a mode change still counts as part of it.
 *
 * Only one change needs this: choosing System clears the override, and RN
 * reports the phone's real mode a render or two later, as a mode change with
 * no tap of its own. Anything past this is the phone acting by itself.
 */
const CHOICE_WINDOW_MS = 2000;

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
 * Swallowing the error is also why three attempts at deferring this call could
 * never be diagnosed — see setThemeId.
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
  const { mode, changes } = useAppearance();
  // When the user last chose something the icon answers to, or null before
  // they have. Nothing touches the icon without a fresh choice: both stored
  // values arrive asynchronously after mount, so a cold start would otherwise
  // move the icon and open with iOS's alert — and with Appearance on System,
  // the phone going dark at sunset, or a Focus or Control Center flipping it,
  // would put that alert over the set logger mid-workout.
  const choiceAt = useRef<number | null>(null);
  const seenChanges = useRef(changes);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (isThemeId(raw)) setThemeIdState(raw);
    });
  }, []);

  /*
   * Applied at the tap, which means iOS raises "You have changed the icon for
   * Plato" every time. That is deliberate, after three attempts at avoiding it:
   *
   *  - Swizzling UIViewController.present to swallow the alert. Shipped and
   *    compiled — the selector is in build 41's binary — and did not intercept.
   *    Whatever presents that alert does not go through the app's own present.
   *  - Applying on the transition to background, where there is no foreground
   *    to alert over. Silent, and the icon never changed: the app suspends
   *    before the call lands and the error is swallowed.
   *  - Applying after a two-second pause in the tapping, still in the
   *    foreground. Also never changed the icon, for reasons never established.
   *
   * Only the immediate call is known to actually work, so the alert is the
   * price. Anyone tempted to defer this again: builds 41 through 44 are the
   * record of that not working, and the next attempt needs the swallowed error
   * surfaced first — `applyAppIcon` hides exactly the diagnostic that would
   * explain why the deferred calls failed.
   */
  const setThemeId = useCallback((id: ThemeId) => {
    choiceAt.current = Date.now();
    setThemeIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id);
  }, []);

  // The icon answers to both axes: which accent, and which mode it has to sit
  // on. A white glyph on near-black is unreadable on a light home screen, so
  // switching appearance moves the icon exactly as switching accent does.
  //
  // But only when the switch was a tap in Plato. A mode change the phone made
  // by itself, minutes after any tap, leaves the icon where it is: an icon on
  // the other mode until the next visit to Profile is a far smaller cost than
  // iOS's alert landing on whatever screen is up. It used to follow the phone
  // only in a launch where Profile had been touched, and not otherwise.
  useEffect(() => {
    if (changes !== seenChanges.current) {
      seenChanges.current = changes;
      choiceAt.current = Date.now();
    }
    if (choiceAt.current == null || Date.now() - choiceAt.current > CHOICE_WINDOW_MS) return;
    applyAppIcon(THEMES[themeId][mode].iconName);
  }, [themeId, mode, changes]);

  const value = useMemo(() => ({ themeId, setThemeId }), [themeId, setThemeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active accent set, flattened for the current mode. */
export function useTheme(): ResolvedTheme {
  const { themeId } = useContext(ThemeContext);
  const { mode } = useAppearance();
  return useMemo(() => resolveTheme(THEMES[themeId], mode), [themeId, mode]);
}

/** For the picker, which needs to write the theme as well as read it. */
export function useThemePicker() {
  const { themeId, setThemeId } = useContext(ThemeContext);
  const theme = useTheme();
  return { theme, themeId, setThemeId };
}
