import { useMemo } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Card, EmptyState, SectionLabel } from "@/components/ui";
import { MuscleMap } from "@/components/muscle-map";
import { FontScaleCap, Spacing } from "@/constants/theme";
import { makeStyles, usePalette } from "@/context/AppearanceContext";
import { useTheme } from "@/context/ThemeContext";
import { useWorkouts } from "@/hooks/use-workouts";
import { computeStats } from "@/lib/data";
import { useWeightUnit } from "@/context/UnitContext";
import { addDays, displayVolume, formatDuration, setsByCategory, startOfWeek, workoutVolumeLbs } from "@/lib/workout-utils";

const CHART_DAYS = 14;

export default function StatsScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const { completed, loading } = useWorkouts();
  const { unit } = useWeightUnit();

  // Lifetime stats are always derived from real workout history — never
  // incremented counters (the old app corrupted stats that way).
  const stats = useMemo(() => computeStats(completed), [completed]);

  const chart = useMemo(() => {
    const days: { label: string; volume: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      const volume = completed
        .filter((w) => {
          const d = new Date(w.completedAt!);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === day.getTime();
        })
        .reduce((sum, w) => sum + (w.totalVolume ?? workoutVolumeLbs(w)), 0);
      days.push({
        label: day.toLocaleDateString(undefined, { weekday: "narrow" }),
        volume,
      });
    }
    return days;
  }, [completed]);

  const maxVolume = Math.max(...chart.map((d) => d.volume), 1);

  const thisWeek = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = addDays(start, 7);
    return completed.filter((w) => w.completedAt! >= start && w.completedAt! < end);
  }, [completed]);

  /**
   * How much of each thing you actually did this week.
   *
   * The diagram above answers "did I train chest", which is the question you
   * already know the answer to. This answers "how much", which is the one that
   * changes next week — one set of chest and twenty look identical on a body
   * map.
   */
  const weekSets = useMemo(() => setsByCategory(thisWeek), [thisWeek]);
  const mostSets = weekSets[0]?.sets ?? 1;

  // Weekly muscle recap: a muscle is "primary" if any exercise this week
  // targeted it first; muscles hit only in passing get the secondary shade.
  const weekMuscles = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = addDays(start, 7);
    const primaries = new Set<string>();
    const secondaries = new Set<string>();
    let workoutCount = 0;
    for (const w of completed) {
      const d = w.completedAt!;
      if (d < start || d >= end) continue;
      workoutCount++;
      for (const ex of w.exercises) {
        if (!ex.sets.some((s) => s.isCompleted)) continue;
        ex.exercise.musclesWorked.forEach((m, i) => (i === 0 ? primaries : secondaries).add(m));
      }
    }
    return {
      primary: [...primaries],
      secondary: [...secondaries].filter((m) => !primaries.has(m)),
      workoutCount,
    };
  }, [completed]);

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Statistics</Text>
          <Text style={styles.subtitle}>Lifetime, across all devices</Text>
        </View>

        <View style={styles.streakRow}>
          <Card style={styles.streakCard}>
            <View style={styles.streakIconWrap}>
              <Ionicons name="flame" size={20} color={palette.amber} />
            </View>
            <Text style={styles.streakValue}>{stats.currentStreak}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </Card>
          <Card style={styles.streakCard}>
            <View style={styles.streakIconWrap}>
              <Ionicons name="trophy" size={20} color={theme.accentText} />
            </View>
            <Text style={styles.streakValue}>{stats.longestStreak}</Text>
            <Text style={styles.streakLabel}>best streak</Text>
          </Card>
        </View>

        <View style={styles.grid}>
          <StatCard label="Workouts" value={String(stats.totalCompletedWorkouts)} />
          <StatCard label="Volume" value={displayVolume(stats.totalVolumeLbs, unit)} />
          <StatCard label="Sets" value={String(stats.totalSetsCompleted)} />
          <StatCard label="Time" value={formatDuration(stats.totalWorkoutTimeMinutes)} />
        </View>

        <View>
          <SectionLabel>Muscles this week</SectionLabel>
          <Card style={styles.muscleCard}>
            <MuscleMap
              musclesWorked={weekMuscles.primary}
              secondaryMuscles={weekMuscles.secondary}
            />
            {weekSets.length > 0 && (
              <View style={styles.setRows}>
                {/* The numbers are bare, and a bare number next to a muscle
                    name could be sets, reps or pounds. Said once above the
                    column rather than repeated on all six rows. */}
                <Text style={styles.setHeading}>Sets completed this week</Text>
                {weekSets.map((row) => (
                  <View key={row.category} style={styles.setRow}>
                    <Text style={styles.setCategory} numberOfLines={1}>
                      {row.category}
                    </Text>
                    <View style={styles.setTrack}>
                      <View
                        style={[
                          styles.setBar,
                          { width: `${(row.sets / mostSets) * 100}%`, backgroundColor: theme.accent },
                        ]}
                      />
                    </View>
                    <Text style={styles.setCount} maxFontSizeMultiplier={FontScaleCap.grid}>
                      {row.sets}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.muscleCaption}>
              {weekMuscles.workoutCount === 0
                ? "Nothing logged yet this week — the body fills in as you train."
                : `From ${weekMuscles.workoutCount} workout${weekMuscles.workoutCount === 1 ? "" : "s"} since Monday`}
            </Text>
          </Card>
        </View>

        <View>
          <SectionLabel>Volume — last {CHART_DAYS} days</SectionLabel>
          <Card style={styles.chartCard}>
            {!loading && completed.length === 0 ? (
              <EmptyState title="Nothing to chart yet" message="Finish a workout and your volume will show up here." />
            ) : (
              <View style={styles.chart}>
                {chart.map((d, i) => (
                  <View key={i} style={styles.chartCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            backgroundColor: theme.accent,
                            height: `${Math.max(d.volume > 0 ? 6 : 0, (d.volume / maxVolume) * 100)}%`,
                          },
                        ]}
                      />
                    </View>
                    {/* One label per bar in a fixed-width column. */}
                    <Text style={styles.barLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
                      {d.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  // Two columns stop working once the numbers scale up — give each stat the
  // whole row so a value like "1.2M lbs" isn't broken across three lines.
  const { fontScale } = useWindowDimensions();
  return (
    <Card style={[styles.statCard, fontScale > 1.3 && styles.statCardWide]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
  },
  scroll: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  header: {
    gap: 2,
    marginTop: Spacing.two,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: c.textTertiary,
  },
  streakRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  streakCard: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: Spacing.four,
  },
  streakIconWrap: {
    marginBottom: Spacing.one,
  },
  streakValue: {
    fontSize: 32,
    fontWeight: "800",
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
  streakLabel: {
    fontSize: 12,
    color: c.textTertiary,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  statCard: {
    flexBasis: "48%",
    flexGrow: 1,
    gap: 2,
  },
  statCardWide: {
    flexBasis: "100%",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontSize: 12,
    color: c.textTertiary,
  },
  chartCard: {
    paddingVertical: Spacing.three,
  },
  muscleCard: {
    gap: Spacing.two,
  },
  setRows: {
    gap: 5,
  },
  setHeading: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: c.textTertiary,
    marginBottom: 1,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  setCategory: {
    width: 78,
    fontSize: 12,
    fontWeight: "600",
    color: c.textSecondary,
  },
  setTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.surfaceRaised,
    overflow: "hidden",
  },
  setBar: {
    height: 5,
    borderRadius: 3,
  },
  setCount: {
    minWidth: 22,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "700",
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
  muscleCaption: {
    fontSize: 12,
    color: c.textTertiary,
    textAlign: "center",
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 140,
  },
  chartCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    height: "100%",
  },
  barTrack: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    color: c.textTertiary,
  },
}));
