import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Card, EmptyState, SectionLabel } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { useWorkouts } from "@/hooks/use-workouts";
import { computeStats } from "@/lib/firestore";
import { formatDuration, formatVolume, workoutVolumeLbs } from "@/lib/workout-utils";

const CHART_DAYS = 14;

export default function StatsScreen() {
  const { completed, loading } = useWorkouts();

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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Statistics</Text>
          <Text style={styles.subtitle}>Lifetime, across all devices</Text>
        </View>

        <View style={styles.streakRow}>
          <Card style={styles.streakCard}>
            <View style={styles.streakIconWrap}>
              <Ionicons name="flame" size={20} color={Palette.amber} />
            </View>
            <Text style={styles.streakValue}>{stats.currentStreak}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </Card>
          <Card style={styles.streakCard}>
            <View style={styles.streakIconWrap}>
              <Ionicons name="trophy" size={20} color={Palette.accentText} />
            </View>
            <Text style={styles.streakValue}>{stats.longestStreak}</Text>
            <Text style={styles.streakLabel}>best streak</Text>
          </Card>
        </View>

        <View style={styles.grid}>
          <StatCard label="Workouts" value={String(stats.totalCompletedWorkouts)} />
          <StatCard label="Volume" value={`${formatVolume(stats.totalVolumeLbs)} lbs`} />
          <StatCard label="Sets" value={String(stats.totalSetsCompleted)} />
          <StatCard label="Time" value={formatDuration(stats.totalWorkoutTimeMinutes)} />
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
                            height: `${Math.max(d.volume > 0 ? 6 : 0, (d.volume / maxVolume) * 100)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{d.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.bg,
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
    color: Palette.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Palette.textTertiary,
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
    color: Palette.text,
    fontVariant: ["tabular-nums"],
  },
  streakLabel: {
    fontSize: 12,
    color: Palette.textTertiary,
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
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: Palette.text,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontSize: 12,
    color: Palette.textTertiary,
  },
  chartCard: {
    paddingVertical: Spacing.three,
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
    backgroundColor: Palette.accent,
  },
  barLabel: {
    fontSize: 10,
    color: Palette.textTertiary,
  },
});
