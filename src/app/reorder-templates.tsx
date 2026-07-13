import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";

import { Palette, Radius, Spacing } from "@/constants/theme";
import { useWorkouts } from "@/hooks/use-workouts";
import { updateWorkout } from "@/lib/firestore";
import { totalSetCount } from "@/lib/workout-utils";
import type { Workout } from "@/types";

export default function ReorderTemplatesScreen() {
  const { templates } = useWorkouts();
  // Local copy so the drag is instant and doesn't fight the live subscription.
  const [order, setOrder] = useState<Workout[]>(templates);

  // Keep in sync if a template is added/removed elsewhere, but leave the order
  // alone once the user starts dragging (the ids match, just repositioned).
  useEffect(() => {
    const sameSet =
      order.length === templates.length &&
      order.every((t) => templates.some((n) => n.id === t.id));
    if (!sameSet) setOrder(templates);
  }, [templates, order]);

  function persist(data: Workout[]) {
    setOrder(data);
    // Write each template's new position. orderIndex keeps every reader
    // (this app and plato-web) in agreement on the sequence.
    data.forEach((t, i) => {
      if (t.orderIndex !== i) updateWorkout(t.id, { orderIndex: i });
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Reorder templates</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.doneButton}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Drag the handles to set the order they appear in.</Text>

      <DraggableFlatList
        data={order}
        keyExtractor={(t) => t.id}
        onDragEnd={({ data }) => persist(data)}
        contentContainerStyle={styles.list}
        renderItem={({ item, drag, isActive }) => (
          <ScaleDecorator>
            <View style={[styles.row, isActive && styles.rowActive]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.exercises.length} exercise{item.exercises.length === 1 ? "" : "s"} ·{" "}
                  {totalSetCount(item)} sets
                </Text>
              </View>
              <Pressable onPressIn={drag} hitSlop={10} style={styles.handle}>
                <Ionicons name="reorder-two" size={22} color={Palette.textSecondary} />
              </Pressable>
            </View>
          </ScaleDecorator>
        )}
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
    paddingTop: Spacing.three,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: -0.5,
  },
  doneButton: {
    paddingHorizontal: 4,
  },
  doneText: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.accentText,
  },
  hint: {
    fontSize: 13,
    color: Palette.textTertiary,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.three,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
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
  rowActive: {
    borderColor: Palette.accent,
    backgroundColor: Palette.accentSoft,
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
  handle: {
    padding: 4,
  },
});
