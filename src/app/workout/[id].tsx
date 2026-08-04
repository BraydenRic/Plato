import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type ErrorBoundaryProps,
} from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button, Card, EmptyState } from "@/components/ui";
import { FontScaleCap, Palette, Radius, Spacing } from "@/constants/theme";
import { getWorkout, getCompletedWorkouts, reopenWorkout, saveAsTemplate, stripUndefined, subscribeWorkout, updateWorkout, upsertUserStats, computeStats, deleteWorkout } from "@/lib/data";
import { useWorkouts } from "@/hooks/use-workouts";
import { isBodyweightExercise, isTimedExercise } from "@/lib/exercises";
import { useRestTimer } from "@/context/RestTimerContext";
import { useBodyweight } from "@/hooks/use-bodyweight";
import { useSetTimer } from "@/context/SetTimerContext";
import { useWeightUnit } from "@/context/UnitContext";
import { useTheme } from "@/context/ThemeContext";
import { bodyweightOn, formatBodyweightLoad, convertWeight, displayVolume, formatClock, liveSetSeconds, newId, previousSetsByExercise, relativeDay, sameDay, startOfDay, workoutVolumeLbs, completedSetCount, totalSetCount, MAX_TEMPLATES, MAX_ACTIVE_WORKOUTS } from "@/lib/workout-utils";
import type { Workout, WorkoutExercise, WorkoutSet } from "@/types";


const fieldKey = (setId: string, field: "weight" | "reps" | "duration") => `${setId}:${field}`;

// "1:30" → 90, "45" → 45 seconds. Undefined for blank/garbage input.
function parseDurationText(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (t.includes(":")) {
    const [m, s] = t.split(":");
    const mins = Number(m);
    const secs = Number(s);
    if (!Number.isFinite(mins) || !Number.isFinite(secs)) return undefined;
    return Math.max(0, Math.round(mins * 60 + secs));
  }
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : undefined;
}

// A render error here used to hard-crash the whole app. Show the actual error
// instead — recoverable for the user, and the message pinpoints the bug for us.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView style={[styles.safe, { padding: Spacing.three, justifyContent: "center", gap: Spacing.three }]}>
      <Text style={{ fontSize: 20, fontWeight: "800", color: Palette.text, textAlign: "center" }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 13, color: Palette.textSecondary, textAlign: "center" }} selectable>
        {error.message}
      </Text>
      <Button title="Try again" variant="secondary" onPress={retry} />
    </SafeAreaView>
  );
}

export default function WorkoutScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const { restSeconds, rest, startRest, extendRest, endRest } = useRestTimer();
  const { log: bodyweightLog } = useBodyweight();
  // Only this workout's rest. A rest outlives the screen by design, so without
  // this the next workout would inherit the last one's countdown.
  const restEndsAt = rest?.workoutId === id ? rest.endsAt : null;
  const [restLeft, setRestLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const { unit: weightUnit } = useWeightUnit();
  // The one set stopwatch that can run at a time (timed exercises). It's held
  // above the navigator so leaving this screen doesn't cancel it; scope it to
  // this workout so another workout's timer never drives these rows.
  const { timer, startTimer, clearTimer } = useSetTimer();
  const timing = timer && timer.workoutId === id ? timer : null;

  // Registry of the live set inputs (keyed by set id + field) plus which one is
  // focused, so the keyboard's "Next" button can advance to the following field.
  const inputRefs = useRef(new Map<string, TextInput>());
  const focusedField = useRef<string | null>(null);
  // Drives the Done/Next bar pinned above the numeric keypad. It's a plain view
  // (not InputAccessoryView, which doesn't render on the new architecture) so it
  // only appears while a set input is focused.
  const [keypadOpen, setKeypadOpen] = useState(false);
  // Whether the keyboard is up at all, by any route — including the name field,
  // which deliberately keeps the keypad bar closed. Used only to keep the footer
  // away from the keyboard; see where it is read.
  const [keyboardUp, setKeyboardUp] = useState(false);
  // Whether a field actually took focus, as opposed to merely being pressed.
  // The watchdog below leans on this to tell a cancelled press apart from a
  // keyboard that is only slow to arrive.
  const keypadConfirmed = useRef(false);
  const registerInput = (key: string, node: TextInput | null) => {
    if (node) inputRefs.current.set(key, node);
    else inputRefs.current.delete(key);
  };

  // The bar hides whenever the keyboard goes away, however it was dismissed.
  useEffect(() => {
    const event = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const sub = Keyboard.addListener(event, () => {
      keypadConfirmed.current = false;
      setKeypadOpen(false);
      setKeyboardUp(false);
    });
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const shown = Keyboard.addListener(showEvent, () => setKeyboardUp(true));
    return () => {
      sub.remove();
      shown.remove();
    };
  }, []);

  // The bar opens on press-in (before the keyboard, so the footer never
  // flashes upward), but a cancelled press — like a scroll that starts on an
  // input — would strand it with no keyboard. Re-check once the keyboard has
  // had time to appear and back out if it never did.
  //
  // Focus is what separates the two cases. Keyboard.isVisible() alone can't:
  // the first tap after the app comes to the foreground routinely takes longer
  // than this to animate in, and treating that as a cancelled press closed the
  // bar while the keyboard was still on its way up. That left the footer
  // showing — it renders on !keypadOpen — with KeyboardAvoidingView lifting
  // "Finish workout" into the space Done had just vacated, right under the
  // thumb of someone mid-set.
  useEffect(() => {
    if (!keypadOpen) return;
    const check = setTimeout(() => {
      if (keypadConfirmed.current || Keyboard.isVisible()) return;
      setKeypadOpen(false);
    }, 600);
    return () => clearTimeout(check);
  }, [keypadOpen]);

  // Live subscription: picks up exercises added from the modal instantly, and
  // reads from the device store instead of Firestore for a guest's workouts.
  useEffect(() => {
    if (!id) return;
    return subscribeWorkout(id, (next) => {
      setWorkout(next);
      setLoading(false);
    });
  }, [id]);

  /**
   * Re-read whenever this screen comes back to the front.
   *
   * Belt and braces, and deliberately so: adding an exercise to a freshly
   * started workout sometimes left this screen showing none of it until it was
   * closed and reopened, while the write itself had plainly landed. The
   * subscription above should make that impossible and I could not find the
   * hole, so this closes the symptom from the other side — coming back from the
   * modal is exactly the moment the stale copy was being noticed.
   *
   * Cheap: one document read, only on focus, and it no-ops when the
   * subscription already did its job.
   */
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      getWorkout(id)
        .then((fresh) => {
          if (!cancelled && fresh) setWorkout(fresh);
        })
        .catch(() => {
          // The subscription is the primary path; a failed top-up changes
          // nothing that was already on screen.
        });
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  // Elapsed workout clock (only while in progress).
  const startedAtMs = workout?.startedAt?.getTime();
  const isDone = !!workout?.completedAt;
  // Templates open in a structure editor: exercises and set counts, no logging.
  const isTemplate = !!workout?.isTemplate;
  // Scheduled ahead of time and not yet begun: editable as a plan, no clock.
  const isPlanned = !!workout && !isTemplate && !workout.startedAt && !workout.completedAt;
  const scheduledDayMs = workout?.scheduledFor ? startOfDay(workout.scheduledFor).getTime() : null;
  const todayMs = startOfDay(new Date()).getTime();
  // A plan for a day that isn't today — a past one is backfilling a forgotten
  // session, a future one is pre-logging. Either way it's logged directly onto
  // its scheduled day (no live clock, no "start" step that would drag it onto
  // today) and finishing stamps it on that day.
  const isOffDayPlan = isPlanned && scheduledDayMs != null && scheduledDayMs !== todayMs;
  const isPastPlan = isOffDayPlan && scheduledDayMs! < todayMs;
  useEffect(() => {
    if (!startedAtMs || isDone) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAtMs, isDone]);

  // Drives the in-app readout only. The deadline itself stays put in the
  // context once it passes — the Live Activity needs it to hold at 0:00, and
  // this bar hides itself on restLeft instead.
  useEffect(() => {
    if (!restEndsAt) return;
    const tick = () => setRestLeft(Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [restEndsAt]);

  // What the lifter weighed when this workout happened, so bodyweight sets are
  // valued against that rather than against today's scale. Null until they have
  // recorded anything, in which case those sets count zero as they always did.
  const bodyweightLbs = useMemo(() => {
    if (!workout) return undefined;
    const when = workout.completedAt ?? workout.startedAt ?? workout.createdAt;
    return bodyweightOn(bodyweightLog, when)?.lbs;
  }, [workout, bodyweightLog]);

  const liveVolume = useMemo(
    () => (workout ? workoutVolumeLbs(workout, bodyweightLbs) : 0),
    [workout, bodyweightLbs]
  );

  // Last completed numbers per exercise, shown as input placeholders so the
  // user knows what they lifted last time without templates storing weights.
  const { completed, templates, active } = useWorkouts();
  const previousSets = useMemo(
    () => previousSetsByExercise(completed, workout?.id),
    [completed, workout?.id]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.six }} />
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState title="Workout not found" message="It may have been deleted on another device." />
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  async function saveExercises(exercises: WorkoutExercise[]) {
    await updateWorkout(workout!.id, stripUndefined({ exercises }) as Partial<Workout>);
  }

  // Move the keyboard to the next set input in reading order: within a set
  // weight → reps, then on to the next set, then the next exercise. Focusing a
  // new field blurs the current one, which commits its value automatically.
  function inputOrder() {
    return workout!.exercises.flatMap((ex) =>
      isTimedExercise(ex.exercise)
        ? ex.sets.map((s) => fieldKey(s.id, "duration"))
        : ex.sets.flatMap((s) => [fieldKey(s.id, "weight"), fieldKey(s.id, "reps")])
    );
  }

  function focusNext() {
    const order = inputOrder();
    const start = focusedField.current ? order.indexOf(focusedField.current) : -1;
    for (let i = start + 1; i < order.length; i++) {
      const node = inputRefs.current.get(order[i]);
      if (node) {
        node.focus();
        return;
      }
    }
    // Nothing left to fill — close the keyboard.
    Keyboard.dismiss();
  }

  // Mirror of focusNext, for stepping back to fix the previous entry.
  function focusPrev() {
    const order = inputOrder();
    const start = focusedField.current ? order.indexOf(focusedField.current) : order.length;
    for (let i = start - 1; i >= 0; i--) {
      const node = inputRefs.current.get(order[i]);
      if (node) {
        node.focus();
        return;
      }
    }
    // Already at the first input — nowhere to go back to; keep the keyboard up.
  }

  function mutateSet(exerciseId: string, setId: string, patch: Partial<WorkoutSet>) {
    const exercises = workout!.exercises.map((ex) =>
      ex.id !== exerciseId
        ? ex
        : { ...ex, sets: ex.sets.map((s) => (s.id !== setId ? s : { ...s, ...patch })) }
    );
    saveExercises(exercises);
  }

  // Sets complete themselves once a weight or reps value is entered (in the
  // SetRow's commit), so there's no checkbox — this just applies the patch and
  // kicks off the rest timer the moment a set first flips to done.
  function patchSet(exerciseId: string, setId: string, patch: Partial<WorkoutSet>) {
    const wasCompleted =
      workout!.exercises
        .find((ex) => ex.id === exerciseId)
        ?.sets.find((s) => s.id === setId)?.isCompleted ?? false;
    mutateSet(exerciseId, setId, patch);
    // No rest countdown while merely planning — only during a live session,
    // only on the incomplete→complete flip, and only if the timer is on.
    if (patch.isCompleted && !wasCompleted && !isDone && !isPlanned && restSeconds > 0) {
      startRest(id);
    }
  }

  // The value a running stopwatch would commit right now. Shares one helper
  // with the row's live readout so what you watched is exactly what gets logged.
  function timedSeconds(t: { startedAt: number }): number {
    return liveSetSeconds(Date.now(), t.startedAt);
  }

  function commitTimer(t: { exerciseId: string; setId: string; startedAt: number }) {
    const secs = timedSeconds(t);
    patchSet(t.exerciseId, t.setId, {
      duration: secs > 0 ? secs : undefined,
      isCompleted: secs > 0,
      completedAt: secs > 0 ? new Date() : undefined,
    });
  }

  // Play/stop on a timed set. Stopping logs the elapsed seconds and completes
  // the set; starting a set that already has time continues from it.
  function toggleSetTimer(exerciseId: string, setId: string, currentDuration?: number) {
    if (timing?.setId === setId) {
      commitTimer(timing);
      clearTimer();
      return;
    }
    // Only one stopwatch at a time — starting another set banks the running one.
    // Only this workout's timer can be banked from here (patching a set needs
    // that workout loaded), so a timer left running in another workout is
    // dropped and its set keeps whatever duration it had already logged.
    if (timing) commitTimer(timing);
    startTimer({
      workoutId: id,
      exerciseId,
      setId,
      startedAt: Date.now() - (currentDuration ?? 0) * 1000,
    });
  }

  function addSet(exercise: WorkoutExercise) {
    const last = exercise.sets[exercise.sets.length - 1];
    // New sets start empty so they only count once you actually log them.
    // Last session's numbers still show as ghosted placeholders for guidance.
    const fresh: WorkoutSet = {
      id: newId(),
      weightUnit: last?.weightUnit ?? weightUnit,
      isCompleted: false,
    };
    saveExercises(
      workout!.exercises.map((ex) =>
        ex.id !== exercise.id ? ex : { ...ex, sets: [...ex.sets, fresh] }
      )
    );
  }

  function removeSet(exerciseId: string, setId: string) {
    // Deleting the row a stopwatch is running on leaves nothing to bank it into,
    // so drop the timer with it rather than stranding it on a missing set.
    if (timing?.setId === setId) clearTimer();
    saveExercises(
      workout!.exercises.map((ex) =>
        ex.id !== exerciseId ? ex : { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
      )
    );
  }

  function removeExercise(exerciseId: string) {
    Alert.alert("Remove exercise?", "Its sets will be removed from this workout.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          if (timing?.exerciseId === exerciseId) clearTimer();
          saveExercises(workout!.exercises.filter((ex) => ex.id !== exerciseId));
        },
      },
    ]);
  }

  async function finishWith(exercises: WorkoutExercise[]) {
    setFinishing(true);
    try {
      // A workout scheduled for another day belongs to that day, not the day it
      // was typed in — anchor completedAt to noon of the scheduled day so it
      // lands on the right calendar day in every timezone. Duration is unknown
      // for these, so it's omitted rather than invented.
      const completedAt = isOffDayPlan
        ? new Date(startOfDay(workout!.scheduledFor!).getTime() + 12 * 3_600_000)
        : new Date();
      const startedAt = workout!.startedAt ?? workout!.createdAt;
      const durationMinutes = isOffDayPlan
        ? undefined
        : Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000));
      // Frozen here, with the bodyweight of the day. Readers prefer this stored
      // number, so a later weigh-in never re-values a finished session.
      const totalVolume = workoutVolumeLbs({ ...workout!, exercises }, bodyweightLbs);

      await updateWorkout(
        workout!.id,
        stripUndefined({ exercises, completedAt, durationMinutes, totalVolume }) as Partial<Workout>
      );

      // Derive lifetime stats from actual workout history (kept in sync for plato-web).
      const completedWorkouts = await getCompletedWorkouts(workout!.userId);
      await upsertUserStats({ userId: workout!.userId, ...computeStats(completedWorkouts) });

      router.back();
    } catch {
      Alert.alert("Couldn't finish workout", "Check your connection and try again.");
    } finally {
      setFinishing(false);
    }
  }

  function finishWorkout() {
    // Sets auto-complete as they're filled in, so there's no "mark done" step to
    // nag about — finishing just saves the workout exactly as it stands. Each set
    // shows its own green check / red X in the completed view.
    let exercises = workout!.exercises;
    // A stopwatch still running gets banked into its set instead of lost.
    if (timing) {
      const secs = timedSeconds(timing);
      exercises = exercises.map((ex) =>
        ex.id !== timing.exerciseId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) =>
                s.id !== timing.setId
                  ? s
                  : {
                      ...s,
                      duration: secs > 0 ? secs : undefined,
                      isCompleted: secs > 0,
                      completedAt: secs > 0 ? new Date() : undefined,
                    }
              ),
            }
      );
      clearTimer();
    }
    finishWith(exercises);
  }

  function resumeWorkout() {
    const finishedToday = !!workout?.completedAt && sameDay(workout.completedAt, new Date());
    Alert.alert(
      "Resume workout?",
      finishedToday
        ? "It goes back to in progress so you can add or fix sets."
        : "It reopens for editing and stays on its original day when you finish again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resume",
          onPress: async () => {
            setResuming(true);
            try {
              await reopenWorkout(workout!);
              // The workout left history, so re-derive the synced lifetime stats.
              const completedWorkouts = await getCompletedWorkouts(workout!.userId);
              await upsertUserStats({ userId: workout!.userId, ...computeStats(completedWorkouts) });
            } catch (e) {
              // Surface the real Firebase reason (e.g. permission-denied) instead of
              // masking every failure as a connection problem — makes resume issues
              // diagnosable from the device.
              const code = (e as { code?: string })?.code;
              const detail = code ? `\n\n(${code})` : "";
              Alert.alert("Couldn't resume workout", `Check your connection and try again.${detail}`);
            } finally {
              setResuming(false);
            }
          },
        },
      ]
    );
  }

  function openMenu() {
    Alert.alert(workout!.name, undefined, [
      { text: "Cancel", style: "cancel" },
      // A template can't be re-saved as one — hide the option there.
      ...(isTemplate
        ? []
        : [
            {
              text: "Save as template",
              onPress: async () => {
                if (templates.length >= MAX_TEMPLATES) {
                  Alert.alert(
                    "Template limit reached",
                    `You can keep up to ${MAX_TEMPLATES} templates. Delete one you no longer use to make room.`
                  );
                  return;
                }
                try {
                  await saveAsTemplate(workout!, workout!.name);
                  Alert.alert("Template saved", "Find it on the Workouts tab.");
                } catch {
                  Alert.alert("Couldn't save template", "Check your connection and try again.");
                }
              },
            },
          ]),
      {
        text: isTemplate ? "Delete template" : "Delete workout",
        style: "destructive" as const,
        onPress: () => {
          // The timer now outlives this screen, so it has to go with the workout.
          if (timing) clearTimer();
          // Leave first. Deleting while this screen is still mounted makes its
          // own subscription fire with nothing, so it renders its empty state
          // for a frame before the navigation lands — the blank flash on the
          // way out. Going back first means the screen is gone by then.
          router.back();
          deleteWorkout(workout!).catch(() =>
            Alert.alert("Couldn't delete", "Check your connection and try again.")
          );
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-down" size={26} color={Palette.textSecondary} />
          </Pressable>
          <View style={styles.topCenter}>
            {isTemplate ? (
              <Text style={[styles.plannedLabel, { color: theme.accentText }]}>Template</Text>
            ) : isDone ? (
              <Text style={styles.doneLabel}>Completed</Text>
            ) : isPlanned ? (
              <Text style={[styles.plannedLabel, { color: theme.accentText }]}>
                {isPastPlan ? "Logging" : "Planned"}
                {workout.scheduledFor ? ` · ${relativeDay(workout.scheduledFor)}` : ""}
              </Text>
            ) : (
              <Text style={styles.clock}>{formatClock(elapsed)}</Text>
            )}
          </View>
          <Pressable onPress={openMenu} hitSlop={12}>
            <Ionicons name="ellipsis-horizontal" size={24} color={Palette.textSecondary} />
          </Pressable>
        </View>

        {isTemplate ? (
          <DraggableFlatList
            data={workout.exercises}
            keyExtractor={(ex) => ex.id}
            onDragEnd={({ data }) => {
              // Apply the new order locally right away so the list doesn't
              // snap back while the Firestore write round-trips.
              setWorkout({ ...workout, exercises: data });
              // orderIndex keeps other readers (like plato-web) in agreement.
              saveExercises(data.map((ex, i) => ({ ...ex, orderIndex: i })));
            }}
            containerStyle={{ flex: 1 }}
            contentContainerStyle={styles.dragScroll}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={styles.dragHeader}>
                <TextInput
                  style={styles.title}
                  value={workout.name}
                  onChangeText={(name) => setWorkout({ ...workout, name })}
                  onEndEditing={(e) => {
                    const name = e.nativeEvent.text.trim() || "Workout";
                    updateWorkout(workout.id, { name });
                  }}
                />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText}>
                    {workout.exercises.length} exercise{workout.exercises.length === 1 ? "" : "s"} · {totalSetCount(workout)} sets
                  </Text>
                </View>
                {workout.exercises.length === 0 && (
                  <EmptyState title="No exercises yet" message="Add exercises to shape this template." />
                )}
              </View>
            }
            ListFooterComponent={
              <Button
                title="+ Add exercise"
                variant="secondary"
                onPress={() => router.push({ pathname: "/add-exercise", params: { workoutId: workout.id } })}
              />
            }
            renderItem={({ item, drag, isActive }) => (
              <ScaleDecorator>
                <View style={styles.dragItem}>
                  <ExerciseCard
                    exercise={item}
                    templateMode
                    onDrag={drag}
                    dragActive={isActive}
                    readOnly={false}
                    onPatchSet={(setId, patch) => patchSet(item.id, setId, patch)}
                    onAddSet={() => addSet(item)}
                    onRemoveSet={(setId) => removeSet(item.id, setId)}
                    onRemove={() => removeExercise(item.id)}
                  />
                </View>
              </ScaleDecorator>
            )}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <TextInput
              style={styles.title}
              value={workout.name}
              // The title uses the text keyboard — hopping here from a set input
              // swaps keyboards without a hide event, so drop the bar manually.
              onFocus={() => setKeypadOpen(false)}
              onChangeText={(name) => setWorkout({ ...workout, name })}
              onEndEditing={(e) => {
                const name = e.nativeEvent.text.trim() || "Workout";
                updateWorkout(workout.id, { name });
              }}
              editable={!isDone}
            />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                {displayVolume(workout.totalVolume ?? liveVolume, weightUnit)}
              </Text>
              <Text style={styles.summaryDot}>·</Text>
              <Text style={styles.summaryText}>
                {completedSetCount(workout)}/{totalSetCount(workout)} sets
              </Text>
              {isDone && workout.durationMinutes ? (
                <>
                  <Text style={styles.summaryDot}>·</Text>
                  <Text style={styles.summaryText}>{workout.durationMinutes}m</Text>
                </>
              ) : null}
            </View>

            {workout.exercises.length === 0 && (
              <EmptyState title="No exercises yet" message="Add your first exercise to start logging sets." />
            )}

            {workout.exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                prevSets={previousSets.get(exercise.exerciseId)}
                readOnly={isDone}
                registerInput={registerInput}
                onInputFocus={(key, focused) => {
                  focusedField.current = key;
                  if (focused) keypadConfirmed.current = true;
                  setKeypadOpen(true);
                }}
                onPatchSet={(setId, patch) => patchSet(exercise.id, setId, patch)}
                onAddSet={() => addSet(exercise)}
                onRemoveSet={(setId) => removeSet(exercise.id, setId)}
                onRemove={() => removeExercise(exercise.id)}
                timingSetId={timing?.exerciseId === exercise.id ? timing.setId : undefined}
                timingStartedAt={timing?.exerciseId === exercise.id ? timing.startedAt : undefined}
                bodyweightLbs={bodyweightLbs}
                onToggleTimer={(setId, duration) => toggleSetTimer(exercise.id, setId, duration)}
              />
            ))}

            {!isDone && (
              <Button
                title="+ Add exercise"
                variant="secondary"
                onPress={() => router.push({ pathname: "/add-exercise", params: { workoutId: workout.id } })}
              />
            )}
          </ScrollView>
        )}

        {restEndsAt && restLeft > 0 && !isDone && (
          <View
            style={[
              styles.restBar,
              { backgroundColor: theme.accentSoft, borderColor: theme.accent },
            ]}>
            <Ionicons name="timer-outline" size={18} color={theme.accentText} />
            <Text style={[styles.restText, { color: theme.accentText }]}>
              Rest {formatClock(restLeft)}
            </Text>
            <Pressable onPress={() => extendRest(15_000)} hitSlop={8}>
              <Text style={styles.restSkip}>+15s</Text>
            </Pressable>
            <Pressable onPress={endRest} hitSlop={8}>
              <Text style={styles.restSkip}>Skip</Text>
            </Pressable>
          </View>
        )}

        {/* Hidden while the keypad toolbar is up: the footer button would sit
            right above it, and a mis-tap mid-workout would finish the session.
            Also hidden for any other keyboard — renaming the workout raises one
            without the toolbar — so that "Finish workout" can never end up
            adjacent to the keyboard, whatever route got it there. Keeping this
            structural matters more than the toolbar state being right: one is a
            missing button, the other ends the session. */}
        {!keypadOpen && !keyboardUp && (
        <View style={styles.footer}>
          {isTemplate ? (
            <Button title="Done" variant="secondary" onPress={() => router.back()} />
          ) : isDone ? (
            <Button title="Resume workout" variant="secondary" onPress={resumeWorkout} loading={resuming} />
          ) : isOffDayPlan ? (
            <Button title="Log workout" onPress={finishWorkout} loading={finishing} />
          ) : isPlanned ? (
            <Button
              title="Start workout"
              onPress={() => {
                // Starting turns this plan into a live session — respect the
                // same cap on simultaneously in-progress workouts.
                if (active.length >= MAX_ACTIVE_WORKOUTS) {
                  Alert.alert(
                    "Too many workouts in progress",
                    `Finish or delete one of your ${MAX_ACTIVE_WORKOUTS} in-progress workouts before starting another.`
                  );
                  return;
                }
                updateWorkout(workout.id, { startedAt: new Date() });
              }}
            />
          ) : (
            <Button title="Finish workout" onPress={finishWorkout} loading={finishing} />
          )}
        </View>
        )}

        {/* Numeric keypads have no return key, so pin a toolbar above the
            keyboard with Next (advance to the following field) and Done. This
            is the last child of the KeyboardAvoidingView, so its padding keeps
            the bar sitting directly on top of the keypad. */}
        {keypadOpen && !isDone && !isTemplate && (
          <View style={styles.keypadBar}>
            <Pressable
              onPress={focusPrev}
              hitSlop={8}
              style={[
                styles.keypadPill,
                { backgroundColor: theme.accentSoft, borderColor: theme.accent },
              ]}>
              <Ionicons name="arrow-back" size={18} color={theme.accentText} />
              <Text
                style={[styles.keypadPillText, { color: theme.accentText }]}
                maxFontSizeMultiplier={FontScaleCap.keypad}>
                Back
              </Text>
            </Pressable>
            <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8} style={styles.keypadDoneButton}>
              <Text style={styles.keypadDone} maxFontSizeMultiplier={FontScaleCap.keypad}>
                Done
              </Text>
            </Pressable>
            <Pressable
              onPress={focusNext}
              hitSlop={8}
              style={[
                styles.keypadPill,
                { backgroundColor: theme.accentSoft, borderColor: theme.accent },
              ]}>
              <Text
                style={[styles.keypadPillText, { color: theme.accentText }]}
                maxFontSizeMultiplier={FontScaleCap.keypad}>
                Next
              </Text>
              <Ionicons name="arrow-forward" size={18} color={theme.accentText} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Exercise card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  prevSets,
  templateMode,
  onDrag,
  dragActive,
  readOnly,
  registerInput,
  onInputFocus,
  onPatchSet,
  onAddSet,
  onRemoveSet,
  onRemove,
  timingSetId,
  timingStartedAt,
  bodyweightLbs,
  onToggleTimer,
}: {
  exercise: WorkoutExercise;
  /** Last session's numbers, indexed by set position — holes where it was skipped. */
  prevSets?: (WorkoutSet | undefined)[];
  templateMode?: boolean;
  onDrag?: () => void;
  dragActive?: boolean;
  readOnly: boolean;
  registerInput?: (key: string, node: TextInput | null) => void;
  onInputFocus?: (key: string, focused?: boolean) => void;
  onPatchSet: (setId: string, patch: Partial<WorkoutSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemove: () => void;
  timingSetId?: string;
  timingStartedAt?: number;
  /** What the lifter weighed when this workout happened, for the BW baseline. */
  bodyweightLbs?: number;
  onToggleTimer?: (setId: string, currentDuration?: number) => void;
}) {
  const { unit } = useWeightUnit();
  const theme = useTheme();
  // Cardio and holds log a stopwatch per set instead of weight × reps.
  const timed = isTimedExercise(exercise.exercise);
  const bodyweight = isBodyweightExercise(exercise.exercise);
  return (
    <Card style={[styles.exerciseCard, dragActive && { borderColor: theme.accent }]}>
      <View style={styles.exerciseHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseName}>{exercise.exercise.name}</Text>
          <Text style={[styles.exerciseCategory, { color: theme.accentText }]}>
            {/* The baseline is the same for every set, so it belongs here rather
                than repeated down the rows. Without a weigh-in on file it says
                so plainly — those sets are counting zero, and silently showing
                nothing would hide that. */}
            {exercise.exercise.category}
            {bodyweight
              ? bodyweightLbs
                ? ` · BW ${Math.round(convertWeight(bodyweightLbs, "lbs", unit))} ${unit}`
                : " · BW not set"
              : ""}
          </Text>
        </View>
        {templateMode && (
          // Touching the grip hands the gesture to the drag system immediately.
          <Pressable onPressIn={onDrag} disabled={dragActive} hitSlop={8} style={styles.dragHandle}>
            <Ionicons name="reorder-two" size={20} color={Palette.textSecondary} />
          </Pressable>
        )}
        {!readOnly && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Ionicons name="close" size={18} color={Palette.textTertiary} />
          </Pressable>
        )}
      </View>

      {templateMode ? (
        // Templates only carry structure, so sets are just a count here.
        <View style={styles.stepperRow}>
          <Text style={styles.stepperLabel}>
            {exercise.sets.length} set{exercise.sets.length === 1 ? "" : "s"}
          </Text>
          <Pressable
            onPress={() => onRemoveSet(exercise.sets[exercise.sets.length - 1].id)}
            disabled={exercise.sets.length <= 1}
            hitSlop={8}
            style={[styles.stepperButton, exercise.sets.length <= 1 && { opacity: 0.4 }]}>
            <Ionicons name="remove" size={18} color={Palette.text} />
          </Pressable>
          <Pressable onPress={onAddSet} hitSlop={8} style={styles.stepperButton}>
            <Ionicons name="add" size={18} color={Palette.text} />
          </Pressable>
        </View>
      ) : (
        <>
          {/* Column headings label a fixed grid, so they cap with the numbers
              they sit above rather than pushing the columns out of alignment. */}
          <View style={styles.setHeaderRow}>
            <Text style={[styles.setHeaderCell, styles.setNumCol]} maxFontSizeMultiplier={FontScaleCap.grid}>
              SET
            </Text>
            {timed ? (
              <>
                <Text style={[styles.setHeaderCell, styles.inputCol]} maxFontSizeMultiplier={FontScaleCap.grid}>
                  TIME
                </Text>
                <View style={styles.timerCol} />
              </>
            ) : (
              <>
                <Text style={[styles.setHeaderCell, styles.inputCol]} maxFontSizeMultiplier={FontScaleCap.grid}>
                  {bodyweight ? "+ " : ""}WEIGHT ({unit.toUpperCase()})
                </Text>
                <Text style={[styles.setHeaderCell, styles.inputCol]} maxFontSizeMultiplier={FontScaleCap.grid}>
                  REPS
                </Text>
              </>
            )}
            <View style={styles.checkCol} />
          </View>

          {exercise.sets.map((set, i) => (
            <SetRow
              key={set.id}
              index={i + 1}
              set={set}
              prev={prevSets?.[i]}
              before={i > 0 ? exercise.sets[i - 1] : undefined}
              readOnly={readOnly}
              timed={timed}
              bodyweight={bodyweight}
              runningStartedAt={timingSetId === set.id ? timingStartedAt : undefined}
              onToggleTimer={() => onToggleTimer?.(set.id, set.duration)}
              registerInput={registerInput}
              onInputFocus={onInputFocus}
              onPatch={(patch) => onPatchSet(set.id, patch)}
              onRemove={() => onRemoveSet(set.id)}
            />
          ))}

          {!readOnly && (
            <Pressable onPress={onAddSet} style={styles.addSetButton}>
              <Text style={styles.addSetText}>+ Add set</Text>
            </Pressable>
          )}
        </>
      )}
    </Card>
  );
}

// Numeric inputs hold local text while editing and commit on blur —
// whole-object patches only, so a set can never be partially zeroed.
function SetRow({
  index,
  set,
  prev,
  before,
  readOnly,
  timed,
  bodyweight,
  runningStartedAt,
  onToggleTimer,
  registerInput,
  onInputFocus,
  onPatch,
  onRemove,
}: {
  index: number;
  set: WorkoutSet;
  prev?: WorkoutSet;
  /** The set directly above this one in the workout — the copy button's source. */
  before?: WorkoutSet;
  readOnly: boolean;
  timed?: boolean;
  /** The weight field means *added* load, and blank reads as BW. */
  bodyweight: boolean;
  /** Set when this row's stopwatch is running (backdated by prior duration). */
  runningStartedAt?: number;
  onToggleTimer?: () => void;
  registerInput?: (key: string, node: TextInput | null) => void;
  onInputFocus?: (key: string, focused?: boolean) => void;
  onPatch: (patch: Partial<WorkoutSet>) => void;
  onRemove: () => void;
}) {
  const { unit } = useWeightUnit();
  const theme = useTheme();

  // Weights are stored with the unit they were logged in; show them converted
  // to the current preference so switching lbs/kg updates old workouts too.
  const shownWeight =
    set.weight != null && (set.weightUnit === "lbs" || set.weightUnit === "kg")
      ? convertWeight(set.weight, set.weightUnit, unit)
      : set.weightUnit === "bodyweight"
        ? // Added load is banked in lbs, since "bodyweight" says nothing about
          // which unit the extra was typed in. Nothing added leaves the field
          // empty so its BW placeholder shows through — a literal 0 sitting in
          // the box reads as "zero pounds", which is the one thing a bodyweight
          // set is not.
          set.weight
          ? convertWeight(set.weight, "lbs", unit)
          : undefined
        : set.weight;

  const [weightText, setWeightText] = useState(shownWeight != null ? String(shownWeight) : "");
  const [repsText, setRepsText] = useState(set.reps != null ? String(set.reps) : "");
  const [durationText, setDurationText] = useState(set.duration != null ? formatClock(set.duration) : "");
  const editing = useRef(false);

  // Live readout while this row's stopwatch runs.
  const running = runningStartedAt != null;
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);
  // Clamped to what the set already banked, which covers the first frame of a
  // new run where `nowMs` is still the last tick of the previous one — without
  // it, resuming a set holding 1:30 flashes 0:00 before catching up.
  const liveSeconds = running ? liveSetSeconds(nowMs, runningStartedAt!, set.duration ?? 0) : 0;

  // The last reading the row painted, kept so it outlives the stopwatch being
  // cleared.
  const lastLive = useRef(0);
  if (running) lastLive.current = liveSeconds;

  // Stopping clears the timer synchronously, but the committed duration has to
  // round-trip through the store before `set.duration` catches up. Seed the
  // input with the final reading on that transition so the row doesn't swap
  // from the live text to an input still holding the pre-stop value — on a
  // fresh set, an empty field showing its 0:00 placeholder.
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running && lastLive.current > 0) {
      setDurationText(formatClock(lastLive.current));
    }
    wasRunning.current = running;
  }, [running]);

  // Last session's numbers for this exercise, ghosted in empty inputs.
  const prevWeight =
    prev?.weight != null && (prev.weightUnit === "lbs" || prev.weightUnit === "kg")
      ? convertWeight(prev.weight, prev.weightUnit, unit)
      : prev?.weightUnit === "bodyweight" && prev.weight
        ? convertWeight(prev.weight, "lbs", unit)
        : prev?.weight;

  // Sync remote changes into the inputs when not actively editing.
  useEffect(() => {
    if (editing.current) return;
    setWeightText(shownWeight != null ? String(shownWeight) : "");
    setRepsText(set.reps != null ? String(set.reps) : "");
    setDurationText(set.duration != null ? formatClock(set.duration) : "");
  }, [shownWeight, set.reps, set.duration]);

  function commit() {
    editing.current = false;
    // Blur fires even with no edits — skip the write so an untouched set never
    // gets re-stored as its rounded unit conversion.
    const weightDirty = weightText !== (shownWeight != null ? String(shownWeight) : "");
    const repsDirty = repsText !== (set.reps != null ? String(set.reps) : "");
    if (!weightDirty && !repsDirty) return;

    const weight = weightText.trim() === "" ? undefined : Number(weightText.replace(",", "."));
    const reps = repsText.trim() === "" ? undefined : Math.round(Number(repsText));
    const validWeight = Number.isFinite(weight!) ? weight : undefined;
    const validReps = Number.isFinite(reps!) ? reps : undefined;
    // A set is "done" (green check, counts toward volume, starts the rest timer)
    // only when it has both a weight and a positive rep count. Partial entries are
    // still stored so the row can flag them with a red X, but don't count as done.
    // Weight 0 is valid (bodyweight moves), but 0 reps isn't a real set.
    // A bodyweight set is done on reps alone — the empty weight field *is* the
    // load, so waiting for a number would mean it could never be completed.
    const done = bodyweight
      ? validReps != null && validReps > 0
      : validWeight != null && validReps != null && validReps > 0;
    onPatch({
      // Typed values are in the currently displayed unit, so store that unit —
      // except on a bodyweight set, where the number is the *added* load and is
      // banked in lbs because "bodyweight" leaves nowhere to record a unit.
      weight: bodyweight && validWeight != null ? convertWeight(validWeight, unit, "lbs") : validWeight,
      ...(bodyweight
        ? { weightUnit: "bodyweight" as const }
        : validWeight != null
          ? { weightUnit: unit }
          : {}),
      reps: validReps,
      isCompleted: done,
      completedAt: done ? new Date() : undefined,
    });
  }

  // Copy button: an untouched set right after a completed one repeats it in one
  // tap — same weight and reps (or time), marked done.
  const untouched = !set.isCompleted && set.weight == null && set.reps == null && set.duration == null;
  const canCopyBefore = !readOnly && !running && untouched && !!before?.isCompleted;
  function copyBefore() {
    // Real guard, not a `!` assertion: the React Compiler turns unguarded
    // `before!.x` reads in this closure into render-time dependency reads,
    // which crashed every first set (where `before` is undefined) in build 9.
    const src = before;
    if (!src) return;
    editing.current = false;
    onPatch(
      timed
        ? { duration: src.duration, isCompleted: true, completedAt: new Date() }
        : {
            weight: src.weight,
            weightUnit: src.weightUnit,
            reps: src.reps,
            isCompleted: true,
            completedAt: new Date(),
          }
    );
  }

  // Manual time entry for timed sets ("1:30" or plain seconds) — an alternative
  // to the stopwatch for logging after the fact.
  function commitDuration() {
    editing.current = false;
    const baseline = set.duration != null ? formatClock(set.duration) : "";
    if (durationText === baseline) return;

    const seconds = parseDurationText(durationText);
    const done = seconds != null && seconds > 0;
    onPatch({
      duration: done ? seconds : undefined,
      isCompleted: done,
      completedAt: done ? new Date() : undefined,
    });
  }

  return (
    // Swipe a row left to delete it — no confirmation, mirroring big fitness
    // apps. Long-press still works as a fallback gesture.
    <ReanimatedSwipeable
      enabled={!readOnly}
      friction={2}
      rightThreshold={36}
      overshootRight={false}
      renderRightActions={() => (
        <View style={styles.setDeleteAction}>
          <Ionicons name="trash-outline" size={16} color="#fff" />
        </View>
      )}
      onSwipeableWillOpen={onRemove}>
      <Pressable onLongPress={readOnly ? undefined : onRemove} style={styles.setRow}>
      <Text style={[styles.setNum, styles.setNumCol]} maxFontSizeMultiplier={FontScaleCap.grid}>
        {index}
      </Text>
      {timed ? (
        <>
          {running ? (
            <Text
              style={[
                styles.timerLive,
                {
                  backgroundColor: theme.accentSoft,
                  borderColor: theme.accent,
                  color: theme.accentText,
                },
                styles.inputCol,
              ]}
              maxFontSizeMultiplier={FontScaleCap.grid}>
              {formatClock(liveSeconds)}
            </Text>
          ) : (
            <TextInput
              ref={(node) => registerInput?.(fieldKey(set.id, "duration"), node)}
              style={[styles.setInput, styles.inputCol]}
              maxFontSizeMultiplier={FontScaleCap.grid}
              value={durationText}
              onPressIn={readOnly ? undefined : () => onInputFocus?.(fieldKey(set.id, "duration"))}
              onFocus={() => {
                editing.current = true;
                onInputFocus?.(fieldKey(set.id, "duration"), true);
              }}
              onChangeText={setDurationText}
              onEndEditing={commitDuration}
              keyboardType="numbers-and-punctuation"
              placeholder={prev?.duration != null ? formatClock(prev.duration) : "0:00"}
              placeholderTextColor={Palette.textTertiary}
              editable={!readOnly}
            />
          )}
          {readOnly ? (
            <View style={styles.timerCol} />
          ) : (
            <Pressable
              onPress={onToggleTimer}
              hitSlop={6}
              style={[
                styles.timerButton,
                { backgroundColor: theme.accentSoft, borderColor: theme.accent },
                running && styles.timerButtonActive,
              ]}>
              {/* Running turns the pill danger-red, so white is right there
                  whatever the theme; idle it carries the accent. */}
              <Ionicons
                name={running ? "stop" : "play"}
                size={15}
                color={running ? "#fff" : theme.accentText}
              />
            </Pressable>
          )}
        </>
      ) : (
        <>
          <TextInput
            ref={(node) => registerInput?.(fieldKey(set.id, "weight"), node)}
            style={[styles.setInput, styles.inputCol]}
            maxFontSizeMultiplier={FontScaleCap.grid}
            value={weightText}
            onPressIn={readOnly ? undefined : () => onInputFocus?.(fieldKey(set.id, "weight"))}
            onFocus={() => {
              editing.current = true;
              onInputFocus?.(fieldKey(set.id, "weight"), true);
            }}
            onChangeText={setWeightText}
            onEndEditing={commit}
            keyboardType={bodyweight ? "numbers-and-punctuation" : "decimal-pad"}
            placeholder={
              bodyweight
                ? // The empty field *is* the load on these, so it shows what it
                  // means — "BW", or last session's added weight.
                  formatBodyweightLoad(prev?.weightUnit === "bodyweight" ? prev.weight : 0, unit)
                : prevWeight != null
                  ? String(prevWeight)
                  : "—"
            }
            placeholderTextColor={Palette.textTertiary}
            editable={!readOnly}
          />
          <TextInput
            ref={(node) => registerInput?.(fieldKey(set.id, "reps"), node)}
            style={[styles.setInput, styles.inputCol]}
            maxFontSizeMultiplier={FontScaleCap.grid}
            value={repsText}
            onPressIn={readOnly ? undefined : () => onInputFocus?.(fieldKey(set.id, "reps"))}
            onFocus={() => {
              editing.current = true;
              onInputFocus?.(fieldKey(set.id, "reps"), true);
            }}
            onChangeText={setRepsText}
            onEndEditing={commit}
            keyboardType="number-pad"
            placeholder={prev?.reps != null ? String(prev.reps) : "—"}
            placeholderTextColor={Palette.textTertiary}
            editable={!readOnly}
          />
        </>
      )}
      <View style={[styles.checkCol, styles.doneMark]}>
        {set.isCompleted ? (
          // Fully logged: weight + reps.
          <Ionicons name="checkmark-circle" size={20} color={Palette.success} />
        ) : set.weight != null || set.reps != null || readOnly ? (
          // Half-filled while logging, or any unfinished set once the workout
          // is completed (readOnly). Resuming clears the X on empty sets since
          // they're editable again.
          <Ionicons name="close-circle" size={20} color={Palette.danger} />
        ) : canCopyBefore ? (
          // One tap repeats the set above (same numbers, marked done).
          <Pressable onPress={copyBefore} hitSlop={8}>
            <Ionicons name="copy-outline" size={18} color={Palette.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.bg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  topCenter: {
    flex: 1,
    alignItems: "center",
  },
  clock: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
    fontVariant: ["tabular-nums"],
  },
  doneLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Palette.success,
  },
  plannedLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  scroll: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: -0.5,
    padding: 0,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: -Spacing.two,
  },
  summaryText: {
    fontSize: 14,
    color: Palette.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  summaryDot: {
    color: Palette.textTertiary,
  },
  exerciseCard: {
    gap: Spacing.two,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: "700",
    color: Palette.text,
  },
  exerciseCategory: {
    fontSize: 12,
    marginTop: 1,
  },
  setHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  setHeaderCell: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: Palette.textTertiary,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    // Opaque so the delete action stays hidden behind the row until swiped.
    backgroundColor: Palette.surface,
  },
  setDeleteAction: {
    width: 56,
    borderRadius: Radius.sm,
    backgroundColor: Palette.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  setNumCol: {
    width: 28,
    textAlign: "center",
  },
  setNum: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  inputCol: {
    flex: 1,
  },
  setInput: {
    backgroundColor: Palette.surfaceRaised,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    color: Palette.text,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 8,
    fontVariant: ["tabular-nums"],
  },
  keypadBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Palette.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  keypadDoneButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  keypadDone: {
    fontSize: 16,
    fontWeight: "600",
    color: Palette.textSecondary,
  },
  // Sized for gym hands: 44pt-tall pills that split the row evenly, so they
  // stay comfortably tappable from an SE up to a Pro Max.
  keypadPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  keypadPillText: {
    fontSize: 16,
    fontWeight: "700",
  },
  checkCol: {
    width: 34,
  },
  timerCol: {
    width: 34,
  },
  // Same footprint as a set input, restyled as the live stopwatch readout.
  timerLive: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 8,
    fontVariant: ["tabular-nums"],
    overflow: "hidden",
  },
  timerButton: {
    width: 34,
    height: 30,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timerButtonActive: {
    backgroundColor: Palette.danger,
    borderColor: Palette.danger,
  },
  doneMark: {
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  addSetButton: {
    alignItems: "center",
    paddingVertical: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceRaised,
    marginTop: Spacing.one,
  },
  addSetText: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.textSecondary,
  },
  restBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  restText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  restSkip: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.textSecondary,
  },
  dragScroll: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  dragHeader: {
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  dragItem: {
    marginBottom: Spacing.three,
  },
  dragHandle: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    backgroundColor: Palette.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  stepperLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Palette.text,
    fontVariant: ["tabular-nums"],
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    padding: Spacing.three,
    paddingTop: 0,
  },
});
