import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

/**
 * A bare trend line — no axes, no grid, no labels.
 *
 * Deliberately the least it can be. It sits on one row of a Profile card next
 * to the number it describes, where the job is to show a shape, not to be read
 * off. Anything more would need room the card doesn't have.
 */
export function Sparkline({
  values,
  color,
  width,
  height = 24,
}: {
  values: number[];
  color: string;
  width: number;
  height?: number;
}) {
  if (values.length === 0 || width <= 0) return <View style={{ width, height }} />;

  // One weigh-in has no slope, but it does have a position worth drawing —
  // a flat mark reads as "recorded, nothing to compare yet".
  if (values.length === 1) {
    return (
      <Svg width={width} height={height}>
        <Path
          d={`M0,${height / 2} L${width},${height / 2}`}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.35}
        />
      </Svg>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  // A flat run has no span to divide by, and would otherwise be drawn at the
  // very top of the box. Give it one and it lands through the middle.
  const span = max - min || 1;
  const pad = 2;
  const usable = height - pad * 2;

  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => pad + (1 - (v - min) / span) * usable;

  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
