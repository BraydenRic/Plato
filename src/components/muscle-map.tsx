import { useState } from "react";
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

// The library hardcodes #3f3f3f on most body parts, so the default fill must
// match it exactly or reset parts (like the head) come out a different tone.
// Seams between muscles show the layer behind the shapes, so it's a hair
// darker than the fill rather than near-black.
const BODY_GREY = "#3f3f3f";
const SEAM = "#33333b";

// The library's figures are 200pt wide each at scale 1 — too wide for two
// side by side on a phone, so scale is derived from the measured card width.
const FIGURE_BASE_WIDTH = 200;

// Lighter violet for muscles an exercise works but doesn't target.
const SECONDARY_VIOLET = "#c4b5fd";

// Front and back body figures, side by side. The exercise library lists the
// primary target muscle first, so it gets the full violet and the rest of the
// list gets the lighter secondary shade.
export function MuscleMap({ musclesWorked }: MuscleMapProps) {
  const [rowWidth, setRowWidth] = useState(0);
  const scale = rowWidth > 0 ? Math.min((rowWidth / 2 - 8) / FIGURE_BASE_WIDTH, 1) : 0;

  const [primaryName, ...secondaryNames] = musclesWorked;
  const primarySlugs = muscleSlugsFor(primaryName ? [primaryName] : []);
  const secondarySlugs = muscleSlugsFor(secondaryNames).filter(
    (s) => !primarySlugs.includes(s)
  );

  const data: ExtendedBodyPart[] = [
    ...primarySlugs.map((slug) => ({ slug, intensity: 1 })),
    ...secondarySlugs.map((slug) => ({ slug, intensity: 2 })),
    // The head ships with a hardcoded light color; listing it here with no
    // color of its own resets it to the default body gray.
    { slug: "head" as const },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.row} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
        {scale > 0 &&
          (["front", "back"] as const).map((side) => (
            <View key={side} style={styles.figure}>
              <Body
                data={data}
                side={side}
                gender="male"
                scale={scale}
                colors={[Palette.accent, SECONDARY_VIOLET]}
                border={SEAM}
                defaultFill={BODY_GREY}
              />
              <Text style={styles.label}>{side}</Text>
            </View>
          ))}
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: Palette.accent }]} />
        <Text style={styles.legendText}>Primary</Text>
        {secondarySlugs.length > 0 && (
          <>
            <View style={[styles.legendDot, { backgroundColor: SECONDARY_VIOLET }]} />
            <Text style={styles.legendText}>Secondary</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
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
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 10,
  },
  legendText: {
    fontSize: 11,
    color: Palette.textTertiary,
  },
});
