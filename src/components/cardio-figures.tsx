import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, type ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";

import { FontScaleCap, Spacing } from "@/constants/theme";
import { makeStyles, usePalette } from "@/context/AppearanceContext";
import { useTheme } from "@/context/ThemeContext";
import { averageActiveWeek } from "@/lib/cardio";
import { formatClock } from "@/lib/workout-utils";

/**
 * The pictures cardio is read through: big numbers, splits, weeks, a trend.
 *
 * One rule runs through all of them — the accent carries the data and the
 * text stays in the ink colours, so a number is always as legible as the
 * page around it however bright the accent. Colour beyond the accent is kept
 * to the small glyphs beside a figure (a red heart, an amber flame), where it
 * says what the number is without anyone having to read the label.
 */

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface Figure {
  key: string;
  value: string;
  /** Set smaller beside the value: "/mi", "bpm". */
  unit?: string;
  label: string;
  icon: IconName;
  /** The glyph's colour. Text never takes it. */
  tint: string;
}

/** A row of headline numbers, each with a glyph and a label beneath. */
export function FigureRow({ figures }: { figures: Figure[] }) {
  const styles = useStyles();
  return (
    <View style={styles.figures}>
      {figures.map((f) => (
        <View key={f.key} style={styles.figure} accessible accessibilityLabel={`${f.label}: ${f.value}${f.unit ? ` ${f.unit}` : ""}`}>
          <Text style={styles.figureValue} maxFontSizeMultiplier={FontScaleCap.title}>
            {f.value}
            {f.unit ? <Text style={styles.figureUnit}> {f.unit}</Text> : null}
          </Text>
          <View style={styles.figureLabelRow}>
            <Ionicons name={f.icon} size={11} color={f.tint} />
            <Text style={styles.figureLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
              {f.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export interface SplitRow {
  /** "1", "2"… or the part past the last whole one, "0.20". */
  label: string;
  seconds: number;
  /** How much of a mile or kilometre it covers: 1, or less for the last. */
  units: number;
}

const SPLIT_ROW = 26;

/**
 * Splits as bars. Length is speed against the fastest split, from zero, so a
 * bar half as long really is half as fast; on an even run they all come out
 * nearly full, which is the truth about an even run. What separates them at a
 * glance is depth of colour — the quicker the split, the deeper — and a line
 * at the average shows which side of it each one fell.
 */
export function SplitsChart({ rows, unitWord }: { rows: SplitRow[]; unitWord: "mile" | "km" }) {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const speeds = rows.map((r) => r.units / r.seconds);
  const fastest = Math.max(...speeds);
  const slowest = Math.min(...speeds);
  const totalUnits = rows.reduce((sum, r) => sum + r.units, 0);
  const totalSeconds = rows.reduce((sum, r) => sum + r.seconds, 0);
  const average = totalUnits / totalSeconds;
  const averagePace = formatClock(Math.round(totalSeconds / totalUnits));
  const short = unitWord === "mile" ? "mi" : "km";

  return (
    <View style={styles.splits}>
      <View style={styles.splitsHeader}>
        <Text style={styles.heading} maxFontSizeMultiplier={FontScaleCap.grid}>
          Splits · per {unitWord}
        </Text>
        <View style={styles.legend}>
          <View style={[styles.legendLine, { backgroundColor: palette.textTertiary }]} />
          <Text style={styles.legendText} maxFontSizeMultiplier={FontScaleCap.grid}>
            avg {averagePace} /{short}
          </Text>
        </View>
      </View>
      <View style={styles.splitsBody}>
        <View>
          {rows.map((row, i) => {
            const isFastest = speeds[i] === fastest && rows.length > 1;
            return (
              <View
                key={row.label}
                style={[styles.splitRowText, { height: SPLIT_ROW }]}
                accessible
                accessibilityLabel={`${row.units < 1 ? `Last ${row.label} ${short}` : `${unitWord === "mile" ? "Mile" : "Kilometer"} ${row.label}`}, ${formatClock(Math.round(row.seconds))}`}>
                <Text style={styles.splitLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
                  {row.label}
                </Text>
                <Text
                  style={[styles.splitTime, isFastest && { color: palette.text, fontWeight: "800" }]}
                  maxFontSizeMultiplier={FontScaleCap.grid}>
                  {formatClock(Math.round(row.seconds))}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.splitTracks}>
          {rows.map((row, i) => {
            const depth = fastest === slowest ? 1 : (speeds[i] - slowest) / (fastest - slowest);
            return (
              <View key={row.label} style={[styles.splitTrackRow, { height: SPLIT_ROW }]}>
                <View style={styles.splitTrack}>
                  <View
                    style={[
                      styles.splitBar,
                      {
                        width: `${(speeds[i] / fastest) * 100}%`,
                        backgroundColor: theme.accent,
                        opacity: 0.42 + 0.58 * depth,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
          <View
            pointerEvents="none"
            style={[styles.averageLine, { left: `${(average / fastest) * 100}%`, backgroundColor: palette.textTertiary }]}
          />
        </View>
      </View>
    </View>
  );
}

const WEEK_CHART_HEIGHT = 128;
const WEEK_PAD = { top: 20, bottom: 2 };
/** Room at the right, clear of this week's column, when there's no average to label. */
const WEEK_GUTTER = 26;

/**
 * Distance per week as columns. The week being read stands at full strength
 * with its number on top; the others step back. The line across is your
 * typical week (averageActiveWeek), so a big week reads as big against your
 * own normal rather than against the tallest bar. It sits behind the columns
 * rather than cutting through them, and says its number.
 */
export function WeekColumns({
  weeks,
  selected,
  onSelect,
  format,
  describe,
  firstLabel,
}: {
  weeks: { weekStart: Date; metres: number }[];
  selected: number;
  onSelect: (index: number) => void;
  /** The short number over a column: "4.2". */
  format: (metres: number) => string;
  /** What a screen reader says for a column. */
  describe: (week: { weekStart: Date; metres: number }) => string;
  /** Under the first column; the last is always "This week". */
  firstLabel: string;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const peak = Math.max(...weeks.map((w) => w.metres), 1);
  const average = averageActiveWeek(weeks);
  const averageLabel = average == null ? null : `avg ${format(average)}`;
  // Wide enough for the label's digits at the 10pt it's set in (SVG text
  // doesn't grow with the text size setting), so it never reaches this week.
  const gutter = averageLabel ? Math.max(WEEK_GUTTER, 8 + averageLabel.length * 6) : WEEK_GUTTER;
  const plotHeight = WEEK_CHART_HEIGHT - WEEK_PAD.top - WEEK_PAD.bottom;
  const plotWidth = Math.max(0, width - gutter);
  const slot = plotWidth / weeks.length;
  const column = Math.min(24, slot * 0.58);
  const y = (metres: number) => WEEK_PAD.top + plotHeight * (1 - metres / peak);
  const base = WEEK_PAD.top + plotHeight;

  /** A column with its top corners rounded and its foot square on the baseline. */
  function columnPath(x: number, top: number): string {
    const r = Math.min(4, column / 2, base - top);
    return [
      `M${x},${base}`,
      `L${x},${top + r}`,
      `Q${x},${top} ${x + r},${top}`,
      `L${x + column - r},${top}`,
      `Q${x + column},${top} ${x + column},${top + r}`,
      `L${x + column},${base}`,
      "Z",
    ].join(" ");
  }

  return (
    <View>
      <View testID="week-chart" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: WEEK_CHART_HEIGHT }}>
        {width > 0 && (
          <Svg width={width} height={WEEK_CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="weekFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.accent} stopOpacity="1" />
                <Stop offset="1" stopColor={theme.accent} stopOpacity="0.45" />
              </LinearGradient>
            </Defs>
            <Line x1={0} y1={base} x2={plotWidth} y2={base} stroke={palette.border} strokeWidth={1} />
            {/* Before the columns, so they're drawn over it. */}
            {average != null && (
              <Line x1={0} y1={y(average)} x2={plotWidth} y2={y(average)} stroke={palette.textTertiary} strokeWidth={1} opacity={0.5} />
            )}
            {weeks.map((w, i) => {
              if (w.metres <= 0) return null;
              const x = i * slot + (slot - column) / 2;
              const top = Math.min(y(w.metres), base - 3);
              return (
                <Path key={i} d={columnPath(x, top)} fill="url(#weekFill)" opacity={i === selected ? 1 : 0.38} />
              );
            })}
            {average != null && (
              <SvgText
                x={width}
                y={y(average) + 3.5}
                fontSize={10}
                fontWeight="600"
                fill={palette.textTertiary}
                textAnchor="end">
                {averageLabel}
              </SvgText>
            )}
            {weeks[selected] && weeks[selected].metres > 0 && (
              <SvgText
                x={selected * slot + slot / 2}
                y={Math.min(y(weeks[selected].metres), base - 3) - 6}
                fontSize={11}
                fontWeight="800"
                fill={palette.text}
                textAnchor="middle">
                {format(weeks[selected].metres)}
              </SvgText>
            )}
          </Svg>
        )}
        {/* Hit targets the full height of each slot: a short week is as easy to
            tap as a long one. */}
        <View style={[styles.weekHits, { right: gutter }]}>
          {weeks.map((w, i) => (
            <Pressable
              key={w.weekStart.getTime()}
              style={styles.weekHit}
              onPress={() => onSelect(i)}
              accessibilityRole="button"
              accessibilityLabel={describe(w)}
              accessibilityState={{ selected: i === selected }}
            />
          ))}
        </View>
      </View>
      <View style={[styles.weekAxis, { paddingRight: gutter }]}>
        <Text style={styles.weekAxisLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
          {firstLabel}
        </Text>
        <Text style={styles.weekAxisLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
          This week
        </Text>
      </View>
    </View>
  );
}

/**
 * A session from start to end as one bar: the moving part in the accent, the
 * paused part beside it in grey, each as long as its share. The pauses are
 * summed, not placed — the bar says how much, the clock times at its ends
 * say when.
 */
export function SessionSpan({ start, end, moving, paused }: { start: Date; end: Date; moving: number; paused: number }) {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const total = moving + paused;
  return (
    <View
      style={styles.span}
      accessible
      accessibilityLabel={`Started ${clock(start)}, finished ${clock(end)}. ${formatClock(moving)} moving${
        paused ? `, ${formatClock(paused)} paused` : ", no pauses"
      }.`}>
      <View style={styles.spanEnds}>
        <Text style={styles.spanTime} maxFontSizeMultiplier={FontScaleCap.grid}>
          {clock(start)}
        </Text>
        <Text style={styles.spanTime} maxFontSizeMultiplier={FontScaleCap.grid}>
          {clock(end)}
        </Text>
      </View>
      <View style={styles.spanBar}>
        <View style={[styles.spanPart, { flex: total ? moving / total : 1, backgroundColor: theme.accent }]} />
        {paused > 0 && (
          <View style={[styles.spanPart, { flex: paused / total, backgroundColor: palette.textTertiary, opacity: 0.4 }]} />
        )}
      </View>
      <View style={styles.spanLegend}>
        <View style={styles.legend}>
          <View style={[styles.spanKey, { backgroundColor: theme.accent }]} />
          <Text style={styles.spanValue} maxFontSizeMultiplier={FontScaleCap.grid}>
            {formatClock(moving)}
            <Text style={styles.spanWord}> moving</Text>
          </Text>
        </View>
        {paused > 0 ? (
          <View style={styles.legend}>
            <View style={[styles.spanKey, { backgroundColor: palette.textTertiary, opacity: 0.4 }]} />
            <Text style={styles.spanValue} maxFontSizeMultiplier={FontScaleCap.grid}>
              {formatClock(paused)}
              <Text style={styles.spanWord}> paused</Text>
            </Text>
          </View>
        ) : (
          <Text style={styles.spanWord} maxFontSizeMultiplier={FontScaleCap.grid}>
            No pauses
          </Text>
        )}
      </View>
    </View>
  );
}

const TREND_HEIGHT = 112;

/**
 * A session-by-session line, oldest to newest, with the area under it washed
 * in the accent. The best session wears an amber dot, as the lifting chart's
 * peak does; the latest is ringed, because it's the one you just did.
 */
export function SessionTrend({ values }: { values: number[] }) {
  const palette = usePalette();
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const pad = { top: 10, bottom: 8, left: 6, right: 6 };
  const w = width - pad.left - pad.right;
  const h = TREND_HEIGHT - pad.top - pad.bottom;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = Math.max(max - min, max * 0.15);
  const lo = Math.max(0, min - span * 0.3);
  const hi = max + span * 0.2;
  const x = (i: number) => pad.left + (values.length === 1 ? w / 2 : (i / (values.length - 1)) * w);
  const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * h;
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = `${line} L${x(values.length - 1)},${pad.top + h} L${x(0)},${pad.top + h} Z`;
  const peakIndex = values.indexOf(max);
  const last = values.length - 1;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: TREND_HEIGHT }}>
      {width > 0 && (
        <Svg width={width} height={TREND_HEIGHT}>
          <Defs>
            <LinearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.accent} stopOpacity="0.3" />
              <Stop offset="1" stopColor={theme.accent} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          <Line x1={pad.left} y1={pad.top + h} x2={pad.left + w} y2={pad.top + h} stroke={palette.border} strokeWidth={1} />
          {values.length > 1 && <Path d={area} fill="url(#trendArea)" />}
          {values.length > 1 && (
            <Path d={line} stroke={theme.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          )}
          <Circle cx={x(last)} cy={y(values[last])} r={6} fill={palette.surface} />
          <Circle cx={x(last)} cy={y(values[last])} r={4} fill={theme.accent} />
          {peakIndex !== last && (
            <>
              <Circle cx={x(peakIndex)} cy={y(max)} r={6} fill={palette.surface} />
              <Circle cx={x(peakIndex)} cy={y(max)} r={4} fill={palette.amber} />
            </>
          )}
          {peakIndex === last && values.length > 1 && (
            <Circle cx={x(last)} cy={y(values[last])} r={4} fill={palette.amber} />
          )}
        </Svg>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  figures: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: Spacing.five,
    rowGap: Spacing.three,
  },
  figure: {
    gap: 3,
  },
  figureValue: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
  figureUnit: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
    color: c.textTertiary,
  },
  figureLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  figureLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: c.textTertiary,
  },
  heading: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: c.textTertiary,
  },
  splits: {
    gap: Spacing.two,
  },
  splitsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  span: {
    gap: Spacing.two,
  },
  spanEnds: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  spanTime: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  // Two parts with a sliver of card between them, so the grey reads as its
  // own share rather than the bar fading out.
  spanBar: {
    flexDirection: "row",
    height: 10,
    gap: 2,
  },
  spanPart: {
    borderRadius: 4,
  },
  spanLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spanKey: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  spanValue: {
    fontSize: 15,
    fontWeight: "700",
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
  spanWord: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textTertiary,
  },
  legendLine: {
    width: 1,
    height: 12,
    opacity: 0.7,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "600",
    color: c.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  splitsBody: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  splitRowText: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  splitLabel: {
    width: 32,
    fontSize: 12,
    fontWeight: "600",
    color: c.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  splitTime: {
    width: 50,
    fontSize: 14,
    fontWeight: "600",
    color: c.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  splitTracks: {
    flex: 1,
    position: "relative",
  },
  splitTrackRow: {
    justifyContent: "center",
  },
  splitTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: c.surfaceRaised,
    overflow: "hidden",
  },
  splitBar: {
    height: 12,
    borderRadius: 6,
  },
  averageLine: {
    position: "absolute",
    top: 4,
    bottom: 4,
    width: 1,
    marginLeft: -0.5,
    opacity: 0.7,
  },
  weekHits: {
    ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const),
    flexDirection: "row",
  },
  weekHit: {
    flex: 1,
  },
  weekAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  weekAxisLabel: {
    fontSize: 10,
    color: c.textTertiary,
  },
}));
