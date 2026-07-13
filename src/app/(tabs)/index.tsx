import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button, Card, EmptyState, SectionLabel } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useWorkouts } from "@/hooks/use-workouts";
import { createWorkout, deleteWorkout, startFromTemplate, stripUndefined } from "@/lib/firestore";
import { useWeightUnit } from "@/context/UnitContext";
import {
  addDays,
  completedSetCount,
  displayVolume,
  MAX_TEMPLATES,
  relativeDay,
  sameDay,
  startOfDay,
  startOfWeek,
  totalSetCount,
  workoutDay,
  workoutVolumeLbs,
} from "@/lib/workout-utils";
import type { Workout } from "@/types";

export default function WorkoutsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { loading, error, active, planned, completed, templates } = useWorkouts();
  const [starting, setStarting] = useState(false);

  // 0 = this week; −1 last week; +1 next week. Any offset works — chevrons
  // just walk the calendar, so all history stays reachable from the strip too.
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));

  const today = startOfDay(new Date());
  const weekStart = addDays(startOfWeek(today), weekOffset * 7);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart.getTime()]
  );

  // Everything except templates has a home on the calendar.
  const dated = useMemo(() => [...active, ...planned, ...completed], [active, planned, completed]);
  const dayWorkouts = useMemo(
    () =>
      dated
        .filter((w) => sameDay(workoutDay(w), selectedDay))
        .sort((a, b) => workoutDay(a).getTime() - workoutDay(b).getTime()),
    [dated, selectedDay]
  );

  function shiftWeek(delta: number) {
    const next = weekOffset + delta;
    setWeekOffset(next);
    // Keep the selection inside the visible week (same weekday).
    const dow = (selectedDay.getDay() + 6) % 7;
    setSelectedDay(addDays(addDays(startOfWeek(today), next * 7), dow));
  }

  function resetToToday() {
    setWeekOffset(0);
    setSelectedDay(today);
  }

  async function quickStart() {
    if (!user || starting) return;
    setStarting(true);
    try {
      const id = await createWorkout(
        stripUndefined({
          userId: user.uid,
          name: defaultWorkoutName(),
          isTemplate: false,
          exercises: [],
          createdAt: new Date(),
          startedAt: new Date(),
        })
      );
      router.push(`/workout/${id}`);
    } catch {
      Alert.alert("Couldn't start workout", "Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  async function planEmpty(day: Date) {
    if (!user || starting) return;
    setStarting(true);
    try {
      const id = await createWorkout(
        stripUndefined({
          userId: user.uid,
          name: `${day.toLocaleDateString(undefined, { weekday: "long" })} Workout`,
          isTemplate: false,
          exercises: [],
          createdAt: new Date(),
          scheduledFor: day,
        })
      );
      router.push(`/workout/${id}`);
    } catch {
      Alert.alert("Couldn't plan workout", "Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  async function planFromTemplate(template: Workout, day: Date) {
    if (!user || starting) return;
    setStarting(true);
    try {
      const id = await startFromTemplate(template, user.uid, day);
      router.push(`/workout/${id}`);
    } catch {
      Alert.alert("Couldn't plan workout", "Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  function planWorkout(day: Date) {
    if (templates.length === 0) {
      planEmpty(day);
      return;
    }
    const isPast = day.getTime() < today.getTime();
    Alert.alert(
      `${isPast ? "Log for" : "Plan for"} ${relativeDay(day)}`,
      "Start from scratch or use a template.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Empty workout", onPress: () => planEmpty(day) },
        ...templates.map((t) => ({ text: t.name, onPress: () => planFromTemplate(t, day) })),
      ]
    );
  }

  async function beginTemplate(template: Workout) {
    if (!user || starting) return;
    setStarting(true);
    try {
      const id = await startFromTemplate(template, user.uid);
      router.push(`/workout/${id}`);
    } catch {
      Alert.alert("Couldn't start workout", "Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  async function newTemplate() {
    if (!user) return;
    if (templates.length >= MAX_TEMPLATES) {
      Alert.alert(
        "Template limit reached",
        `You can keep up to ${MAX_TEMPLATES} templates. Delete one you no longer use to make room.`
      );
      return;
    }
    try {
      const id = await createWorkout(
        stripUndefined({
          userId: user.uid,
          name: "New template",
          isTemplate: true,
          exercises: [],
          createdAt: new Date(),
        }) as Omit<Workout, "id">
      );
      router.push(`/workout/${id}`);
    } catch {
      Alert.alert("Couldn't create template", "Check your connection and try again.");
    }
  }

  function confirmDelete(workout: Workout) {
    Alert.alert(
      workout.isTemplate ? "Delete template?" : "Delete workout?",
      `"${workout.name}" will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteWorkout(workout) },
      ]
    );
  }

  const firstName = user?.displayName?.split(" ")[0];
  const selectedIsToday = sameDay(selectedDay, today);
  const selectedIsFuture = selectedDay.getTime() > today.getTime();
  const weekLabel =
    weekOffset === 0
      ? "This week"
      : weekOffset === -1
        ? "Last week"
        : weekOffset === 1
          ? "Next week"
          : `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.greeting}>{firstName ? `Hey ${firstName}` : "Workouts"}</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </Text>
        </View>

        {/* ── Week strip ── */}
        <View style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <Pressable onPress={() => shiftWeek(-1)} hitSlop={10} style={styles.weekArrow}>
              <Ionicons name="chevron-back" size={18} color={Palette.textSecondary} />
            </Pressable>
            <Pressable onPress={resetToToday} hitSlop={8}>
              <Text style={styles.weekLabel}>{weekLabel}</Text>
            </Pressable>
            <Pressable onPress={() => shiftWeek(1)} hitSlop={10} style={styles.weekArrow}>
              <Ionicons name="chevron-forward" size={18} color={Palette.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.dayRow}>
            {weekDays.map((day) => {
              const isToday = sameDay(day, today);
              const isSelected = sameDay(day, selectedDay);
              const dayItems = dated.filter((w) => sameDay(workoutDay(w), day));
              // A finished workout gets a green box + glow so completed days read
              // at a glance, not just from the small dot. The selected day keeps
              // its accent highlight instead.
              const hasDone = dayItems.some((w) => w.completedAt);
              return (
                <Pressable
                  key={day.getTime()}
                  onPress={() => setSelectedDay(day)}
                  style={[
                    styles.dayCell,
                    hasDone && !isSelected && styles.dayCellDone,
                    isSelected && styles.dayCellSelected,
                  ]}>
                  <Text style={[styles.dayName, isSelected && styles.dayTextSelected]}>
                    {day.toLocaleDateString(undefined, { weekday: "narrow" })}
                  </Text>
                  <Text
                    style={[
                      styles.dayNum,
                      isToday && !isSelected && styles.dayNumToday,
                      isSelected && styles.dayTextSelected,
                    ]}>
                    {day.getDate()}
                  </Text>
                  <View style={styles.dotRow}>
                    {dayItems.slice(0, 3).map((w) => (
                      <View
                        key={w.id}
                        style={[
                          styles.dot,
                          w.completedAt
                            ? styles.dotDone
                            : w.startedAt
                              ? styles.dotLive
                              : styles.dotPlanned,
                        ]}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* ── Selected day ── */}
          <View style={styles.dayPanel}>
            <Text style={styles.dayPanelTitle}>{relativeDay(selectedDay)}</Text>

            {dayWorkouts.length === 0 && (
              <Text style={styles.dayPanelEmpty}>
                {selectedIsFuture
                  ? "Nothing planned yet."
                  : selectedIsToday
                    ? "Nothing logged today."
                    : "Rest day."}
              </Text>
            )}
            {dayWorkouts.map((w) => (
              <WorkoutRow
                key={w.id}
                workout={w}
                onPress={() => router.push(`/workout/${w.id}`)}
                onLongPress={() => confirmDelete(w)}
              />
            ))}

            {selectedIsToday && (
              <Button title="Start empty workout" onPress={quickStart} loading={starting} />
            )}
            {selectedIsFuture && (
              <Button
                title={`Plan for ${relativeDay(selectedDay)}`}
                variant="secondary"
                onPress={() => planWorkout(selectedDay)}
                loading={starting}
              />
            )}
            {!selectedIsToday && !selectedIsFuture && (
              <Button
                title={`Log for ${relativeDay(selectedDay)}`}
                variant="secondary"
                onPress={() => planWorkout(selectedDay)}
                loading={starting}
              />
            )}
          </View>
        </View>

        {loading && <ActivityIndicator color={Palette.accent} style={{ marginTop: Spacing.five }} />}
        {error && !loading && <EmptyState title="Couldn't load workouts" message={error} />}

        {active.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>In progress</SectionLabel>
            {active.map((w) => (
              <WorkoutRow key={w.id} workout={w}
                onPress={() => router.push(`/workout/${w.id}`)}
                onLongPress={() => confirmDelete(w)} />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SectionLabel>Templates</SectionLabel>
            <View style={styles.sectionActions}>
              {templates.length > 1 && (
                <Pressable onPress={() => router.push("/reorder-templates")} hitSlop={8}>
                  <Text style={styles.sectionAction}>Reorder</Text>
                </Pressable>
              )}
              <Pressable onPress={newTemplate} hitSlop={8}>
                <Text style={styles.sectionAction}>+ New</Text>
              </Pressable>
            </View>
          </View>
          {templates.length === 0 ? (
            <Text style={styles.templateEmpty}>
              Build a reusable workout structure, or save one from a finished workout.
            </Text>
          ) : (
            templates.map((t) => (
              <Card key={t.id} style={styles.templateRow}>
                <Pressable
                  style={styles.templateInfo}
                  onPress={() => router.push(`/workout/${t.id}`)}
                  onLongPress={() => confirmDelete(t)}>
                  <Text style={styles.rowTitle}>{t.name}</Text>
                  <Text style={styles.rowMeta}>
                    {t.exercises.length} exercise{t.exercises.length === 1 ? "" : "s"} · {totalSetCount(t)} sets
                  </Text>
                </Pressable>
                <Button title="Start" variant="secondary" compact onPress={() => beginTemplate(t)} />
              </Card>
            ))
          )}
        </View>

        <View style={styles.section}>
          <SectionLabel>History</SectionLabel>
          {!loading && completed.length === 0 ? (
            <EmptyState
              title="No workouts yet"
              message="Start an empty workout above and log your first sets."
            />
          ) : (
            <Pressable onPress={() => router.push("/history")}>
              {({ pressed }) => (
                <Card style={[styles.historyLink, pressed && { opacity: 0.8 }]}>
                  <Ionicons name="time-outline" size={20} color={Palette.accentText} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowTitle}>Full history</Text>
                    <Text style={styles.rowMeta}>
                      {completed.length} workout{completed.length === 1 ? "" : "s"}, kept forever
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Palette.textTertiary} />
                </Card>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function WorkoutRow({
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
  const done = completedSetCount(workout);
  const total = totalSetCount(workout);
  const isLive = !!workout.startedAt && !workout.completedAt;
  const isPlanned = !workout.startedAt && !workout.completedAt;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      {({ pressed }) => (
        <Card style={[styles.workoutRow, isLive && styles.workoutRowActive, pressed && { opacity: 0.8 }]}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.rowTitle}>{workout.name}</Text>
            <Text style={styles.rowMeta}>
              {relativeDay(workoutDay(workout))}
              {workout.exercises.length > 0 && ` · ${workout.exercises.length} exercise${workout.exercises.length === 1 ? "" : "s"}`}
              {total > 0 && !isPlanned && ` · ${done}/${total} sets`}
              {total > 0 && isPlanned && ` · ${total} sets planned`}
            </Text>
          </View>
          {isLive ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : isPlanned ? (
            <View style={styles.plannedBadge}>
              <Text style={styles.plannedText}>PLANNED</Text>
            </View>
          ) : volume > 0 ? (
            <Text style={styles.volume}>{displayVolume(volume, unit)}</Text>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={Palette.textTertiary} />
          )}
        </Card>
      )}
    </Pressable>
  );
}

function defaultWorkoutName(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Morning Workout";
  if (hour < 17) return "Afternoon Workout";
  return "Evening Workout";
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
  greeting: {
    fontSize: 28,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 14,
    color: Palette.textTertiary,
  },
  weekCard: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekArrow: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  weekLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  dayRow: {
    flexDirection: "row",
    gap: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: Spacing.two,
    borderRadius: Radius.sm,
    // Transparent border on every cell so the completed-day border below doesn't
    // nudge the layout when it appears.
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayCellDone: {
    backgroundColor: Palette.successSoft,
    borderColor: "rgba(52,211,153,0.4)",
    // Soft green halo (iOS) so a finished day glows rather than just tinting.
    shadowColor: Palette.success,
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    // Android has no shadow spread, so the tint + border carry it there.
    elevation: 3,
  },
  dayCellSelected: {
    backgroundColor: Palette.accent,
  },
  dayName: {
    fontSize: 11,
    fontWeight: "600",
    color: Palette.textTertiary,
  },
  dayNum: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
    fontVariant: ["tabular-nums"],
  },
  dayNumToday: {
    color: Palette.accentText,
  },
  dayTextSelected: {
    color: "#fff",
  },
  dotRow: {
    flexDirection: "row",
    gap: 3,
    height: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dotDone: {
    backgroundColor: Palette.success,
  },
  dotLive: {
    backgroundColor: Palette.amber,
  },
  dotPlanned: {
    borderWidth: 1,
    borderColor: Palette.accentText,
  },
  dayPanel: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.three,
  },
  dayPanelTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dayPanelEmpty: {
    fontSize: 13,
    color: Palette.textTertiary,
    paddingVertical: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.accentText,
  },
  templateEmpty: {
    fontSize: 13,
    color: Palette.textTertiary,
    lineHeight: 19,
  },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  workoutRowActive: {
    borderColor: Palette.accent,
    backgroundColor: Palette.accentSoft,
  },
  templateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  templateInfo: {
    flex: 1,
    gap: 3,
  },
  historyLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
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
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.success,
  },
  liveText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: Palette.success,
  },
  plannedBadge: {
    backgroundColor: Palette.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  plannedText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: Palette.accentText,
  },
});
