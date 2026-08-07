import { useMemo, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { FontScaleCap, Palette, Spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { convertWeight } from "@/lib/workout-utils";
import type { BodyweightEntry } from "@/types";

/** Past this many points a dot per weigh-in turns the line into a smear. */
const DOTS_UP_TO = 40;

/**
 * Round numbers to hang gridlines off, covering [lo, hi].
 *
 * Ticks at exactly (hi−lo)/n land on values like 187.3, which read as noise on
 * an axis. Snapping the step to 1/2/5 × a power of ten gives labels a person
 * recognises as their own weight.
 */
function niceTicks(lo: number, hi: number, count = 4): number[] {
  const raw = (hi - lo) / Math.max(1, count - 1);
  if (!Number.isFinite(raw) || raw <= 0) return [lo];
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1000; v += step) {
    ticks.push(Math.round(v * 10) / 10);
  }
  return ticks;
}

/**
 * The weigh-in log drawn out in full.
 *
 * Plotted against *time*, not against entry number, so a gap in the log reads
 * as a gap. Weighing in daily for a week and then once three months later
 * should not draw those two stretches at the same slope.
 *
 * Drag across it to read a specific day. The readout sits in a fixed row above
 * the plot rather than in a bubble that follows your thumb — a bubble is nicer
 * right up until it reaches an edge, and this one has a date in it, which is
 * exactly the thing that would get clipped.
 */
export function BodyweightChart({
  log,
  unit,
  height = 150,
}: {
  log: BodyweightEntry[];
  unit: "lbs" | "kg";
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [scrubbed, setScrubbed] = useState<number | null>(null);

  const pad = { top: 12, bottom: 20, left: 8, right: 44 };

  const geometry = useMemo(() => {
    if (log.length === 0 || width <= 0) return null;

    const values = log.map((e) => convertWeight(e.lbs, "lbs", unit));
    const times = log.map((e) => e.date.getTime());
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;

    const max = Math.max(...values);
    const min = Math.min(...values);
    // Bodyweight moves in small percentages, so a tight range would draw normal
    // fluctuation as a mountain. Pad it, and never divide by a zero span.
    const span = Math.max(max - min, 2);
    const lo = min - span * 0.25;
    const hi = max + span * 0.25;

    const first = times[0];
    const last = times[times.length - 1];
    // A single weigh-in spans no time; put its point in the middle rather than
    // dividing by zero and drawing it hard against the left edge.
    const timeSpan = Math.max(last - first, 1);
    const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * h;

    if (log.length === 1) {
      const cx = pad.left + w / 2;
      const cy = pad.top + h / 2;
      return {
        values, times, min, max, ticks: [] as number[], plotBottom: pad.top + h,
        x: () => cx, y: () => cy, line: "", area: "",
      };
    }

    const x = (t: number) => pad.left + ((t - first) / timeSpan) * w;
    const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(times[i])},${y(v)}`).join(" ");
    const area = `${line} L${x(last)},${pad.top + h} L${x(first)},${pad.top + h} Z`;

    return {
      values, times, min, max,
      ticks: niceTicks(lo, hi).filter((t) => t >= lo && t <= hi),
      plotBottom: pad.top + h,
      x, y, line, area,
    };
  }, [log, unit, width, height, pad.left, pad.right, pad.top, pad.bottom]);

  // Recreated when the geometry moves, which cannot happen mid-drag — the log,
  // the unit and the width are all still while a thumb is down.
  const responder = useMemo(() => {
    function pick(px: number) {
      if (!geometry || geometry.times.length < 2) return;
      let best = 0;
      let bestDistance = Infinity;
      geometry.times.forEach((t, i) => {
        const d = Math.abs(geometry.x(t) - px);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      });
      setScrubbed(best);
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Claim horizontal movement only, so the screen underneath still scrolls.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
      onPanResponderRelease: () => setScrubbed(null),
      onPanResponderTerminate: () => setScrubbed(null),
    });
  }, [geometry]);

  if (log.length === 0) return <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} />;

  // Falls back to the newest, so the row is never blank and never jumps in
  // height as you pick it up and put it down.
  const shownIndex = scrubbed ?? log.length - 1;
  const shownEntry = log[shownIndex];
  const shownValue = geometry?.values[shownIndex];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.readout}>
        <Text style={styles.readoutDate} maxFontSizeMultiplier={FontScaleCap.grid}>
          {shownEntry.date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Text>
        <Text
          style={[styles.readoutValue, { color: theme.accentText }]}
          maxFontSizeMultiplier={FontScaleCap.grid}>
          {shownValue != null ? `${shownValue.toFixed(1)} ${unit}` : "—"}
        </Text>
      </View>

      {geometry && (
        <>
          <View
            {...responder.panHandlers}
            accessibilityRole="image"
            accessibilityLabel={`Bodyweight from ${log[0].date.toLocaleDateString()} to ${log[
              log.length - 1
            ].date.toLocaleDateString()}, between ${Math.round(geometry.min)} and ${Math.round(
              geometry.max
            )} ${unit}.`}>
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="bwArea" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={theme.accent} stopOpacity="0.22" />
                  <Stop offset="1" stopColor={theme.accent} stopOpacity="0.02" />
                </LinearGradient>
              </Defs>

              {geometry.ticks.map((t) => (
                <Line
                  key={t}
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={geometry.y(t)}
                  y2={geometry.y(t)}
                  stroke={Palette.border}
                  strokeWidth={1}
                />
              ))}

              <Path d={geometry.area} fill="url(#bwArea)" />
              <Path
                d={geometry.line}
                stroke={theme.accent}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />

              {/* Every weigh-in gets a dot only while they're countable. */}
              {log.length <= DOTS_UP_TO &&
                log.length > 1 &&
                geometry.times.map((t, i) => (
                  <Circle
                    key={t}
                    cx={geometry.x(t)}
                    cy={geometry.y(geometry.values[i])}
                    r={2.5}
                    fill={theme.accent}
                    opacity={0.55}
                  />
                ))}

              {scrubbed != null && geometry.times.length > 1 && (
                <Line
                  x1={geometry.x(geometry.times[scrubbed])}
                  x2={geometry.x(geometry.times[scrubbed])}
                  y1={pad.top}
                  y2={geometry.plotBottom}
                  stroke={theme.accent}
                  strokeWidth={1}
                  opacity={0.5}
                />
              )}

              <Circle
                cx={geometry.x(geometry.times[shownIndex])}
                cy={geometry.y(geometry.values[shownIndex])}
                r={4}
                fill={theme.accent}
                stroke={Palette.surface}
                strokeWidth={2}
              />
            </Svg>

            {/* Tick labels as text rather than SVG <Text>, so they inherit
                Dynamic Type the way the rest of the screen does. */}
            {geometry.ticks.map((t) => (
              <Text
                key={t}
                style={[styles.tick, { top: geometry.y(t) - 7, right: 0 }]}
                maxFontSizeMultiplier={FontScaleCap.grid}>
                {t}
              </Text>
            ))}
          </View>

          <View style={styles.axis}>
            <Text style={styles.axisLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
              {log[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </Text>
            <Text style={styles.axisLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
              {`${Math.round(geometry.min)}–${Math.round(geometry.max)} ${unit}`}
            </Text>
            <Text style={styles.axisLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
              {log[log.length - 1].date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  readoutDate: {
    fontSize: 12,
    color: Palette.textTertiary,
  },
  readoutValue: {
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  tick: {
    position: "absolute",
    fontSize: 11,
    color: Palette.textTertiary,
    fontVariant: ["tabular-nums"],
  },
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
