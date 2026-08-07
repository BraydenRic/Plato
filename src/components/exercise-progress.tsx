import { useMemo, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { useTheme } from "@/context/ThemeContext";
import { FontScaleCap, Palette, Radius, Spacing } from "@/constants/theme";
import { useWeightUnit } from "@/context/UnitContext";
import { useWorkouts } from "@/hooks/use-workouts";
import { convertWeight, estimatedOneRepMax, formatWeight } from "@/lib/workout-utils";

const CHART_HEIGHT = 150;
const MAX_SESSIONS = 12;

/** One completed set, kept whole so the readout can name the reps. */
interface SetPoint {
  lbs: number;
  reps?: number;
}

interface SessionPoint {
  date: Date;
  /** Heaviest completed set of the session. */
  top: SetPoint;
  /**
   * The set with the best estimated one-rep max, which is not always the
   * heaviest — 205×10 is worth more as a single than 225×3.
   */
  best: SetPoint;
  bestE1rm: number;
}

/**
 * What the line is plotting.
 *
 * Two answers to "am I getting stronger", and they disagree in exactly the case
 * that matters. Est. 1RM is the default because the flat line was the
 * complaint: adding reps at the same weight is progress, and top set cannot see
 * it. Top set stays a tap away because it is the number you actually lifted,
 * with no formula in between.
 */
type Metric = "e1rm" | "top";

const METRICS: { key: Metric; label: string }[] = [
  { key: "e1rm", label: "Est. 1RM" },
  { key: "top", label: "Top set" },
];

// Personal record + progress trend for one exercise, derived entirely from the
// user's completed workout history (never stored counters).
export function ExerciseProgress({ exerciseId }: { exerciseId: string }) {
  const { completed } = useWorkouts();
  const { unit } = useWeightUnit();
  const theme = useTheme();
  const [chartWidth, setChartWidth] = useState(0);
  const [metric, setMetric] = useState<Metric>("e1rm");
  const [scrubbed, setScrubbed] = useState<number | null>(null);

  const { sessions, pr, best1Rm } = useMemo(() => {
    const points: SessionPoint[] = [];
    let record: SetPoint | null = null;
    let bestEpley = 0;
    // `completed` is newest-first; walk it and reverse for the chart. One
    // point per workout, even if the exercise appears in it more than once.
    for (const w of completed) {
      let top: SetPoint | null = null;
      let best: SetPoint | null = null;
      let bestOfSession = 0;
      for (const ex of w.exercises) {
        if (ex.exerciseId !== exerciseId) continue;
        for (const s of ex.sets) {
          if (!s.isCompleted || s.weight == null) continue;
          if (s.weightUnit !== "lbs" && s.weightUnit !== "kg") continue;
          const lbs = convertWeight(s.weight, s.weightUnit, "lbs");
          if (!top || lbs > top.lbs) top = { lbs, reps: s.reps };
          const epley = estimatedOneRepMax(lbs, s.reps);
          if (epley > bestOfSession) {
            bestOfSession = epley;
            best = { lbs, reps: s.reps };
          }
          if (epley > bestEpley) bestEpley = epley;
        }
      }
      if (top) {
        points.push({
          date: w.completedAt!,
          top,
          best: best ?? top,
          bestE1rm: bestOfSession || top.lbs,
        });
        if (!record || top.lbs > record.lbs) record = top;
      }
    }
    return { sessions: points.reverse(), pr: record, best1Rm: bestEpley };
  }, [completed, exerciseId]);

  if (sessions.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>
          No sets logged yet. Finish a workout with this exercise and your PR and progress
          chart will appear here.
        </Text>
      </View>
    );
  }

  const show = (lbs: number) => formatWeight(lbs, unit);
  const chartPoints = sessions.slice(-MAX_SESSIONS);
  const valueOf = (p: SessionPoint) => (metric === "e1rm" ? p.bestE1rm : p.top.lbs);
  const setOf = (p: SessionPoint) => (metric === "e1rm" ? p.best : p.top);
  const peak = chartPoints.reduce((m, p) => Math.max(m, valueOf(p)), 0);

  // Falls back to the newest session, so the row never blanks and never changes
  // height as you pick it up and put it down.
  const readIndex = scrubbed ?? chartPoints.length - 1;
  const read = chartPoints[readIndex];
  const readSet = setOf(read);

  return (
    <View style={styles.card}>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue} maxFontSizeMultiplier={FontScaleCap.grid}>
            {show(pr!.lbs)}
            <Text style={styles.statUnit}> {unit}</Text>
          </Text>
          <Text style={styles.statLabel}>Best set{pr!.reps ? ` · ×${pr!.reps}` : ""}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue} maxFontSizeMultiplier={FontScaleCap.grid}>
            {show(best1Rm)}
            <Text style={styles.statUnit}> {unit}</Text>
          </Text>
          <Text style={styles.statLabel}>Est. 1RM</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue} maxFontSizeMultiplier={FontScaleCap.grid}>
            {sessions.length}
          </Text>
          <Text style={styles.statLabel}>Session{sessions.length === 1 ? "" : "s"}</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        {METRICS.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => setMetric(m.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: m.key === metric }}
            style={[
              styles.metric,
              m.key === metric && { backgroundColor: theme.accentSoft, borderColor: theme.accent },
            ]}>
            <Text
              style={[styles.metricText, m.key === metric && { color: theme.accentText }]}
              maxFontSizeMultiplier={FontScaleCap.grid}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* The reps live here. They are the whole reason a flat weight line can
          still be three weeks of progress, so they get named rather than left
          for the reader to infer from a stat at the top of the card. */}
      <View style={styles.readout}>
        <Text style={styles.readoutDate} maxFontSizeMultiplier={FontScaleCap.grid}>
          {read.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          {readSet.reps ? ` · ${show(readSet.lbs)} × ${readSet.reps}` : ` · ${show(readSet.lbs)} ${unit}`}
        </Text>
        <Text
          style={[styles.readoutValue, { color: theme.accentText }]}
          maxFontSizeMultiplier={FontScaleCap.grid}>
          {show(valueOf(read))} {unit}
        </Text>
      </View>

      <View onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
        {chartWidth > 0 && (
          <TrendChart
            points={chartPoints}
            valueOf={valueOf}
            width={chartWidth}
            unit={unit}
            peak={peak}
            scrubbed={scrubbed}
            onScrub={setScrubbed}
          />
        )}
      </View>

      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>
          {chartPoints[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </Text>
        <Text style={styles.axisLabel}>
          {metric === "e1rm" ? "est. 1rm per session" : "top set per session"}
        </Text>
        <Text style={styles.axisLabel}>
          {chartPoints[chartPoints.length - 1].date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </Text>
      </View>
    </View>
  );
}

function TrendChart({
  points,
  valueOf,
  width,
  unit,
  peak,
  scrubbed,
  onScrub,
}: {
  points: SessionPoint[];
  valueOf: (p: SessionPoint) => number;
  width: number;
  unit: "lbs" | "kg";
  peak: number;
  scrubbed: number | null;
  onScrub: (index: number | null) => void;
}) {
  const theme = useTheme();
  const pad = { top: 14, bottom: 10, left: 8, right: 40 };
  const w = width - pad.left - pad.right;
  const h = CHART_HEIGHT - pad.top - pad.bottom;

  const values = points.map(valueOf);
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Breathing room so the line never hugs the frame; a flat history still
  // needs a non-zero span to be drawable.
  const span = Math.max(max - min, max * 0.1, 1);
  const lo = Math.max(0, min - span * 0.25);
  const hi = max + span * 0.25;

  const x = (i: number) => pad.left + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * h;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(valueOf(p))}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${pad.top + h} L${x(0)},${pad.top + h} Z`;
  const gridValues = [lo + (hi - lo) * 0.8, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.2];

  // Recreated when the points move, which cannot happen mid-drag.
  const responder = useMemo(() => {
    function pick(px: number) {
      if (points.length < 2) return;
      let best = 0;
      let bestDistance = Infinity;
      points.forEach((_, i) => {
        const d = Math.abs(x(i) - px);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      });
      onScrub(best);
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Horizontal movement only, so the screen underneath still scrolls.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
      onPanResponderRelease: () => onScrub(null),
      onPanResponderTerminate: () => onScrub(null),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, width, onScrub]);

  return (
    <View {...responder.panHandlers}>
      <Svg width={width} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.accent} stopOpacity="0.28" />
            <Stop offset="1" stopColor={theme.accent} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {gridValues.map((v, i) => (
          <Line
            key={i}
            x1={pad.left}
            y1={y(v)}
            x2={pad.left + w}
            y2={y(v)}
            stroke={Palette.border}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
        ))}

        {points.length > 1 && <Path d={area} fill="url(#area)" />}
        {points.length > 1 && (
          <Path
            d={line}
            stroke={theme.accent}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {scrubbed != null && points.length > 1 && (
          <Line
            x1={x(scrubbed)}
            y1={pad.top}
            x2={x(scrubbed)}
            y2={pad.top + h}
            stroke={theme.accent}
            strokeWidth={1}
            opacity={0.5}
          />
        )}

        {points.map((p, i) => {
          const isPeak = valueOf(p) === peak;
          return (
            <Circle
              key={i}
              cx={x(i)}
              cy={y(valueOf(p))}
              r={isPeak ? 5 : 3.5}
              fill={isPeak ? Palette.amber : Palette.surface}
              stroke={isPeak ? Palette.amber : theme.accent}
              strokeWidth={2}
            />
          );
        })}
      </Svg>

      {/* Y-axis labels live outside the SVG so they use the app's fonts. */}
      {gridValues.map((v, i) => (
        <Text key={i} style={[styles.gridLabel, { top: y(v) - 7, right: 0 }]}>
          {formatWeight(v, unit)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: Palette.textTertiary,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  stat: {
    flex: 1,
    gap: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: Palette.border,
    marginHorizontal: Spacing.three,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Palette.text,
    fontVariant: ["tabular-nums"],
  },
  statUnit: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textTertiary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textSecondary,
  },
  metrics: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  metric: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surfaceRaised,
  },
  metricText: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.textSecondary,
  },
  readout: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.two,
    marginBottom: -Spacing.two,
  },
  readoutDate: {
    fontSize: 12,
    color: Palette.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  readoutValue: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  gridLabel: {
    position: "absolute",
    fontSize: 10,
    color: Palette.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  axisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -Spacing.two,
  },
  axisLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: Palette.textTertiary,
  },
});
