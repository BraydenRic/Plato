import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Palette } from "@/constants/theme";
import {
  BODY_OUTLINE,
  MUSCLE_MAP_VIEW_BOX,
  MUSCLE_PATHS,
  type MuscleGroupId,
} from "./muscle-map-paths";

// The exercise library names muscles the way lifters talk ("Traps", "Quads",
// "Core"); the diagram names them anatomically. Compound names fan out to
// every region they hit, same as the original Flutter app did.
const MUSCLE_NAME_TO_GROUPS: Record<string, MuscleGroupId[]> = {
  chest: ["chest"],
  "upper chest": ["chest"],
  "lower chest": ["chest"],
  back: ["lats", "upper_back", "lower_back", "trapezius"],
  lats: ["lats"],
  "upper back": ["upper_back", "trapezius"],
  "lower back": ["lower_back"],
  traps: ["trapezius"],
  trapezius: ["trapezius"],
  shoulders: ["shoulders"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearms"],
  abs: ["abs"],
  obliques: ["obliques"],
  core: ["abs", "obliques"],
  // The diagram splits the thigh into three shapes: quadriceps is only the
  // outer strip, adductors the big inner-front mass, abductors the hip. Quad
  // work hits the adductors too, and lighting both keeps the thigh from
  // looking half-off.
  quads: ["quadriceps", "adductors"],
  quadriceps: ["quadriceps", "adductors"],
  hamstrings: ["hamstrings"],
  // The outer-hip "abductor" shapes are mostly glute medius on this map.
  glutes: ["glutes", "abductors"],
  calves: ["calves"],
  // No dedicated hip-flexor region in the diagram; the outer-hip shapes are
  // the closest visual match.
  "hip flexors": ["abductors"],
  legs: ["quadriceps", "adductors", "abductors", "hamstrings", "glutes", "calves"],
  arms: ["biceps", "triceps", "forearms"],
  "full body": [
    "chest", "shoulders", "biceps", "triceps", "forearms",
    "abs", "obliques", "lats", "upper_back", "lower_back", "trapezius",
    "quadriceps", "adductors", "abductors", "hamstrings", "glutes", "calves",
  ],
  // Cardio doesn't map to a visible muscle region.
  cardio: [],
};

export function muscleGroupsFor(musclesWorked: string[]): Set<MuscleGroupId> {
  const groups = new Set<MuscleGroupId>();
  for (const name of musclesWorked) {
    for (const g of MUSCLE_NAME_TO_GROUPS[name.trim().toLowerCase()] ?? []) {
      groups.add(g);
    }
  }
  return groups;
}

interface MuscleMapProps {
  musclesWorked: string[];
}

// Front and back body figures, side by side, with worked muscles lit violet.
export function MuscleMap({ musclesWorked }: MuscleMapProps) {
  const highlighted = muscleGroupsFor(musclesWorked);
  const [, , vbWidth, vbHeight] = MUSCLE_MAP_VIEW_BOX.split(" ").map(Number);

  return (
    <View style={{ width: "100%", aspectRatio: vbWidth / vbHeight }}>
      <Svg width="100%" height="100%" viewBox={MUSCLE_MAP_VIEW_BOX}>
        {/* Body silhouette sits under the muscle shapes; regions with no
            muscle path (shins, hands, head) show this fill, so it must stay
            close to the muscle tone or they read as dark holes. */}
        {BODY_OUTLINE.map((d, i) => (
          <Path
            key={`outline-${i}`}
            d={d}
            fill="#3d3d47"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={0.5}
          />
        ))}
        {MUSCLE_PATHS.map(({ group, d }, i) => {
          const active = highlighted.has(group);
          return (
            <Path
              key={i}
              d={d}
              fill={active ? Palette.accent : "#454550"}
              stroke={active ? "#ddd3ff" : "rgba(255,255,255,0.28)"}
              strokeWidth={active ? 0.9 : 0.5}
            />
          );
        })}
      </Svg>
    </View>
  );
}
