import { act, render, screen } from "@testing-library/react-native";
import { View } from "react-native";
import { Path } from "react-native-svg";

import { MuscleMap } from "../muscle-map";
import { FIGURE_BODY } from "@/constants/theme";

/**
 * What the figure actually draws, with the real library underneath.
 *
 * muscle-map.test.tsx checks what the app hands the library; this checks what
 * comes out. The two differed: the library's own data gives every region a
 * grey that beats the `defaultFill` it's handed, so in light mode the muscles
 * not worked came out charcoal under a light grey head.
 */

let mockMode: "dark" | "light" = "light";
jest.mock("@/context/AppearanceContext", () => ({
  ...jest.requireActual("@/context/AppearanceContext"),
  useMode: () => mockMode,
}));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ figure: { primary: "#8b5cf6", secondary: "#4c1d95" } }),
}));

/** Each region's fills, front and back, once the figure has a width to draw at. */
function fills(): Record<string, string[]> {
  // onLayout never fires under the test renderer, so the width is handed over.
  act(() => {
    screen.UNSAFE_getAllByType(View)[1].props.onLayout?.({ nativeEvent: { layout: { width: 400 } } });
  });
  const byRegion: Record<string, Set<string>> = {};
  for (const path of screen.UNSAFE_getAllByType(Path)) {
    if (path.props.id) (byRegion[path.props.id] ??= new Set()).add(path.props.fill);
  }
  return Object.fromEntries(Object.entries(byRegion).map(([id, set]) => [id, [...set]]));
}

it.each(["light", "dark"] as const)("draws the muscles not worked in the body grey, in %s mode", (mode) => {
  mockMode = mode;
  render(<MuscleMap musclesWorked={["Chest", "Triceps"]} />);
  const drawn = fills();

  expect(drawn.chest).toEqual(["#8b5cf6"]);
  expect(drawn.triceps).toEqual(["#4c1d95"]);
  for (const region of ["biceps", "quadriceps", "upper-back", "calves", "head", "hands"]) {
    expect({ region, fill: drawn[region] }).toEqual({ region, fill: [FIGURE_BODY[mode]] });
  }
});
