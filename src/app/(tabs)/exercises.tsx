import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Chip, Field } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { useExerciseLibrary } from "@/hooks/use-exercise-library";
import type { Exercise } from "@/types";

export default function ExercisesScreen() {
  const { exercises, isModified, deleteExercise, resetLibrary } = useExerciseLibrary();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(
    () => ["All", ...new Set(exercises.map((e) => e.category))],
    [exercises]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (category === "All" || e.category === category) &&
        (term === "" ||
          e.name.toLowerCase().includes(term) ||
          e.musclesWorked.some((m) => m.toLowerCase().includes(term)))
    );
  }, [exercises, search, category]);

  function confirmDelete(exercise: Exercise) {
    Alert.alert(
      "Delete exercise?",
      exercise.isCustom
        ? `"${exercise.name}" will be removed from your library. Logged workouts keep it.`
        : `"${exercise.name}" will be hidden from your library. Reset brings it back.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteExercise(exercise) },
      ]
    );
  }

  function confirmReset() {
    Alert.alert(
      "Reset library?",
      "Restores all default exercises and deletes your custom ones.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: () => resetLibrary() },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>Exercises</Text>
          <Text style={styles.subtitle}>
            {exercises.length} movements · hold one to delete
          </Text>
        </View>
        {isModified && (
          <Pressable onPress={confirmReset} hitSlop={8} style={styles.headerButton}>
            <Ionicons name="refresh" size={18} color={Palette.textSecondary} />
          </Pressable>
        )}
        <Pressable
          onPress={() => router.push("/create-exercise")}
          hitSlop={8}
          style={[styles.headerButton, styles.headerButtonAccent]}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Field placeholder="Search exercises or muscles" value={search} onChangeText={setSearch} autoCorrect={false} />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {categories.map((c) => (
            <Chip key={c} label={c} active={c === category} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ExerciseRow
            exercise={item}
            onPress={() => router.push(`/exercise/${item.id}`)}
            onLongPress={() => confirmDelete(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function ExerciseRow({
  exercise,
  onPress,
  onLongPress,
}: {
  exercise: Exercise;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.rowName}>{exercise.name}</Text>
          <Text style={styles.rowMeta}>{exercise.musclesWorked.join(" · ")}</Text>
        </View>
        {exercise.isCustom && (
          <View style={[styles.categoryBadge, styles.customBadge]}>
            <Text style={styles.categoryText}>Custom</Text>
          </View>
        )}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{exercise.category}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Palette.textTertiary} />
      </View>
    </Pressable>
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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Palette.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonAccent: {
    backgroundColor: Palette.accent,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Palette.textTertiary,
  },
  searchWrap: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  chips: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  row: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
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
  categoryBadge: {
    backgroundColor: Palette.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  customBadge: {
    backgroundColor: Palette.surfaceRaised,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
    color: Palette.accentText,
  },
});
