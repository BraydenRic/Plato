import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Card, Chip, SectionLabel } from "@/components/ui";
import { FontScaleCap, Spacing } from "@/constants/theme";
import { makeStyles } from "@/context/AppearanceContext";
import { useTheme } from "@/context/ThemeContext";
import { useWeightUnit } from "@/context/UnitContext";
import {
  ACTIVITY_KIND,
  ACTIVITY_LABEL,
  BEST_EFFORTS,
  activitiesIn,
  cardioRecords,
  cardioSessions,
  distanceUnit,
  formatDistance,
  weeklyDistance,
  type CardioActivity,
} from "@/lib/cardio";
import { addDays, formatClock } from "@/lib/workout-utils";
import type { BestEffortKey, Workout } from "@/types";

const WEEKS = 8;

/**
 * Records worth listing, in the unit someone thinks in: a mile for lbs people,
 * a kilometre for kg people. The race distances are the same for everyone.
 */
const RECORD_KEYS: Record<"lbs" | "kg", BestEffortKey[]> = {
  lbs: ["1mi", "5k", "10k", "half", "marathon"],
  kg: ["1k", "5k", "10k", "half", "marathon"],
};

/**
 * Cardio on the Stats tab: how far this week, the last eight weeks, and your
 * records. Nothing at all for someone who doesn't do cardio that covers
 * ground — the section only exists once there's something to put in it.
 *
 * One activity at a time. A mile walked and a mile ridden aren't the same
 * mile, so they never share a chart; the chips pick which you're looking at.
 */
export function CardioStats({ completed }: { completed: Workout[] }) {
  const styles = useStyles();
  const theme = useTheme();
  const { unit } = useWeightUnit();
  const sessions = useMemo(() => cardioSessions(completed), [completed]);
  const activities = useMemo(() => activitiesIn(sessions), [sessions]);
  // Opens on whatever you did last: just back from a run, it shows runs.
  const [picked, setPicked] = useState<CardioActivity | null>(null);
  const activity = picked && activities.includes(picked) ? picked : sessions[0]?.activity;
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const mine = useMemo(() => sessions.filter((s) => s.activity === activity), [sessions, activity]);
  const weeks = useMemo(() => weeklyDistance(mine, WEEKS), [mine]);
  const records = useMemo(() => cardioRecords(mine), [mine]);

  if (!activity) return null;

  const label = ACTIVITY_LABEL[activity];
  const lengthUnit = distanceUnit(ACTIVITY_KIND[activity], unit);
  const show = (metres: number) => formatDistance(metres, lengthUnit);
  const peak = Math.max(...weeks.map((w) => w.metres), 1);
  // The week the big number is about: the bar tapped, or this one. One number
  // that follows your finger, rather than a headline and a readout beneath it
  // saying the same thing twice.
  const readIndex = selectedWeek ?? weeks.length - 1;
  const read = weeks[readIndex];
  const isThisWeek = readIndex === weeks.length - 1;
  const inWeek = mine.filter((s) => s.date >= read.weekStart && s.date < addDays(read.weekStart, 7));
  const weekSeconds = inWeek.reduce((sum, s) => sum + s.seconds, 0);

  const recordRows = [
    ...(activity === "run"
      ? RECORD_KEYS[unit]
          .filter((key) => records.best[key] != null)
          .map((key) => ({
            key,
            label: BEST_EFFORTS.find((e) => e.key === key)!.label,
            value: formatClock(records.best[key]!),
          }))
      : []),
    ...(records.longest
      ? [{ key: "longest", label: `Longest ${label.one.toLowerCase()}`, value: show(records.longest.metres) }]
      : []),
  ];

  return (
    <View>
      <SectionLabel>{label.noun}</SectionLabel>
      {activities.length > 1 && (
        <View style={styles.chips}>
          {activities.map((a) => (
            <Chip
              key={a}
              label={ACTIVITY_LABEL[a].one}
              active={a === activity}
              onPress={() => {
                setPicked(a);
                setSelectedWeek(null);
              }}
            />
          ))}
        </View>
      )}
      <Card style={styles.card}>
        {/* Above the chart, so a thumb on a bar never covers its reading. */}
        <View style={styles.hero}>
          <Text style={styles.heroValue} maxFontSizeMultiplier={FontScaleCap.title}>
            {show(read.metres)}
          </Text>
          <Text style={styles.heroLabel}>
            {isThisWeek
              ? "this week"
              : `week of ${read.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
            {inWeek.length > 0
              ? ` · ${inWeek.length} ${inWeek.length === 1 ? label.one.toLowerCase() : label.many}` +
                (weekSeconds > 0 ? ` · ${formatClock(weekSeconds)}` : "")
              : ""}
          </Text>
        </View>

        <View>
          <View style={styles.chart}>
            {weeks.map((week, i) => (
              <Pressable
                key={week.weekStart.getTime()}
                style={styles.chartCol}
                onPress={() => setSelectedWeek(i)}
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Week of ${week.weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric" })}, ${show(week.metres)}`}
                accessibilityState={{ selected: i === readIndex }}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        backgroundColor: theme.accent,
                        // The week being read at full strength, the rest held
                        // back, so which bar the number above belongs to is
                        // never a guess.
                        opacity: i === readIndex ? 1 : 0.45,
                        height: `${week.metres > 0 ? Math.max(4, (week.metres / peak) * 100) : 0}%`,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            ))}
          </View>
          <View style={styles.axis}>
            <Text style={styles.axisLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
              {weeks[0].weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </Text>
            <Text style={styles.axisLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
              This week
            </Text>
          </View>
        </View>

        {recordRows.length > 0 && (
          <View style={styles.records}>
            <Text style={styles.recordsHeading} maxFontSizeMultiplier={FontScaleCap.grid}>
              Records
            </Text>
            {recordRows.map((row) => (
              <View key={row.key} style={styles.recordRow}>
                <Text style={styles.recordLabel}>{row.label}</Text>
                <Text style={styles.recordValue} maxFontSizeMultiplier={FontScaleCap.title}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  card: {
    gap: Spacing.three,
  },
  hero: {
    gap: 2,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  heroLabel: {
    fontSize: 13,
    color: c.textTertiary,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 96,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  chartCol: {
    flex: 1,
    height: "100%",
    alignItems: "center",
  },
  barTrack: {
    flex: 1,
    width: "100%",
    maxWidth: 24,
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  axisLabel: {
    fontSize: 10,
    color: c.textTertiary,
  },
  records: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: Spacing.three,
  },
  recordsHeading: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: c.textTertiary,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  recordLabel: {
    fontSize: 14,
    color: c.textSecondary,
  },
  recordValue: {
    fontSize: 15,
    fontWeight: "700",
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
}));
