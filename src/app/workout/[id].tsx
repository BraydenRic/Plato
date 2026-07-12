import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button, Card, EmptyState } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { db } from "@/lib/firebase";
import { getCompletedWorkouts, reopenWorkout, saveAsTemplate, stripUndefined, updateWorkout, upsertUserStats, computeStats, deleteWorkout } from "@/lib/firestore";
import { useWorkouts } from "@/hooks/use-workouts";
import { useWeightUnit } from "@/context/UnitContext";
import { convertWeight, displayVolume, formatClock, newId, relativeDay, sameDay, startOfDay, workoutVolumeLbs, completedSetCount, totalSetCount } from "@/lib/workout-utils";
import type { Workout, WorkoutExercise, WorkoutSet } from "@/types";

const REST_SECONDS = 90;

function toDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  if (typeof val === "object" && "toDate" in (val as object)) {
    return (val as { toDate: () => Date }).toDate();
  }
  return undefined;
}

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
  // A plan whose day already passed = backfilling a forgotten session. It gets
  // logged directly (no live clock) and finish backdates it to that day.
  const isBacklog =
    isPlanned &&
    !!workout.scheduledFor &&
    startOfDay(workout.scheduledFor).getTime() < startOfDay(new Date()).getTime();
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
  const { completed } = useWorkouts();
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

  function mutateSet(exerciseId: string, setId: string, patch: Partial<WorkoutSet>) {
    const exercises = workout!.exercises.map((ex) =>
      ex.id !== exerciseId
        ? ex
        : { ...ex, sets: ex.sets.map((s) => (s.id !== setId ? s : { ...s, ...patch })) }
    );
    saveExercises(exercises);
  }

  function toggleSetComplete(exerciseId: string, set: WorkoutSet) {
    const completing = !set.isCompleted;
    mutateSet(exerciseId, set.id, {
      isCompleted: completing,
      completedAt: completing ? new Date() : undefined,
    });
    // No rest countdown while merely planning — only during a live session.
    if (completing && !isDone && !isPlanned) setRestEndsAt(Date.now() + REST_SECONDS * 1000);
  }

  function addSet(exercise: WorkoutExercise) {
    const last = exercise.sets[exercise.sets.length - 1];
    const fresh: WorkoutSet = {
      id: newId(),
      reps: last?.reps,
      weight: last?.weight,
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

  function moveExercise(exerciseId: string, direction: -1 | 1) {
    const list = [...workout!.exercises];
    const from = list.findIndex((ex) => ex.id === exerciseId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    // orderIndex keeps other readers (like plato-web) agreeing on the order.
    saveExercises(list.map((ex, i) => ({ ...ex, orderIndex: i })));
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
      // Backfilled sessions belong to the day they happened, not the day they
      // were typed in — anchor completedAt to noon of the scheduled day so it
      // lands on the right calendar day in every timezone. Duration is unknown
      // for backfills, so it's omitted rather than invented.
      const completedAt = isBacklog
        ? new Date(startOfDay(workout!.scheduledFor!).getTime() + 12 * 3_600_000)
        : new Date();
      const startedAt = workout!.startedAt ?? workout!.createdAt;
      const durationMinutes = isBacklog
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
    const incomplete = totalSetCount(workout!) - completedSetCount(workout!);
    if (incomplete === 0) {
      finishWith(workout!.exercises);
      return;
    }
    Alert.alert(
      "Finish workout?",
      `${incomplete} set${incomplete === 1 ? "" : "s"} not marked done.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard them",
          style: "destructive",
          onPress: () =>
            finishWith(
              workout!.exercises
                .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.isCompleted) }))
                .filter((ex) => ex.sets.length > 0)
            ),
        },
        {
          text: "Complete all",
          onPress: () =>
            finishWith(
              workout!.exercises.map((ex) => ({
                ...ex,
                sets: ex.sets.map((s) =>
                  s.isCompleted ? s : { ...s, isCompleted: true, completedAt: new Date() }
                ),
              }))
            ),
        },
      ]
    );
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
            } catch {
              Alert.alert("Couldn't resume workout", "Check your connection and try again.");
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
          await deleteWorkout(workout!.id);
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
                {isBacklog ? "Logging" : "Planned"}
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
            {isTemplate ? (
              <Text style={styles.summaryText}>
                {workout.exercises.length} exercise{workout.exercises.length === 1 ? "" : "s"} · {totalSetCount(workout)} sets
              </Text>
            ) : (
              <>
                <Text style={styles.summaryText}>
                  {displayVolume(workout.totalVolume ?? liveVolume, weightUnit)}
                </Text>
                <Text style={styles.summaryDot}>·</Text>
                <Text style={styles.summaryText}>
                  {completedSetCount(workout)}/{totalSetCount(workout)} sets
                </Text>
              </>
            )}
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

          {workout.exercises.map((exercise, index) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              prevSets={previousSets.get(exercise.exerciseId)}
              templateMode={isTemplate}
              onMoveUp={index > 0 ? () => moveExercise(exercise.id, -1) : undefined}
              onMoveDown={
                index < workout.exercises.length - 1
                  ? () => moveExercise(exercise.id, 1)
                  : undefined
              }
              readOnly={isDone}
              onToggleSet={(set) => toggleSetComplete(exercise.id, set)}
              onPatchSet={(setId, patch) => mutateSet(exercise.id, setId, patch)}
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

        {restEndsAt && !isDone && (
          <View style={styles.restBar}>
            <Ionicons name="timer-outline" size={18} color={Palette.accentText} />
            <Text style={styles.restText}>Rest {formatClock(restLeft)}</Text>
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
          ) : isBacklog ? (
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Exercise card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  prevSets,
  templateMode,
  onMoveUp,
  onMoveDown,
  readOnly,
  onToggleSet,
  onPatchSet,
  onAddSet,
  onRemoveSet,
  onRemove,
}: {
  exercise: WorkoutExercise;
  prevSets?: WorkoutSet[];
  templateMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  readOnly: boolean;
  onToggleSet: (set: WorkoutSet) => void;
  onPatchSet: (setId: string, patch: Partial<WorkoutSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemove: () => void;
}) {
  const { unit } = useWeightUnit();
  return (
    <Card style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseName}>{exercise.exercise.name}</Text>
          <Text style={styles.exerciseCategory}>{exercise.exercise.category}</Text>
        </View>
        {templateMode && (
          <>
            <Pressable
              onPress={onMoveUp}
              disabled={!onMoveUp}
              hitSlop={6}
              style={[styles.moveButton, !onMoveUp && { opacity: 0.3 }]}>
              <Ionicons name="chevron-up" size={16} color={Palette.textSecondary} />
            </Pressable>
            <Pressable
              onPress={onMoveDown}
              disabled={!onMoveDown}
              hitSlop={6}
              style={[styles.moveButton, !onMoveDown && { opacity: 0.3 }]}>
              <Ionicons name="chevron-down" size={16} color={Palette.textSecondary} />
            </Pressable>
          </>
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
              prev={prevSets?.[i] ?? prevSets?.[prevSets.length - 1]}
              readOnly={readOnly}
              onToggle={() => onToggleSet(set)}
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
  onToggle,
  onPatch,
  onRemove,
}: {
  index: number;
  set: WorkoutSet;
  prev?: WorkoutSet;
  readOnly: boolean;
  onToggle: () => void;
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
    onPatch({
      // Typed values are in the currently displayed unit, so store that unit.
      weight: validWeight,
      ...(validWeight != null ? { weightUnit: unit } : {}),
      reps: Number.isFinite(reps!) ? reps : undefined,
    });
  }

  return (
    <Pressable onLongPress={readOnly ? undefined : onRemove} style={[styles.setRow, set.isCompleted && styles.setRowDone]}>
      <Text style={[styles.setNum, styles.setNumCol]}>{index}</Text>
      <TextInput
        style={[styles.setInput, styles.inputCol]}
        value={weightText}
        onFocus={() => (editing.current = true)}
        onChangeText={setWeightText}
        onEndEditing={commit}
        keyboardType="decimal-pad"
        placeholder={prevWeight != null ? String(prevWeight) : "—"}
        placeholderTextColor={Palette.textTertiary}
        editable={!readOnly}
      />
      <TextInput
        style={[styles.setInput, styles.inputCol]}
        value={repsText}
        onFocus={() => (editing.current = true)}
        onChangeText={setRepsText}
        onEndEditing={commit}
        keyboardType="number-pad"
        placeholder={prev?.reps != null ? String(prev.reps) : "—"}
        placeholderTextColor={Palette.textTertiary}
        editable={!readOnly}
      />
      <Pressable
        onPress={readOnly ? undefined : onToggle}
        hitSlop={8}
        style={[styles.check, styles.checkCol, set.isCompleted && styles.checkDone]}>
        <Ionicons
          name="checkmark"
          size={16}
          color={set.isCompleted ? "#fff" : Palette.textTertiary}
        />
      </Pressable>
    </Pressable>
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
  },
  setRowDone: {
    opacity: 0.85,
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
  checkCol: {
    width: 34,
  },
  check: {
    height: 30,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.surfaceRaised,
  },
  checkDone: {
    backgroundColor: Palette.success,
    borderColor: Palette.success,
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
  moveButton: {
    width: 28,
    height: 28,
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
