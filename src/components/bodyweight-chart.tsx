import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { FontScaleCap, Palette, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { convertWeight } from "@/lib/workout-utils";
import type { BodyweightEntry } from "@/types";

const HEIGHT = 150;

/**
 * The weigh-in log drawn out in full — the expanded half of the Profile card.
 *
 * Plotted against *time*, not against entry number, so a gap in the log reads
 * as a gap. Weighing in daily for a week and then once three months later
 * should not draw those two stretches at the same slope.
 */
export function BodyweightChart({ log, unit }: { log: BodyweightEntry[]; unit: "lbs" | "kg" }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const pad = { top: 12, bottom: 20, left: 8, right: 44 };

  const geometry = useMemo(() => {
    if (log.length < 2 || width <= 0) return null;

    const values = log.map((e) => convertWeight(e.lbs, "lbs", unit));
    const times = log.map((e) => e.date.getTime());
    const w = width - pad.left - pad.right;
    const h = HEIGHT - pad.top - pad.bottom;

    const max = Math.max(...values);
    const min = Math.min(...values);
    // Bodyweight moves in small percentages, so a tight range would draw normal
    // fluctuation as a mountain. Pad it, and never divide by a zero span.
    const span = Math.max(max - min, 2);
    const lo = min - span * 0.25;
    const hi = max + span * 0.25;

    const first = times[0];
    const last = times[times.length - 1];
    const timeSpan = Math.max(last - first, 1);

    const x = (t: number) => pad.left + ((t - first) / timeSpan) * w;
    const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * h;

    const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(times[i])},${y(v)}`).join(" ");
    const area = `${line} L${x(last)},${pad.top + h} L${x(first)},${pad.top + h} Z`;

    return { values, times, x, y, line, area, max, min, latest: values[values.length - 1] };
  }, [log, unit, width, pad.left, pad.right, pad.top, pad.bottom]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {geometry && (
        <>
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="bwArea" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.accent} stopOpacity="0.22" />
                <Stop offset="1" stopColor={theme.accent} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>
            <Path d={geometry.area} fill="url(#bwArea)" />
            <Path
              d={geometry.line}
              stroke={theme.accent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Only the newest point is marked. A dot per weigh-in turns a year
                of daily entries into a smear. */}
            <Circle
              cx={geometry.x(geometry.times[geometry.times.length - 1])}
              cy={geometry.y(geometry.latest)}
              r={4}
              fill={theme.accent}
              stroke={Palette.surface}
              strokeWidth={2}
            />
          </Svg>
          <View style={styles.axis}>
            <Text style={styles.axisLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
              {log[0].date.toLocaleDateString(undefined, { month: "short", year: "2-digit" })}
            </Text>
            <Text style={styles.axisLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
              {`${Math.round(geometry.min)}–${Math.round(geometry.max)} ${unit}`}
            </Text>
            <Text style={styles.axisLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
              {log[log.length - 1].date.toLocaleDateString(undefined, {
                month: "short",
                year: "2-digit",
              })}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: -Spacing.two,
  },
  axisLabel: {
    fontSize: 11,
    color: Palette.textTertiary,
    fontVariant: ["tabular-nums"],
  },
});
