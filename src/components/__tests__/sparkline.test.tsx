import { render } from "@testing-library/react-native";
import { Path } from "react-native-svg";

import { Sparkline } from "../sparkline";

/**
 * The trend line beside the weight on Profile. It has no axes, so where the
 * line sits in its box is the whole message — and a weight that hasn't moved
 * was drawn along the bottom edge, which reads as a drop.
 */

/** The y of every point on the drawn line. */
function heights(values: number[], height = 24): number[] {
  const { UNSAFE_getByType } = render(<Sparkline values={values} color="#fff" width={100} height={height} />);
  const d = UNSAFE_getByType(Path).props.d as string;
  return [...d.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((m) => Number(m[1]));
}

it("draws a weight that hasn't moved through the middle", () => {
  expect(heights([180, 180])).toEqual([12, 12]);
  expect(heights([180, 180, 180], 40)).toEqual([20, 20, 20]);
});

it("puts it where a single weigh-in sits, so logging a second equal one doesn't move it", () => {
  const { UNSAFE_getByType } = render(<Sparkline values={[180]} color="#fff" width={100} />);
  expect(UNSAFE_getByType(Path).props.d).toBe("M0,12 L100,12");
  expect(heights([180, 180])).toEqual([12, 12]);
});

it("still spans the box for a weight that moved", () => {
  // Heaviest at the top, lightest at the bottom, 2pt in from each edge.
  expect(heights([180, 175, 185])).toEqual([12, 22, 2]);
});
