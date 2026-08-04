import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Chip, Field } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { useWeightUnit } from "@/context/UnitContext";
import { useTheme } from "@/context/ThemeContext";
import { useDefaultSets } from "@/context/DefaultSetsContext";
import { stripUndefined, subscribeWorkout, updateWorkout } from "@/lib/data";
import { useExerciseLibrary } from "@/hooks/use-exercise-library";
import { filterExercises } from "@/lib/exercises";
import { newId } from "@/lib/workout-utils";
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from "@/types";

export default function AddExerciseModal() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const router = useRouter();
  const { exercises } = useExerciseLibrary();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const { unit } = useWeightUnit();
  const theme = useTheme();
  const { defaultSets } = useDefaultSets();

  /**
   * The workout's exercises, live.
   *
   * Was a fresh getWorkout on every add, which reads the *server*. That could
   * not see a workout whose creation had not been acked yet — the case for
   * anything opened straight after starting one — and two quick adds would both
   * read the same pre-add copy and the second would overwrite the first.
   *
   * A ref rather than state because consecutive adds have to compose: the write
   * for the second has to build on the first, which a re-render has not
   * necessarily delivered yet.
   */
  const exercisesRef = useRef<WorkoutExercise[] | null>(null);
  useEffect(() => {
    if (!workoutId) return;
    return subscribeWorkout(workoutId, (next) => {
      if (next) exercisesRef.current = next.exercises;
    });
  }, [workoutId]);

  const categories = useMemo(
    () => ["All", ...new Set(exercises.map((e) => e.category))],
    [exercises]
  );

  const filtered = useMemo(
    () => filterExercises(exercises, search, category),
    [exercises, search, category]
  );

  async function add(exercise: Exercise) {
    if (!workoutId || addedIds.has(exercise.id)) return;
    setAddedIds((prev) => new Set(prev).add(exercise.id));
    try {
      // Built from the live copy, which is the same one the workout screen is
      // rendering, so this write can't be based on a version it never saw.
      const current = exercisesRef.current;
      if (!current) throw new Error("workout not loaded");
      // Start with the user's preferred number of empty sets (Profile → Default sets).
      const startingSets: WorkoutSet[] = Array.from({ length: defaultSets }, () => ({
        id: newId(),
        weightUnit: unit,
        isCompleted: false,
      }));
      const exercises = [
        ...current,
        {
          id: newId(),
          exerciseId: exercise.id,
          exercise,
          orderIndex: current.length,
          sets: startingSets,
        },
      ];
      // Bank it before the await so a second add composes onto this one rather
      // than racing the round-trip.
      exercisesRef.current = exercises;
      await updateWorkout(workoutId, stripUndefined({ exercises }) as Partial<Workout>);
    } catch {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(exercise.id);
        return next;
      });
      Alert.alert("Couldn't add exercise", "Check your connection and try again.");
    }
  }

  // Tapping the check on an exercise you just added undoes it — handy for
  // fixing an accidental tap without leaving this screen.
  async function remove(exercise: Exercise) {
    if (!workoutId) return;
    setAddedIds((prev) => {
      const next = new Set(prev);
      next.delete(exercise.id);
      return next;
    });
    try {
      const current = exercisesRef.current;
      if (!current) throw new Error("workout not loaded");
      // Drop only the copy we added this session (the last one with this id), so
      // a pre-existing copy of the same exercise stays put. Reindex to keep
      // orderIndex contiguous.
      const exercises = [...current];
      const last = exercises.map((ex) => ex.exerciseId).lastIndexOf(exercise.id);
      if (last === -1) return;
      exercises.splice(last, 1);
      const reindexed = exercises.map((ex, i) => ({ ...ex, orderIndex: i }));
      exercisesRef.current = reindexed;
      await updateWorkout(workoutId, stripUndefined({ exercises: reindexed }) as Partial<Workout>);
    } catch {
      // Put the check back — the exercise is still on the template.
      setAddedIds((prev) => new Set(prev).add(exercise.id));
      Alert.alert("Couldn't remove exercise", "Check your connection and try again.");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Add exercise</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.done, { color: theme.accentText }]}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Field
          placeholder="Search exercises"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {categories.map((c) => (
            <Chip
              key={c}
              label={c}
              active={c === category}
              // Tapping the active category again clears the filter back to "All",
              // matching the toggle behavior on the Exercises tab.
              onPress={() => setCategory((prev) => (prev === c ? "All" : c))}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const added = addedIds.has(item.id);
          return (
            <Pressable
              onPress={() => (added ? remove(item) : add(item))}
              style={[styles.row, added && styles.rowAdded]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>{item.musclesWorked.join(" · ")}</Text>
              </View>
              <View
                style={[
                  styles.addIcon,
                  { backgroundColor: theme.accentSoft },
                  added && styles.addIconDone,
                ]}>
                <Ionicons name={added ? "checkmark" : "add"} size={18} color={added ? "#fff" : theme.accentText} />
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: Palette.text,
  },
  done: {
    fontSize: 16,
    fontWeight: "600",
  },
  searchWrap: {
    paddingHorizontal: Spacing.three,
  },
  chips: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  rowAdded: {
    borderColor: Palette.success,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "600",
    color: Palette.text,
  },
  rowMeta: {
    fontSize: 12,
    color: Palette.textTertiary,
  },
  addIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  addIconDone: {
    backgroundColor: Palette.success,
  },
});
