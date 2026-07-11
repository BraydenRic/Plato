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
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Button, Card, EmptyState } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { db } from "@/lib/firebase";
import { getCompletedWorkouts, saveAsTemplate, stripUndefined, updateWorkout, upsertUserStats, computeStats, deleteWorkout } from "@/lib/firestore";
import { formatClock, formatVolume, newId, relativeDay, startOfDay, workoutVolumeLbs, completedSetCount, totalSetCount } from "@/lib/workout-utils";
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
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">("lbs");

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

  useEffect(() => {
    AsyncStorage.getItem("weight_unit").then((u) => {
      if (u === "kg" || u === "lbs") setWeightUnit(u);
    });
  }, []);

  // Elapsed workout clock (only while in progress).
  const startedAtMs = workout?.startedAt?.getTime();
  const isDone = !!workout?.completedAt;
  // Scheduled ahead of time and not yet begun: editable as a plan, no clock.
  const isPlanned = !!workout && !workout.startedAt && !workout.completedAt;
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

  function openMenu() {
    Alert.alert(workout!.name, undefined, [
      { text: "Cancel", style: "cancel" },
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
      {
        text: "Delete workout",
        style: "destructive",
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
            {isDone ? (
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
            <Text style={styles.summaryText}>
              {formatVolume(workout.totalVolume ?? liveVolume)} lbs
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

        {!isDone && (
          <View style={styles.footer}>
            {isBacklog ? (
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
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Exercise card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  readOnly,
  onToggleSet,
  onPatchSet,
  onAddSet,
  onRemoveSet,
  onRemove,
}: {
  exercise: WorkoutExercise;
  readOnly: boolean;
  onToggleSet: (set: WorkoutSet) => void;
  onPatchSet: (setId: string, patch: Partial<WorkoutSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemove: () => void;
}) {
  return (
    <Card style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseName}>{exercise.exercise.name}</Text>
          <Text style={styles.exerciseCategory}>{exercise.exercise.category}</Text>
        </View>
        {!readOnly && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Ionicons name="close" size={18} color={Palette.textTertiary} />
          </Pressable>
        )}
      </View>

      <View style={styles.setHeaderRow}>
        <Text style={[styles.setHeaderCell, styles.setNumCol]}>SET</Text>
        <Text style={[styles.setHeaderCell, styles.inputCol]}>WEIGHT</Text>
        <Text style={[styles.setHeaderCell, styles.inputCol]}>REPS</Text>
        <View style={styles.checkCol} />
      </View>

      {exercise.sets.map((set, i) => (
        <SetRow
          key={set.id}
          index={i + 1}
          set={set}
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
    </Card>
  );
}

// Numeric inputs hold local text while editing and commit on blur —
// whole-object patches only, so a set can never be partially zeroed.
function SetRow({
  index,
  set,
  readOnly,
  onToggle,
  onPatch,
  onRemove,
}: {
  index: number;
  set: WorkoutSet;
  readOnly: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<WorkoutSet>) => void;
  onRemove: () => void;
}) {
  const [weightText, setWeightText] = useState(set.weight != null ? String(set.weight) : "");
  const [repsText, setRepsText] = useState(set.reps != null ? String(set.reps) : "");
  const editing = useRef(false);

  // Sync remote changes into the inputs when not actively editing.
  useEffect(() => {
    if (editing.current) return;
    setWeightText(set.weight != null ? String(set.weight) : "");
    setRepsText(set.reps != null ? String(set.reps) : "");
  }, [set.weight, set.reps]);

  function commit() {
    editing.current = false;
    const weight = weightText.trim() === "" ? undefined : Number(weightText.replace(",", "."));
    const reps = repsText.trim() === "" ? undefined : Math.round(Number(repsText));
    onPatch({
      weight: Number.isFinite(weight!) ? weight : undefined,
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
        placeholder="—"
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
        placeholder="—"
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
  footer: {
    padding: Spacing.three,
    paddingTop: 0,
  },
});
