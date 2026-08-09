import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";

import { ThemeProvider, useTheme, useThemePicker } from "../ThemeContext";
import { DEFAULT_THEME_ID, THEMES } from "@/constants/theme";

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
    // iOS puts up a system alert on every successful change, so a redundant
    // call would nag someone who re-picked the theme they were already on.
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
