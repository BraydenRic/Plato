import { StyleSheet, Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Button, Card, Chip } from "../ui";
import { ThemeProvider, useThemePicker } from "@/context/ThemeContext";
import { AppearanceProvider, useAppearance } from "@/context/AppearanceContext";
import { PALETTES, THEMES, type AppearancePref, type ThemeId } from "@/constants/theme";

// Pulls in expo-font's native loader, which has no place in a unit test.
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

// AppearanceProvider pushes the chosen mode down to UIKit on mount, and there
// is no UIKit here.
jest.mock("react-native/Libraries/Utilities/Appearance", () => ({
  getColorScheme: () => "dark",
  setColorScheme: jest.fn(),
  addChangeListener: () => ({ remove: () => {} }),
}));


/**
 * End-to-end wiring between the theme and the shared primitives.
 *
 * The palette tests prove the colours are sound and the context tests prove the
 * choice is stored — this is the join between them: that picking a theme
 * actually repaints the components, and that the accent is read at render time
 * rather than captured once into a module-level StyleSheet (which is exactly
 * how a themeable design system quietly stops being themeable).
 */

jest.mock("expo-alternate-app-icons", () => ({
  supportsAlternateIcons: false,
  setAlternateAppIcon: jest.fn(),
  getAppIconName: () => null,
}));

beforeEach(async () => {
  await AsyncStorage.clear();
});

/** Flattens a style prop down to the value actually applied. */
function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as never) ?? {};
}

let setTheme: (id: ThemeId) => void;

function Harness({ children }: { children: React.ReactNode }) {
  function Control() {
    setTheme = useThemePicker().setThemeId;
    return null;
  }
  return (
    <ThemeProvider>
      <Control />
      {children}
    </ThemeProvider>
  );
}

async function choose(id: ThemeId) {
  await act(async () => {
    setTheme(id);
    await Promise.resolve();
  });
}

describe("Button", () => {
  it("fills a primary button with the active accent", async () => {
    render(
      <Harness>
        <Button title="Start workout" testID="btn" />
      </Harness>
    );
    expect(flatten(screen.getByTestId("btn").props.style).backgroundColor).toBe(
      THEMES.violet.dark.accent
    );

    await choose("magenta");
    expect(flatten(screen.getByTestId("btn").props.style).backgroundColor).toBe(
      THEMES.magenta.dark.accent
    );
  });

  it("flips the label to dark on the accents that wash white out", async () => {
    render(
      <Harness>
        <Button title="Start workout" />
      </Harness>
    );
    // Violet carries white...
    expect(flatten(screen.getByText("Start workout").props.style).color).toBe(
      THEMES.violet.dark.onAccent
    );

    // ...cyan cannot, so the same button turns dark-on-colour.
    await choose("cyan");
    const label = flatten(screen.getByText("Start workout").props.style).color;
    expect(label).toBe(THEMES.cyan.dark.onAccent);
    expect(label).not.toBe("#ffffff");
  });

  it("tints a ghost button's label with the accent's text shade", async () => {
    render(
      <Harness>
        <Button title="Skip" variant="ghost" />
      </Harness>
    );
    await choose("amber");
    expect(flatten(screen.getByText("Skip").props.style).color).toBe(THEMES.amber.dark.accentText);
  });

  it("leaves the danger variant on its semantic red whatever the theme", async () => {
    render(
      <Harness>
        <Button title="Delete" variant="danger" testID="danger" />
      </Harness>
    );
    const before = flatten(screen.getByTestId("danger").props.style).backgroundColor;
    await choose("cyan");
    // A destructive action must not start looking like a primary one.
    expect(flatten(screen.getByTestId("danger").props.style).backgroundColor).toBe(before);
  });
});

describe("Chip", () => {
  it("wears the accent only while it is active", async () => {
    render(
      <Harness>
        <Chip label="Chest" active />
        <Chip label="Back" />
      </Harness>
    );
    await choose("cobalt");

    expect(flatten(screen.getByText("Chest").props.style).color).toBe(THEMES.cobalt.dark.accentText);
    // The inactive chip stays on the neutral chrome, which no theme touches.
    expect(flatten(screen.getByText("Back").props.style).color).not.toBe(
      THEMES.cobalt.dark.accentText
    );
  });
});

describe("every theme", () => {
  it.each(Object.keys(THEMES) as ThemeId[])("repaints the primary button for %s", async (id) => {
    render(
      <Harness>
        <Button title="Go" testID="btn" />
      </Harness>
    );
    await choose(id);
    expect(flatten(screen.getByTestId("btn").props.style).backgroundColor).toBe(
      THEMES[id].dark.accent
    );
    expect(flatten(screen.getByText("Go").props.style).color).toBe(THEMES[id].dark.onAccent);
  });
});

describe("the neutral chrome", () => {
  it("does not move when the accent does", async () => {
    function Probe() {
      return <Text testID="body">body copy</Text>;
    }
    render(
      <Harness>
        <Probe />
      </Harness>
    );
    // Themes are accent-only by design; if a future change starts tinting the
    // surfaces, the contrast guarantees in the palette tests stop holding.
    const before = flatten(screen.getByTestId("body").props.style);
    await choose("amber");
    expect(flatten(screen.getByTestId("body").props.style)).toEqual(before);
  });
});

/**
 * The other axis. The accent deliberately leaves the chrome alone; the mode is
 * the thing that moves it — and it has to move it at render time, because the
 * whole hazard of this change is a StyleSheet that captured one palette at
 * import and now quietly ignores the setting.
 */
describe("light mode", () => {
  let setAppearance: (pref: AppearancePref) => void;

  function ModeHarness({ children }: { children: React.ReactNode }) {
    function Control() {
      setAppearance = useAppearance().setPref;
      setTheme = useThemePicker().setThemeId;
      return null;
    }
    return (
      <AppearanceProvider>
        <ThemeProvider>
          <Control />
          {children}
        </ThemeProvider>
      </AppearanceProvider>
    );
  }

  async function go(pref: AppearancePref) {
    await act(async () => {
      setAppearance(pref);
      await Promise.resolve();
    });
  }

  it("repaints the neutral chrome", async () => {
    render(
      <ModeHarness>
        <Card testID="card" />
      </ModeHarness>
    );
    expect(flatten(screen.getByTestId("card").props.style).backgroundColor).toBe(
      PALETTES.dark.surface
    );

    await go("light");

    expect(flatten(screen.getByTestId("card").props.style).backgroundColor).toBe(
      PALETTES.light.surface
    );
  });

  it("swaps to the accent set built for the page it sits on", async () => {
    // A ghost button's label is accentText, which is lifted to glow on
    // near-black and lands around 1.7:1 on white. Reading the dark value in
    // light mode is the exact failure this guards.
    render(
      <ModeHarness>
        <Button title="Skip" variant="ghost" />
      </ModeHarness>
    );
    expect(flatten(screen.getByText("Skip").props.style).color).toBe(THEMES.violet.dark.accentText);

    await go("light");

    expect(flatten(screen.getByText("Skip").props.style).color).toBe(THEMES.violet.light.accentText);
  });

  it("flips graphite rather than leaving it invisible", async () => {
    // The one theme whose accent genuinely inverts: white on a white page is
    // not a dimmer version of the idea, it is nothing at all.
    render(
      <ModeHarness>
        <Button title="Go" testID="btn" />
      </ModeHarness>
    );
    await act(async () => {
      setTheme("graphite");
      await Promise.resolve();
    });
    expect(flatten(screen.getByTestId("btn").props.style).backgroundColor).toBe(
      THEMES.graphite.dark.accent
    );

    await go("light");

    expect(flatten(screen.getByTestId("btn").props.style).backgroundColor).toBe(
      THEMES.graphite.light.accent
    );
  });

  it("leaves the accent alone when only the mode changes", async () => {
    // Six of the seven accents are the same colour in both modes on purpose:
    // the brand shouldn't shift under you when the lights change.
    render(
      <ModeHarness>
        <Button title="Go" testID="btn" />
      </ModeHarness>
    );
    await go("light");
    expect(flatten(screen.getByTestId("btn").props.style).backgroundColor).toBe(
      THEMES.violet.dark.accent
    );
  });
});
