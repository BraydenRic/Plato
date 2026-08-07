import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ActiveWorkoutBar } from "@/components/active-workout-bar";
import { BodyweightChart } from "@/components/bodyweight-chart";
import { Button, Card, EmptyState, SectionLabel } from "@/components/ui";
import { FontScaleCap, Palette, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useWeightUnit } from "@/context/UnitContext";
import { useBodyweight } from "@/hooks/use-bodyweight";
import { useWorkouts } from "@/hooks/use-workouts";
import { applyVolumeCorrections } from "@/lib/apply-volume-corrections";
import { staleVolumesOnDay } from "@/lib/repair-bodyweight-volumes";
import { convertWeight, relativeDay, sameDay, workoutDay } from "@/lib/workout-utils";
import type { BodyweightEntry } from "@/types";

/**
 * How far back each range reaches, in days. `null` is everything.
 *
 * Weeks are missing on purpose: bodyweight barely moves in one, so a 1W chart
 * is a scale-plot of water weight and reads as wild swings.
 */
const RANGES = [
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "1Y", days: 365 },
  { key: "All", days: null },
] as const;

export default function BodyweightScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { unit } = useWeightUnit();
  const { dataUserId } = useAuth();
  const { log, loading, record, remove } = useBodyweight();
  const { completed } = useWorkouts();
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("3M");

  const range = RANGES.find((r) => r.key === rangeKey)!;

  const shown = useMemo(() => {
    if (range.days == null) return log;
    const cutoff = Date.now() - range.days * 86_400_000;
    return log.filter((e) => e.date.getTime() >= cutoff);
  }, [log, range.days]);

  // Over the visible window, not all time — the number under a 1M chart should
  // be the month's change, or the chart and the figure disagree.
  const delta = useMemo(() => {
    if (shown.length < 2) return null;
    const first = convertWeight(shown[0].lbs, "lbs", unit);
    const last = convertWeight(shown[shown.length - 1].lbs, "lbs", unit);
    return Math.round((last - first) * 10) / 10;
  }, [shown, unit]);

  const latest = log.length > 0 ? log[log.length - 1] : null;

  /** Completed workouts filed under a day, so an edit can say what it will touch. */
  function workoutsOn(day: Date) {
    return completed.filter((w) => sameDay(workoutDay(w), day));
  }

  /**
   * Re-prices the workouts on a day whose weigh-in just changed.
   *
   * Fire-and-forget: the log on screen is already correct, and the volumes are
   * on other screens. A failure leaves them stale rather than wrong-and-hidden,
   * and the launch repair is not the fix for that — it has already run.
   */
  function repriceDay(day: Date, nextLog: BodyweightEntry[]) {
    if (!dataUserId) return;
    applyVolumeCorrections(
      staleVolumesOnDay(completed, nextLog, day),
      completed,
      dataUserId
    ).catch((e) => console.warn("Couldn't re-price that day's workouts", e));
  }

  function saveWeight(value: string | undefined, day: Date) {
    const entered = Number((value ?? "").trim());
    if (!Number.isFinite(entered) || entered <= 0) return;
    const lbs = convertWeight(entered, unit, "lbs");
    record(lbs, day)
      .then(() => repriceDay(day, withEntry(log, day, lbs)))
      .catch((e) => {
        console.warn("Couldn't save the weigh-in", e);
        Alert.alert("Couldn't save", "Check your connection and try again.");
      });
  }

  function deleteEntry(entry: BodyweightEntry) {
    remove(entry.date)
      .then(() => repriceDay(entry.date, withoutEntry(log, entry.date)))
      .catch((e) => {
        console.warn("Couldn't delete the weigh-in", e);
        Alert.alert("Couldn't delete", "Check your connection and try again.");
      });
  }

  function editEntry(entry: BodyweightEntry) {
    const affected = workoutsOn(entry.date).length;
    const shownValue = Math.round(convertWeight(entry.lbs, "lbs", unit) * 10) / 10;
    Alert.prompt(
      entry.date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
      // Says what else moves, because it isn't only the graph. Stated rather
      // than asked: the number was wrong, and a volume priced from it was too.
      affected > 0
        ? `Weigh-in in ${unit}. Changing it re-prices ${affected} workout${affected === 1 ? "" : "s"} logged that day.`
        : `Weigh-in in ${unit}.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteEntry(entry) },
        { text: "Save", onPress: (value?: string) => saveWeight(value, entry.date) },
      ],
      "plain-text",
      String(shownValue),
      "decimal-pad"
    );
  }

  function logToday() {
    Alert.prompt(
      "Bodyweight",
      `Today's weigh-in, in ${unit}.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Save", onPress: (value?: string) => saveWeight(value, new Date()) },
      ],
      "plain-text",
      undefined,
      "decimal-pad"
    );
  }

  return (
    <View style={styles.safe}>
      <ActiveWorkoutBar />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Palette.textSecondary} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>Bodyweight</Text>
          <Text style={styles.subtitle}>
            {log.length} weigh-in{log.length === 1 ? "" : "s"} · tap one to fix it
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!loading && log.length === 0 ? (
          <EmptyState
            title="No weigh-ins yet"
            message="Log one and your bodyweight sets start counting toward your volume."
          />
        ) : (
          <>
            <Card style={styles.chartCard}>
              <View style={styles.summary}>
                <Text style={styles.big} maxFontSizeMultiplier={FontScaleCap.grid}>
                  {latest ? Math.round(convertWeight(latest.lbs, "lbs", unit) * 10) / 10 : "—"}
                  <Text style={styles.bigUnit}> {unit}</Text>
                </Text>
                {delta != null && (
                  <View style={styles.deltaWrap}>
                    <Ionicons
                      name={delta > 0 ? "arrow-up" : delta < 0 ? "arrow-down" : "remove"}
                      size={13}
                      color={Palette.textSecondary}
                    />
                    <Text style={styles.delta} maxFontSizeMultiplier={FontScaleCap.grid}>
                      {Math.abs(delta)} {unit} · {rangeKey === "All" ? "all time" : rangeKey}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.ranges}>
                {RANGES.map((r) => (
                  <Pressable
                    key={r.key}
                    onPress={() => setRangeKey(r.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: r.key === rangeKey }}
                    style={[
                      styles.range,
                      r.key === rangeKey && { backgroundColor: theme.accentSoft, borderColor: theme.accent },
                    ]}>
                    <Text
                      style={[styles.rangeText, r.key === rangeKey && { color: theme.accentText }]}
                      maxFontSizeMultiplier={FontScaleCap.grid}>
                      {r.key}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {shown.length === 0 ? (
                <Text style={styles.rangeEmpty}>
                  Nothing weighed in this range. The log below still has everything.
                </Text>
              ) : (
                <BodyweightChart log={shown} unit={unit} height={220} />
              )}
            </Card>

            <Button title="Log today's weigh-in" onPress={logToday} />

            <View style={styles.section}>
              <SectionLabel>Log</SectionLabel>
              <Card style={styles.logCard}>
                {[...log].reverse().map((entry, i) => {
                  const affected = workoutsOn(entry.date).length;
                  return (
                    <Pressable
                      key={entry.date.getTime()}
                      onPress={() => editEntry(entry)}
                      accessibilityRole="button"
                      accessibilityLabel={`${entry.date.toLocaleDateString()}, ${Math.round(
                        convertWeight(entry.lbs, "lbs", unit) * 10
                      ) / 10} ${unit}. Edit or delete.`}
                      style={({ pressed }) => [
                        styles.logRow,
                        i > 0 && styles.logRowBorder,
                        pressed && { opacity: 0.7 },
                      ]}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.logDate}>{relativeDay(entry.date)}</Text>
                        <Text style={styles.logMeta}>
                          {entry.date.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {affected > 0 && ` · ${affected} workout${affected === 1 ? "" : "s"}`}
                        </Text>
                      </View>
                      <Text
                        style={[styles.logValue, { color: theme.accentText }]}
                        maxFontSizeMultiplier={FontScaleCap.grid}>
                        {Math.round(convertWeight(entry.lbs, "lbs", unit) * 10) / 10} {unit}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={Palette.textTertiary} />
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Local mirrors of the store helpers, used only to hand repriceDay the log as
// it will be once the write lands — `log` in this render is still the old one.
function withEntry(log: BodyweightEntry[], day: Date, lbs: number): BodyweightEntry[] {
  return [...log.filter((e) => !sameDay(e.date, day)), { date: day, lbs }].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}

function withoutEntry(log: BodyweightEntry[], day: Date): BodyweightEntry[] {
  return log.filter((e) => !sameDay(e.date, day));
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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Palette.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
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
  scroll: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  chartCard: {
    gap: Spacing.three,
  },
  summary: {
    gap: Spacing.one,
  },
  big: {
    fontSize: 36,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  bigUnit: {
    fontSize: 17,
    fontWeight: "700",
    color: Palette.textTertiary,
    letterSpacing: 0,
  },
  deltaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  delta: {
    fontSize: 13,
    color: Palette.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  ranges: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  range: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surfaceRaised,
  },
  rangeText: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.textSecondary,
  },
  rangeEmpty: {
    fontSize: 13,
    color: Palette.textTertiary,
    lineHeight: 19,
    paddingVertical: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  logCard: {
    paddingVertical: 0,
  },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: 12,
  },
  logRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  logDate: {
    fontSize: 15,
    fontWeight: "600",
    color: Palette.text,
  },
  logMeta: {
    fontSize: 12,
    color: Palette.textTertiary,
  },
  logValue: {
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
