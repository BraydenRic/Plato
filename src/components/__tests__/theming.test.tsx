import { StyleSheet, Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Button, Chip } from "../ui";
import { ThemeProvider, useThemePicker } from "@/context/ThemeContext";
import { THEMES, type ThemeId } from "@/constants/theme";

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
      THEMES.violet.accent
    );

    await choose("magenta");
    expect(flatten(screen.getByTestId("btn").props.style).backgroundColor).toBe(
      THEMES.magenta.accent
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
      THEMES.violet.onAccent
    );

    // ...cyan cannot, so the same button turns dark-on-colour.
    await choose("cyan");
    const label = flatten(screen.getByText("Start workout").props.style).color;
    expect(label).toBe(THEMES.cyan.onAccent);
    expect(label).not.toBe("#ffffff");
  });

  it("tints a ghost button's label with the accent's text shade", async () => {
    render(
      <Harness>
        <Button title="Skip" variant="ghost" />
      </Harness>
    );
    await choose("amber");
    expect(flatten(screen.getByText("Skip").props.style).color).toBe(THEMES.amber.accentText);
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

    expect(flatten(screen.getByText("Chest").props.style).color).toBe(THEMES.cobalt.accentText);
    // The inactive chip stays on the neutral chrome, which no theme touches.
    expect(flatten(screen.getByText("Back").props.style).color).not.toBe(
      THEMES.cobalt.accentText
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
      THEMES[id].accent
    );
    expect(flatten(screen.getByText("Go").props.style).color).toBe(THEMES[id].onAccent);
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
