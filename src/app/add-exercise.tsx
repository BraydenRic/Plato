import { useMemo, useState } from "react";
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
import { EXERCISES } from "@/lib/exercises";
import { getWorkout, stripUndefined, updateWorkout } from "@/lib/firestore";
import { newId } from "@/lib/workout-utils";
import type { Exercise, Workout, WorkoutSet } from "@/types";

const CATEGORIES = ["All", ...new Set(EXERCISES.map((e) => e.category))];

export default function AddExerciseModal() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const { unit } = useWeightUnit();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return EXERCISES.filter(
      (e) =>
        (category === "All" || e.category === category) &&
        (term === "" ||
          e.name.toLowerCase().includes(term) ||
          e.musclesWorked.some((m) => m.toLowerCase().includes(term)))
    );
  }, [search, category]);

  async function add(exercise: Exercise) {
    if (!workoutId || addedIds.has(exercise.id)) return;
    setAddedIds((prev) => new Set(prev).add(exercise.id));
    try {
      // Read-modify-write of the embedded exercises array. The workout screen
      // is subscribed to this doc, so it updates the moment this lands.
      const workout = await getWorkout(workoutId);
      if (!workout) throw new Error("workout missing");
      const startingSets: WorkoutSet[] = [
        { id: newId(), weightUnit: unit, isCompleted: false },
        { id: newId(), weightUnit: unit, isCompleted: false },
        { id: newId(), weightUnit: unit, isCompleted: false },
      ];
      const exercises = [
        ...workout.exercises,
        {
          id: newId(),
          exerciseId: exercise.id,
          exercise,
          orderIndex: workout.exercises.length,
          sets: startingSets,
        },
      ];
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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Add exercise</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Field
          placeholder="Search exercises or muscles"
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
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} active={c === category} onPress={() => setCategory(c)} />
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
            <Pressable onPress={() => add(item)} style={[styles.row, added && styles.rowAdded]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>{item.musclesWorked.join(" · ")}</Text>
              </View>
              <View style={[styles.addIcon, added && styles.addIconDone]}>
                <Ionicons name={added ? "checkmark" : "add"} size={18} color={added ? "#fff" : Palette.accentText} />
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
    color: Palette.accentText,
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
    backgroundColor: Palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addIconDone: {
    backgroundColor: Palette.success,
  },
});
