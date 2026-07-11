import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Chip, Field } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { EXERCISES } from "@/lib/exercises";
import type { Exercise } from "@/types";

const CATEGORIES = ["All", ...new Set(EXERCISES.map((e) => e.category))];

export default function ExercisesScreen() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Exercises</Text>
        <Text style={styles.subtitle}>{EXERCISES.length} movements in the library</Text>
      </View>

      <View style={styles.searchWrap}>
        <Field placeholder="Search exercises or muscles" value={search} onChangeText={setSearch} autoCorrect={false} />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} active={c === category} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ExerciseRow exercise={item} onPress={() => router.push(`/exercise/${item.id}`)} />
        )}
      />
    </SafeAreaView>
  );
}

function ExerciseRow({ exercise, onPress }: { exercise: Exercise; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.rowName}>{exercise.name}</Text>
          <Text style={styles.rowMeta}>{exercise.musclesWorked.join(" · ")}</Text>
        </View>
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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: 2,
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
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
    color: Palette.accentText,
  },
});
