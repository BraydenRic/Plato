import { useState } from "react";
import { Text, View } from "react-native";
import Body, { type ExtendedBodyPart } from "react-native-body-highlighter";

import { FIGURE_BODY } from "@/constants/theme";
import { makeStyles } from "@/context/AppearanceContext";
import { useTheme } from "@/context/ThemeContext";

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
  tibialis: ["tibialis"],
  shins: ["tibialis"],
  "hip flexors": ["adductors"],
  legs: ["quadriceps", "adductors", "hamstring", "gluteal", "calves", "tibialis"],
  arms: ["biceps", "triceps", "forearm"],
  "full body": [
    "chest", "deltoids", "biceps", "triceps", "forearm",
    "abs", "obliques", "upper-back", "lower-back", "trapezius",
    "quadriceps", "adductors", "hamstring", "gluteal", "calves", "tibialis",
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
  // When provided, every name in musclesWorked gets the primary shade and
  // these get the secondary one — used by aggregate views like the weekly
  // recap. Without it, the first name in musclesWorked is the primary.
  secondaryMuscles?: string[];
}

// The library hardcodes FIGURE_BODY on most body parts, so the default fill must
// match it exactly or reset parts (like the head) come out a different tone.
// That is also why the figure stays dark in light mode — the fill is only ours
// for the parts passed in `data`, and the rest of the silhouette is the
// library's own. Seams between muscles show the layer behind the shapes, so
// they sit a hair darker than the fill rather than near-black.
const SEAM = "#37373c";

// The library's figures are 200pt wide each at scale 1 — too wide for two
// side by side on a phone, so scale is derived from the measured card width.
const FIGURE_BASE_WIDTH = 200;

// Front and back body figures, side by side. The exercise library lists the
// primary target muscle first, so it gets the solid accent and the rest of the
// list gets the muted shade — both follow the chosen theme.
export function MuscleMap({ musclesWorked, secondaryMuscles }: MuscleMapProps) {
  const styles = useStyles();
  const [rowWidth, setRowWidth] = useState(0);
  const theme = useTheme();
  const scale = rowWidth > 0 ? Math.min((rowWidth / 2 - 8) / FIGURE_BASE_WIDTH, 1) : 0;

  const primaryNames = secondaryMuscles ? musclesWorked : musclesWorked.slice(0, 1);
  const secondaryNames = secondaryMuscles ?? musclesWorked.slice(1);
  const primarySlugs = muscleSlugsFor(primaryNames);
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
                colors={[theme.figure.primary, theme.figure.secondary]}
                border={SEAM}
                defaultFill={FIGURE_BODY}
              />
              <Text style={styles.label}>{side}</Text>
            </View>
          ))}
      </View>
      <View style={styles.legend}>
        {primarySlugs.length > 0 && (
          <>
            <View style={[styles.legendDot, { backgroundColor: theme.figure.primary }]} />
            <Text style={styles.legendText}>Primary</Text>
          </>
        )}
        {secondarySlugs.length > 0 && (
          <>
            <View style={[styles.legendDot, { backgroundColor: theme.figure.secondary }]} />
            <Text style={styles.legendText}>Secondary</Text>
          </>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
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
    color: c.textTertiary,
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
    color: c.textTertiary,
  },
}));
