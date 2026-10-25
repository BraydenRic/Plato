import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { WeekColumns } from "@/components/cardio-figures";
import { Card, Chip, SectionLabel } from "@/components/ui";
import { FontScaleCap, Radius, Spacing } from "@/constants/theme";
import { makeStyles, usePalette } from "@/context/AppearanceContext";
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
  formatDistanceValue,
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

const shortDate = (date: Date) => date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

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
  const palette = usePalette();
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
  // The week the big number is about: the bar tapped, or this one. One number
  // that follows your finger, rather than a headline and a readout beneath it
  // saying the same thing twice.
  const readIndex = selectedWeek ?? weeks.length - 1;
  const read = weeks[readIndex];
  const before = readIndex > 0 ? weeks[readIndex - 1] : null;
  const isThisWeek = readIndex === weeks.length - 1;
  const inWeek = mine.filter((s) => s.date >= read.weekStart && s.date < addDays(read.weekStart, 7));
  const weekSeconds = inWeek.reduce((sum, s) => sum + s.seconds, 0);
  // Against the week before, in the reader's unit, rounded the way it's shown
  // — so "+0.00" never appears for a change too small to see.
  const change = before ? Number(formatDistanceValue(read.metres - before.metres, lengthUnit)) : 0;

  const recordTiles = [
    ...(activity === "run"
      ? RECORD_KEYS[unit]
          .filter((key) => records.best[key] != null)
          .map((key) => ({
            key,
            label: BEST_EFFORTS.find((e) => e.key === key)!.label,
            value: formatClock(records.best[key]!),
            date: records.bestOn[key],
          }))
      : []),
    ...(records.longest
      ? [
          {
            key: "longest",
            label: `Longest ${label.one.toLowerCase()}`,
            value: show(records.longest.metres),
            date: records.longest.date,
          },
        ]
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
          <View style={styles.heroTop}>
            <Text style={styles.heroValue} maxFontSizeMultiplier={FontScaleCap.title}>
              {show(read.metres).split(" ")[0]}
              <Text style={styles.heroUnit}> {lengthUnit}</Text>
            </Text>
            {change !== 0 && (
              <View
                style={styles.change}
                accessible
                accessibilityLabel={`${change > 0 ? "Up" : "Down"} ${Math.abs(change)} ${lengthUnit} on the week before`}>
                <Ionicons
                  name={change > 0 ? "arrow-up" : "arrow-down"}
                  size={12}
                  // Up is good news and says so; down is just a fact, not a
                  // telling-off, so it stays in ink.
                  color={change > 0 ? palette.success : palette.textTertiary}
                />
                <Text style={styles.changeText} maxFontSizeMultiplier={FontScaleCap.grid}>
                  {Math.abs(change)} {lengthUnit}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.heroLabel}>
            {isThisWeek ? "this week" : `week of ${shortDate(read.weekStart)}`}
            {inWeek.length > 0
              ? ` · ${inWeek.length} ${inWeek.length === 1 ? label.one.toLowerCase() : label.many}` +
                (weekSeconds > 0 ? ` · ${formatClock(weekSeconds)}` : "")
              : ""}
          </Text>
        </View>

        <WeekColumns
          weeks={weeks}
          selected={readIndex}
          onSelect={setSelectedWeek}
          format={(metres) => formatDistanceValue(metres, lengthUnit)}
          describe={(w) => `Week of ${w.weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric" })}, ${show(w.metres)}`}
          firstLabel={shortDate(weeks[0].weekStart)}
        />

        {recordTiles.length > 0 && (
          <View style={styles.records}>
            <Text style={styles.recordsHeading} maxFontSizeMultiplier={FontScaleCap.grid}>
              Records
            </Text>
            <View style={styles.recordGrid}>
              {recordTiles.map((tile) => (
                <View key={tile.key} style={styles.recordTile}>
                  <View style={styles.recordLabelRow}>
                    <Ionicons name="trophy" size={11} color={palette.amber} />
                    <Text style={styles.recordLabel} numberOfLines={1}>
                      {tile.label}
                    </Text>
                  </View>
                  <Text style={styles.recordValue} maxFontSizeMultiplier={FontScaleCap.title}>
                    {tile.value}
                  </Text>
                  {tile.date && <Text style={styles.recordDate}>{shortDate(tile.date)}</Text>}
                </View>
              ))}
            </View>
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
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  heroValue: {
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1.4,
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
  heroUnit: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0,
    color: c.textTertiary,
  },
  heroLabel: {
    fontSize: 13,
    color: c.textTertiary,
  },
  change: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: c.surfaceRaised,
  },
  changeText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.textSecondary,
    fontVariant: ["tabular-nums"],
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
  recordGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  // Two to a row: a record is a number worth seeing big, and a list of label
  // and value lines read like a receipt.
  recordTile: {
    flexBasis: "48%",
    flexGrow: 1,
    gap: 2,
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: c.surfaceRaised,
  },
  recordLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  recordLabel: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: c.textTertiary,
  },
  recordValue: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
  recordDate: {
    fontSize: 11,
    color: c.textTertiary,
  },
}));
