import { useMemo, useState } from "react";
import { PanResponder, Pressable, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { SessionTrend } from "@/components/cardio-figures";
import { useTheme } from "@/context/ThemeContext";
import { FontScaleCap, Radius, Spacing } from "@/constants/theme";
import { makeStyles, usePalette } from "@/context/AppearanceContext";
import { useWeightUnit } from "@/context/UnitContext";
import { useWorkouts } from "@/hooks/use-workouts";
import { distanceKind, distanceUnit, formatDistance, formatRate, toMetres, type DistanceKind } from "@/lib/cardio";
import { isBodyweightExercise, isTimedExercise } from "@/lib/exercises";
import {
  convertWeight,
  estimatedOneRepMax,
  formatBodyweightLoad,
  formatClock,
  formatWeight,
} from "@/lib/workout-utils";
import type { Exercise } from "@/types";

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

/**
 * Progress for one exercise, derived entirely from the user's completed workout
 * history (never stored counters).
 *
 * Timed exercises get their own card: a plank or a run has no weight, so the
 * lifting card found nothing in them and said "No sets logged yet" however many
 * had been. Bodyweight exercises get one for the same reason.
 */
export function ExerciseProgress({ exerciseId, exercise }: { exerciseId: string; exercise?: Exercise }) {
  if (exercise && isTimedExercise(exercise)) return <TimedProgress exercise={exercise} />;
  if (exercise && isBodyweightExercise(exercise)) return <BodyweightProgress exerciseId={exerciseId} />;
  return <LiftProgress exerciseId={exerciseId} />;
}

/** Below this, a session's average pace is a sprint, not a record worth keeping. */
function rateFloorMetres(kind: DistanceKind, unit: "lbs" | "kg"): number {
  const length = distanceUnit(kind, unit);
  if (kind === "row") return 500;
  if (kind === "swim") return toMetres(100, length);
  return toMetres(1, length);
}

const RECENT_SESSIONS = 5;

function TimedProgress({ exercise }: { exercise: Exercise }) {
  const styles = useStyles();
  const { completed } = useWorkouts();
  const { unit } = useWeightUnit();
  const ground = distanceKind(exercise);

  // One per workout, newest first: the time and distance of its completed
  // sets. Pace comes only from sets that have both — a mile typed with no time
  // beside three timed ones would otherwise make the session look faster.
  const sessions = useMemo(() => {
    const out: { id: string; date: Date; seconds: number; metres: number; pacedSeconds: number; pacedMetres: number }[] = [];
    for (const w of completed) {
      let seconds = 0;
      let metres = 0;
      let pacedSeconds = 0;
      let pacedMetres = 0;
      for (const ex of w.exercises) {
        if (ex.exerciseId !== exercise.id) continue;
        for (const s of ex.sets) {
          if (!s.isCompleted) continue;
          seconds += s.duration ?? 0;
          metres += s.distance ?? 0;
          if (s.duration && s.distance) {
            pacedSeconds += s.duration;
            pacedMetres += s.distance;
          }
        }
      }
      if (seconds > 0 || metres > 0) {
        out.push({ id: w.id, date: w.completedAt!, seconds, metres, pacedSeconds, pacedMetres });
      }
    }
    return out;
  }, [completed, exercise.id]);

  if (sessions.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>
          Nothing logged yet. Your bests appear after your first workout with it.
        </Text>
      </View>
    );
  }

  const groundUnit = ground ? distanceUnit(ground, unit) : null;
  const longestTime = Math.max(...sessions.map((s) => s.seconds));
  const longestDistance = Math.max(...sessions.map((s) => s.metres));
  // Fastest average over a real distance — fewest seconds per metre.
  const floor = ground ? rateFloorMetres(ground, unit) : Infinity;
  const quickest = sessions
    .filter((s) => s.pacedMetres >= floor && s.pacedSeconds > 0)
    .reduce<(typeof sessions)[number] | null>(
      (best, s) => (!best || s.pacedSeconds / s.pacedMetres < best.pacedSeconds / best.pacedMetres ? s : best),
      null
    );
  const totalSeconds = sessions.reduce((sum, s) => sum + s.seconds, 0);
  // How far each time on cardio that covers ground, how long on everything
  // else — oldest first, the last dozen, like the lifting chart.
  const byDistance = !!ground && longestDistance > 0;
  const trend = sessions
    .slice(0, MAX_SESSIONS)
    .reverse()
    .map((s) => (byDistance ? s.metres : s.seconds))
    .filter((v) => v > 0);

  const stats =
    ground && groundUnit && longestDistance > 0
      ? [
          { label: "Longest", value: formatDistance(longestDistance, groundUnit) },
          {
            label: ground === "ride" ? "Fastest avg" : "Best pace",
            value: quickest ? formatRate(quickest.pacedMetres, quickest.pacedSeconds, ground, unit)! : "—",
          },
        ]
      : [
          { label: "Longest", value: longestTime > 0 ? formatClock(longestTime) : "—" },
          { label: "Total time", value: formatClock(totalSeconds) },
        ];

  return (
    <View style={styles.card}>
      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statRowItem}>
            <View style={styles.stat}>
              {/* The unit set small beside the number, as "lbs" is on the
                  lifting card: at full size "6.20 mi" breaks over two lines
                  in a third of the card. */}
              <Text style={styles.statValue} maxFontSizeMultiplier={FontScaleCap.grid}>
                {stat.value.split(" ")[0]}
                {stat.value.includes(" ") && (
                  <Text style={styles.statUnit}> {stat.value.slice(stat.value.indexOf(" ") + 1)}</Text>
                )}
              </Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
            <View style={styles.statDivider} />
          </View>
        ))}
        <View style={styles.stat}>
          <Text style={styles.statValue} maxFontSizeMultiplier={FontScaleCap.grid}>
            {sessions.length}
          </Text>
          <Text style={styles.statLabel}>Session{sessions.length === 1 ? "" : "s"}</Text>
        </View>
      </View>

      {trend.length > 1 && (
        <View>
          <Text style={styles.trendHeading} maxFontSizeMultiplier={FontScaleCap.grid}>
            {byDistance ? "Distance" : "Time"} · last {trend.length} sessions
          </Text>
          <SessionTrend values={trend} />
        </View>
      )}

      <View style={styles.recent}>
        {sessions.slice(0, RECENT_SESSIONS).map((s) => {
          const rate = ground ? formatRate(s.pacedMetres, s.pacedSeconds, ground, unit) : null;
          return (
            <View key={s.id} style={styles.recentRow}>
              <Text style={styles.recentDate} maxFontSizeMultiplier={FontScaleCap.grid}>
                {s.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </Text>
              <Text style={styles.recentValue} maxFontSizeMultiplier={FontScaleCap.grid}>
                {[
                  s.metres > 0 && groundUnit ? formatDistance(s.metres, groundUnit) : null,
                  s.seconds > 0 ? formatClock(s.seconds) : null,
                  rate,
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** A set's reps, and what was added to or taken off the lifter, in lbs. */
interface RepSet {
  reps: number;
  added?: number;
}

/** More reps wins; at the same reps, the heavier load. */
function beats(a: RepSet, b: RepSet): boolean {
  return a.reps > b.reps || (a.reps === b.reps && (a.added ?? 0) > (b.added ?? 0));
}

/**
 * Progress for a move where you are the weight: pull-ups, push-ups, dips.
 *
 * Their sets are stored as "bodyweight", with only what was added or taken off
 * in the weight field, so the lifting card, which reads lbs and kg, skipped
 * every one and said "No sets logged yet" over thirty sessions of pull-ups.
 * Reps are what these are trained by, so they lead. Pricing each set at the
 * day's weigh-in instead would chart the scale as much as the lifting, and
 * draw nothing for someone who has never weighed in.
 */
function BodyweightProgress({ exerciseId }: { exerciseId: string }) {
  const styles = useStyles();
  const { completed } = useWorkouts();
  const { unit } = useWeightUnit();

  // One per workout, newest first. Any completed set with reps counts, not
  // only "bodyweight" ones: a push-up logged before the exercise was marked
  // bodyweight was still a push-up. Its weight just isn't an added load.
  const sessions = useMemo(() => {
    const out: { id: string; date: Date; sets: number; reps: number; best: RepSet }[] = [];
    for (const w of completed) {
      let sets = 0;
      let reps = 0;
      let best: RepSet | null = null;
      for (const ex of w.exercises) {
        if (ex.exerciseId !== exerciseId) continue;
        for (const s of ex.sets) {
          if (!s.isCompleted || !s.reps) continue;
          const set: RepSet = { reps: s.reps, added: s.weightUnit === "bodyweight" ? s.weight : undefined };
          sets += 1;
          reps += s.reps;
          if (!best || beats(set, best)) best = set;
        }
      }
      if (best) out.push({ id: w.id, date: w.completedAt!, sets, reps, best });
    }
    return out;
  }, [completed, exerciseId]);

  if (sessions.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>
          No sets logged yet. Your best set and chart appear after your first workout with it.
        </Text>
      </View>
    );
  }

  const record = sessions.reduce((top, s) => (beats(s.best, top) ? s.best : top), sessions[0].best);
  const totalReps = sessions.reduce((sum, s) => sum + s.reps, 0);
  // Oldest first, the last dozen, like the lifting chart.
  const trend = sessions
    .slice(0, MAX_SESSIONS)
    .reverse()
    .map((s) => s.best.reps);
  const bestOf = (set: RepSet) => `${formatBodyweightLoad(set.added, unit)} × ${set.reps}`;

  return (
    <View style={styles.card}>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue} maxFontSizeMultiplier={FontScaleCap.grid}>
            {record.reps}
            <Text style={styles.statUnit}> reps</Text>
          </Text>
          <Text style={styles.statLabel}>
            Best set{record.added ? ` · ${formatBodyweightLoad(record.added, unit)}` : ""}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue} maxFontSizeMultiplier={FontScaleCap.grid}>
            {totalReps}
          </Text>
          <Text style={styles.statLabel}>Total reps</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue} maxFontSizeMultiplier={FontScaleCap.grid}>
            {sessions.length}
          </Text>
          <Text style={styles.statLabel}>Session{sessions.length === 1 ? "" : "s"}</Text>
        </View>
      </View>

      {trend.length > 1 && (
        <View>
          <Text style={styles.trendHeading} maxFontSizeMultiplier={FontScaleCap.grid}>
            Most reps · last {trend.length} sessions
          </Text>
          <SessionTrend values={trend} />
        </View>
      )}

      <View style={styles.recent}>
        {sessions.slice(0, RECENT_SESSIONS).map((s) => (
          <View key={s.id} style={styles.recentRow}>
            <Text style={styles.recentDate} maxFontSizeMultiplier={FontScaleCap.grid}>
              {s.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </Text>
            <Text style={styles.recentValue} maxFontSizeMultiplier={FontScaleCap.grid}>
              {[`${s.sets} set${s.sets === 1 ? "" : "s"}`, `${s.reps} reps`, `best ${bestOf(s.best)}`].join("  ·  ")}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function LiftProgress({ exerciseId }: { exerciseId: string }) {
  const styles = useStyles();
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
          No sets logged yet. Your PR and chart appear after your first workout with it.
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
  const styles = useStyles();
  const palette = usePalette();
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
            stroke={palette.border}
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
              fill={isPeak ? palette.amber : palette.surface}
              stroke={isPeak ? palette.amber : theme.accent}
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

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: c.textTertiary,
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
    backgroundColor: c.border,
    marginHorizontal: Spacing.three,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
  statUnit: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textTertiary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textSecondary,
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
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  metricText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.textSecondary,
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
    color: c.textTertiary,
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
    color: c.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  axisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -Spacing.two,
  },
  statRowItem: {
    flex: 1,
    flexDirection: "row",
  },
  trendHeading: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: c.textTertiary,
    marginBottom: Spacing.one,
  },
  recent: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: Spacing.three,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.three,
  },
  recentDate: {
    width: 52,
    fontSize: 12,
    color: c.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  recentValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: c.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  axisLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: c.textTertiary,
  },
}));
