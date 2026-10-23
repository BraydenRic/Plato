import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";

import { DRAG_LIFT_SCALE, DRAG_SPRING, FontScaleCap, Radius, Spacing } from "@/constants/theme";
import { makeStyles, usePalette } from "@/context/AppearanceContext";
import { useTheme } from "@/context/ThemeContext";

/**
 * A full-screen drag list with a Done button, for putting things in order:
 * templates, and the workouts within a day. Each row is a title, a line of
 * detail and a grip.
 *
 * Holds its own copy of the order so a drag is instant and doesn't fight the
 * live subscription underneath. That copy follows the source only when an item
 * is added or removed elsewhere; once you're dragging, the ids match and your
 * order stands.
 */
export function ReorderScreen<T extends { id: string }>({
  title,
  items,
  describe,
  onReorder,
}: {
  title: string;
  items: T[];
  describe: (item: T) => { title: string; meta: string };
  /** The items in their new order, after each drop. */
  onReorder: (items: T[]) => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const [order, setOrder] = useState<T[]>(items);

  useEffect(() => {
    const sameSet = order.length === items.length && order.every((t) => items.some((n) => n.id === t.id));
    if (!sameSet) setOrder(items);
  }, [items, order]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title} maxFontSizeMultiplier={FontScaleCap.title}>
          {title}
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.doneButton}>
          <Text style={[styles.doneText, { color: theme.accentText }]}>Done</Text>
        </Pressable>
      </View>

      <DraggableFlatList
        data={order}
        keyExtractor={(item) => item.id}
        // Same spring as the template editor: the list stays locked until a
        // drop settles, and its default takes ~1.8s to under Reanimated 4.
        animationConfig={DRAG_SPRING}
        onDragEnd={({ data }) => {
          setOrder(data);
          onReorder(data);
        }}
        contentContainerStyle={styles.list}
        renderItem={({ item, drag, isActive }) => {
          const row = describe(item);
          return (
            <ScaleDecorator activeScale={DRAG_LIFT_SCALE}>
              <View
                style={[styles.row, isActive && { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowName}>{row.title}</Text>
                  <Text style={styles.rowMeta}>{row.meta}</Text>
                </View>
                <Pressable onPressIn={drag} hitSlop={10} style={styles.handle} testID="reorder-handle">
                  <Ionicons name="reorder-two" size={22} color={palette.textSecondary} />
                </Pressable>
              </View>
            </ScaleDecorator>
          );
        }}
      />
    </SafeAreaView>
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
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.5,
  },
  doneButton: {
    paddingHorizontal: 4,
  },
  doneText: {
    fontSize: 15,
    fontWeight: "700",
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    padding: Spacing.three,
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
  handle: {
    padding: 4,
  },
}));
