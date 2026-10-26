import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, type ComponentProps } from "react";
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui";
import { FontScaleCap, Radius, Spacing } from "@/constants/theme";
import { makeStyles, usePalette } from "@/context/AppearanceContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useWeeklyPlan } from "@/hooks/use-weekly-plan";
import { useWorkouts } from "@/hooks/use-workouts";
import { createWorkoutLocalFirst, startFromTemplate, stripUndefined } from "@/lib/data";
import { MAX_ACTIVE_WORKOUTS, defaultWorkoutName, totalSetCount } from "@/lib/workout-utils";

/** A blank workout, or one of the templates by id. */
type Choice = "blank" | string;

interface Tile {
  id: Choice;
  title: string;
  meta: string;
  icon: ComponentProps<typeof Ionicons>["name"];
}

/**
 * Starting a workout: blank, or from one of your templates. Laid out like
 * Start cardio, pick then Start, so the two buttons side by side on Home open
 * the same kind of sheet. Today's weekly-split template is picked to begin
 * with, so on a planned day Start is the only tap left.
 */
export default function StartWorkoutScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const router = useRouter();
  const { dataUserId } = useAuth();
  const { templates, active } = useWorkouts();
  const { plan } = useWeeklyPlan();
  const { fontScale } = useWindowDimensions();
  // Two to a row, until the text is big enough that a name would break
  // mid-word in half the width.
  const oneColumn = fontScale > 1.3;
  const [picked, setPicked] = useState<Choice | null>(null);
  const [starting, setStarting] = useState(false);

  // Worked out each render rather than set once: the templates and the split
  // arrive after the first one. A tap wins; a template deleted meanwhile doesn't.
  const todaysId = plan[new Date().getDay()];
  const todays = templates.find((t) => t.id === todaysId);
  const choice: Choice =
    picked && (picked === "blank" || templates.some((t) => t.id === picked)) ? picked : todays?.id ?? "blank";
  const template = templates.find((t) => t.id === choice);

  const tiles: Tile[] = [
    { id: "blank", title: "Blank workout", meta: "Add exercises as you go", icon: "add" },
    ...templates.map((t) => ({
      id: t.id,
      title: t.name,
      meta: `${t.exercises.length} exercise${t.exercises.length === 1 ? "" : "s"} · ${totalSetCount(t)} sets`,
      icon: "barbell-outline" as const,
    })),
  ];

  function start() {
    if (!dataUserId || starting) return;
    if (active.length >= MAX_ACTIVE_WORKOUTS) {
      Alert.alert(
        "Too many workouts in progress",
        `Finish or delete one of your ${MAX_ACTIVE_WORKOUTS} in-progress workouts before starting another.`
      );
      return;
    }
    setStarting(true);
    const { id, saved } = template
      ? startFromTemplate(template, dataUserId)
      : createWorkoutLocalFirst(
          stripUndefined({
            userId: dataUserId,
            name: defaultWorkoutName(),
            isTemplate: false,
            exercises: [],
            createdAt: new Date(),
            startedAt: new Date(),
          })
        );
    // Straight into the workout, with this sheet gone from the stack behind it.
    router.replace(`/workout/${id}`);
    saved.catch(() => Alert.alert("Couldn't start workout", "Check your connection and try again."));
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title} maxFontSizeMultiplier={FontScaleCap.title}>
          Start workout
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close" style={styles.close}>
          <Ionicons name="close" size={20} color={palette.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.grid}>
          {tiles.map((tile) => {
            const selected = tile.id === choice;
            const isTodays = tile.id === todays?.id;
            return (
              <Pressable
                key={tile.id}
                onPress={() => setPicked(tile.id)}
                accessibilityRole="button"
                accessibilityLabel={`${tile.title}, ${tile.meta}${isTodays ? ", today's split" : ""}`}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.tile,
                  oneColumn && styles.tileWide,
                  selected
                    ? { backgroundColor: theme.accentSoft, borderColor: theme.accent }
                    : { backgroundColor: palette.surface, borderColor: palette.border },
                  pressed && { opacity: 0.8 },
                ]}>
                <View style={styles.tileTop}>
                  <Ionicons name={tile.icon} size={22} color={selected ? theme.accentText : palette.textSecondary} />
                  {isTodays && (
                    <View style={[styles.today, { backgroundColor: theme.accent }]}>
                      <Text style={[styles.todayText, { color: theme.onAccent }]} maxFontSizeMultiplier={FontScaleCap.grid}>
                        Today
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tileTitle, { color: selected ? theme.accentText : palette.text }]}>{tile.title}</Text>
                <Text style={styles.tileMeta}>{tile.meta}</Text>
              </Pressable>
            );
          })}
        </View>
        {templates.length === 0 && (
          <Text style={styles.hint}>Templates you make on Home show up here, ready to start.</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title={template ? `Start ${template.name}` : "Start blank workout"} onPress={start} loading={starting} />
      </View>
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
    padding: Spacing.three,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: c.text,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: c.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  // Two to a row. Tiles in a row stretch to the taller one, so a long name
  // wraps onto another line instead of being cut off, and the row stays even.
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 112,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  tileWide: {
    flexBasis: "100%",
  },
  tileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    marginBottom: 2,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  tileMeta: {
    fontSize: 12,
    color: c.textTertiary,
  },
  today: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  todayText: {
    fontSize: 11,
    fontWeight: "700",
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: c.textTertiary,
  },
  footer: {
    padding: Spacing.three,
  },
}));
