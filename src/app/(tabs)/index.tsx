import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button, Card, EmptyState, SectionLabel } from "@/components/ui";
import { FontScaleCap, Palette, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useWorkouts } from "@/hooks/use-workouts";
import {
  createWorkoutLocalFirst,
  deleteWorkout,
  startFromTemplate,
  stripUndefined,
} from "@/lib/data";
import { useWeightUnit } from "@/context/UnitContext";
import { useTheme } from "@/context/ThemeContext";
import {
  addDays,
  completedSetCount,
  displayVolume,
  MAX_ACTIVE_WORKOUTS,
  MAX_TEMPLATES,
  relativeDay,
  sameDay,
  startOfDay,
  startOfWeek,
  totalSetCount,
  workoutDay,
  workoutVolumeLbs,
} from "@/lib/workout-utils";
import { useWeeklyPlan } from "@/hooks/use-weekly-plan";
import type { Workout } from "@/types";

// Bottom-sheet template picker. Alerts cap out fast with many templates — this
// scrolls, shows exercise counts, and marks the current choice.
type PickerOption = {
  key: string;
  label: string;
  hint?: string;
  active?: boolean;
  onPress: () => void;
};
type PickerConfig = { title: string; subtitle?: string; options: PickerOption[] };

export default function WorkoutsScreen() {
  const theme = useTheme();
  const router = useRouter();
  // `user` only drives the greeting — guests have no account, so it falls back.
  const { user, dataUserId } = useAuth();
  const { loading, error, active, planned, completed, templates } = useWorkouts();
  const { plan, assignDay } = useWeeklyPlan();
  const [starting, setStarting] = useState(false);
  const [picker, setPicker] = useState<PickerConfig | null>(null);

  // Quick lookup so weekday → template resolves by id, and stale ids (deleted
  // templates) simply resolve to nothing.
  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const templateForDay = (day: Date) => {
    const id = plan[day.getDay()];
    return id ? templateById.get(id) : undefined;
  };

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

  /**
   * The workout we are in the middle of opening, hidden from this screen for
   * as long as the push takes to cover it.
   *
   * Creating one updates Firestore's cache immediately, but pushing the workout
   * screen takes an animation to cover this list — so the new row and its
   * calendar dot appear underneath the incoming screen and are visible for the
   * length of the transition. Navigating before the write lands (see
   * createWorkoutLocalFirst) shortened that; it did not remove it, because the
   * cache was never what we were waiting for.
   *
   * Revealed on a timer, which reads as the wrong tool until you ask what the
   * alternative is timing against. Waiting for this screen to be focused again
   * was the first attempt, and it holds the row back the entire time the
   * workout is open — including while a back-swipe is dragging this list into
   * view, so the row was missing during the swipe and appeared once it
   * finished. The window we actually need to cover is one animation, and it
   * ends long before anyone looks at this list again.
   */
  const [openingId, setOpeningId] = useState<string | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openNewWorkout(id: string) {
    setOpeningId(id);
    router.push(`/workout/${id}`);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    // Comfortably past the end of the push, and far short of the time it takes
    // to open a workout and swipe back out of it.
    revealTimer.current = setTimeout(() => setOpeningId(null), 500);
  }

  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);

  // Backstop. However the timer fared, this list is whole by the time it is on
  // top again — a row that stayed hidden would look like a lost workout.
  useFocusEffect(
    useCallback(() => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
      setOpeningId(null);
    }, [])
  );

  // Same suppression for the templates list. The cap checks deliberately keep
  // counting `templates`, since the one being opened does exist.
  const visibleTemplates = useMemo(
    () => templates.filter((t) => t.id !== openingId),
    [templates, openingId]
  );

  // And for In progress, which lists the same workouts the calendar does. This
  // one was missed, so starting a workout flashed it here even while the
  // calendar below correctly held it back.
  const visibleActive = useMemo(
    () => active.filter((w) => w.id !== openingId),
    [active, openingId]
  );

  // Everything except templates has a home on the calendar.
  const dated = useMemo(
    () => [...active, ...planned, ...completed].filter((w) => w.id !== openingId),
    [active, planned, completed, openingId]
  );
  const dayWorkouts = useMemo(
    () =>
      dated
        .filter((w) => sameDay(workoutDay(w), selectedDay))
        .sort((a, b) => workoutDay(a).getTime() - workoutDay(b).getTime()),
    [dated, selectedDay]
  );
  // The weekly-split template for the selected day, shown as a ghost suggestion
  // only when nothing real is on that day yet.
  const daySuggestion = dayWorkouts.length === 0 ? templateForDay(selectedDay) : undefined;

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

  // Guard the "start now" paths so abandoned live sessions can't pile up.
  function atActiveLimit() {
    if (active.length >= MAX_ACTIVE_WORKOUTS) {
      Alert.alert(
        "Too many workouts in progress",
        `Finish or delete one of your ${MAX_ACTIVE_WORKOUTS} in-progress workouts before starting another.`
      );
      return true;
    }
    return false;
  }

  function quickStart() {
    if (!dataUserId || starting || atActiveLimit()) return;
    setStarting(true);
    const { id, saved } = createWorkoutLocalFirst(
      stripUndefined({
        userId: dataUserId,
        name: defaultWorkoutName(),
        isTemplate: false,
        exercises: [],
        createdAt: new Date(),
        startedAt: new Date(),
      })
    );
    openNewWorkout(id);
    saved
      .catch(() => Alert.alert("Couldn't start workout", "Check your connection and try again."))
      .finally(() => setStarting(false));
  }

  /**
   * Whether creating a workout for this day should open it.
   *
   * Planning ahead is done the moment the workout lands on the calendar —
   * opening it interrupts someone who is laying out a week and has four more
   * days to fill. Today and past days are the opposite: today's is about to be
   * lifted, and a past one is being written up from memory, so both want the
   * sets in front of them straight away.
   *
   * Derived from the day rather than passed in by each caller. It used to be a
   * `navigate` argument, and the two callers that planned from the picker both
   * defaulted it to true — so planning next Tuesday from there opened it anyway.
   */
  const opensOnCreate = (day: Date) => day.getTime() <= today.getTime();

  function planEmpty(day: Date) {
    if (!dataUserId || starting) return;
    setStarting(true);
    const { id, saved } = createWorkoutLocalFirst(
      stripUndefined({
        userId: dataUserId,
        name: `${day.toLocaleDateString(undefined, { weekday: "long" })} Workout`,
        isTemplate: false,
        exercises: [],
        createdAt: new Date(),
        scheduledFor: day,
      })
    );
    if (opensOnCreate(day)) openNewWorkout(id);
    saved
      .catch(() => Alert.alert("Couldn't plan workout", "Check your connection and try again."))
      .finally(() => setStarting(false));
  }

  function planFromTemplate(template: Workout, day: Date) {
    if (!dataUserId || starting) return;
    // Navigate on the id rather than on the write. Waiting for the server first
    // leaves this list on screen with the new workout already in it, which
    // reads as the workout appearing under today a beat before the screen opens.
    setStarting(true);
    const { id, saved } = startFromTemplate(template, dataUserId, day);
    if (opensOnCreate(day)) openNewWorkout(id);
    saved
      .catch(() => Alert.alert("Couldn't plan workout", "Check your connection and try again."))
      .finally(() => setStarting(false));
  }

  function planWorkout(day: Date) {
    if (templates.length === 0) {
      planEmpty(day);
      return;
    }
    const isPast = day.getTime() < today.getTime();
    setPicker({
      title: `${isPast ? "Log for" : "Plan for"} ${relativeDay(day)}`,
      subtitle: "Start from scratch or use a template.",
      options: [
        { key: "empty", label: "Empty workout", onPress: () => planEmpty(day) },
        ...templates.map((t) => ({
          key: t.id,
          label: t.name,
          hint: templateMeta(t),
          onPress: () => planFromTemplate(t, day),
        })),
      ],
    });
  }

  function beginTemplate(template: Workout) {
    if (!dataUserId || starting || atActiveLimit()) return;
    setStarting(true);
    const { id, saved } = startFromTemplate(template, dataUserId);
    openNewWorkout(id);
    saved
      .catch(() => Alert.alert("Couldn't start workout", "Check your connection and try again."))
      .finally(() => setStarting(false));
  }

  function newTemplate() {
    if (!dataUserId) return;
    if (templates.length >= MAX_TEMPLATES) {
      Alert.alert(
        "Template limit reached",
        `You can keep up to ${MAX_TEMPLATES} templates. Delete one you no longer use to make room.`
      );
      return;
    }
    const { id, saved } = createWorkoutLocalFirst(
      stripUndefined({
        userId: dataUserId,
        name: "New template",
        isTemplate: true,
        exercises: [],
        createdAt: new Date(),
      }) as Omit<Workout, "id">
    );
    openNewWorkout(id);
    saved.catch(() =>
      Alert.alert("Couldn't create template", "Check your connection and try again.")
    );
  }

  // Turn a weekly-split suggestion into a real workout for the selected day,
  // following the same start-today / plan-ahead / log-past rule as templates.
  function materializeSplit(template: Workout) {
    if (selectedIsToday) beginTemplate(template);
    else planFromTemplate(template, selectedDay);
  }

  function editSplitDay(day: Date) {
    const weekday = day.getDay();
    if (templates.length === 0) {
      Alert.alert("No templates yet", "Create a template first, then assign it to a day.");
      return;
    }
    setPicker({
      title: day.toLocaleDateString(undefined, { weekday: "long" }),
      subtitle: "Pick a template for this day, or set it as rest.",
      options: [
        {
          key: "rest",
          label: "Rest (no workout)",
          active: plan[weekday] == null,
          onPress: () => assignDay(weekday, null),
        },
        ...templates.map((t) => ({
          key: t.id,
          label: t.name,
          hint: templateMeta(t),
          active: plan[weekday] === t.id,
          onPress: () => assignDay(weekday, t.id),
        })),
      ],
    });
  }

  function templateMeta(t: Workout): string {
    return `${t.exercises.length} exercise${t.exercises.length === 1 ? "" : "s"} · ${totalSetCount(t)} sets`;
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
                    isSelected && { backgroundColor: theme.accent },
                  ]}>
                  {/* Seven columns share one row, so the date text caps like the
                      set grid does — past that it wraps out of its own cell. */}
                  <Text
                    style={[styles.dayName, isSelected && { color: theme.onAccent }]}
                    maxFontSizeMultiplier={FontScaleCap.grid}>
                    {day.toLocaleDateString(undefined, { weekday: "narrow" })}
                  </Text>
                  <Text
                    style={[
                      styles.dayNum,
                      isToday && !isSelected && { color: theme.accentText },
                      isSelected && { color: theme.onAccent },
                    ]}
                    maxFontSizeMultiplier={FontScaleCap.grid}>
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
                              : [styles.dotPlanned, { borderColor: theme.accentText }],
                        ]}
                      />
                    ))}
                    {/* Hollow dot marks a day the weekly split suggests but that
                        has no real workout yet. */}
                    {dayItems.length === 0 && templateForDay(day) && <View style={styles.dotGhost} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* ── Selected day ── */}
          <View style={styles.dayPanel}>
            <Text style={styles.dayPanelTitle}>{relativeDay(selectedDay)}</Text>

            {dayWorkouts.length === 0 &&
              (daySuggestion ? (
                <Pressable
                  style={[
                    styles.ghostRow,
                    { backgroundColor: theme.accentSoft, borderColor: theme.accent },
                  ]}
                  onPress={() => materializeSplit(daySuggestion)}>
                  <View style={styles.ghostBadge}>
                    <Ionicons name="repeat" size={15} color={theme.accentText} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowTitle}>{daySuggestion.name}</Text>
                    <Text style={styles.rowMeta}>
                      From your weekly split · {totalSetCount(daySuggestion)} sets
                    </Text>
                  </View>
                  <Text style={[styles.ghostAction, { color: theme.accentText }]}>
                    {selectedIsToday ? "Start" : selectedIsFuture ? "Plan" : "Log"}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.dayPanelEmpty}>
                  {selectedIsFuture
                    ? "Nothing planned yet."
                    : selectedIsToday
                      ? "Nothing logged today."
                      : "Rest day."}
                </Text>
              ))}
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

        {loading && <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.five }} />}
        {error && !loading && <EmptyState title="Couldn't load workouts" message={error} />}

        {visibleActive.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>In progress</SectionLabel>
            {visibleActive.map((w) => (
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
                  <Text style={[styles.sectionAction, { color: theme.accentText }]}>Reorder</Text>
                </Pressable>
              )}
              <Pressable onPress={newTemplate} hitSlop={8}>
                <Text style={[styles.sectionAction, { color: theme.accentText }]}>+ New</Text>
              </Pressable>
            </View>
          </View>
          {visibleTemplates.length === 0 ? (
            <Text style={styles.templateEmpty}>
              Build a reusable workout structure, or save one from a finished workout.
            </Text>
          ) : (
            visibleTemplates.map((t) => (
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
                <Button
                  // The action follows the selected day: start now if it's today,
                  // schedule ahead if it's future, or log onto a past day.
                  title={selectedIsToday ? "Start" : selectedIsFuture ? "Plan" : "Log"}
                  variant="secondary"
                  compact
                  onPress={() =>
                    selectedIsToday
                      ? beginTemplate(t)
                      : planFromTemplate(t, selectedDay)
                  }
                />
              </Card>
            ))
          )}
        </View>

        {/* ── Weekly split: a recurring template per weekday, suggested on the
            calendar above. Sits below Templates since those get daily use. ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SectionLabel>Weekly split</SectionLabel>
            <Text style={styles.splitHint}>Repeats every week</Text>
          </View>
          <Card style={styles.splitCard}>
            {weekDays.map((day, i) => {
              const t = templateForDay(day);
              return (
                <Pressable
                  key={day.getDay()}
                  onPress={() => editSplitDay(day)}
                  style={[styles.splitRow, i > 0 && styles.splitRowBorder]}>
                  <Text style={styles.splitDay}>
                    {day.toLocaleDateString(undefined, { weekday: "long" })}
                  </Text>
                  <Text style={[styles.splitTemplate, !t && styles.splitRest]} numberOfLines={1}>
                    {t ? t.name : "Rest"}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={Palette.textTertiary} />
                </Pressable>
              );
            })}
          </Card>
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
                  <Ionicons name="time-outline" size={20} color={theme.accentText} />
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

      {/* Template picker sheet — scrolls, so any number of templates fits. */}
      <Modal
        visible={picker != null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPicker(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{picker?.title}</Text>
          {picker?.subtitle ? <Text style={styles.sheetSubtitle}>{picker.subtitle}</Text> : null}
          <ScrollView contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator>
            {picker?.options.map((o) => (
              <Pressable
                key={o.key}
                style={[
                  styles.sheetOption,
                  o.active && { backgroundColor: theme.accentSoft, borderColor: theme.accent },
                ]}
                onPress={() => {
                  setPicker(null);
                  o.onPress();
                }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.sheetOptionLabel, o.active && { color: theme.accentText }]}>
                    {o.label}
                  </Text>
                  {o.hint ? <Text style={styles.sheetOptionHint}>{o.hint}</Text> : null}
                </View>
                {o.active && <Ionicons name="checkmark" size={18} color={theme.accentText} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
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
  const theme = useTheme();
  const volume = workout.totalVolume ?? workoutVolumeLbs(workout);
  const done = completedSetCount(workout);
  const total = totalSetCount(workout);
  const isLive = !!workout.startedAt && !workout.completedAt;
  const isPlanned = !workout.startedAt && !workout.completedAt;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      {({ pressed }) => (
        <Card
          style={[
            styles.workoutRow,
            isLive && { borderColor: theme.accent, backgroundColor: theme.accentSoft },
            pressed && { opacity: 0.8 },
          ]}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.rowTitle}>{workout.name}</Text>
            <Text style={styles.rowMeta}>
              {relativeDay(workoutDay(workout))}
              {workout.exercises.length > 0 && ` · ${workout.exercises.length} exercise${workout.exercises.length === 1 ? "" : "s"}`}
              {total > 0 && !isPlanned && ` · ${done}/${total} sets`}
              {total > 0 && isPlanned && ` · ${total} sets planned`}
            </Text>
          </View>
          {isPlanned ? (
            <View style={[styles.plannedBadge, { backgroundColor: theme.accentSoft }]}>
              <Text style={[styles.plannedText, { color: theme.accentText }]}>PLANNED</Text>
            </View>
          ) : volume > 0 ? (
            <Text style={[styles.volume, { color: theme.accentText }]}>{displayVolume(volume, unit)}</Text>
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
  },
  dotGhost: {
    width: 5,
    height: 5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Palette.textTertiary,
  },
  ghostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  ghostBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostAction: {
    fontSize: 14,
    fontWeight: "700",
  },
  splitHint: {
    fontSize: 12,
    color: Palette.textTertiary,
  },
  splitCard: {
    paddingVertical: 0,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  splitRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  splitDay: {
    width: 88,
    fontSize: 14,
    fontWeight: "600",
    color: Palette.textSecondary,
  },
  splitTemplate: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Palette.text,
  },
  splitRest: {
    color: Palette.textTertiary,
    fontWeight: "500",
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
    fontVariant: ["tabular-nums"],
  },
  plannedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  plannedText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Palette.border,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    // Clears the home indicator; the list scrolls once it outgrows the sheet.
    paddingBottom: Spacing.five,
    maxHeight: "70%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Palette.border,
    marginBottom: Spacing.two,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Palette.textTertiary,
    marginTop: 2,
  },
  sheetList: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  sheetOptionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: Palette.text,
  },
  sheetOptionHint: {
    fontSize: 12,
    color: Palette.textTertiary,
  },
});
