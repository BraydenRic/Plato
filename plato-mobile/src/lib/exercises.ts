import type { Exercise } from "@/types";

export const EXERCISES: Exercise[] = [
  // Chest
  { id: "bench-press", name: "Bench Press", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "The fundamental compound pressing movement. Lie flat, lower the bar to mid-chest, press up." },
  { id: "incline-bench", name: "Incline Bench Press", category: "Chest", musclesWorked: ["Upper Chest", "Triceps", "Shoulders"], description: "Targets the upper chest. Set bench to 30–45° incline." },
  { id: "decline-bench", name: "Decline Bench Press", category: "Chest", musclesWorked: ["Lower Chest", "Triceps"], description: "Emphasizes lower chest fibers with a slight decline angle." },
  { id: "dumbbell-fly", name: "Dumbbell Fly", category: "Chest", musclesWorked: ["Chest"], description: "Isolation movement. Wide arc motion to stretch and contract the pecs." },
  { id: "cable-crossover", name: "Cable Crossover", category: "Chest", musclesWorked: ["Chest"], description: "Constant tension through the full range of motion." },
  { id: "push-up", name: "Push-Up", category: "Chest", musclesWorked: ["Chest", "Triceps", "Core"], description: "Bodyweight pressing movement. Hands shoulder-width, full range of motion." },
  { id: "dips-chest", name: "Chest Dips", category: "Chest", musclesWorked: ["Chest", "Triceps"], description: "Lean forward to emphasize chest over triceps." },

  // Back
  { id: "deadlift", name: "Deadlift", category: "Back", musclesWorked: ["Back", "Glutes", "Hamstrings", "Core"], description: "King of all lifts. Hinge at hips, neutral spine, drive through the floor." },
  { id: "pull-up", name: "Pull-Up", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Overhand grip, full hang to chin over bar. The gold standard for back width." },
  { id: "chin-up", name: "Chin-Up", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Underhand grip. More bicep involvement than pull-up." },
  { id: "barbell-row", name: "Barbell Row", category: "Back", musclesWorked: ["Back", "Biceps", "Core"], description: "Hinged position, pull bar to lower chest. Squeeze shoulder blades." },
  { id: "cable-row", name: "Seated Cable Row", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Controlled pull with constant tension. Drive elbows back." },
  { id: "lat-pulldown", name: "Lat Pulldown", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Wide grip pulldown to upper chest. Depresses scapula." },
  { id: "t-bar-row", name: "T-Bar Row", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Neutral grip row for mid-back thickness." },
  { id: "face-pull", name: "Face Pull", category: "Back", musclesWorked: ["Shoulders", "Back"], description: "Cable at face height, pull to forehead. Excellent for rear delts." },

  // Shoulders
  { id: "ohp", name: "Overhead Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps", "Core"], description: "Press barbell from rack position overhead. Full body stability required." },
  { id: "dumbbell-ohp", name: "Dumbbell Shoulder Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Seated or standing. Greater range of motion than barbell." },
  { id: "lateral-raise", name: "Lateral Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Raise arms to 90°, pinky slightly higher. Isolates medial delt." },
  { id: "front-raise", name: "Front Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Raise arms forward to shoulder height. Anterior delt focus." },
  { id: "reverse-fly", name: "Reverse Fly", category: "Shoulders", musclesWorked: ["Shoulders", "Back"], description: "Bent over or on incline bench. Targets rear deltoids." },
  { id: "arnold-press", name: "Arnold Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Rotating press named after Arnold. Full shoulder recruitment." },
  { id: "upright-row", name: "Upright Row", category: "Shoulders", musclesWorked: ["Shoulders", "Traps"], description: "Narrow grip pull to chin. Traps and medial delts." },

  // Biceps
  { id: "barbell-curl", name: "Barbell Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Classic mass builder. Keep elbows stationary, full range." },
  { id: "dumbbell-curl", name: "Dumbbell Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Alternating or simultaneous. Supinate at the top." },
  { id: "hammer-curl", name: "Hammer Curl", category: "Biceps", musclesWorked: ["Biceps", "Forearms"], description: "Neutral grip. Targets brachialis and brachioradialis." },
  { id: "incline-curl", name: "Incline Dumbbell Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Greater stretch at bottom position. Excellent for long head." },
  { id: "preacher-curl", name: "Preacher Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Eliminates cheating. Peak contraction at top." },
  { id: "cable-curl", name: "Cable Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Constant tension throughout range of motion." },
  { id: "concentration-curl", name: "Concentration Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Seated, elbow on inner thigh. Maximum isolation." },

  // Triceps
  { id: "close-grip-bench", name: "Close-Grip Bench Press", category: "Triceps", musclesWorked: ["Triceps", "Chest"], description: "Shoulder-width grip bench. Best compound tricep exercise." },
  { id: "skull-crusher", name: "Skull Crusher", category: "Triceps", musclesWorked: ["Triceps"], description: "EZ bar or dumbbells lowered to forehead. All three heads." },
  { id: "tricep-pushdown", name: "Tricep Pushdown", category: "Triceps", musclesWorked: ["Triceps"], description: "Cable pushdown with rope or bar. Constant tension." },
  { id: "overhead-tricep", name: "Overhead Tricep Extension", category: "Triceps", musclesWorked: ["Triceps"], description: "Maximum long head stretch. Seated dumbbell or cable." },
  { id: "dips-tricep", name: "Tricep Dips", category: "Triceps", musclesWorked: ["Triceps", "Chest"], description: "Upright torso to emphasize triceps." },
  { id: "kickback", name: "Tricep Kickback", category: "Triceps", musclesWorked: ["Triceps"], description: "Hinge forward, extend arm back. Lateral head isolation." },

  // Legs
  { id: "squat", name: "Back Squat", category: "Legs", musclesWorked: ["Quads", "Glutes", "Hamstrings", "Core"], description: "Bar on upper traps. Depth below parallel, knees track toes." },
  { id: "front-squat", name: "Front Squat", category: "Legs", musclesWorked: ["Quads", "Core", "Glutes"], description: "Bar on front delts. More quad emphasis and core demand." },
  { id: "leg-press", name: "Leg Press", category: "Legs", musclesWorked: ["Quads", "Glutes", "Hamstrings"], description: "Machine-based pressing. Foot placement alters emphasis." },
  { id: "romanian-dl", name: "Romanian Deadlift", category: "Legs", musclesWorked: ["Hamstrings", "Glutes", "Back"], description: "Hip hinge with minimal knee bend. Maximum hamstring stretch." },
  { id: "leg-curl", name: "Leg Curl", category: "Legs", musclesWorked: ["Hamstrings"], description: "Lying or seated. Direct hamstring isolation." },
  { id: "leg-extension", name: "Leg Extension", category: "Legs", musclesWorked: ["Quads"], description: "Direct quad isolation. Control the eccentric." },
  { id: "lunges", name: "Lunges", category: "Legs", musclesWorked: ["Quads", "Glutes", "Hamstrings"], description: "Walking or stationary. Unilateral movement for balance." },
  { id: "bulgarian-squat", name: "Bulgarian Split Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Rear foot elevated. Demanding unilateral leg exercise." },
  { id: "calf-raise", name: "Calf Raise", category: "Legs", musclesWorked: ["Calves"], description: "Standing or seated. Full range, pause at bottom." },
  { id: "hack-squat", name: "Hack Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Machine squat variation. Upright torso, quad dominant." },

  // Glutes
  { id: "hip-thrust", name: "Hip Thrust", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "Bar over hips, drive upward. The premier glute exercise." },
  { id: "glute-bridge", name: "Glute Bridge", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "Floor-based hip extension. Controlled squeeze at top." },
  { id: "cable-kickback", name: "Cable Kickback", category: "Glutes", musclesWorked: ["Glutes"], description: "Ankle attachment, extend leg back. Direct glute isolation." },
  { id: "sumo-dl", name: "Sumo Deadlift", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings", "Quads"], description: "Wide stance, vertical torso. Greater hip abductor involvement." },
  { id: "abduction-machine", name: "Hip Abduction Machine", category: "Glutes", musclesWorked: ["Glutes"], description: "Seated abduction. Targets gluteus medius and minimus." },

  // Core
  { id: "plank", name: "Plank", category: "Core", musclesWorked: ["Core"], description: "Maintain rigid body position. Breathe throughout." },
  { id: "ab-rollout", name: "Ab Wheel Rollout", category: "Core", musclesWorked: ["Core"], description: "Advanced anti-extension. Brutal for core strength." },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", category: "Core", musclesWorked: ["Core", "Hip Flexors"], description: "Dead hang, raise legs to 90° or higher." },
  { id: "cable-crunch", name: "Cable Crunch", category: "Core", musclesWorked: ["Core"], description: "Loaded flexion. Curl elbows toward knees." },
  { id: "russian-twist", name: "Russian Twist", category: "Core", musclesWorked: ["Core"], description: "Seated rotation with weight. Oblique focus." },
  { id: "side-plank", name: "Side Plank", category: "Core", musclesWorked: ["Core"], description: "Lateral stability hold. Targets obliques and QL." },

  // Cardio
  { id: "running", name: "Running", category: "Cardio", musclesWorked: ["Legs", "Core", "Cardio"], description: "Steady state or intervals. Track pace and distance." },
  { id: "cycling", name: "Cycling", category: "Cardio", musclesWorked: ["Legs", "Cardio"], description: "Low impact cardio. Stationary or outdoor." },
  { id: "rowing", name: "Rowing Machine", category: "Cardio", musclesWorked: ["Back", "Legs", "Cardio"], description: "Full body cardio. Drive with legs, pull with back." },
  { id: "jump-rope", name: "Jump Rope", category: "Cardio", musclesWorked: ["Calves", "Cardio", "Shoulders"], description: "High intensity. Excellent for conditioning and coordination." },
  { id: "stairmaster", name: "StairMaster", category: "Cardio", musclesWorked: ["Glutes", "Legs", "Cardio"], description: "Simulated stair climbing. Cardio with glute emphasis." },
];

export const MUSCLE_GROUPS = [
  "All", "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Glutes", "Core", "Cardio"
] as const;

export const WORKOUT_TEMPLATES = [
  {
    name: "Push Day",
    description: "Chest, shoulders, triceps",
    exercises: ["bench-press", "ohp", "incline-bench", "lateral-raise", "tricep-pushdown", "skull-crusher"],
    icon: "💪",
  },
  {
    name: "Pull Day",
    description: "Back, biceps, rear delts",
    exercises: ["deadlift", "pull-up", "barbell-row", "lat-pulldown", "barbell-curl", "face-pull"],
    icon: "🏋️",
  },
  {
    name: "Leg Day",
    description: "Quads, hamstrings, glutes, calves",
    exercises: ["squat", "romanian-dl", "leg-press", "lunges", "leg-curl", "calf-raise"],
    icon: "🦵",
  },
  {
    name: "Upper Body",
    description: "Full upper body",
    exercises: ["bench-press", "barbell-row", "ohp", "pull-up", "barbell-curl", "tricep-pushdown"],
    icon: "🔝",
  },
  {
    name: "Full Body",
    description: "Total body compound movements",
    exercises: ["squat", "bench-press", "deadlift", "ohp", "barbell-row", "pull-up"],
    icon: "⚡",
  },
];
