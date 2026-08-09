import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ExerciseProgress } from "@/components/exercise-progress";
import { MuscleMap } from "@/components/muscle-map";
import { SectionLabel } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { makeStyles, usePalette } from "@/context/AppearanceContext";
import { formGuideFor, type FormFault } from "@/lib/exercise-form";
import { useExerciseLibrary } from "@/hooks/use-exercise-library";
import { useTheme } from "@/context/ThemeContext";

export default function ExerciseDetailScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { exercises, deleteExercise } = useExerciseLibrary();
  const theme = useTheme();
  const exercise = exercises.find((e) => e.id === id);
  const guide = exercise ? formGuideFor(exercise.id) : undefined;
  const [guideOpen, setGuideOpen] = useState(false);

  function confirmDelete() {
    if (!exercise) return;
    Alert.alert(
      "Delete exercise?",
      exercise.isCustom
        ? `"${exercise.name}" will be removed from your library. Logged workouts keep it.`
        : `"${exercise.name}" will be hidden from your library. Reset brings it back.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteExercise(exercise);
            router.back();
          },
        },
      ]
    );
  }

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
          <Text style={[styles.meta, { color: theme.accentText }]}>{exercise.category}</Text>
        </View>
        <Pressable
          onPress={() => router.push({ pathname: "/create-exercise", params: { exerciseId: exercise.id } })}
          hitSlop={12}
          style={styles.closeButton}>
          <Ionicons name="pencil" size={16} color={palette.textSecondary} />
        </Pressable>
        <Pressable onPress={confirmDelete} hitSlop={12} style={styles.closeButton}>
          <Ionicons name="trash-outline" size={18} color={palette.textSecondary} />
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={palette.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.muscleChips}>
          {exercise.musclesWorked.map((m) => (
            <View key={m} style={[styles.muscleChip, { backgroundColor: theme.accentSoft }]}>
              <Text style={[styles.muscleChipText, { color: theme.accentText }]}>{m}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.description}>{exercise.description}</Text>

        {/*
          Folded away by default.

          Three sections of cues is the right amount when you came here to learn
          the movement, and too much every other time — which is most times,
          since this screen is also how you check what you lifted last. Behind
          one tap it costs a row; open by default it pushed the progress chart
          off the bottom of the screen.

          Collapsed again on every visit rather than remembered. The state that
          suits you changes with why you opened the screen, not with what you
          chose last week.

          Only the bundled exercises have a guide; a custom one shows its own
          description and no toggle at all, rather than one that opens onto
          nothing.
        */}
        {guide && (
          <View style={styles.guide}>
            <Pressable
              onPress={() => setGuideOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: guideOpen }}
              accessibilityLabel={`How to do it. ${guideOpen ? "Collapse" : "Expand"}.`}
              style={({ pressed }) => [styles.guideToggle, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.guideToggleText, { color: theme.accentText }]}>
                How to do it
              </Text>
              <Ionicons
                name={guideOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.accentText}
              />
            </Pressable>

            {guideOpen && (
              <View style={styles.guideBody}>
                <FormSection label="Set up" lines={guide.setup} />
                <FormSection label="The lift" lines={guide.execution} />
                <FaultSection label="Watch for" faults={guide.watchFor} accent={theme.accentText} />
              </View>
            )}
          </View>
        )}

        <View>
          <SectionLabel>Your progress</SectionLabel>
          <ExerciseProgress exerciseId={exercise.id} />
        </View>

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

/**
 * One block of the form guide.
 *
 * The marker is a dot rather than a number: these are things that are true at
 * the same time, not steps in an order, and numbering them would promise a
 * sequence the content does not have. "Watch for" takes the accent so the
 * mistakes read as the part worth slowing down on.
 */
function FormSection({
  label,
  lines,
  accent,
}: {
  label: string;
  lines: string[];
  accent?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.formSection}>
      <SectionLabel>{label}</SectionLabel>
      {lines.map((line) => (
        <View key={line} style={styles.formLine}>
          <View style={[styles.formDot, accent ? { backgroundColor: accent } : null]} />
          <Text style={styles.formText}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The mistakes, each with what to do about it.
 *
 * The fix sits under the mistake rather than beside it, because the mistake is
 * what you scan for and the fix is what you read once you have found yourself
 * in one.
 */
function FaultSection({
  label,
  faults,
  accent,
}: {
  label: string;
  faults: FormFault[];
  accent: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.formSection}>
      <SectionLabel>{label}</SectionLabel>
      {faults.map((fault) => (
        <View key={fault.mistake} style={styles.formLine}>
          <View style={[styles.formDot, { backgroundColor: accent }]} />
          <View style={styles.faultBody}>
            <Text style={styles.formText}>{fault.mistake}</Text>
            <Text style={styles.faultFix}>{fault.fix}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  missing: {
    color: c.textSecondary,
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
    color: c.text,
    letterSpacing: -0.3,
  },
  meta: {
    fontSize: 13,
    fontWeight: "600",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: c.surfaceRaised,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  muscleChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: c.textSecondary,
  },
  guide: {
    gap: Spacing.three,
  },
  guideToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.border,
  },
  guideToggleText: {
    fontSize: 14,
    fontWeight: "700",
  },
  guideBody: {
    gap: Spacing.four,
  },
  formSection: {
    gap: Spacing.two,
  },
  formLine: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  formDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.textTertiary,
    // Sits on the first line's optical centre rather than the top of the box.
    marginTop: 8,
  },
  faultBody: {
    flex: 1,
    gap: 3,
  },
  faultFix: {
    fontSize: 13,
    lineHeight: 20,
    color: c.textTertiary,
  },
  formText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: c.textSecondary,
  },
  mapCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
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
    color: c.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
}));
