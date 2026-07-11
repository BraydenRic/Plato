import { StyleSheet, Text, View } from "react-native";
import Body, { type ExtendedBodyPart } from "react-native-body-highlighter";

import { Palette } from "@/constants/theme";

type Slug = NonNullable<ExtendedBodyPart["slug"]>;

// The exercise library names muscles the way lifters talk ("Traps", "Quads",
// "Core"); the diagram uses anatomical slugs. Compound names fan out to every
// region they hit.
const MUSCLE_NAME_TO_SLUGS: Record<string, Slug[]> = {
  chest: ["chest"],
  "upper chest": ["chest"],
  "lower chest": ["chest"],
  back: ["upper-back", "lower-back", "trapezius"],
  lats: ["upper-back"],
  "upper back": ["upper-back", "trapezius"],
  "lower back": ["lower-back"],
  traps: ["trapezius"],
  trapezius: ["trapezius"],
  shoulders: ["deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearm"],
  abs: ["abs"],
  obliques: ["obliques"],
  core: ["abs", "obliques"],
  quads: ["quadriceps"],
  quadriceps: ["quadriceps"],
  hamstrings: ["hamstring"],
  glutes: ["gluteal"],
  calves: ["calves"],
  "hip flexors": ["adductors"],
  legs: ["quadriceps", "adductors", "hamstring", "gluteal", "calves"],
  arms: ["biceps", "triceps", "forearm"],
  "full body": [
    "chest", "deltoids", "biceps", "triceps", "forearm",
    "abs", "obliques", "upper-back", "lower-back", "trapezius",
    "quadriceps", "adductors", "hamstring", "gluteal", "calves",
  ],
  // Cardio doesn't map to a visible muscle region.
  cardio: [],
};

export function muscleSlugsFor(musclesWorked: string[]): Slug[] {
  const slugs = new Set<Slug>();
  for (const name of musclesWorked) {
    for (const s of MUSCLE_NAME_TO_SLUGS[name.trim().toLowerCase()] ?? []) {
      slugs.add(s);
    }
  }
  return [...slugs];
}

interface MuscleMapProps {
  musclesWorked: string[];
}

// Front and back body figures, side by side, with worked muscles lit violet.
export function MuscleMap({ musclesWorked }: MuscleMapProps) {
  const data: ExtendedBodyPart[] = muscleSlugsFor(musclesWorked).map((slug) => ({
    slug,
    intensity: 1,
  }));

  return (
    <View style={styles.row}>
      {(["front", "back"] as const).map((side) => (
        <View key={side} style={styles.figure}>
          <Body
            data={data}
            side={side}
            gender="male"
            scale={1}
            colors={[Palette.accent]}
            border={Palette.border}
          />
          <Text style={styles.label}>{side}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-start",
  },
  figure: {
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: Palette.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
