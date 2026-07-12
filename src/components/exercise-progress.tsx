import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { Palette, Radius, Spacing } from "@/constants/theme";
import { useWeightUnit } from "@/context/UnitContext";
import { useWorkouts } from "@/hooks/use-workouts";
import { convertWeight } from "@/lib/workout-utils";

const CHART_HEIGHT = 150;
const MAX_SESSIONS = 12;

interface SessionPoint {
  date: Date;
  // Heaviest completed set of the session, normalized to lbs.
  topLbs: number;
  reps?: number;
}

// Personal record + top-set trend for one exercise, derived entirely from the
// user's completed workout history (never stored counters).
export function ExerciseProgress({ exerciseId }: { exerciseId: string }) {
  const { completed } = useWorkouts();
  const { unit } = useWeightUnit();
  const [chartWidth, setChartWidth] = useState(0);

  const { sessions, pr, best1Rm } = useMemo(() => {
    const points: SessionPoint[] = [];
    let record: SessionPoint | null = null;
    let bestEpley = 0;
    // `completed` is newest-first; walk it and reverse for the chart. One
    // point per workout, even if the exercise appears in it more than once.
    for (const w of completed) {
      let top: SessionPoint | null = null;
      for (const ex of w.exercises) {
        if (ex.exerciseId !== exerciseId) continue;
        for (const s of ex.sets) {
          if (!s.isCompleted || s.weight == null) continue;
          if (s.weightUnit !== "lbs" && s.weightUnit !== "kg") continue;
          const lbs = convertWeight(s.weight, s.weightUnit, "lbs");
          if (!top || lbs > top.topLbs) top = { date: w.completedAt!, topLbs: lbs, reps: s.reps };
          // Epley estimated one-rep max: weight × (1 + reps/30).
          const epley = lbs * (1 + (s.reps ?? 1) / 30);
          if (epley > bestEpley) bestEpley = epley;
        }
      }
      if (top) {
        points.push(top);
        if (!record || top.topLbs > record.topLbs) record = top;
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

  const show = (lbs: number) => `${convertWeight(lbs, "lbs", unit)}`;
  const chartPoints = sessions.slice(-MAX_SESSIONS);
  const prInChart = chartPoints.reduce((m, p) => Math.max(m, p.topLbs), 0);

  return (
    <View style={styles.card}>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {show(pr!.topLbs)}
            <Text style={styles.statUnit}> {unit}</Text>
          </Text>
          <Text style={styles.statLabel}>
            Best set{pr!.reps ? ` · ×${pr!.reps}` : ""}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {show(best1Rm)}
            <Text style={styles.statUnit}> {unit}</Text>
          </Text>
          <Text style={styles.statLabel}>Est. 1RM</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{sessions.length}</Text>
          <Text style={styles.statLabel}>Session{sessions.length === 1 ? "" : "s"}</Text>
        </View>
      </View>

      <View onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
        {chartWidth > 0 && (
          <TopSetChart points={chartPoints} width={chartWidth} unit={unit} prLbs={prInChart} />
        )}
      </View>

      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>
          {chartPoints[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </Text>
        <Text style={styles.axisLabel}>top set per session</Text>
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

function TopSetChart({
  points,
  width,
  unit,
  prLbs,
}: {
  points: SessionPoint[];
  width: number;
  unit: "lbs" | "kg";
  prLbs: number;
}) {
  const pad = { top: 14, bottom: 10, left: 8, right: 40 };
  const w = width - pad.left - pad.right;
  const h = CHART_HEIGHT - pad.top - pad.bottom;

  const values = points.map((p) => p.topLbs);
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Breathing room so the line never hugs the frame; a flat history still
  // needs a non-zero span to be drawable.
  const span = Math.max(max - min, max * 0.1, 1);
  const lo = Math.max(0, min - span * 0.25);
  const hi = max + span * 0.25;

  const x = (i: number) => pad.left + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * h;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.topLbs)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${pad.top + h} L${x(0)},${pad.top + h} Z`;

  const gridValues = [lo + (hi - lo) * 0.8, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.2];

  return (
    <View>
      <Svg width={width} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Palette.accent} stopOpacity="0.28" />
            <Stop offset="1" stopColor={Palette.accent} stopOpacity="0.02" />
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
            stroke={Palette.accent}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {points.map((p, i) => {
          const isPr = p.topLbs === prLbs;
          return (
            <Circle
              key={i}
              cx={x(i)}
              cy={y(p.topLbs)}
              r={isPr ? 5 : 3.5}
              fill={isPr ? Palette.amber : Palette.surface}
              stroke={isPr ? Palette.amber : Palette.accent}
              strokeWidth={2}
            />
          );
        })}
      </Svg>

      {/* Y-axis labels live outside the SVG so they use the app's fonts. */}
      {gridValues.map((v, i) => (
        <Text key={i} style={[styles.gridLabel, { top: y(v) - 7, right: 0 }]}>
          {convertWeight(v, "lbs", unit)}
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
