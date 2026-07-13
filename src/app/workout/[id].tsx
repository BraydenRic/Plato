import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  InputAccessoryView,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button, Card, EmptyState } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { db } from "@/lib/firebase";
import { getCompletedWorkouts, reopenWorkout, saveAsTemplate, stripUndefined, updateWorkout, upsertUserStats, computeStats, deleteWorkout } from "@/lib/firestore";
import { useWorkouts } from "@/hooks/use-workouts";
import { useRestTimer } from "@/context/RestTimerContext";
import { useWeightUnit } from "@/context/UnitContext";
import { convertWeight, displayVolume, formatClock, newId, relativeDay, sameDay, startOfDay, workoutVolumeLbs, completedSetCount, totalSetCount, MAX_TEMPLATES } from "@/lib/workout-utils";
import type { Workout, WorkoutExercise, WorkoutSet } from "@/types";


function toDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  if (typeof val === "object" && "toDate" in (val as object)) {
    return (val as { toDate: () => Date }).toDate();
  }
  return undefined;
}

// Ties every set input to one keyboard toolbar (iOS) so its "Next" button can
// jump weight → reps → next set's weight across the whole workout.
const KEYPAD_ACCESSORY_ID = "workoutKeypad";
const fieldKey = (setId: string, field: "weight" | "reps") => `${setId}:${field}`;

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const { unit: weightUnit } = useWeightUnit();
  const { restSeconds } = useRestTimer();

  // Registry of the live set inputs (keyed by set id + field) plus which one is
  // focused, so the keyboard's "Next" button can advance to the following field.
  const inputRefs = useRef(new Map<string, TextInput>());
  const focusedField = useRef<string | null>(null);
  const registerInput = (key: string, node: TextInput | null) => {
    if (node) inputRefs.current.set(key, node);
    else inputRefs.current.delete(key);
  };

  // Live doc subscription: picks up exercises added from the modal instantly.
  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, "workouts", id), (snap) => {
      if (!snap.exists()) {
        setWorkout(null);
        setLoading(false);
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      setWorkout({
        id: snap.id,
        userId: d.userId as string,
        name: d.name as string,
        isTemplate: Boolean(d.isTemplate),
        exercises: (d.exercises as Workout["exercises"]) ?? [],
        createdAt: toDate(d.createdAt) ?? new Date(),
        scheduledFor: toDate(d.scheduledFor),
        startedAt: toDate(d.startedAt),
        completedAt: toDate(d.completedAt),
        durationMinutes: d.durationMinutes as number | undefined,
        totalVolume: d.totalVolume as number | undefined,
      });
      setLoading(false);
    });
    return unsubscribe;
  }, [id]);

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

  // Rest countdown.
  useEffect(() => {
    if (!restEndsAt) return;
    const tick = () => {
      const left = Math.ceil((restEndsAt - Date.now()) / 1000);
      if (left <= 0) setRestEndsAt(null);
      else setRestLeft(left);
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [restEndsAt]);

  const liveVolume = useMemo(() => (workout ? workoutVolumeLbs(workout) : 0), [workout]);

  // Last completed numbers per exercise, shown as input placeholders so the
  // user knows what they lifted last time without templates storing weights.
  const { completed, templates } = useWorkouts();
  const previousSets = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const w of completed) {
      // `completed` is newest-first, so the first hit per exercise wins.
      if (w.id === workout?.id) continue;
      for (const ex of w.exercises) {
        if (!map.has(ex.exerciseId)) {
          const done = ex.sets.filter((s) => s.isCompleted && s.weight != null);
          if (done.length > 0) map.set(ex.exerciseId, done);
        }
      }
    }
    return map;
  }, [completed, workout?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Palette.accent} style={{ marginTop: Spacing.six }} />
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
  function focusNext() {
    const order = workout!.exercises.flatMap((ex) =>
      ex.sets.flatMap((s) => [fieldKey(s.id, "weight"), fieldKey(s.id, "reps")])
    );
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
      setRestEndsAt(Date.now() + restSeconds * 1000);
    }
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
        onPress: () => saveExercises(workout!.exercises.filter((ex) => ex.id !== exerciseId)),
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
      const totalVolume = workoutVolumeLbs({ ...workout!, exercises });

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
    finishWith(workout!.exercises);
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
        onPress: async () => {
          await deleteWorkout(workout!);
          router.back();
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
              <Text style={styles.plannedLabel}>Template</Text>
            ) : isDone ? (
              <Text style={styles.doneLabel}>Completed</Text>
            ) : isPlanned ? (
              <Text style={styles.plannedLabel}>
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
                onInputFocus={(key) => (focusedField.current = key)}
                onPatchSet={(setId, patch) => patchSet(exercise.id, setId, patch)}
                onAddSet={() => addSet(exercise)}
                onRemoveSet={(setId) => removeSet(exercise.id, setId)}
                onRemove={() => removeExercise(exercise.id)}
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

        {restEndsAt && !isDone && (
          <View style={styles.restBar}>
            <Ionicons name="timer-outline" size={18} color={Palette.accentText} />
            <Text style={styles.restText}>Rest {formatClock(restLeft)}</Text>
            <Pressable onPress={() => setRestEndsAt(restEndsAt + 15_000)} hitSlop={8}>
              <Text style={styles.restSkip}>+15s</Text>
            </Pressable>
            <Pressable onPress={() => setRestEndsAt(null)} hitSlop={8}>
              <Text style={styles.restSkip}>Skip</Text>
            </Pressable>
          </View>
        )}

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
              onPress={() => updateWorkout(workout.id, { startedAt: new Date() })}
            />
          ) : (
            <Button title="Finish workout" onPress={finishWorkout} loading={finishing} />
          )}
        </View>

        {/* Numeric keypads have no return key, so give the set inputs a toolbar
            with Next (advance to the following field) and Done (dismiss). */}
        {Platform.OS === "ios" && !isDone && !isTemplate && (
          <InputAccessoryView nativeID={KEYPAD_ACCESSORY_ID}>
            <View style={styles.keypadBar}>
              <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
                <Text style={styles.keypadDone}>Done</Text>
              </Pressable>
              <Pressable onPress={focusNext} hitSlop={8} style={styles.keypadNext}>
                <Text style={styles.keypadNextText}>Next</Text>
                <Ionicons name="arrow-forward" size={16} color={Palette.accentText} />
              </Pressable>
            </View>
          </InputAccessoryView>
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
}: {
  exercise: WorkoutExercise;
  prevSets?: WorkoutSet[];
  templateMode?: boolean;
  onDrag?: () => void;
  dragActive?: boolean;
  readOnly: boolean;
  registerInput?: (key: string, node: TextInput | null) => void;
  onInputFocus?: (key: string) => void;
  onPatchSet: (setId: string, patch: Partial<WorkoutSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemove: () => void;
}) {
  const { unit } = useWeightUnit();
  return (
    <Card style={[styles.exerciseCard, dragActive && styles.exerciseCardDragging]}>
      <View style={styles.exerciseHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseName}>{exercise.exercise.name}</Text>
          <Text style={styles.exerciseCategory}>{exercise.exercise.category}</Text>
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
          <View style={styles.setHeaderRow}>
            <Text style={[styles.setHeaderCell, styles.setNumCol]}>SET</Text>
            <Text style={[styles.setHeaderCell, styles.inputCol]}>WEIGHT ({unit.toUpperCase()})</Text>
            <Text style={[styles.setHeaderCell, styles.inputCol]}>REPS</Text>
            <View style={styles.checkCol} />
          </View>

          {exercise.sets.map((set, i) => (
            <SetRow
              key={set.id}
              index={i + 1}
              set={set}
              prev={prevSets?.[i]}
              readOnly={readOnly}
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
  readOnly,
  registerInput,
  onInputFocus,
  onPatch,
  onRemove,
}: {
  index: number;
  set: WorkoutSet;
  prev?: WorkoutSet;
  readOnly: boolean;
  registerInput?: (key: string, node: TextInput | null) => void;
  onInputFocus?: (key: string) => void;
  onPatch: (patch: Partial<WorkoutSet>) => void;
  onRemove: () => void;
}) {
  const { unit } = useWeightUnit();

  // Weights are stored with the unit they were logged in; show them converted
  // to the current preference so switching lbs/kg updates old workouts too.
  const shownWeight =
    set.weight != null && (set.weightUnit === "lbs" || set.weightUnit === "kg")
      ? convertWeight(set.weight, set.weightUnit, unit)
      : set.weight;

  const [weightText, setWeightText] = useState(shownWeight != null ? String(shownWeight) : "");
  const [repsText, setRepsText] = useState(set.reps != null ? String(set.reps) : "");
  const editing = useRef(false);

  // Last session's numbers for this exercise, ghosted in empty inputs.
  const prevWeight =
    prev?.weight != null && (prev.weightUnit === "lbs" || prev.weightUnit === "kg")
      ? convertWeight(prev.weight, prev.weightUnit, unit)
      : prev?.weight;

  // Sync remote changes into the inputs when not actively editing.
  useEffect(() => {
    if (editing.current) return;
    setWeightText(shownWeight != null ? String(shownWeight) : "");
    setRepsText(set.reps != null ? String(set.reps) : "");
  }, [shownWeight, set.reps]);

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
    const done = validWeight != null && validReps != null && validReps > 0;
    onPatch({
      // Typed values are in the currently displayed unit, so store that unit.
      weight: validWeight,
      ...(validWeight != null ? { weightUnit: unit } : {}),
      reps: validReps,
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
      <Text style={[styles.setNum, styles.setNumCol]}>{index}</Text>
      <TextInput
        ref={(node) => registerInput?.(fieldKey(set.id, "weight"), node)}
        style={[styles.setInput, styles.inputCol]}
        value={weightText}
        onFocus={() => {
          editing.current = true;
          onInputFocus?.(fieldKey(set.id, "weight"));
        }}
        onChangeText={setWeightText}
        onEndEditing={commit}
        keyboardType="decimal-pad"
        inputAccessoryViewID={Platform.OS === "ios" ? KEYPAD_ACCESSORY_ID : undefined}
        placeholder={prevWeight != null ? String(prevWeight) : "—"}
        placeholderTextColor={Palette.textTertiary}
        editable={!readOnly}
      />
      <TextInput
        ref={(node) => registerInput?.(fieldKey(set.id, "reps"), node)}
        style={[styles.setInput, styles.inputCol]}
        value={repsText}
        onFocus={() => {
          editing.current = true;
          onInputFocus?.(fieldKey(set.id, "reps"));
        }}
        onChangeText={setRepsText}
        onEndEditing={commit}
        keyboardType="number-pad"
        inputAccessoryViewID={Platform.OS === "ios" ? KEYPAD_ACCESSORY_ID : undefined}
        placeholder={prev?.reps != null ? String(prev.reps) : "—"}
        placeholderTextColor={Palette.textTertiary}
        editable={!readOnly}
      />
      <View style={[styles.checkCol, styles.doneMark]}>
        {set.isCompleted ? (
          // Fully logged: weight + reps.
          <Ionicons name="checkmark-circle" size={20} color={Palette.success} />
        ) : set.weight != null || set.reps != null ? (
          // Something was entered but it's missing a weight or valid reps.
          <Ionicons name="close-circle" size={20} color={Palette.danger} />
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
    color: Palette.accentText,
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
  exerciseCardDragging: {
    borderColor: Palette.accent,
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
    color: Palette.accentText,
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
    justifyContent: "space-between",
    backgroundColor: Palette.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  keypadDone: {
    fontSize: 15,
    fontWeight: "600",
    color: Palette.textSecondary,
  },
  keypadNext: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  keypadNextText: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.accentText,
  },
  checkCol: {
    width: 34,
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
    backgroundColor: Palette.accentSoft,
    borderWidth: 1,
    borderColor: Palette.accent,
  },
  restText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: Palette.accentText,
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
