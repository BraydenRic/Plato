import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { MuscleMap } from "@/components/muscle-map";
import { SectionLabel } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { EXERCISES } from "@/lib/exercises";

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = EXERCISES.find((e) => e.id === id);

  if (!exercise) {
    return (
      <View style={[styles.safe, styles.center]}>
        <Text style={styles.missing}>Exercise not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>{exercise.name}</Text>
          <Text style={styles.meta}>{exercise.category}</Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={Palette.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.muscleChips}>
          {exercise.musclesWorked.map((m) => (
            <View key={m} style={styles.muscleChip}>
              <Text style={styles.muscleChipText}>{m}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.description}>{exercise.description}</Text>

        <View>
          <SectionLabel>Muscles worked</SectionLabel>
          <View style={styles.mapCard}>
            <MuscleMap musclesWorked={exercise.musclesWorked} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.bg,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  missing: {
    color: Palette.textSecondary,
    fontSize: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.three,
    paddingTop: Spacing.four,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: -0.3,
  },
  meta: {
    fontSize: 13,
    color: Palette.accentText,
    fontWeight: "600",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Palette.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  muscleChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  muscleChip: {
    backgroundColor: Palette.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  muscleChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.accentText,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: Palette.textSecondary,
  },
  mapCard: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  mapLabels: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  mapLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Palette.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
