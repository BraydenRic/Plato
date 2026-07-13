import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button, Field, SectionLabel } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { useExerciseLibrary, MAX_CUSTOM_EXERCISES } from "@/hooks/use-exercise-library";
import { EXERCISES } from "@/lib/exercises";

const CATEGORIES = [...new Set(EXERCISES.map((e) => e.category))];

// Names the muscle diagram understands (see MUSCLE_NAME_TO_SLUGS), so custom
// exercises light up the body map just like built-ins do.
const MUSCLE_OPTIONS = [
  "Chest", "Back", "Lats", "Traps", "Shoulders",
  "Biceps", "Triceps", "Forearms", "Abs", "Obliques",
  "Quads", "Hamstrings", "Glutes", "Calves", "Hip Flexors",
];

export default function CreateExerciseModal() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId?: string }>();
  const { exercises, customCount, createExercise, updateExercise } = useExerciseLibrary();
  // Editing reuses this form: prefill from the existing exercise and save
  // under the same id so workout history and last-weight lookups keep working.
  const editing = exerciseId ? exercises.find((e) => e.id === exerciseId) : undefined;

  const [name, setName] = useState(editing?.name ?? "");
  const [category, setCategory] = useState<string | null>(editing?.category ?? null);
  // Selection order matters: the first muscle picked is the primary target,
  // which the diagram shows in the stronger violet.
  const [muscles, setMuscles] = useState<string[]>(editing?.musclesWorked ?? []);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [saving, setSaving] = useState(false);

  // Some built-ins use muscle names outside the curated chips (e.g. "Upper
  // Chest", "Core") — surface those too so an edit round-trips cleanly.
  const muscleOptions = useMemo(
    () => [...new Set([...MUSCLE_OPTIONS, ...(editing?.musclesWorked ?? [])])],
    [editing]
  );
  const categoryOptions = useMemo(
    () => [...new Set([...CATEGORIES, ...(editing?.category ? [editing.category] : [])])],
    [editing]
  );

  function toggleMuscle(m: string) {
    setMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  const canSave = name.trim().length > 0 && !!category && muscles.length > 0;

  async function save() {
    if (!canSave || saving) return;
    // Only new exercises count against the cap — editing an existing one is fine.
    if (!editing && customCount >= MAX_CUSTOM_EXERCISES) {
      Alert.alert(
        "Custom exercise limit reached",
        `You can create up to ${MAX_CUSTOM_EXERCISES} custom exercises. Delete one you no longer use to make room.`
      );
      return;
    }
    setSaving(true);
    try {
      const fields = {
        name: name.trim(),
        category: category!,
        musclesWorked: muscles,
        description: description.trim() || `Custom exercise targeting ${muscles.join(", ").toLowerCase()}.`,
      };
      if (editing) {
        await updateExercise({ ...editing, ...fields });
      } else {
        await createExercise(fields);
      }
      router.back();
    } catch {
      Alert.alert("Couldn't save exercise", "Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{editing ? "Edit exercise" : "New exercise"}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={Palette.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View>
          <SectionLabel>Name</SectionLabel>
          <Field
            placeholder="e.g. Landmine Press"
            value={name}
            onChangeText={setName}
            autoCorrect={false}
            autoFocus
          />
        </View>

        <View>
          <SectionLabel>Category</SectionLabel>
          <View style={styles.chipWrap}>
            {categoryOptions.map((c) => (
              <SelectChip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
        </View>

        <View>
          <SectionLabel>Muscles worked</SectionLabel>
          <Text style={styles.hint}>Pick the primary target first — it shows brightest on the diagram.</Text>
          <View style={styles.chipWrap}>
            {muscleOptions.map((m) => {
              const order = muscles.indexOf(m);
              return (
                <SelectChip
                  key={m}
                  label={order === 0 ? `${m} · primary` : m}
                  active={order >= 0}
                  onPress={() => toggleMuscle(m)}
                />
              );
            })}
          </View>
        </View>

        <View>
          <SectionLabel>Description (optional)</SectionLabel>
          <Field
            placeholder="Setup cues, tempo, anything worth remembering"
            value={description}
            onChangeText={setDescription}
            multiline
            style={styles.descriptionField}
          />
        </View>

        <Button
          title={editing ? "Save changes" : "Create exercise"}
          onPress={save}
          loading={saving}
          disabled={!canSave}
        />
      </ScrollView>
    </View>
  );
}

function SelectChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
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
    justifyContent: "space-between",
    padding: Spacing.three,
    paddingTop: Spacing.four,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: -0.3,
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
  hint: {
    fontSize: 12,
    color: Palette.textTertiary,
    marginBottom: Spacing.two,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  chipActive: {
    backgroundColor: Palette.accentSoft,
    borderColor: Palette.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.textSecondary,
  },
  chipTextActive: {
    color: Palette.accentText,
  },
  descriptionField: {
    minHeight: 80,
    textAlignVertical: "top",
  },
});
