import { useMemo } from "react";
import { Alert, Pressable, SectionList, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ActiveWorkoutBar } from "@/components/active-workout-bar";
import { Card, EmptyState } from "@/components/ui";
import { FontScaleCap, Radius, Spacing } from "@/constants/theme";
import { makeStyles, usePalette } from "@/context/AppearanceContext";
import { AWAITING_SYNC_MESSAGE, useWorkouts } from "@/hooks/use-workouts";
import { recordCardioDiscard } from "@/lib/cardio-discards";
import { deleteWorkout } from "@/lib/data";
import { useWeightUnit } from "@/context/UnitContext";
import { useTheme } from "@/context/ThemeContext";
import { isCardioWorkout, workoutDistanceLabel } from "@/lib/cardio";
import { isCardioSession, sessionIcon } from "@/lib/cardio-session";
import { completedSetCount, displayVolume, workoutVolumeLbs } from "@/lib/workout-utils";
import type { Workout } from "@/types";

export default function HistoryScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const { completed, loading, awaitingSync } = useWorkouts();

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
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          // A watch still finishing it stops, and keeps nothing.
          recordCardioDiscard(workout);
          deleteWorkout(workout);
        },
      },
    ]);
  }

  return (
    <View style={styles.safe}>
      {/* History is pushed over the tabs, so it covers their copy of the bar and
          needs its own — and takes over the top inset the same way. */}
      <ActiveWorkoutBar />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={palette.textSecondary} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title} maxFontSizeMultiplier={FontScaleCap.title}>History</Text>
          <Text style={styles.subtitle}>
            {completed.length} workout{completed.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      {!loading && completed.length === 0 ? (
        awaitingSync ? (
          <EmptyState title="Waiting for a connection" message={AWAITING_SYNC_MESSAGE} />
        ) : (
          <EmptyState title="No workouts yet" message="Finished workouts land here permanently." />
        )
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
              // navigate, not push: a double tap reuses the screen it opened.
              onPress={() => router.navigate(`/workout/${item.id}`)}
              onLongPress={() => confirmDelete(item)}
            />
          )}
        />
      )}
    </View>
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
  const styles = useStyles();
  const palette = usePalette();
  const { unit } = useWeightUnit();
  const theme = useTheme();
  const volume = workout.totalVolume ?? workoutVolumeLbs(workout);
  // A run's headline is how far it went, where a lift's is how much it moved.
  const distance = workoutDistanceLabel(workout, unit);
  // A session, or a workout of only runs, rides and rows, has a distance to
  // say instead of a set count. Not the whole Cardio category: that also holds
  // burpees, jump rope and yoga, and a circuit of those keeps its "12 sets".
  const cardio = isCardioSession(workout) || (isCardioWorkout(workout) && distance != null);
  const icon = sessionIcon(workout);
  // Past the largest standard text size the volume on the right took the row's
  // width and squeezed the name to a letter per line. Stack it underneath
  // instead, so the name gets the whole row.
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.36;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      {({ pressed }) => (
        <Card style={[styles.row, stacked && styles.rowStacked, pressed && { opacity: 0.8 }]}>
          <View style={stacked ? styles.rowTextStacked : { flex: 1, gap: 3 }}>
            <Text style={styles.rowTitle} maxFontSizeMultiplier={FontScaleCap.heading}>{workout.name}</Text>
            {/* The glyph marks a run or a ride among the lifting days, as on Home. */}
            <View style={styles.rowMetaLine}>
              {icon && <Ionicons name={icon} size={12} color={theme.accentText} testID="session-icon" />}
              <Text style={styles.rowMeta}>
                {workout.completedAt!.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                {cardio ? "" : ` · ${completedSetCount(workout)} sets`}
                {workout.durationMinutes ? ` · ${workout.durationMinutes}m` : ""}
              </Text>
            </View>
          </View>
          {volume > 0 ? (
            <Text style={[styles.volume, { color: theme.accentText }]} maxFontSizeMultiplier={FontScaleCap.title}>{displayVolume(volume, unit)}</Text>
          ) : distance ? (
            <Text style={[styles.volume, { color: theme.accentText }]} maxFontSizeMultiplier={FontScaleCap.title}>{distance}</Text>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={palette.textTertiary} />
          )}
        </Card>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
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
    backgroundColor: c.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: c.textTertiary,
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
    color: c.textTertiary,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  rowStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  // No flex value at all rather than `flex: 0`: iOS reads 0 as "size to the
  // content" but the web reads it as zero height, and the volume then drew
  // over the name. Leaving it unset means the same thing on both.
  rowTextStacked: {
    gap: 3,
    alignSelf: "stretch",
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: c.text,
  },
  rowMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  rowMeta: {
    flexShrink: 1,
    fontSize: 13,
    color: c.textTertiary,
  },
  volume: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
}));
