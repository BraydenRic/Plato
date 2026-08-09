import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";
import { View } from "react-native";

import { PALETTES } from "@/constants/theme";
import {
  AppearanceProvider,
  makeStyles,
  modeWithoutProvider,
  useAppearance,
  usePalette,
} from "@/context/AppearanceContext";

/**
 * Light mode's plumbing.
 *
 * The palette tests prove the two sets of colours are sound; these prove the
 * right set arrives. Every failure here is invisible in the one direction that
 * matters — a mode that never reaches the stylesheet just renders the old dark
 * app, which looks like nothing being wrong at all.
 */

// The phone's own setting, and the override pushed back at UIKit. RN's index
// resolves both through lazy require()s, so mocking the internal modules is what
// actually reaches `import { Appearance, useColorScheme } from "react-native"`.
let mockSystemScheme: "light" | "dark" | null = "light";
const mockSetColorScheme = jest.fn();

jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: () => mockSystemScheme,
}));

jest.mock("react-native/Libraries/Utilities/Appearance", () => ({
  getColorScheme: () => mockSystemScheme,
  setColorScheme: (scheme: unknown) => mockSetColorScheme(scheme),
  addChangeListener: () => ({ remove: () => {} }),
}));

let ctx: ReturnType<typeof useAppearance>;

function Control() {
  ctx = useAppearance();
  return null;
}

function mount(children?: React.ReactNode) {
  return render(
    <AppearanceProvider>
      <Control />
      {children}
    </AppearanceProvider>
  );
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockSetColorScheme.mockClear();
  // Deliberately the opposite of the default, so a test that passes by ignoring
  // the phone entirely can't be confused with one that passes by reading it.
  mockSystemScheme = "light";
});

describe("choosing an appearance", () => {
  it("starts dark even on a light phone, so an update doesn't turn the app white", async () => {
    mount();
    await settle();
    expect(ctx.pref).toBe("dark");
    expect(ctx.mode).toBe("dark");
  });

  it("restores a stored preference", async () => {
    await AsyncStorage.setItem("appearance", "light");
    mount();
    await settle();
    expect(ctx.pref).toBe("light");
    expect(ctx.mode).toBe("light");
  });

  it("persists the choice so it survives the next launch", async () => {
    mount();
    await settle();
    await act(async () => ctx.setPref("light"));
    expect(await AsyncStorage.getItem("appearance")).toBe("light");
  });

  it.each([["Light"], ["auto"], [""], ["constructor"]])(
    "falls back to the default for a stored %p",
    async (stored) => {
      await AsyncStorage.setItem("appearance", stored);
      mount();
      await settle();
      expect(ctx.pref).toBe("dark");
    }
  );
});

describe("following the phone", () => {
  it("resolves system to whatever the phone reports", async () => {
    mount();
    await settle();
    await act(async () => ctx.setPref("system"));
    expect(ctx.mode).toBe("light");
  });

  it("keeps a fixed choice regardless of the phone", async () => {
    // The whole point of the other two options: a dark app on a light phone.
    mount();
    await settle();
    await act(async () => ctx.setPref("dark"));
    expect(ctx.mode).toBe("dark");
  });

  it("falls back to dark when the phone hasn't answered yet", async () => {
    // useColorScheme reports null until the native module replies. Defaulting
    // to light there would flash a white screen on every cold start.
    mockSystemScheme = null;
    mount();
    await settle();
    await act(async () => ctx.setPref("system"));
    expect(ctx.mode).toBe("dark");
  });
});

describe("the native chrome", () => {
  /*
   * Alerts, the keyboard and action sheets are drawn by UIKit, not by us. Left
   * alone they follow the phone — so someone running Plato in light mode on a
   * dark phone taps "Delete account" and gets a black alert over a white
   * screen. This is the call that stops that.
   */
  it.each([
    ["light", "light"],
    ["dark", "dark"],
  ] as const)("pushes %p down to UIKit", async (pref, expected) => {
    mount();
    await settle();
    await act(async () => ctx.setPref(pref));
    expect(mockSetColorScheme).toHaveBeenLastCalledWith(expected);
  });

  it("hands control back for system", async () => {
    // null, not "system" — UIKit has no such value, and passing one through
    // would pin the app to whichever mode it silently coerced to.
    mount();
    await settle();
    await act(async () => ctx.setPref("system"));
    expect(mockSetColorScheme).toHaveBeenLastCalledWith(null);
  });
});

describe("usePalette", () => {
  it.each([
    ["light", PALETTES.light],
    ["dark", PALETTES.dark],
  ] as const)("hands back the %s palette", async (pref, expected) => {
    let seen: unknown;
    function Probe() {
      seen = usePalette();
      return null;
    }
    mount(<Probe />);
    await settle();
    await act(async () => ctx.setPref(pref));
    expect(seen).toBe(expected);
  });
});

describe("makeStyles", () => {
  it("rebuilds the sheet when the mode changes", async () => {
    const useStyles = makeStyles((c) => ({ box: { backgroundColor: c.bg } }));
    let styles: { box: { backgroundColor: string } };
    function Probe() {
      styles = useStyles();
      return <View style={styles.box} />;
    }

    mount(<Probe />);
    await settle();
    expect(styles!.box.backgroundColor).toBe(PALETTES.dark.bg);

    await act(async () => ctx.setPref("light"));
    expect(styles!.box.backgroundColor).toBe(PALETTES.light.bg);
  });

  it("reuses a sheet when a mode comes back around", async () => {
    // The reason the cache exists: without it every row of every list allocates
    // a fresh StyleSheet on every render. Going dark → light → dark is what
    // proves it, since a rebuild would hand back a different object.
    const useStyles = makeStyles((c) => ({ box: { backgroundColor: c.bg } }));
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useStyles());
      return null;
    }

    mount(<Probe />);
    await settle();
    const firstDark = seen[seen.length - 1];

    await act(async () => ctx.setPref("light"));
    await act(async () => ctx.setPref("dark"));

    expect(seen[seen.length - 1]).toBe(firstDark);
  });

  it("keeps a sheet per mode rather than one that overwrites itself", async () => {
    const useStyles = makeStyles((c) => ({ box: { backgroundColor: c.bg } }));
    const byMode = new Map<string, unknown>();
    function Probe() {
      byMode.set(usePalette() === PALETTES.light ? "light" : "dark", useStyles());
      return null;
    }

    mount(<Probe />);
    await settle();
    await act(async () => ctx.setPref("light"));
    await act(async () => ctx.setPref("dark"));
    expect(byMode.get("light")).not.toBe(byMode.get("dark"));
  });
});

describe("modeWithoutProvider", () => {
  /*
   * Used by the root error boundary, which renders *instead of* the tree that
   * holds the provider — so it has no context to read and must ask UIKit, where
   * the provider has already pushed the app's own choice.
   */
  it.each([
    ["light", "light"],
    ["dark", "dark"],
  ] as const)("reports %p from UIKit", (scheme, expected) => {
    mockSystemScheme = scheme;
    expect(modeWithoutProvider()).toBe(expected);
  });

  it("assumes dark when UIKit has no answer", () => {
    mockSystemScheme = null;
    expect(modeWithoutProvider()).toBe("dark");
  });
});
