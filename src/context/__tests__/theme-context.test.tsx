import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";

import { ThemeProvider, useTheme, useThemePicker } from "../ThemeContext";
import { AppearanceProvider, useAppearance } from "../AppearanceContext";
import { DEFAULT_THEME_ID, THEMES, type AppearancePref } from "@/constants/theme";

/**
 * The accent theme: which palette the app renders in, and the home screen icon
 * that follows it.
 *
 * The icon module is native and absent in Expo Go, so ThemeContext lazy-requires
 * it behind a try/catch. That fallback is most of what's worth testing here —
 * a theme change has to apply in-app whether or not the icon can follow, and it
 * must never take the app down when it can't.
 */

const mockSetAlternateAppIcon = jest.fn(async (name: string | null) => name);
const mockGetAppIconName = jest.fn<string | null, []>(() => null);
let mockSupportsAlternateIcons = true;

// ThemeContext decides at module-load whether the native icon module exists, by
// reading Constants.executionEnvironment. Left to the real expo-constants that
// value depends on how the module was resolved earlier in the run, which made
// these tests pass or fail depending on the order jest happened to pick. Pinning
// it makes the "not Expo Go" branch the one under test, every time.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "standalone" },
  ExecutionEnvironment: { StoreClient: "storeClient", Standalone: "standalone", Bare: "bare" },
}));

// AppearanceProvider pushes the mode at UIKit on mount, and there is none here.
// A stand-in instead: the phone's own scheme, the override the app pushes over
// it, and the listeners useColorScheme subscribes with — so a test can have
// the phone flip by itself, which is how a "system" user's mode changes.
let mockPhoneScheme: "light" | "dark" = "dark";
let mockOverride: "light" | "dark" | null = null;
const mockSchemeListeners = new Set<() => void>();
jest.mock("react-native/Libraries/Utilities/Appearance", () => ({
  getColorScheme: () => mockOverride ?? mockPhoneScheme,
  setColorScheme: (scheme: "light" | "dark" | null) => {
    mockOverride = scheme;
  },
  addChangeListener: (listener: () => void) => {
    mockSchemeListeners.add(listener);
    return { remove: () => mockSchemeListeners.delete(listener) };
  },
}));
// RN's jest setup pins useColorScheme to a constant 'light' that never
// changes, so put back a real subscription — the same shape as RN's own hook,
// reading the stand-in above.
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => {
  const { useSyncExternalStore } = jest.requireActual("react");
  const subscribe = (onChange: () => void) => {
    mockSchemeListeners.add(onChange);
    return () => {
      mockSchemeListeners.delete(onChange);
    };
  };
  function useColorScheme() {
    return useSyncExternalStore(subscribe, () => mockOverride ?? mockPhoneScheme);
  }
  return { __esModule: true, default: useColorScheme };
});

/** What RCTAppearance does when the phone's appearance moves. */
async function phoneReports(scheme: "light" | "dark") {
  mockPhoneScheme = scheme;
  await act(async () => {
    mockSchemeListeners.forEach((listener) => listener());
  });
}

jest.mock("expo-alternate-app-icons", () => ({
  get supportsAlternateIcons() {
    return mockSupportsAlternateIcons;
  },
  setAlternateAppIcon: (name: string | null) => mockSetAlternateAppIcon(name),
  getAppIconName: () => mockGetAppIconName(),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockSupportsAlternateIcons = true;
  mockGetAppIconName.mockReturnValue(null);
  mockPhoneScheme = "dark";
  mockOverride = null;
});


function mountPicker() {
  const box: { current: ReturnType<typeof useThemePicker> } = { current: undefined! };
  function Probe() {
    box.current = useThemePicker();
    return null;
  }
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  );
  return box;
}

/** The same, with a real AppearanceProvider so the mode can be moved. */
function mountWithAppearance() {
  const box: {
    theme: ReturnType<typeof useThemePicker>;
    appearance: ReturnType<typeof useAppearance>;
  } = { theme: undefined!, appearance: undefined! };
  function Probe() {
    box.theme = useThemePicker();
    box.appearance = useAppearance();
    return null;
  }
  render(
    <AppearanceProvider>
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    </AppearanceProvider>
  );
  return box;
}

async function choose(box: ReturnType<typeof mountWithAppearance>, pref: AppearancePref) {
  await act(async () => {
    box.appearance.setPref(pref);
    await Promise.resolve();
  });
}

/** Lets the storage-hydration promise resolve and React apply the result. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("choosing a theme", () => {
  it("starts on the shipped default, so an existing install looks unchanged", async () => {
    const ctx = mountPicker();
    await settle();
    expect(ctx.current.themeId).toBe(DEFAULT_THEME_ID);
    // Compared field-wise rather than by identity: the hook hands back a theme
    // already flattened to the current mode, so it is a derived object and not
    // the registry entry itself. Dark because no AppearanceProvider is mounted.
    expect(ctx.current.theme.id).toBe(DEFAULT_THEME_ID);
    expect(ctx.current.theme.accent).toBe(THEMES[DEFAULT_THEME_ID].dark.accent);
  });

  it("hands back the full palette, not just the id", async () => {
    const ctx = mountPicker();
    await settle();
    await act(async () => ctx.current.setThemeId("cyan"));
    expect(ctx.current.theme.accent).toBe(THEMES.cyan.dark.accent);
    expect(ctx.current.theme.onAccent).toBe(THEMES.cyan.dark.onAccent);
  });

  it("persists the choice so it survives the next launch", async () => {
    const ctx = mountPicker();
    await settle();
    await act(async () => ctx.current.setThemeId("magenta"));
    expect(await AsyncStorage.getItem("theme_id")).toBe("magenta");
  });

  it("restores a previously chosen theme", async () => {
    await AsyncStorage.setItem("theme_id", "amber");
    const ctx = mountPicker();
    await settle();
    expect(ctx.current.themeId).toBe("amber");
  });

  it.each([["purple"], [""], ["constructor"], ["toString"]])(
    "falls back to the default for a stored %p",
    async (raw) => {
      // "constructor" is the interesting one: a naive `in` check would pass it
      // through and index THEMES to a function instead of a palette.
      await AsyncStorage.setItem("theme_id", raw);
      const ctx = mountPicker();
      await settle();
      expect(ctx.current.themeId).toBe(DEFAULT_THEME_ID);
      expect(ctx.current.theme.accent).toBe(THEMES[DEFAULT_THEME_ID].dark.accent);
    }
  );

  it("exposes the same palette through the read-only hook", async () => {
    const seen: string[] = [];
    function Reader() {
      seen.push(useTheme().id);
      return null;
    }
    const box: { current: ReturnType<typeof useThemePicker> } = { current: undefined! };
    function Probe() {
      box.current = useThemePicker();
      return null;
    }
    render(
      <ThemeProvider>
        <Probe />
        <Reader />
      </ThemeProvider>
    );
    await settle();
    await act(async () => box.current.setThemeId("cobalt"));
    expect(seen[seen.length - 1]).toBe("cobalt");
  });
});

describe("the home screen icon", () => {
  /*
   * Applied immediately, which is the only timing known to actually work.
   *
   * Three deferred variants shipped and none of them moved the icon (see
   * ThemeContext for the list). The lesson worth keeping in a test: "no alert"
   * and "no icon change" look identical from inside the app, so assert that the
   * call happens rather than only that it stays quiet.
   */
  it("switches to the alternate registered for the theme", async () => {
    const ctx = mountPicker();
    await settle();
    await act(async () => ctx.current.setThemeId("amber"));
    expect(mockSetAlternateAppIcon).toHaveBeenCalledWith("Amber");
  });

  it("clears the alternate for the theme that owns the bundled icon", async () => {
    mockGetAppIconName.mockReturnValue("Amber");
    const ctx = mountPicker();
    await settle();
    await act(async () => ctx.current.setThemeId("graphite"));
    // null is the plugin's "go back to the default icon".
    expect(mockSetAlternateAppIcon).toHaveBeenCalledWith(null);
  });

  it("leaves the icon alone when it already matches", async () => {
    mockGetAppIconName.mockReturnValue("Cobalt");
    const ctx = mountPicker();
    await settle();
    await act(async () => ctx.current.setThemeId("cobalt"));
    // A redundant call would raise the system alert for a change that isn't one.
    expect(mockSetAlternateAppIcon).not.toHaveBeenCalled();
  });

  it("still applies the theme when the device can't change icons", async () => {
    mockSupportsAlternateIcons = false;
    const ctx = mountPicker();
    await settle();
    await act(async () => ctx.current.setThemeId("cyan"));
    expect(ctx.current.themeId).toBe("cyan");
    expect(mockSetAlternateAppIcon).not.toHaveBeenCalled();
  });

  it("still applies the theme when the icon change fails", async () => {
    mockSetAlternateAppIcon.mockRejectedValueOnce(new Error("no such icon"));
    const ctx = mountPicker();
    await settle();
    await act(async () => ctx.current.setThemeId("magenta"));
    // The colour is what was asked for; a failed icon must not undo it.
    expect(ctx.current.themeId).toBe("magenta");
    expect(await AsyncStorage.getItem("theme_id")).toBe("magenta");
  });

  it("does not touch the icon on launch, only on an explicit choice", async () => {
    // Re-applying at startup would make iOS show its alert every cold start.
    await AsyncStorage.setItem("theme_id", "cyan");
    mountPicker();
    await settle();
    expect(mockSetAlternateAppIcon).not.toHaveBeenCalled();
  });
});

describe("the icon and the mode", () => {
  /*
   * The icon carries a background with it, so it answers to light/dark as well
   * as to the accent: the bundled glyph is white on near-black, which is the
   * one that looks broken sitting on a light home screen.
   */
  it("moves the icon when the appearance changes", async () => {
    const box = mountWithAppearance();
    await settle();
    await choose(box, "light");
    expect(mockSetAlternateAppIcon).toHaveBeenLastCalledWith("VioletLight");
  });

  it("moves it back on the way to dark", async () => {
    const box = mountWithAppearance();
    await settle();
    await choose(box, "light");
    await choose(box, "dark");
    // null is the bundled icon — Violet's dark alternate, in this case, is a
    // real name; the point is only that it is not the Light one.
    expect(mockSetAlternateAppIcon).toHaveBeenLastCalledWith("Violet");
  });

  it("picks the icon for the mode in force, not the default one", async () => {
    const box = mountWithAppearance();
    await settle();
    await choose(box, "light");
    mockSetAlternateAppIcon.mockClear();
    await act(async () => box.theme.setThemeId("cyan"));
    expect(mockSetAlternateAppIcon).toHaveBeenCalledWith("CyanLight");
  });

  it("stays quiet on launch, however the stored preference resolves", async () => {
    // Both stored values arrive after mount, so the mode moves on a cold start
    // without anyone asking. Applying then would open every launch with iOS's
    // alert — the reason the provider waits for a deliberate choice.
    await AsyncStorage.setItem("appearance", "light");
    await AsyncStorage.setItem("theme_id", "magenta");
    mountWithAppearance();
    await settle();
    await settle();
    expect(mockSetAlternateAppIcon).not.toHaveBeenCalled();
  });
});

describe("the icon and a phone that changes by itself", () => {
  /*
   * On System, the mode follows the phone — and the phone flips with no tap in
   * Plato: Automatic at sunset, a Focus with an appearance filter, Control
   * Center. Moving the icon then raises iOS's alert over whatever is on
   * screen, which is usually the set logger. Only a choice made in the app may
   * move the icon.
   */
  it("leaves the icon alone when the phone flips long after any tap", async () => {
    const box = mountWithAppearance();
    await settle();
    // The tap that used to arm it for the rest of the launch.
    await choose(box, "system");
    mockSetAlternateAppIcon.mockClear();

    // Ten minutes on, mid-set.
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(Date.now() + 10 * 60 * 1000);
    try {
      await phoneReports("light");
    } finally {
      nowSpy.mockRestore();
    }

    // The app did follow the phone; only the icon stayed put.
    expect(box.appearance.mode).toBe("light");
    expect(mockSetAlternateAppIcon).not.toHaveBeenCalled();
  });

  it("leaves it alone with no tap at all this launch", async () => {
    await AsyncStorage.setItem("appearance", "system");
    const box = mountWithAppearance();
    await settle();
    await settle();
    expect(box.appearance.pref).toBe("system");
    expect(box.appearance.mode).toBe("dark");

    await phoneReports("light");

    expect(box.appearance.mode).toBe("light");
    expect(mockSetAlternateAppIcon).not.toHaveBeenCalled();
  });

  it("still follows the phone's real mode straight after choosing System", async () => {
    // On light, on a dark phone. Choosing System clears the override, and the
    // phone's dark arrives a moment later as a mode change of its own — which
    // is part of the tap, so the icon goes with it.
    const box = mountWithAppearance();
    await settle();
    await choose(box, "light");
    expect(mockSetAlternateAppIcon).toHaveBeenLastCalledWith("VioletLight");
    mockGetAppIconName.mockReturnValue("VioletLight");

    await choose(box, "system");
    await phoneReports("dark");

    expect(box.appearance.mode).toBe("dark");
    expect(mockSetAlternateAppIcon).toHaveBeenLastCalledWith("Violet");
  });

  it("still moves for a theme tap made after a phone flip", async () => {
    await AsyncStorage.setItem("appearance", "system");
    const box = mountWithAppearance();
    await settle();
    await settle();
    await phoneReports("light");
    expect(box.appearance.mode).toBe("light");

    await act(async () => box.theme.setThemeId("cobalt"));
    expect(mockSetAlternateAppIcon).toHaveBeenCalledWith("CobaltLight");
  });
});
