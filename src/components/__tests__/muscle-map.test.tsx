import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
import { StyleSheet, View } from "react-native";

import { MuscleMap } from "../muscle-map";
import { FIGURE_BODY, FIGURE_SEAM, THEMES, type AppearancePref } from "@/constants/theme";
import { AppearanceProvider, useAppearance } from "@/context/AppearanceContext";
import { ThemeProvider, useThemePicker } from "@/context/ThemeContext";

/**
 * The figure's wiring to the mode.
 *
 * The palette tests prove the two sets of tones are far enough apart from the
 * body they sit on; this proves the body and the tones come from the *same*
 * mode. They diverged once already — the figure was hardcoded dark on the
 * belief that the library baked its grey into the SVG paths, which left a dark
 * slab on a white card and, for Graphite, a near-white "Primary" swatch on a
 * near-white card.
 */

const mockBody = jest.fn();
jest.mock("react-native-body-highlighter", () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockBody(props);
    return null;
  },
}));

jest.mock("expo-alternate-app-icons", () => ({
  supportsAlternateIcons: false,
  setAlternateAppIcon: jest.fn(),
  getAppIconName: () => null,
}));

jest.mock("react-native/Libraries/Utilities/Appearance", () => ({
  getColorScheme: () => "dark",
  setColorScheme: jest.fn(),
  addChangeListener: () => ({ remove: () => {} }),
}));

let setPref: (pref: AppearancePref) => void;
let setTheme: (id: "violet" | "graphite") => void;

function Harness() {
  function Control() {
    setPref = useAppearance().setPref;
    setTheme = useThemePicker().setThemeId;
    return null;
  }
  return (
    <AppearanceProvider>
      <ThemeProvider>
        <Control />
        {/* A width has to arrive before the figure renders at all — the scale is
            derived from the measured row. */}
        <MuscleMap musclesWorked={["Chest", "Triceps"]} />
      </ThemeProvider>
    </AppearanceProvider>
  );
}

/** The library's props on the most recent render. */
function bodyProps() {
  return mockBody.mock.calls.at(-1)?.[0] as {
    defaultFill: string;
    border: string;
    colors: [string, string];
  };
}

async function measure() {
  // onLayout never fires under the test renderer, so the width is supplied by
  // hand; without it `scale` stays 0 and the figure is never mounted.
  await act(async () => {
    screen.UNSAFE_getAllByType(View)[1].props.onLayout?.({
      nativeEvent: { layout: { width: 400 } },
    });
    await Promise.resolve();
  });
}

beforeEach(async () => {
  mockBody.mockClear();
  // The AsyncStorage stand-in is a singleton pinned to globalThis, so a pref
  // saved by one test is restored by the next one's provider.
  await AsyncStorage.clear();
});

it("draws the figure with the body and seam of the current mode", async () => {
  render(<Harness />);
  await measure();
  expect(bodyProps().defaultFill).toBe(FIGURE_BODY.dark);
  expect(bodyProps().border).toBe(FIGURE_SEAM.dark);

  await act(async () => {
    setPref("light");
    await Promise.resolve();
  });

  expect(bodyProps().defaultFill).toBe(FIGURE_BODY.light);
  expect(bodyProps().border).toBe(FIGURE_SEAM.light);
});

it("takes the muscle tones from the same mode as the body", async () => {
  // The pairing is the whole point: tones tuned to be pale against dark grey
  // are the ones that vanish against light grey.
  render(<Harness />);
  await measure();
  expect(bodyProps().colors).toEqual([
    THEMES.violet.dark.figure.primary,
    THEMES.violet.dark.figure.secondary,
  ]);

  await act(async () => {
    setPref("light");
    await Promise.resolve();
  });

  expect(bodyProps().colors).toEqual([
    THEMES.violet.light.figure.primary,
    THEMES.violet.light.figure.secondary,
  ]);
});

it("keeps graphite's swatches off the card they sit on", async () => {
  // The reported bug, pinned at the component: graphite's dark-mode primary is
  // near-white, so drawing it bare on a light card made "Primary" invisible.
  // The swatch now sits on a ring of the body colour.
  render(<Harness />);
  await measure();
  await act(async () => {
    setTheme("graphite");
    setPref("light");
    await Promise.resolve();
  });

  const dot = screen.getByText("Primary");
  expect(bodyProps().colors[0]).toBe(THEMES.graphite.light.figure.primary);

  // Both swatches, not just one — counted exactly, because "at least one" still
  // passes with the Secondary key backed and the Primary one bare.
  const rings = screen.UNSAFE_getAllByType(View).filter((v) => {
    const s = StyleSheet.flatten(v.props.style);
    return s?.backgroundColor === FIGURE_BODY.light && s?.width === 16;
  });
  expect(rings).toHaveLength(2);
  expect(dot).toBeTruthy();
});
