import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Chip, Field } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { makeStyles, usePalette } from "@/context/AppearanceContext";
import { useTheme } from "@/context/ThemeContext";
import { useExerciseLibrary } from "@/hooks/use-exercise-library";
import { filterExercises } from "@/lib/exercises";
import type { Exercise } from "@/types";

export default function ExercisesScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const { exercises, isModified, deleteExercise, resetLibrary } = useExerciseLibrary();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(
    () => ["All", ...new Set(exercises.map((e) => e.category))],
    [exercises]
  );

  const filtered = useMemo(
    () => filterExercises(exercises, search, category),
    [exercises, search, category]
  );

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
    <View style={styles.safe}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>Exercises</Text>
          <Text style={styles.subtitle}>
            {exercises.length} movements · hold one to delete
          </Text>
        </View>
        {isModified && (
          <Pressable onPress={confirmReset} hitSlop={8} style={styles.headerButton}>
            <Ionicons name="refresh" size={18} color={palette.textSecondary} />
          </Pressable>
        )}
        <Pressable
          onPress={() => router.push("/create-exercise")}
          hitSlop={8}
          style={[styles.headerButton, { backgroundColor: theme.accent }]}>
          <Ionicons name="add" size={22} color={theme.onAccent} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        {/*
          defaultValue rather than value, deliberately.

          A controlled TextInput has its native text "forced to match" the prop
          on every render, and when the round-trip through state lags the
          keyboard — which it does here, since each keystroke re-filters ~180
          exercises and redraws the list — the input gets set back to the
          previous string and the caret lands mid-word. Typing, deleting and
          typing again was a reliable way to end up inserting in the middle of
          what you'd written. React Native's own docs call this out: controlled
          inputs "might drop characters during rapid user input".

          Nothing sets `search` except this field, so the prop was pure echo and
          bought nothing for the risk. Uncontrolled, the native input owns the
          text and state just observes it. If a Clear button ever lands here it
          will need a ref and .clear(), because defaultValue won't push a new
          value in after mount — that's the trade.
        */}
        <Field
          placeholder="Search exercises"
          defaultValue={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {categories.map((c) => (
            <Chip
              key={c}
              label={c}
              active={c === category}
              // Tapping the active category again clears it back to "All".
              onPress={() => setCategory((prev) => (prev === c ? "All" : c))}
            />
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
    </View>
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
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.rowName}>{exercise.name}</Text>
          <Text style={styles.rowMeta}>{exercise.musclesWorked.join(" · ")}</Text>
        </View>
        {exercise.isCustom && (
          <View
            style={[styles.categoryBadge, { backgroundColor: theme.accentSoft }, styles.customBadge]}>
            <Text style={[styles.categoryText, { color: theme.accentText }]}>Custom</Text>
          </View>
        )}
        <View style={[styles.categoryBadge, { backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.categoryText, { color: theme.accentText }]}>{exercise.category}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.textTertiary} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
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
    backgroundColor: c.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: c.textTertiary,
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
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
    color: c.text,
  },
  rowMeta: {
    fontSize: 12,
    color: c.textTertiary,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  customBadge: {
    backgroundColor: c.surfaceRaised,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
  },
}));
