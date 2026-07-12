import { useMemo } from "react";
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Card, EmptyState } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { useWorkouts } from "@/hooks/use-workouts";
import { deleteWorkout } from "@/lib/firestore";
import { useWeightUnit } from "@/context/UnitContext";
import { completedSetCount, displayVolume, workoutVolumeLbs } from "@/lib/workout-utils";
import type { Workout } from "@/types";

export default function HistoryScreen() {
  const router = useRouter();
  const { completed, loading } = useWorkouts();

  // Group by month so years of history stay scannable.
  const sections = useMemo(() => {
    const byMonth = new Map<string, Workout[]>();
    for (const w of completed) {
      const key = w.completedAt!.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      byMonth.set(key, [...(byMonth.get(key) ?? []), w]);
    }
    return [...byMonth.entries()].map(([title, data]) => ({ title, data }));
  }, [completed]);

  function confirmDelete(workout: Workout) {
    Alert.alert("Delete workout?", `"${workout.name}" will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteWorkout(workout.id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Palette.textSecondary} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>
            {completed.length} workout{completed.length === 1 ? "" : "s"} · kept forever
          </Text>
        </View>
      </View>

      {!loading && completed.length === 0 ? (
        <EmptyState title="No workouts yet" message="Finished workouts land here permanently." />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(w) => w.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.monthLabel}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <HistoryRow
              workout={item}
              onPress={() => router.push(`/workout/${item.id}`)}
              onLongPress={() => confirmDelete(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function HistoryRow({
  workout,
  onPress,
  onLongPress,
}: {
  workout: Workout;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { unit } = useWeightUnit();
  const volume = workout.totalVolume ?? workoutVolumeLbs(workout);
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      {({ pressed }) => (
        <Card style={[styles.row, pressed && { opacity: 0.8 }]}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.rowTitle}>{workout.name}</Text>
            <Text style={styles.rowMeta}>
              {workout.completedAt!.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              {` · ${completedSetCount(workout)} sets`}
              {workout.durationMinutes ? ` · ${workout.durationMinutes}m` : ""}
            </Text>
          </View>
          {volume > 0 ? (
            <Text style={styles.volume}>{displayVolume(volume, unit)}</Text>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={Palette.textTertiary} />
          )}
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.three,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Palette.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Palette.textTertiary,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  monthLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Palette.textTertiary,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Palette.text,
  },
  rowMeta: {
    fontSize: 13,
    color: Palette.textTertiary,
  },
  volume: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.accentText,
    fontVariant: ["tabular-nums"],
  },
});
