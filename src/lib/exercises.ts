import type { Exercise } from "@/types";

export const EXERCISES: Exercise[] = [
  // Chest
  { id: "bench-press", name: "Bench Press", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "The fundamental compound pressing movement. Lie flat, lower the bar to mid-chest, press up." },
  { id: "incline-bench", name: "Incline Bench Press", category: "Chest", musclesWorked: ["Upper Chest", "Triceps", "Shoulders"], description: "Targets the upper chest. Set bench to 30–45° incline." },
  { id: "decline-bench", name: "Decline Bench Press", category: "Chest", musclesWorked: ["Lower Chest", "Triceps"], description: "Emphasizes lower chest fibers with a slight decline angle." },
  { id: "db-bench-press", name: "Dumbbell Bench Press", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "Greater range of motion than the barbell. Press dumbbells from chest level." },
  { id: "incline-db-press", name: "Incline Dumbbell Press", category: "Chest", musclesWorked: ["Upper Chest", "Triceps", "Shoulders"], description: "Upper-chest builder with a deep stretch. Bench at 30–45°." },
  { id: "decline-db-press", name: "Decline Dumbbell Press", category: "Chest", musclesWorked: ["Lower Chest", "Triceps"], description: "Lower-chest emphasis with independent arm control." },
  { id: "machine-chest-press", name: "Machine Chest Press", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "Fixed path pressing. Great for controlled, high-rep chest work." },
  { id: "incline-machine-press", name: "Incline Machine Chest Press", category: "Chest", musclesWorked: ["Upper Chest", "Triceps", "Shoulders"], description: "Upper-chest press on a guided machine. Stable and joint-friendly." },
  { id: "smith-bench-press", name: "Smith Machine Bench Press", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "Bar on a fixed vertical path. Easy to unrack and overload safely." },
  { id: "smith-incline-press", name: "Smith Machine Incline Press", category: "Chest", musclesWorked: ["Upper Chest", "Triceps"], description: "Guided incline press for upper-chest overload." },
  { id: "pec-deck", name: "Pec Deck Machine", category: "Chest", musclesWorked: ["Chest"], description: "Seated machine fly. Constant tension with a strong peak contraction." },
  { id: "dumbbell-fly", name: "Dumbbell Fly", category: "Chest", musclesWorked: ["Chest"], description: "Isolation movement. Wide arc motion to stretch and contract the pecs." },
  { id: "incline-db-fly", name: "Incline Dumbbell Fly", category: "Chest", musclesWorked: ["Upper Chest"], description: "Fly variation targeting the upper chest through a big stretch." },
  { id: "cable-crossover", name: "Cable Crossover", category: "Chest", musclesWorked: ["Chest"], description: "Constant tension through the full range of motion." },
  { id: "low-cable-fly", name: "Low-to-High Cable Fly", category: "Chest", musclesWorked: ["Upper Chest"], description: "Pulleys set low, sweep upward. Emphasizes the upper chest." },
  { id: "high-cable-fly", name: "High-to-Low Cable Fly", category: "Chest", musclesWorked: ["Lower Chest"], description: "Pulleys set high, sweep down. Emphasizes the lower chest." },
  { id: "incline-cable-fly", name: "Incline Cable Fly", category: "Chest", musclesWorked: ["Upper Chest"], description: "Cable fly on an incline bench for constant upper-chest tension." },
  { id: "push-up", name: "Push-Up", category: "Chest", musclesWorked: ["Chest", "Triceps", "Core"], description: "Bodyweight pressing movement. Hands shoulder-width, full range of motion.", isBodyweight: true },
  { id: "dips-chest", name: "Chest Dips", category: "Chest", musclesWorked: ["Chest", "Triceps"], description: "Lean forward to emphasize chest over triceps.", isBodyweight: true },
  { id: "weighted-dips-chest", name: "Weighted Chest Dips", category: "Chest", musclesWorked: ["Chest", "Triceps"], description: "Add load via belt or dumbbell. Lean forward for chest emphasis.", isBodyweight: true },
  { id: "landmine-press", name: "Landmine Press", category: "Chest", musclesWorked: ["Upper Chest", "Shoulders", "Triceps"], description: "Press a barbell end at an angle. Shoulder-friendly upper-chest work." },
  { id: "svend-press", name: "Svend Press", category: "Chest", musclesWorked: ["Chest"], description: "Squeeze plates together and press out. Pure inner-chest contraction." },
  { id: "iso-lateral-chest-press", name: "Iso-Lateral Chest Press", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "Plate-loaded press with independent arms. Each side has to carry its own share." },
  { id: "iso-lateral-incline-press", name: "Iso-Lateral Incline Press", category: "Chest", musclesWorked: ["Upper Chest", "Triceps", "Shoulders"], description: "Plate-loaded incline press with independent arms. Upper chest without balancing a bar." },
  { id: "floor-press", name: "Floor Press", category: "Chest", musclesWorked: ["Chest", "Triceps"], description: "Bench press lying on the floor. The shortened range overloads the lockout." },
  { id: "cable-chest-press", name: "Cable Chest Press", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "Standing press between two cables. Constant tension and a free path for the shoulders." },
  { id: "db-pullover", name: "Dumbbell Pullover", category: "Chest", musclesWorked: ["Chest", "Lats", "Triceps"], description: "One dumbbell lowered behind the head and pulled back over the chest. Chest and lats together." },
  { id: "squeeze-press", name: "Dumbbell Squeeze Press", category: "Chest", musclesWorked: ["Chest", "Triceps"], description: "Press two dumbbells crushed together. Keeps the inner chest working the whole rep." },
  { id: "incline-push-up", name: "Incline Push-Up", category: "Chest", musclesWorked: ["Chest", "Triceps", "Core"], description: "Hands on a bench or bar. The easier push-up, and the way to build up to the floor.", isBodyweight: true },
  { id: "decline-push-up", name: "Decline Push-Up", category: "Chest", musclesWorked: ["Upper Chest", "Triceps", "Shoulders"], description: "Feet raised on a bench. Shifts more of your weight onto the upper chest and shoulders.", isBodyweight: true },
  { id: "archer-push-up", name: "Archer Push-Up", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "Wide hands, shifting down over one arm at a time. A step toward the one-arm push-up.", isBodyweight: true },
  { id: "clap-push-up", name: "Clap Push-Up", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "Push hard enough to leave the floor and clap. Explosive upper-body power.", isBodyweight: true },
  { id: "ring-dip", name: "Ring Dips", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "Dips on gymnastic rings. The rings move, so the chest and shoulders have to hold them still.", isBodyweight: true },
  { id: "decline-machine-press", name: "Decline Machine Chest Press", category: "Chest", musclesWorked: ["Lower Chest", "Triceps"], description: "Guided press with the handles set low and angled down. Lower-chest work without hooking into a decline bench." },
  { id: "iso-lateral-decline-press", name: "Iso-Lateral Decline Press", category: "Chest", musclesWorked: ["Lower Chest", "Triceps", "Shoulders"], description: "Plate-loaded decline press with independent arms. Heavy lower-chest pressing, one side at a time if you want." },
  { id: "iso-lateral-wide-chest-press", name: "Iso-Lateral Wide Chest Press", category: "Chest", musclesWorked: ["Chest", "Shoulders", "Triceps"], description: "Plate-loaded press with the handles set wide and converging. More stretch across the chest than the standard press." },
  { id: "smith-decline-press", name: "Smith Machine Decline Press", category: "Chest", musclesWorked: ["Lower Chest", "Triceps"], description: "Decline bench under a Smith bar. Lower-chest pressing with no awkward unrack from a decline." },
  { id: "flat-cable-fly", name: "Flat Bench Cable Fly", category: "Chest", musclesWorked: ["Chest"], description: "Lying on a flat bench between two low cables. A dumbbell fly that keeps tension at the top." },
  { id: "single-arm-cable-fly", name: "Single-Arm Cable Fly", category: "Chest", musclesWorked: ["Chest", "Core"], description: "One handle, sweeping across the body. Lets each side of the chest cross past the midline." },
  { id: "decline-db-fly", name: "Decline Dumbbell Fly", category: "Chest", musclesWorked: ["Lower Chest"], description: "Fly on a decline bench. Stretches and loads the lower fibres of the chest." },
  { id: "wide-grip-bench", name: "Wide-Grip Bench Press", category: "Chest", musclesWorked: ["Chest", "Shoulders", "Triceps"], description: "Grip a hand-width or two outside your normal bench grip. Shorter press, more chest, less triceps." },
  { id: "reverse-grip-bench", name: "Reverse-Grip Bench Press", category: "Chest", musclesWorked: ["Upper Chest", "Triceps", "Shoulders"], description: "Underhand grip on the bar, elbows tucked. Upper-chest pressing that's easier on some shoulders." },
  { id: "paused-bench-press", name: "Paused Bench Press", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "Bench press held motionless on the chest before each press. Strength off the chest with no bounce." },
  { id: "db-floor-press", name: "Dumbbell Floor Press", category: "Chest", musclesWorked: ["Chest", "Triceps"], description: "Dumbbells pressed while lying on the floor. The floor sets the depth, and no bench or rack is needed." },
  { id: "single-arm-db-bench-press", name: "Single-Arm Dumbbell Bench Press", category: "Chest", musclesWorked: ["Chest", "Triceps", "Core"], description: "One dumbbell pressed on a flat bench. The core has to stop you rolling toward the weight." },
  { id: "neutral-grip-db-press", name: "Neutral-Grip Dumbbell Press", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "Palms facing each other, elbows close to the sides. A dumbbell press that's kind to the shoulders." },
  { id: "knee-push-up", name: "Knee Push-Up", category: "Chest", musclesWorked: ["Chest", "Triceps", "Core"], description: "Push-up from the knees instead of the toes. The first step on the way to full push-ups.", isBodyweight: true },
  { id: "wide-grip-push-up", name: "Wide-Grip Push-Up", category: "Chest", musclesWorked: ["Chest", "Shoulders", "Triceps"], description: "Hands set well outside the shoulders. Shifts the push-up toward the chest and away from the triceps.", isBodyweight: true },
  { id: "deficit-push-up", name: "Deficit Push-Up", category: "Chest", musclesWorked: ["Chest", "Triceps", "Shoulders"], description: "Hands on handles, plates or blocks so the chest drops below them. A deeper stretch than the floor allows.", isBodyweight: true },
  { id: "ring-push-up", name: "Ring Push-Up", category: "Chest", musclesWorked: ["Chest", "Triceps", "Core"], description: "Push-up with the hands in low gymnastic rings. The rings wobble, so the chest and shoulders work to hold them.", isBodyweight: true },
  { id: "one-arm-push-up", name: "One-Arm Push-Up", category: "Chest", musclesWorked: ["Chest", "Triceps", "Core"], description: "Full push-up on a single arm, feet wide. Strength and whole-body tension together.", isBodyweight: true },
  { id: "pseudo-planche-push-up", name: "Pseudo Planche Push-Up", category: "Chest", musclesWorked: ["Shoulders", "Chest", "Triceps", "Core"], description: "Hands turned out by the hips, body leaning forward over them. A push-up that loads the front of the shoulders hard.", isBodyweight: true },

  // Back
  { id: "deadlift", name: "Deadlift", category: "Back", musclesWorked: ["Back", "Glutes", "Hamstrings", "Core"], description: "King of all lifts. Hinge at hips, neutral spine, drive through the floor." },
  { id: "rack-pull", name: "Rack Pull", category: "Back", musclesWorked: ["Back", "Traps", "Glutes"], description: "Partial deadlift from pins. Overloads the upper back and lockout." },
  { id: "pull-up", name: "Pull-Up", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Overhand grip, full hang to chin over bar. The gold standard for back width.", isBodyweight: true },
  { id: "wide-pull-up", name: "Wide-Grip Pull-Up", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Wider grip biases lat width and the upper back.", isBodyweight: true },
  { id: "chin-up", name: "Chin-Up", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Underhand grip. More bicep involvement than pull-up.", isBodyweight: true },
  { id: "inverted-row", name: "Inverted Row", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Body-weight horizontal pull under a fixed bar. Scalable for any level.", isBodyweight: true },
  { id: "barbell-row", name: "Barbell Row", category: "Back", musclesWorked: ["Back", "Biceps", "Core"], description: "Hinged position, pull bar to lower chest. Squeeze shoulder blades." },
  { id: "pendlay-row", name: "Pendlay Row", category: "Back", musclesWorked: ["Back", "Biceps", "Core"], description: "Explosive row from a dead stop on the floor each rep." },
  { id: "dumbbell-row", name: "Dumbbell Row", category: "Back", musclesWorked: ["Back", "Biceps"], description: "One arm braced on a bench. Big stretch and full contraction." },
  { id: "chest-supported-row", name: "Chest-Supported Row", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Torso braced on a pad. Removes lower-back and momentum." },
  { id: "machine-row", name: "Machine Row", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Seated plate- or pin-loaded row. Controlled mid-back thickness." },
  { id: "meadows-row", name: "Meadows Row", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Single-arm landmine row. Strong stretch on the lats." },
  { id: "cable-row", name: "Seated Cable Row", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Controlled pull with constant tension. Drive elbows back." },
  { id: "t-bar-row", name: "T-Bar Row", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Neutral grip row for mid-back thickness." },
  { id: "lat-pulldown", name: "Lat Pulldown", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Wide grip pulldown to upper chest. Depresses scapula." },
  { id: "wide-grip-pulldown", name: "Wide-Grip Lat Pulldown", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Wider grip for maximum lat width recruitment." },
  { id: "neutral-grip-pulldown", name: "Neutral-Grip Pulldown", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Palms-facing grip. Comfortable and lat-dominant." },
  { id: "single-arm-pulldown", name: "Single-Arm Lat Pulldown", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Unilateral pulldown for a longer range and even development." },
  { id: "straight-arm-pulldown", name: "Straight-Arm Pulldown", category: "Back", musclesWorked: ["Lats"], description: "Arms straight, drive the bar down. Isolates the lats." },
  { id: "cable-pullover", name: "Cable Pullover", category: "Back", musclesWorked: ["Lats"], description: "Kneeling or standing lat isolation with constant tension." },
  { id: "face-pull", name: "Face Pull", category: "Back", musclesWorked: ["Shoulders", "Back"], description: "Cable at face height, pull to forehead. Excellent for rear delts." },
  { id: "barbell-shrug", name: "Barbell Shrug", category: "Back", musclesWorked: ["Traps"], description: "Elevate the shoulders straight up. Direct upper-trap builder." },
  { id: "dumbbell-shrug", name: "Dumbbell Shrug", category: "Back", musclesWorked: ["Traps"], description: "Shrug with dumbbells for a longer range than the barbell." },
  { id: "back-extension", name: "Back Extension", category: "Back", musclesWorked: ["Lower Back", "Glutes", "Hamstrings"], description: "Hyperextension bench. Strengthens the spinal erectors and hips.", isBodyweight: true },
  { id: "iso-lateral-high-row", name: "Iso-Lateral High Row", category: "Back", musclesWorked: ["Lats", "Back", "Biceps"], description: "Plate-loaded row pulling down and back from overhead. Lats and upper back, one arm per handle." },
  { id: "iso-lateral-low-row", name: "Iso-Lateral Low Row", category: "Back", musclesWorked: ["Lats", "Back", "Biceps"], description: "Plate-loaded row pulling up and back from low. Drives the elbows past the hips for the lower lats." },
  { id: "iso-lateral-pulldown", name: "Iso-Lateral Pulldown", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Plate-loaded pulldown with independent arms. A lat pulldown that can't hide a weak side." },
  { id: "reverse-grip-pulldown", name: "Reverse-Grip Lat Pulldown", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Underhand, shoulder-width grip. Pulls the elbows down close to the body for the lower lats." },
  { id: "assisted-pull-up", name: "Assisted Pull-Up", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Pull-ups with a machine pad or band taking part of your weight. Log the assistance as a negative.", isBodyweight: true },
  { id: "neutral-grip-pull-up", name: "Neutral-Grip Pull-Up", category: "Back", musclesWorked: ["Lats", "Biceps", "Forearms"], description: "Palms facing each other on parallel handles. The friendliest pull-up grip for the elbows and shoulders.", isBodyweight: true },
  { id: "scapular-pull-up", name: "Scapular Pull-Up", category: "Back", musclesWorked: ["Lats", "Traps"], description: "Hang and pull the shoulder blades down without bending the arms. The first step of every pull-up.", isBodyweight: true },
  { id: "muscle-up", name: "Muscle-Up", category: "Back", musclesWorked: ["Lats", "Chest", "Triceps"], description: "Pull-up that carries on over the bar into a dip. Advanced pulling power and timing.", isBodyweight: true },
  { id: "front-lever-hold", name: "Front Lever Hold", category: "Back", musclesWorked: ["Lats", "Core"], description: "Hang with the body held horizontal under the bar. Tuck the knees until you can hold it straight." },
  { id: "rope-climb", name: "Rope Climb", category: "Back", musclesWorked: ["Lats", "Biceps", "Forearms"], description: "Climb a hanging rope with the arms, legs, or both. Grip and pulling strength together.", isBodyweight: true },
  { id: "single-arm-cable-row", name: "Single-Arm Cable Row", category: "Back", musclesWorked: ["Lats", "Back", "Biceps"], description: "Seated or kneeling row with one handle. A longer pull and even work for both sides." },
  { id: "renegade-row", name: "Renegade Row", category: "Back", musclesWorked: ["Back", "Core", "Biceps"], description: "Row a dumbbell from a push-up position, one side at a time. Back work that tests the core." },
  { id: "machine-pullover", name: "Machine Pullover", category: "Back", musclesWorked: ["Lats"], description: "Seated pullover machine. Trains the lats through a big arc without the biceps getting in the way." },
  { id: "trap-bar-deadlift", name: "Trap Bar Deadlift", category: "Back", musclesWorked: ["Glutes", "Quads", "Back", "Hamstrings"], description: "Deadlift from inside a hex bar. Handles at your sides make it easier on the lower back." },
  { id: "power-clean", name: "Power Clean", category: "Back", musclesWorked: ["Glutes", "Hamstrings", "Traps", "Quads"], description: "Pull the bar from the floor and catch it on the shoulders. Full-body power." },
  { id: "hang-clean", name: "Hang Clean", category: "Back", musclesWorked: ["Glutes", "Hamstrings", "Traps"], description: "A clean started from just above the knees. Teaches the hip drive without the pull from the floor." },
  { id: "cable-shrug", name: "Cable Shrug", category: "Back", musclesWorked: ["Traps"], description: "Shrug against a low cable. Tension stays on the traps at the bottom, where dumbbells go slack." },
  { id: "smith-shrug", name: "Smith Machine Shrug", category: "Back", musclesWorked: ["Traps"], description: "Shrug on a fixed bar path. Easy to load heavy and set down safely." },
  { id: "machine-back-extension", name: "Machine Back Extension", category: "Back", musclesWorked: ["Lower Back", "Glutes"], description: "Seated, pin-loaded back extension. Trains the spinal erectors with a load you can set." },
  { id: "superman", name: "Superman", category: "Back", musclesWorked: ["Lower Back", "Glutes"], description: "Face down, lift the arms and legs off the floor together. Floor work for the lower back.", isBodyweight: true },
  { id: "wide-grip-cable-row", name: "Wide-Grip Seated Cable Row", category: "Back", musclesWorked: ["Back", "Shoulders", "Biceps"], description: "Seated cable row on a long bar, hands wide. Elbows flare out to bias the upper back and rear delts." },
  { id: "iso-lateral-row", name: "Iso-Lateral Row", category: "Back", musclesWorked: ["Back", "Lats", "Biceps"], description: "Plate-loaded seated row pulling straight back, one arm per handle. Mid-back thickness without a stack to lean on." },
  { id: "chest-supported-t-bar-row", name: "Chest-Supported T-Bar Row", category: "Back", musclesWorked: ["Back", "Lats", "Biceps"], description: "Lying face down on the angled pad of a T-bar machine. Heavy rowing with the lower back out of it." },
  { id: "seal-row", name: "Seal Row", category: "Back", musclesWorked: ["Back", "Lats", "Biceps"], description: "Face down on a raised flat bench, row a barbell up to its underside. No legs, no swing, just back." },
  { id: "incline-db-row", name: "Incline Dumbbell Row", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Chest on an incline bench, a dumbbell in each hand. The free-weight way to do a chest-supported row." },
  { id: "bent-over-db-row", name: "Bent-Over Dumbbell Row", category: "Back", musclesWorked: ["Back", "Biceps", "Lower Back"], description: "Hinged over with a dumbbell in each hand, no bench. Rows both sides at once from a held hinge." },
  { id: "gorilla-row", name: "Kettlebell Gorilla Row", category: "Back", musclesWorked: ["Back", "Biceps", "Core"], description: "Two kettlebells on the floor between the feet, deep hinge, row them one at a time. Back and trunk together." },
  { id: "reverse-grip-barbell-row", name: "Reverse-Grip Barbell Row", category: "Back", musclesWorked: ["Back", "Lats", "Biceps"], description: "Barbell row with the palms facing forward and a more upright torso. Pulls the elbows low for the lats." },
  { id: "smith-row", name: "Smith Machine Row", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Bent-over row on the Smith bar. The fixed path lets you think about the back instead of balance." },
  { id: "weighted-pull-up", name: "Weighted Pull-Up", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Pull-ups with a plate on a dip belt or a dumbbell between the feet. Log the added load.", isBodyweight: true },
  { id: "weighted-chin-up", name: "Weighted Chin-Up", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Underhand chin-ups with load hung from a belt. Log the added load.", isBodyweight: true },
  { id: "negative-pull-up", name: "Negative Pull-Up", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Jump or step to the top of a pull-up and lower yourself as slowly as you can. Builds the strength for full reps.", isBodyweight: true },
  { id: "archer-pull-up", name: "Archer Pull-Up", category: "Back", musclesWorked: ["Lats", "Biceps"], description: "Wide grip, pull toward one hand while the other arm goes nearly straight. A step toward the one-arm pull-up.", isBodyweight: true },
  { id: "kipping-pull-up", name: "Kipping Pull-Up", category: "Back", musclesWorked: ["Lats", "Biceps", "Core"], description: "A rhythmic swing from the hips carries you to the bar. More reps per set than strict, and a skill of its own.", isBodyweight: true },
  { id: "ring-row", name: "Ring Row", category: "Back", musclesWorked: ["Back", "Biceps", "Core"], description: "Lean back from gymnastic rings or suspension straps and row yourself up. Walk the feet forward to make it harder.", isBodyweight: true },
  { id: "trap-bar-shrug", name: "Trap Bar Shrug", category: "Back", musclesWorked: ["Traps", "Forearms"], description: "Shrug holding the handles of a hex bar. The load sits at your sides, so it can go heavy." },
  { id: "behind-back-shrug", name: "Behind-the-Back Barbell Shrug", category: "Back", musclesWorked: ["Traps"], description: "Barbell held behind the thighs and shrugged straight up. Pulls the shoulders slightly back as they rise." },
  { id: "machine-shrug", name: "Machine Shrug", category: "Back", musclesWorked: ["Traps"], description: "Plate- or pin-loaded shrug machine with handles at your sides. Heavy traps with no bar to balance." },
  { id: "snatch-grip-deadlift", name: "Snatch-Grip Deadlift", category: "Back", musclesWorked: ["Back", "Traps", "Glutes", "Hamstrings"], description: "Deadlift with the hands out near the collars. Starts you lower and asks far more of the upper back." },
  { id: "deficit-deadlift", name: "Deficit Deadlift", category: "Back", musclesWorked: ["Back", "Glutes", "Hamstrings", "Quads"], description: "Deadlift standing on a low plate or platform. The longer pull builds speed off the floor." },
  { id: "power-snatch", name: "Power Snatch", category: "Back", musclesWorked: ["Glutes", "Hamstrings", "Traps", "Shoulders"], description: "Wide grip, pull the bar from the floor to locked out overhead in one motion. Catch it in a partial squat." },
  { id: "clean-and-jerk", name: "Clean and Jerk", category: "Back", musclesWorked: ["Full Body"], description: "Clean the bar to the shoulders, stand, then dip and drive it overhead. The second Olympic lift." },
  { id: "clean-pull", name: "Clean Pull", category: "Back", musclesWorked: ["Traps", "Glutes", "Hamstrings", "Back"], description: "The first half of a clean, finished with a hard hip drive and shrug but no catch. Pulling strength for the lift." },
  { id: "dumbbell-snatch", name: "Dumbbell Snatch", category: "Back", musclesWorked: ["Glutes", "Hamstrings", "Shoulders", "Traps"], description: "One dumbbell from the floor to overhead in one explosive pull. Power and conditioning, one side at a time." },
  { id: "kettlebell-clean", name: "Kettlebell Clean", category: "Back", musclesWorked: ["Glutes", "Hamstrings", "Back", "Forearms"], description: "Swing a kettlebell from between the legs into the rack at your shoulder. The bell rolls around the wrist, not onto it." },
  { id: "band-row", name: "Resistance Band Row", category: "Back", musclesWorked: ["Back", "Biceps"], description: "Row a band anchored at chest height or looped round the feet. Gets harder toward the finish, and goes anywhere." },

  // Shoulders
  { id: "ohp", name: "Overhead Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps", "Core"], description: "Press barbell from rack position overhead. Full body stability required." },
  { id: "dumbbell-ohp", name: "Dumbbell Shoulder Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Seated or standing. Greater range of motion than barbell." },
  { id: "seated-db-press", name: "Seated Dumbbell Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Back supported to isolate the delts. Press dumbbells overhead." },
  { id: "machine-shoulder-press", name: "Machine Shoulder Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Guided overhead press. Stable path for controlled delt work." },
  { id: "smith-shoulder-press", name: "Smith Machine Shoulder Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Overhead press on a fixed bar path. Easy to overload safely." },
  { id: "arnold-press", name: "Arnold Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Rotating press named after Arnold. Full shoulder recruitment." },
  { id: "lateral-raise", name: "Lateral Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Raise arms to 90°, pinky slightly higher. Isolates medial delt." },
  { id: "cable-lateral-raise", name: "Cable Lateral Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Constant tension on the side delt through the whole range." },
  { id: "machine-lateral-raise", name: "Machine Lateral Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Seated machine that isolates the medial delts with a fixed path." },
  { id: "front-raise", name: "Front Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Raise arms forward to shoulder height. Anterior delt focus." },
  { id: "cable-front-raise", name: "Cable Front Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Front delt raise with continuous cable tension." },
  { id: "plate-front-raise", name: "Plate Front Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Hold a plate and raise to eye level. Front-delt isolation." },
  { id: "reverse-fly", name: "Reverse Fly", category: "Shoulders", musclesWorked: ["Shoulders", "Back"], description: "Bent over or on incline bench. Targets rear deltoids." },
  { id: "rear-delt-machine", name: "Rear Delt Machine", category: "Shoulders", musclesWorked: ["Shoulders", "Back"], description: "Reverse pec-deck. Isolates the rear delts with a fixed path." },
  { id: "cable-rear-delt", name: "Cable Rear Delt Fly", category: "Shoulders", musclesWorked: ["Shoulders", "Back"], description: "Crossed cables pulled apart. Constant rear-delt tension." },
  { id: "upright-row", name: "Upright Row", category: "Shoulders", musclesWorked: ["Shoulders", "Traps"], description: "Narrow grip pull to chin. Traps and medial delts." },
  { id: "landmine-shoulder-press", name: "Landmine Shoulder Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Single-arm angled press. Shoulder-friendly pressing pattern." },
  { id: "iso-lateral-shoulder-press", name: "Iso-Lateral Shoulder Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Plate-loaded overhead press with independent arms. Heavy pressing with nothing to balance." },
  { id: "push-press", name: "Push Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps", "Quads"], description: "Dip and drive with the legs to launch the bar overhead. Moves more than a strict press." },
  { id: "z-press", name: "Z Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps", "Core"], description: "Overhead press seated on the floor, legs out. Nothing to lean back on but your own trunk." },
  { id: "kettlebell-press", name: "Kettlebell Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "One kettlebell pressed overhead from the rack. The bell sits behind the wrist and tests control." },
  { id: "pike-push-up", name: "Pike Push-Up", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Hips high, lower the head toward the floor. The bodyweight way to start pressing overhead.", isBodyweight: true },
  { id: "handstand-push-up", name: "Handstand Push-Up", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Upside down against a wall, lower the head and press back up. Full bodyweight overhead.", isBodyweight: true },
  { id: "band-pull-apart", name: "Band Pull-Apart", category: "Shoulders", musclesWorked: ["Shoulders", "Back"], description: "Stretch a band apart at chest height. High-rep rear-delt and upper-back work." },
  { id: "rear-delt-row", name: "Rear Delt Row", category: "Shoulders", musclesWorked: ["Shoulders", "Back"], description: "Row with the elbows flared wide to the upper chest. Rear delts, not lats." },
  { id: "y-raise", name: "Y-Raise", category: "Shoulders", musclesWorked: ["Shoulders", "Traps"], description: "Chest on an incline bench, raise light dumbbells into a Y. Lower traps and delts." },
  { id: "cable-external-rotation", name: "Cable External Rotation", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Elbow pinned at the side, rotate the forearm out against a cable. Rotator cuff work." },
  { id: "kettlebell-halo", name: "Kettlebell Halo", category: "Shoulders", musclesWorked: ["Shoulders", "Core"], description: "Circle a kettlebell around the head. Shoulder control through a full circle." },
  { id: "seated-barbell-press", name: "Seated Barbell Shoulder Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Barbell pressed from a rack while seated against an upright bench. Takes the legs and lower back out of the press." },
  { id: "behind-the-neck-press", name: "Behind-the-Neck Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps", "Traps"], description: "Barbell lowered behind the head to the base of the neck. Only for shoulders that reach there comfortably." },
  { id: "single-arm-db-shoulder-press", name: "Single-Arm Dumbbell Shoulder Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps", "Core"], description: "One dumbbell pressed overhead at a time. Shows up a weaker side and makes the trunk resist the lean." },
  { id: "bottoms-up-kb-press", name: "Bottoms-Up Kettlebell Press", category: "Shoulders", musclesWorked: ["Shoulders", "Forearms", "Core"], description: "Kettlebell held upside down by the handle and pressed overhead. The bell topples unless the whole arm stays tight." },
  { id: "push-jerk", name: "Push Jerk", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps", "Quads"], description: "Dip, drive, and push yourself under the bar to catch it on locked arms. Moves more than a push press." },
  { id: "split-jerk", name: "Split Jerk", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps", "Quads", "Glutes"], description: "Drive the bar up and split the feet front and back to catch it overhead. The Olympic way to get the most weight up." },
  { id: "viking-press", name: "Viking Press", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps"], description: "Press two handles overhead on a landmine attachment or viking press machine. A neutral-grip press on an arc." },
  { id: "lean-away-lateral-raise", name: "Lean-Away Lateral Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Hold a post and lean out to the side, raising one dumbbell. Keeps the side delt loaded from the very bottom." },
  { id: "band-lateral-raise", name: "Resistance Band Lateral Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Stand on a band and raise the arms out to the sides. Hardest at the top, and it goes anywhere." },
  { id: "cable-y-raise", name: "Cable Y-Raise", category: "Shoulders", musclesWorked: ["Shoulders", "Traps"], description: "Low cables crossed, raise the arms up and out into a Y. Side delts and lower traps with constant tension." },
  { id: "side-lying-lateral-raise", name: "Side-Lying Lateral Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Lying on your side on an incline bench, raise one dumbbell. Loads the side delt hardest near the bottom." },
  { id: "landmine-lateral-raise", name: "Landmine Lateral Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Hold the end of a landmine bar at the hip and raise it out to the side. The arc keeps tension through the range." },
  { id: "cable-upright-row", name: "Cable Upright Row", category: "Shoulders", musclesWorked: ["Shoulders", "Traps"], description: "Upright row with a bar or rope on a low cable. Smooth tension and an easy grip to adjust." },
  { id: "db-upright-row", name: "Dumbbell Upright Row", category: "Shoulders", musclesWorked: ["Shoulders", "Traps"], description: "Upright row with a dumbbell in each hand. Each arm finds its own path, which suits more shoulders." },
  { id: "barbell-front-raise", name: "Barbell Front Raise", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Raise a barbell or EZ bar in front of you to shoulder height. Front delts with both hands on one bar." },
  { id: "side-lying-rear-delt-raise", name: "Side-Lying Rear Delt Raise", category: "Shoulders", musclesWorked: ["Shoulders", "Back"], description: "Lying on your side on a flat bench, raise one dumbbell up and back. Rear delt work you can't swing." },
  { id: "single-arm-cable-rear-delt", name: "Single-Arm Cable Rear Delt Fly", category: "Shoulders", musclesWorked: ["Shoulders", "Back"], description: "Stand side-on and pull one handle across and out from the opposite side. A longer pull for each rear delt." },
  { id: "cuban-press", name: "Cuban Press", category: "Shoulders", musclesWorked: ["Shoulders", "Traps"], description: "Upright row, rotate the forearms up, then press overhead. Light rotator cuff and shoulder work in one." },
  { id: "side-lying-external-rotation", name: "Side-Lying External Rotation", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Lying on your side, elbow at your ribs, rotate a light dumbbell up. Rotator cuff work with no cable needed." },
  { id: "cable-internal-rotation", name: "Cable Internal Rotation", category: "Shoulders", musclesWorked: ["Shoulders"], description: "Elbow pinned at the side, rotate the forearm in across the body against a cable. The other half of the rotator cuff." },
  { id: "wall-walk", name: "Wall Walk", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps", "Core"], description: "From a push-up position, walk the feet up the wall and the hands in toward it. Bodyweight overhead strength.", isBodyweight: true },
  { id: "handstand-hold", name: "Handstand Hold", category: "Shoulders", musclesWorked: ["Shoulders", "Triceps", "Core"], description: "Hold a handstand against a wall or freestanding. Overhead strength and balance, logged for time." },

  // Biceps
  { id: "barbell-curl", name: "Barbell Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Classic mass builder. Keep elbows stationary, full range." },
  { id: "ez-bar-curl", name: "EZ-Bar Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Angled grip eases wrist strain while loading the biceps heavily." },
  { id: "dumbbell-curl", name: "Dumbbell Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Alternating or simultaneous. Supinate at the top." },
  { id: "hammer-curl", name: "Hammer Curl", category: "Biceps", musclesWorked: ["Biceps", "Forearms"], description: "Neutral grip. Targets brachialis and brachioradialis." },
  { id: "incline-hammer-curl", name: "Incline Hammer Curl", category: "Biceps", musclesWorked: ["Biceps", "Forearms"], description: "Neutral grip on an incline bench for a deep stretch." },
  { id: "incline-curl", name: "Incline Dumbbell Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Greater stretch at bottom position. Excellent for long head." },
  { id: "preacher-curl", name: "Preacher Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Eliminates cheating. Peak contraction at top." },
  { id: "spider-curl", name: "Spider Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Chest on an incline bench, arms hanging. Constant short-head tension." },
  { id: "cable-curl", name: "Cable Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Constant tension throughout range of motion." },
  { id: "cable-hammer-curl", name: "Cable Hammer Curl", category: "Biceps", musclesWorked: ["Biceps", "Forearms"], description: "Rope attachment, neutral grip. Brachialis and forearm focus." },
  { id: "high-cable-curl", name: "High Cable Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Arms out at shoulder height. Strong peak contraction for the biceps." },
  { id: "concentration-curl", name: "Concentration Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Seated, elbow on inner thigh. Maximum isolation." },
  { id: "zottman-curl", name: "Zottman Curl", category: "Biceps", musclesWorked: ["Biceps", "Forearms"], description: "Curl up supinated, lower pronated. Hits biceps and forearms." },
  { id: "machine-curl", name: "Machine Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Fixed-path curl with a pad. Consistent tension, no swinging." },
  { id: "bayesian-curl", name: "Bayesian Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Facing away from a low cable, arm behind the body. Loads the biceps hardest where it's stretched." },
  { id: "drag-curl", name: "Drag Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Drag the bar up the body with the elbows moving back. Keeps the front delt out of it." },
  { id: "cross-body-hammer-curl", name: "Cross-Body Hammer Curl", category: "Biceps", musclesWorked: ["Biceps", "Forearms"], description: "Neutral grip, curl across the body toward the opposite shoulder. Brachialis emphasis." },
  { id: "band-curl", name: "Resistance Band Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Stand on a band and curl. Gets harder toward the top, and goes anywhere." },
  { id: "db-preacher-curl", name: "Dumbbell Preacher Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "One dumbbell curled over the preacher pad. Each arm works alone with nowhere to cheat." },
  { id: "cable-preacher-curl", name: "Cable Preacher Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Preacher bench set in front of a low cable. Keeps tension at the top where free weights go easy." },
  { id: "hammer-preacher-curl", name: "Hammer Preacher Curl", category: "Biceps", musclesWorked: ["Biceps", "Forearms"], description: "Dumbbell curled over the preacher pad with the palm facing in. Brachialis work with the arm braced." },
  { id: "single-arm-cable-curl", name: "Single-Arm Cable Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "One handle on a low cable. Lets each arm turn and curl on its own path." },
  { id: "wide-grip-barbell-curl", name: "Wide-Grip Barbell Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Hands set outside the shoulders on the bar. Shifts the curl toward the inner, short head." },
  { id: "close-grip-ez-curl", name: "Close-Grip EZ-Bar Curl", category: "Biceps", musclesWorked: ["Biceps", "Forearms"], description: "Hands on the inner bends of the EZ bar. Shifts the curl toward the outer, long head." },
  { id: "waiter-curl", name: "Waiter Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Hold one dumbbell upright by its top plate with both palms and curl it. Hard squeeze at the top." },
  { id: "bodyweight-bicep-curl", name: "Bodyweight Bicep Curl", category: "Biceps", musclesWorked: ["Biceps", "Forearms"], description: "Underhand on rings or a low bar, lean back and curl yourself up. Walk the feet forward to make it harder.", isBodyweight: true },
  { id: "kettlebell-curl", name: "Kettlebell Curl", category: "Biceps", musclesWorked: ["Biceps", "Forearms"], description: "Curl a kettlebell by the handle, one or two at a time. The offset weight makes the grip and forearm work." },
  { id: "lying-cable-curl", name: "Lying Cable Curl", category: "Biceps", musclesWorked: ["Biceps"], description: "Lie on your back with your feet to a low cable and curl the bar toward your shoulders. Strict, with the upper arms pinned to the floor." },

  // Triceps
  { id: "close-grip-bench", name: "Close-Grip Bench Press", category: "Triceps", musclesWorked: ["Triceps", "Chest"], description: "Shoulder-width grip bench. Best compound tricep exercise." },
  { id: "jm-press", name: "JM Press", category: "Triceps", musclesWorked: ["Triceps"], description: "Hybrid of close-grip bench and skull crusher. Heavy triceps loading." },
  { id: "skull-crusher", name: "Skull Crusher", category: "Triceps", musclesWorked: ["Triceps"], description: "EZ bar or dumbbells lowered to forehead. All three heads." },
  { id: "tricep-pushdown", name: "Tricep Pushdown", category: "Triceps", musclesWorked: ["Triceps"], description: "Cable pushdown with rope or bar. Constant tension." },
  { id: "rope-pushdown", name: "Rope Pushdown", category: "Triceps", musclesWorked: ["Triceps"], description: "Spread the rope at the bottom for a hard lateral-head contraction." },
  { id: "single-arm-pushdown", name: "Single-Arm Pushdown", category: "Triceps", musclesWorked: ["Triceps"], description: "Underhand single-arm cable pushdown. Isolates each side." },
  { id: "reverse-grip-pushdown", name: "Reverse-Grip Pushdown", category: "Triceps", musclesWorked: ["Triceps"], description: "Supinated grip pushdown emphasizing the medial head." },
  { id: "overhead-tricep", name: "Overhead Tricep Extension", category: "Triceps", musclesWorked: ["Triceps"], description: "Maximum long head stretch. Seated dumbbell or cable." },
  { id: "cable-overhead-extension", name: "Cable Overhead Extension", category: "Triceps", musclesWorked: ["Triceps"], description: "Rope overhead from a low pulley. Constant long-head stretch." },
  { id: "db-overhead-extension", name: "Dumbbell Overhead Extension", category: "Triceps", musclesWorked: ["Triceps"], description: "Two-handed dumbbell behind the head. Deep long-head stretch." },
  { id: "machine-tricep-extension", name: "Machine Triceps Extension", category: "Triceps", musclesWorked: ["Triceps"], description: "Seated dip or extension machine. Controlled, high-rep friendly." },
  { id: "dips-tricep", name: "Tricep Dips", category: "Triceps", musclesWorked: ["Triceps", "Chest"], description: "Upright torso to emphasize triceps.", isBodyweight: true },
  { id: "bench-dips", name: "Bench Dips", category: "Triceps", musclesWorked: ["Triceps"], description: "Hands on a bench behind you. Scalable bodyweight triceps work.", isBodyweight: true },
  { id: "diamond-push-up", name: "Diamond Push-Up", category: "Triceps", musclesWorked: ["Triceps", "Chest"], description: "Hands together under the chest. Bodyweight triceps emphasis.", isBodyweight: true },
  { id: "kickback", name: "Tricep Kickback", category: "Triceps", musclesWorked: ["Triceps"], description: "Hinge forward, extend arm back. Lateral head isolation." },
  { id: "tate-press", name: "Tate Press", category: "Triceps", musclesWorked: ["Triceps"], description: "Lying on a bench, lower the dumbbell heads to the chest with the elbows flared. Lockout strength." },
  { id: "cable-tricep-kickback", name: "Cable Tricep Kickback", category: "Triceps", musclesWorked: ["Triceps"], description: "Hinge forward and extend the arm back against a low cable. Tension where dumbbells have none." },
  { id: "cross-body-cable-extension", name: "Cross-Body Cable Extension", category: "Triceps", musclesWorked: ["Triceps"], description: "Cable from the opposite side, extend the arm across and out. Lateral-head work that suits the elbow." },
  { id: "bodyweight-tricep-extension", name: "Bodyweight Tricep Extension", category: "Triceps", musclesWorked: ["Triceps", "Core"], description: "Hands on a low bar, lower the head beneath it and extend back out. A skull crusher with your body.", isBodyweight: true },
  { id: "assisted-dip", name: "Assisted Dip", category: "Triceps", musclesWorked: ["Triceps", "Chest"], description: "Dips with a machine pad taking part of your weight. Log the assistance as a negative.", isBodyweight: true },
  { id: "incline-skull-crusher", name: "Incline Skull Crusher", category: "Triceps", musclesWorked: ["Triceps"], description: "Skull crusher on an incline bench, lowering behind the head. More stretch on the long head." },
  { id: "decline-skull-crusher", name: "Decline Skull Crusher", category: "Triceps", musclesWorked: ["Triceps"], description: "Skull crusher on a decline bench. Keeps tension on the triceps at the top where the flat version rests." },
  { id: "cable-skull-crusher", name: "Cable Skull Crusher", category: "Triceps", musclesWorked: ["Triceps"], description: "Lying on a bench, head toward a low cable, extend a bar or rope up. Tension through the whole rep." },
  { id: "single-arm-overhead-extension", name: "Single-Arm Overhead Extension", category: "Triceps", musclesWorked: ["Triceps"], description: "One dumbbell lowered behind the head and pressed back up. Long-head stretch, one side at a time." },
  { id: "ez-bar-overhead-extension", name: "EZ-Bar Overhead Extension", category: "Triceps", musclesWorked: ["Triceps"], description: "Seated or standing, lower an EZ bar behind the head and extend. Heavier long-head loading than one dumbbell." },
  { id: "smith-close-grip-bench", name: "Smith Machine Close-Grip Bench Press", category: "Triceps", musclesWorked: ["Triceps", "Chest"], description: "Close-grip bench on a fixed bar path. Heavy triceps pressing without balancing the bar." },
  { id: "band-pushdown", name: "Resistance Band Pushdown", category: "Triceps", musclesWorked: ["Triceps"], description: "Band anchored overhead, push it down to straight arms. Triceps work with no cable station." },
  { id: "band-overhead-extension", name: "Resistance Band Overhead Extension", category: "Triceps", musclesWorked: ["Triceps"], description: "Band anchored low behind you, extend the arms overhead. Long-head work anywhere you can loop a band." },
  { id: "straight-bar-dip", name: "Straight Bar Dip", category: "Triceps", musclesWorked: ["Triceps", "Chest", "Shoulders"], description: "Dip on top of a single bar with it in front of the body. The top half of a muscle-up.", isBodyweight: true },
  { id: "close-grip-push-up", name: "Close-Grip Push-Up", category: "Triceps", musclesWorked: ["Triceps", "Chest"], description: "Hands under the shoulders, elbows brushing the ribs. Triceps push-up without the wrist angle of the diamond.", isBodyweight: true },
  { id: "rolling-db-extension", name: "Rolling Dumbbell Extension", category: "Triceps", musclesWorked: ["Triceps"], description: "Lying on a bench, lower the dumbbells beside the head, roll them back over the chest and press out. Lets you handle more than a strict skull crusher." },

  // Forearms
  { id: "wrist-curl", name: "Barbell Wrist Curl", category: "Forearms", musclesWorked: ["Forearms"], description: "Barbell in both hands, forearms on a bench, palms up. Curl the wrists to build the flexors." },
  { id: "dumbbell-wrist-curl", name: "Dumbbell Wrist Curl", category: "Forearms", musclesWorked: ["Forearms"], description: "One dumbbell per hand over a bench, palms up. Lets each wrist work through its full range." },
  { id: "machine-wrist-curl", name: "Machine Wrist Curl", category: "Forearms", musclesWorked: ["Forearms"], description: "Seated at a wrist-curl or preacher-style machine, palms up. Constant tension on the flexors." },
  { id: "reverse-wrist-curl", name: "Barbell Reverse Wrist Curl", category: "Forearms", musclesWorked: ["Forearms"], description: "Barbell with a palms-down grip on a bench. Wrist extension for the forearm extensors." },
  { id: "dumbbell-reverse-wrist-curl", name: "Dumbbell Reverse Wrist Curl", category: "Forearms", musclesWorked: ["Forearms"], description: "Dumbbells palms-down over a bench. Independent extension for each forearm." },
  { id: "machine-reverse-wrist-curl", name: "Machine Reverse Wrist Curl", category: "Forearms", musclesWorked: ["Forearms"], description: "Machine wrist extension, palms down. Steady tension on the extensors." },
  { id: "behind-back-wrist-curl", name: "Behind-the-Back Wrist Curl", category: "Forearms", musclesWorked: ["Forearms"], description: "Barbell held behind the body, curl at the wrists. Deep flexor work." },
  { id: "reverse-barbell-curl", name: "Reverse Barbell Curl", category: "Forearms", musclesWorked: ["Forearms", "Biceps"], description: "Overhand curl targeting the brachioradialis and forearms." },
  { id: "wrist-roller", name: "Wrist Roller", category: "Forearms", musclesWorked: ["Forearms"], description: "Roll a weighted cord up and down. Brutal forearm endurance." },
  { id: "farmers-carry", name: "Farmer's Carry", category: "Forearms", musclesWorked: ["Forearms", "Traps", "Core"], description: "Walk carrying heavy loads. Grip, traps, and core conditioning." },
  { id: "plate-pinch", name: "Plate Pinch", category: "Forearms", musclesWorked: ["Forearms"], description: "Pinch plates together and hold. Direct grip and thumb strength." },
  { id: "dead-hang", name: "Dead Hang", category: "Forearms", musclesWorked: ["Forearms", "Lats"], description: "Hang from a bar for time. Grip endurance and shoulder decompression." },
  { id: "hand-gripper", name: "Hand Gripper", category: "Forearms", musclesWorked: ["Forearms"], description: "Squeeze a spring gripper closed. Direct crushing-grip strength." },
  { id: "finger-curl", name: "Finger Curl", category: "Forearms", musclesWorked: ["Forearms"], description: "Let the bar roll down to the fingertips and curl it back into the palm. Finger flexor strength." },
  { id: "towel-hang", name: "Towel Hang", category: "Forearms", musclesWorked: ["Forearms", "Lats"], description: "Hang from towels looped over a bar. Much harder on the grip than the bar itself." },
  { id: "barbell-hold", name: "Barbell Static Hold", category: "Forearms", musclesWorked: ["Forearms", "Traps"], description: "Hold a heavy bar at lockout for time. Grip work at loads you can't carry." },
  { id: "reverse-ez-bar-curl", name: "Reverse EZ-Bar Curl", category: "Forearms", musclesWorked: ["Forearms", "Biceps"], description: "Overhand curl on the angled grips of an EZ bar. Brachioradialis work that's easier on the wrists." },
  { id: "reverse-db-curl", name: "Reverse Dumbbell Curl", category: "Forearms", musclesWorked: ["Forearms", "Biceps"], description: "Palms-down curl with a dumbbell in each hand. Lets each wrist settle where it's comfortable." },
  { id: "reverse-cable-curl", name: "Reverse Cable Curl", category: "Forearms", musclesWorked: ["Forearms", "Biceps"], description: "Overhand curl with a straight bar on a low cable. Forearm tension that doesn't fade at the top." },
  { id: "reverse-preacher-curl", name: "Reverse Preacher Curl", category: "Forearms", musclesWorked: ["Forearms", "Biceps"], description: "Overhand curl over the preacher pad. No swinging, so the forearms do the lifting." },
  { id: "wrist-pronation", name: "Wrist Pronation", category: "Forearms", musclesWorked: ["Forearms"], description: "Forearm braced, rotate a hammer or one-sided dumbbell from palm up to palm down. Trains the forearm's inward turn." },
  { id: "wrist-supination", name: "Wrist Supination", category: "Forearms", musclesWorked: ["Forearms"], description: "Forearm braced, rotate a hammer or one-sided dumbbell from palm down to palm up. Trains the forearm's outward turn." },
  { id: "cable-wrist-curl", name: "Cable Wrist Curl", category: "Forearms", musclesWorked: ["Forearms"], description: "Forearms on a bench facing a low cable, palms up, curl the wrists. Steady tension on the flexors." },
  { id: "band-finger-extension", name: "Band Finger Extension", category: "Forearms", musclesWorked: ["Forearms"], description: "Rubber band around the fingertips, spread the fingers open against it. Balances out all the gripping." },
  { id: "one-arm-dead-hang", name: "One-Arm Dead Hang", category: "Forearms", musclesWorked: ["Forearms", "Lats"], description: "Hang from a bar by one hand for time. Your whole bodyweight on a single grip." },

  // Neck
  { id: "plate-neck-flexion", name: "Plate Neck Flexion", category: "Neck", musclesWorked: ["Neck"], description: "Lying face up with a padded plate on the forehead, curl the chin toward the chest. Front of the neck." },
  { id: "plate-neck-extension", name: "Plate Neck Extension", category: "Neck", musclesWorked: ["Neck", "Traps"], description: "Lying face down with a padded plate on the back of the head, lift the head up. Back of the neck." },
  { id: "lateral-neck-flexion", name: "Lateral Neck Flexion", category: "Neck", musclesWorked: ["Neck"], description: "Lying on your side with a padded plate on the head, lift the ear toward the shoulder. Sides of the neck." },
  { id: "neck-harness-extension", name: "Neck Harness Extension", category: "Neck", musclesWorked: ["Neck", "Traps"], description: "Weight hung from a head harness, lift the head from chin-down to neutral. Loadable neck extension." },
  { id: "neck-machine-flexion", name: "4-Way Neck Flexion", category: "Neck", musclesWorked: ["Neck"], description: "Seated on the 4-way neck machine, facing the pad. Push the head forward and down against it." },
  { id: "neck-machine-extension", name: "4-Way Neck Extension", category: "Neck", musclesWorked: ["Neck", "Traps"], description: "Seated on the 4-way neck machine, back of the head on the pad. Push the head back against it." },
  { id: "neck-machine-lateral-flexion", name: "4-Way Neck Lateral Flexion", category: "Neck", musclesWorked: ["Neck"], description: "Seated on the 4-way neck machine, side of the head on the pad. Tilt the ear toward the shoulder against it." },
  { id: "banded-neck-flexion", name: "Banded Neck Flexion", category: "Neck", musclesWorked: ["Neck"], description: "Band anchored behind you and looped over the forehead. Nod the chin down against it." },
  { id: "banded-neck-extension", name: "Banded Neck Extension", category: "Neck", musclesWorked: ["Neck", "Traps"], description: "Band anchored in front and looped behind the head. Take the head back against it." },
  { id: "neck-isometric-hold", name: "Neck Isometric Hold", category: "Neck", musclesWorked: ["Neck"], description: "Press the head into your own hand without letting it move. Front, back and both sides." },
  { id: "chin-tuck", name: "Chin Tuck", category: "Neck", musclesWorked: ["Neck"], description: "Lying face up, tuck the chin and lift the head an inch off the floor. Deep neck flexor strength.", isBodyweight: true },
  { id: "wrestlers-bridge", name: "Wrestler's Bridge", category: "Neck", musclesWorked: ["Neck", "Traps", "Glutes"], description: "Face up on a mat, arch onto your head and feet and rock slowly. Bodyweight work for the back of the neck.", isBodyweight: true },
  { id: "front-neck-bridge", name: "Front Neck Bridge", category: "Neck", musclesWorked: ["Neck", "Core"], description: "Face down, weight on the forehead and feet, rock slowly forward and back. Bodyweight work for the front of the neck.", isBodyweight: true },
  { id: "banded-lateral-neck-flexion", name: "Banded Lateral Neck Flexion", category: "Neck", musclesWorked: ["Neck"], description: "Band anchored to one side and looped around the head. Tilt the ear away from the anchor against it." },
  { id: "neck-harness-flexion", name: "Neck Harness Flexion", category: "Neck", musclesWorked: ["Neck"], description: "Head harness clipped to a cable behind you at head height. Nod the chin down to the chest against it." },

  // Legs
  { id: "squat", name: "Back Squat", category: "Legs", musclesWorked: ["Quads", "Glutes", "Hamstrings", "Core"], description: "Bar on upper traps. Depth below parallel, knees track toes." },
  { id: "front-squat", name: "Front Squat", category: "Legs", musclesWorked: ["Quads", "Core", "Glutes"], description: "Bar on front delts. More quad emphasis and core demand." },
  { id: "goblet-squat", name: "Goblet Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Hold a dumbbell at the chest. Great for depth and beginners." },
  { id: "smith-squat", name: "Smith Machine Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Fixed bar path lets you push quads hard with less balance demand." },
  { id: "box-squat", name: "Box Squat", category: "Legs", musclesWorked: ["Quads", "Glutes", "Hamstrings"], description: "Squat to a box for consistent depth and explosive drive off it." },
  { id: "safety-bar-squat", name: "Safety Bar Squat", category: "Legs", musclesWorked: ["Quads", "Glutes", "Core"], description: "Padded yoke bar. Upright torso, shoulder-friendly squatting." },
  { id: "hack-squat", name: "Hack Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Machine squat variation. Upright torso, quad dominant." },
  { id: "pendulum-squat", name: "Pendulum Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Arced machine path with a deep stretch. Heavy quad emphasis." },
  { id: "belt-squat", name: "Belt Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Load hangs from the hips. Trains legs with zero spinal load." },
  { id: "leg-press", name: "Leg Press", category: "Legs", musclesWorked: ["Quads", "Glutes", "Hamstrings"], description: "Machine-based pressing. Foot placement alters emphasis." },
  { id: "single-leg-press", name: "Single-Leg Press", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "One leg at a time on the leg press. Fixes side-to-side imbalances." },
  { id: "lunges", name: "Lunges", category: "Legs", musclesWorked: ["Quads", "Glutes", "Hamstrings"], description: "Walking or stationary. Unilateral movement for balance.", isBodyweight: true },
  { id: "walking-lunge", name: "Walking Lunge", category: "Legs", musclesWorked: ["Quads", "Glutes", "Hamstrings"], description: "Step forward continuously. Loaded unilateral leg and glute work.", isBodyweight: true },
  { id: "reverse-lunge", name: "Reverse Lunge", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Step back into the lunge. Easier on the knees than forward lunges.", isBodyweight: true },
  { id: "bulgarian-squat", name: "Bulgarian Split Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Rear foot elevated. Demanding unilateral leg exercise.", isBodyweight: true },
  { id: "step-up", name: "Step-Up", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Drive up onto a box. Unilateral quad and glute strength.", isBodyweight: true },
  { id: "sissy-squat", name: "Sissy Squat", category: "Legs", musclesWorked: ["Quads"], description: "Lean back on the toes for an intense quad stretch and contraction.", isBodyweight: true },
  { id: "leg-extension", name: "Leg Extension", category: "Legs", musclesWorked: ["Quads"], description: "Direct quad isolation. Control the eccentric." },
  { id: "romanian-dl", name: "Romanian Deadlift", category: "Legs", musclesWorked: ["Hamstrings", "Glutes", "Back"], description: "Hip hinge with minimal knee bend. Maximum hamstring stretch." },
  { id: "good-morning", name: "Good Morning", category: "Legs", musclesWorked: ["Hamstrings", "Glutes", "Lower Back"], description: "Barbell on the back, hinge forward. Hamstring and posterior-chain builder." },
  { id: "leg-curl", name: "Lying Leg Curl", category: "Legs", musclesWorked: ["Hamstrings"], description: "Face-down machine curl. Direct hamstring isolation." },
  { id: "seated-leg-curl", name: "Seated Leg Curl", category: "Legs", musclesWorked: ["Hamstrings"], description: "Upright machine curl with the hips flexed. Strong hamstring stretch." },
  { id: "nordic-curl", name: "Nordic Hamstring Curl", category: "Legs", musclesWorked: ["Hamstrings"], description: "Lower the body under control with anchored ankles. Elite eccentric strength.", isBodyweight: true },
  { id: "glute-ham-raise", name: "Glute-Ham Raise", category: "Legs", musclesWorked: ["Hamstrings", "Glutes"], description: "GHD bench raise. Powerful hamstring and glute contraction.", isBodyweight: true },
  { id: "adductor-machine", name: "Adductor Machine", category: "Legs", musclesWorked: ["Hip Flexors"], description: "Squeeze the pads together. Isolates the inner-thigh adductors." },
  { id: "calf-raise", name: "Calf Raise", category: "Legs", musclesWorked: ["Calves"], description: "Standing or seated. Full range, pause at bottom." },
  { id: "seated-calf-raise", name: "Seated Calf Raise", category: "Legs", musclesWorked: ["Calves"], description: "Knees bent to bias the soleus. Slow, full-range reps." },
  { id: "leg-press-calf-raise", name: "Leg Press Calf Raise", category: "Legs", musclesWorked: ["Calves"], description: "Push through the balls of the feet on the leg press. Heavy calf loading." },
  { id: "donkey-calf-raise", name: "Donkey Calf Raise", category: "Legs", musclesWorked: ["Calves"], description: "Hip-hinged calf raise for a huge stretch on the gastrocnemius." },
  { id: "tibialis-raise", name: "Tibialis Raise", category: "Legs", musclesWorked: ["Tibialis"], description: "Heels down, pull the toes up toward the shins against a wall or plate. Builds the tibialis anterior (front of the shin) for knee health." },
  { id: "stiff-leg-deadlift", name: "Stiff-Leg Deadlift", category: "Legs", musclesWorked: ["Hamstrings", "Glutes", "Lower Back"], description: "Knees nearly straight, each rep from the floor. More hamstring stretch than a Romanian." },
  { id: "db-romanian-deadlift", name: "Dumbbell Romanian Deadlift", category: "Legs", musclesWorked: ["Hamstrings", "Glutes", "Back"], description: "Romanian deadlift with a dumbbell in each hand. Easy to learn the hinge with." },
  { id: "single-leg-rdl", name: "Single-Leg Romanian Deadlift", category: "Legs", musclesWorked: ["Hamstrings", "Glutes", "Core"], description: "Hinge on one leg with the other reaching back. Hamstrings, glutes and balance." },
  { id: "standing-leg-curl", name: "Standing Leg Curl", category: "Legs", musclesWorked: ["Hamstrings"], description: "One leg at a time on a standing curl machine. Evens out the two sides." },
  { id: "stability-ball-leg-curl", name: "Stability Ball Leg Curl", category: "Legs", musclesWorked: ["Hamstrings", "Glutes"], description: "Heels on a ball, hips up, roll the ball in. Hamstring curl with no machine.", isBodyweight: true },
  { id: "zercher-squat", name: "Zercher Squat", category: "Legs", musclesWorked: ["Quads", "Glutes", "Core"], description: "Bar held in the crooks of the elbows. Upright squat that hammers the upper back and core." },
  { id: "landmine-squat", name: "Landmine Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Hold the end of a landmine bar at the chest and squat. The angled bar keeps you upright." },
  { id: "thruster", name: "Thruster", category: "Legs", musclesWorked: ["Quads", "Glutes", "Shoulders"], description: "Front squat straight into an overhead press in one movement. Legs, shoulders and lungs." },
  { id: "wall-ball", name: "Wall Ball", category: "Legs", musclesWorked: ["Quads", "Glutes", "Shoulders"], description: "Squat with a medicine ball and throw it to a target on the wall. Catch and go again." },
  { id: "split-squat", name: "Split Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Staggered stance, both feet on the floor, drop the back knee. The easier Bulgarian.", isBodyweight: true },
  { id: "pistol-squat", name: "Pistol Squat", category: "Legs", musclesWorked: ["Quads", "Glutes", "Core"], description: "Squat all the way down on one leg with the other held out in front. Strength and balance.", isBodyweight: true },
  { id: "bodyweight-squat", name: "Bodyweight Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Squat with no load. For warm-ups, high reps, and learning the pattern.", isBodyweight: true },
  { id: "jump-squat", name: "Jump Squat", category: "Legs", musclesWorked: ["Quads", "Glutes", "Calves"], description: "Squat down and jump as high as you can. Explosive leg power.", isBodyweight: true },
  { id: "wall-sit", name: "Wall Sit", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Back against a wall, thighs parallel, hold. Quad endurance without moving a joint." },
  { id: "lateral-lunge", name: "Lateral Lunge", category: "Legs", musclesWorked: ["Quads", "Glutes", "Adductors"], description: "Step out to the side and sit into that hip. Trains the legs side to side for once.", isBodyweight: true },
  { id: "cossack-squat", name: "Cossack Squat", category: "Legs", musclesWorked: ["Quads", "Adductors", "Glutes"], description: "Wide stance, shift deep onto one leg with the other straight. Strength through a big hip range.", isBodyweight: true },
  { id: "sumo-squat", name: "Sumo Squat", category: "Legs", musclesWorked: ["Quads", "Adductors", "Glutes"], description: "Wide stance, toes out, dumbbell or kettlebell hanging between the legs. Inner-thigh emphasis." },
  { id: "reverse-nordic", name: "Reverse Nordic", category: "Legs", musclesWorked: ["Quads"], description: "Kneeling upright, lean the whole body back from the knees. Quads under a long stretch.", isBodyweight: true },
  { id: "cable-hip-adduction", name: "Cable Hip Adduction", category: "Legs", musclesWorked: ["Adductors"], description: "Ankle strap on a low cable, sweep the leg in across the body. Inner-thigh work, one side at a time." },
  { id: "copenhagen-plank", name: "Copenhagen Plank", category: "Legs", musclesWorked: ["Adductors", "Obliques"], description: "Side plank with the top leg on a bench holding you up. Hard, direct adductor strength." },
  { id: "single-leg-calf-raise", name: "Single-Leg Calf Raise", category: "Legs", musclesWorked: ["Calves"], description: "One foot on a step, the other off. Your whole bodyweight on one calf.", isBodyweight: true },
  { id: "smith-calf-raise", name: "Smith Machine Calf Raise", category: "Legs", musclesWorked: ["Calves"], description: "Standing calf raise under a Smith bar, toes on a plate. Heavy load with nothing to balance." },
  { id: "v-squat", name: "V-Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Plate-loaded squat machine with shoulder pads and an arcing path. Feels like a barbell squat without the balancing." },
  { id: "reverse-hack-squat", name: "Reverse Hack Squat", category: "Legs", musclesWorked: ["Glutes", "Hamstrings", "Quads"], description: "Face the pad on a hack squat machine and squat with the hips pushing back. Shifts the work toward the glutes and hamstrings." },
  { id: "barbell-hack-squat", name: "Barbell Hack Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Barbell held behind the legs, stood up from the floor. The original hack squat, no machine needed." },
  { id: "horizontal-leg-press", name: "Horizontal Leg Press", category: "Legs", musclesWorked: ["Quads", "Glutes", "Hamstrings"], description: "Seated leg press that pushes straight out, usually pin-loaded. Easier to get in and out of than the 45° sled." },
  { id: "vertical-leg-press", name: "Vertical Leg Press", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Lie on your back and press a sled straight up overhead. Heavy leg work in very little floor space." },
  { id: "iso-lateral-leg-press", name: "Iso-Lateral Leg Press", category: "Legs", musclesWorked: ["Quads", "Glutes", "Hamstrings"], description: "Plate-loaded leg press with a separate foot plate for each leg. Both legs at once or one at a time, and neither can hide." },
  { id: "low-bar-squat", name: "Low-Bar Squat", category: "Legs", musclesWorked: ["Glutes", "Hamstrings", "Quads", "Lower Back"], description: "Bar sits lower, across the rear delts, with more forward lean. Brings the hips in and usually moves the most weight." },
  { id: "pause-squat", name: "Pause Squat", category: "Legs", musclesWorked: ["Quads", "Glutes", "Core"], description: "Back squat with a dead stop of a second or two at the bottom. Builds strength out of the hole and honest depth." },
  { id: "overhead-squat", name: "Overhead Squat", category: "Legs", musclesWorked: ["Quads", "Glutes", "Shoulders", "Core"], description: "Squat with a barbell locked out overhead on a wide grip. Leg strength, shoulder stability and mobility in one." },
  { id: "dumbbell-squat", name: "Dumbbell Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Squat holding a dumbbell at each side. Easy to load when there's no rack free." },
  { id: "kettlebell-front-squat", name: "Kettlebell Front Squat", category: "Legs", musclesWorked: ["Quads", "Glutes", "Core"], description: "Two kettlebells held in the rack position at the shoulders. Upright squatting that asks a lot of the trunk." },
  { id: "heel-elevated-goblet-squat", name: "Heel-Elevated Goblet Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Goblet squat with the heels up on a wedge or plates. Lets the knees travel forward for deeper, quad-heavy reps." },
  { id: "spanish-squat", name: "Spanish Squat", category: "Legs", musclesWorked: ["Quads"], description: "Heavy band looped behind the knees and anchored in front, sit back into it. Quad work with the shins kept vertical.", isBodyweight: true },
  { id: "smith-bulgarian-split-squat", name: "Smith Machine Bulgarian Split Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Rear foot on a bench behind you, Smith bar on the back. The bar handles the balance so the front leg can go heavy." },
  { id: "front-foot-elevated-split-squat", name: "Front-Foot-Elevated Split Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Split squat with the front foot raised on a low step or plate. More depth and a bigger stretch than from the floor.", isBodyweight: true },
  { id: "landmine-reverse-lunge", name: "Landmine Reverse Lunge", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Hold the end of a landmine bar at the chest and step back into a lunge. The anchored bar makes balance much easier." },
  { id: "skater-squat", name: "Skater Squat", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "On one leg, bend the free knee behind you and lower it toward a pad. A single-leg squat that's easier to balance than a pistol.", isBodyweight: true },
  { id: "box-pistol-squat", name: "Box Pistol Squat", category: "Legs", musclesWorked: ["Quads", "Glutes", "Core"], description: "Pistol squat down to a box or bench behind you. The way to build up to a full pistol.", isBodyweight: true },
  { id: "lateral-step-up", name: "Lateral Step-Up", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Stand side-on to a box and step up sideways. Works the side of the hip along with the quads.", isBodyweight: true },
  { id: "single-leg-extension", name: "Single-Leg Extension", category: "Legs", musclesWorked: ["Quads"], description: "Leg extension one leg at a time. Shows up a weaker side and gives it the work to catch up." },
  { id: "iso-lateral-leg-extension", name: "Iso-Lateral Leg Extension", category: "Legs", musclesWorked: ["Quads"], description: "Plate-loaded leg extension with an independent arm for each leg. Heavy quad isolation that evens out both sides." },
  { id: "kneeling-leg-curl", name: "Kneeling Leg Curl", category: "Legs", musclesWorked: ["Hamstrings"], description: "One knee on the pad, curl the other heel up against a roller. Single-leg hamstring isolation with the hips locked in." },
  { id: "sliding-leg-curl", name: "Sliding Leg Curl", category: "Legs", musclesWorked: ["Hamstrings", "Glutes"], description: "Heels on sliders or a towel, hips up, pull the heels in. A hamstring curl for any smooth floor.", isBodyweight: true },
  { id: "dumbbell-leg-curl", name: "Dumbbell Leg Curl", category: "Legs", musclesWorked: ["Hamstrings"], description: "Face down on a bench with a dumbbell held between the feet. A lying leg curl with no machine." },
  { id: "cable-leg-curl", name: "Cable Leg Curl", category: "Legs", musclesWorked: ["Hamstrings"], description: "Standing, ankle strap on a low cable, curl the heel up behind you. One leg at a time with constant tension." },
  { id: "smith-romanian-deadlift", name: "Smith Machine Romanian Deadlift", category: "Legs", musclesWorked: ["Hamstrings", "Glutes"], description: "Romanian deadlift on the fixed Smith path. Lets you focus on the hinge without the bar drifting." },
  { id: "b-stance-rdl", name: "B-Stance Romanian Deadlift", category: "Legs", musclesWorked: ["Hamstrings", "Glutes"], description: "Front foot does the work, back foot on its toes as a kickstand. Most of a single-leg RDL without the wobble." },
  { id: "side-lying-hip-adduction", name: "Side-Lying Hip Adduction", category: "Legs", musclesWorked: ["Adductors"], description: "Lying on your side, top leg crossed in front, lift the straight bottom leg. Simple inner-thigh work on the floor.", isBodyweight: true },
  { id: "adductor-squeeze", name: "Adductor Squeeze", category: "Legs", musclesWorked: ["Adductors"], description: "Lying with the knees bent, squeeze a ball or pad between them and hold. Isometric inner-thigh strength." },
  { id: "cable-hip-flexion", name: "Cable Hip Flexion", category: "Legs", musclesWorked: ["Hip Flexors", "Quads"], description: "Ankle strap on a low cable, facing away, drive the knee up in front. Direct, loadable hip flexor work." },
  { id: "standing-calf-raise-machine", name: "Standing Calf Raise Machine", category: "Legs", musclesWorked: ["Calves"], description: "Shoulders under the pads of the standing calf machine, balls of the feet on the block. Straight-legged calf work you can load heavy." },
  { id: "barbell-calf-raise", name: "Barbell Calf Raise", category: "Legs", musclesWorked: ["Calves"], description: "Barbell on the upper back, balls of the feet on a plate or block. Free-weight standing calf work." },
  { id: "dumbbell-calf-raise", name: "Dumbbell Calf Raise", category: "Legs", musclesWorked: ["Calves"], description: "Both feet on a step with a dumbbell in each hand. Standing calf work with nothing but dumbbells." },
  { id: "hack-squat-calf-raise", name: "Hack Squat Calf Raise", category: "Legs", musclesWorked: ["Calves"], description: "Balls of the feet on the bottom edge of the hack squat platform, legs straight. Heavy calf loading with the shoulders pinned under pads." },
  { id: "seated-db-calf-raise", name: "Seated Dumbbell Calf Raise", category: "Legs", musclesWorked: ["Calves"], description: "Sitting on a bench, toes on a plate, dumbbells resting on the knees. Soleus work when there's no seated calf machine." },
  { id: "seated-tibialis-raise", name: "Seated Tibialis Raise", category: "Legs", musclesWorked: ["Tibialis"], description: "Sitting on a box with a tib bar or dumbbell hooked over the feet, pull the toes up. Loadable work for the front of the shin." },
  { id: "pogo-jump", name: "Pogo Jumps", category: "Legs", musclesWorked: ["Calves"], description: "Quick, small bounces off the balls of the feet with stiff ankles. Springy lower legs for running and jumping.", isBodyweight: true },
  { id: "broad-jump", name: "Broad Jump", category: "Legs", musclesWorked: ["Glutes", "Quads", "Hamstrings"], description: "Swing the arms and jump forward as far as you can, landing on both feet. Horizontal power.", isBodyweight: true },
  { id: "tuck-jump", name: "Tuck Jump", category: "Legs", musclesWorked: ["Quads", "Glutes", "Hip Flexors"], description: "Jump straight up and pull the knees to the chest at the top. Fast, explosive leg power.", isBodyweight: true },
  { id: "depth-jump", name: "Depth Jump", category: "Legs", musclesWorked: ["Quads", "Glutes", "Calves"], description: "Step off a box, land and jump straight back up as fast as you can. Trains a quick bounce off the ground.", isBodyweight: true },
  { id: "jumping-lunge", name: "Jumping Lunge", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "From a lunge, jump and switch legs in the air. Single-leg power and a lot of heart rate.", isBodyweight: true },
  { id: "single-leg-wall-sit", name: "Single-Leg Wall Sit", category: "Legs", musclesWorked: ["Quads", "Glutes"], description: "Wall sit with one foot lifted off the floor. Twice the load on each leg with no equipment." },

  // Glutes
  { id: "hip-thrust", name: "Hip Thrust", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "Bar over hips, drive upward. The premier glute exercise." },
  { id: "machine-hip-thrust", name: "Machine Hip Thrust", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "Plate-loaded thrust machine. Easy setup and heavy loading." },
  { id: "single-leg-hip-thrust", name: "Single-Leg Hip Thrust", category: "Glutes", musclesWorked: ["Glutes"], description: "One leg at a time for unilateral glute strength and balance.", isBodyweight: true },
  { id: "b-stance-hip-thrust", name: "B-Stance Hip Thrust", category: "Glutes", musclesWorked: ["Glutes"], description: "Staggered stance shifts most load onto the working glute." },
  { id: "glute-bridge", name: "Glute Bridge", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "Floor-based hip extension. Controlled squeeze at top.", isBodyweight: true },
  { id: "cable-pull-through", name: "Cable Pull-Through", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "Hip hinge against a low cable. Teaches a strong glute lockout." },
  { id: "cable-kickback", name: "Cable Kickback", category: "Glutes", musclesWorked: ["Glutes"], description: "Ankle attachment, extend leg back. Direct glute isolation." },
  { id: "reverse-hyper", name: "Reverse Hyperextension", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings", "Lower Back"], description: "Swing the legs up behind you. Glutes, hams, and low-back health." },
  { id: "sumo-dl", name: "Sumo Deadlift", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings", "Quads"], description: "Wide stance, vertical torso. Greater hip abductor involvement." },
  { id: "curtsy-lunge", name: "Curtsy Lunge", category: "Glutes", musclesWorked: ["Glutes", "Quads"], description: "Step behind and across. Targets the gluteus medius.", isBodyweight: true },
  { id: "abduction-machine", name: "Hip Abduction Machine", category: "Glutes", musclesWorked: ["Glutes"], description: "Seated abduction. Targets gluteus medius and minimus." },
  { id: "banded-lateral-walk", name: "Banded Lateral Walk", category: "Glutes", musclesWorked: ["Glutes"], description: "Band around the knees, step sideways. Glute-medius activation." },
  { id: "frog-pump", name: "Frog Pump", category: "Glutes", musclesWorked: ["Glutes"], description: "Soles together, pump the hips up. High-rep glute burnout.", isBodyweight: true },
  { id: "kettlebell-swing", name: "Kettlebell Swing", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings", "Core"], description: "Hike the bell back and snap the hips to float it to chest height. Explosive hip hinge." },
  { id: "smith-hip-thrust", name: "Smith Machine Hip Thrust", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "Hip thrust under a Smith bar. The fixed path makes setup and heavy loading simple." },
  { id: "machine-glute-kickback", name: "Machine Glute Kickback", category: "Glutes", musclesWorked: ["Glutes"], description: "Kickback on a glute machine with a foot plate or pad. Direct glute work that's easy to load." },
  { id: "donkey-kick", name: "Donkey Kick", category: "Glutes", musclesWorked: ["Glutes"], description: "On hands and knees, drive one bent leg up toward the ceiling. Floor-based glute isolation.", isBodyweight: true },
  { id: "fire-hydrant", name: "Fire Hydrant", category: "Glutes", musclesWorked: ["Glutes"], description: "On hands and knees, lift a bent leg out to the side. Glute medius activation.", isBodyweight: true },
  { id: "clamshell", name: "Clamshell", category: "Glutes", musclesWorked: ["Glutes"], description: "Side-lying, knees bent, open the top knee against a band. Gluteus medius for hip stability." },
  { id: "side-lying-hip-abduction", name: "Side-Lying Hip Abduction", category: "Glutes", musclesWorked: ["Glutes"], description: "Lying on your side, raise the straight top leg. Simple, effective glute medius work.", isBodyweight: true },
  { id: "cable-hip-abduction", name: "Cable Hip Abduction", category: "Glutes", musclesWorked: ["Glutes"], description: "Ankle strap on a low cable, sweep the leg out to the side. Standing glute medius work." },
  { id: "dumbbell-hip-thrust", name: "Dumbbell Hip Thrust", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "Hip thrust with a dumbbell held across the hips. The home and crowded-gym version of the barbell thrust." },
  { id: "kas-glute-bridge", name: "Kas Glute Bridge", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "Upper back on a bench, bar on the hips, short range from halfway up to lockout. Keeps the glutes loaded the whole set." },
  { id: "feet-elevated-glute-bridge", name: "Feet-Elevated Glute Bridge", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "Glute bridge with the heels up on a bench or step. Bigger range, and more hamstring than the floor version.", isBodyweight: true },
  { id: "single-leg-glute-bridge", name: "Single-Leg Glute Bridge", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "On your back, one foot planted and the other leg lifted, drive the hips up. One glute at a time on the floor.", isBodyweight: true },
  { id: "marching-glute-bridge", name: "Marching Glute Bridge", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings", "Core"], description: "Hold a glute bridge and lift one foot at a time without the hips dropping. Glutes and pelvic control together.", isBodyweight: true },
  { id: "kneeling-hip-thrust", name: "Kneeling Hip Thrust", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "Kneeling, band anchored behind you across the hips, sit back toward the heels and drive the hips forward. Glute lockout work with no bench." },
  { id: "45-degree-hip-extension", name: "45-Degree Hip Extension", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings"], description: "Back extension bench with the pad below the hips, upper back rounded, feet turned out. The glute version of the hyperextension.", isBodyweight: true },
  { id: "bench-reverse-hyper", name: "Bench Reverse Hyperextension", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings", "Lower Back"], description: "Face down on a high bench, hips at the edge, raise both legs behind you. Reverse hypers with no machine.", isBodyweight: true },
  { id: "kettlebell-sumo-deadlift", name: "Kettlebell Sumo Deadlift", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings", "Quads"], description: "Wide stance, one heavy kettlebell between the feet, stand it up. A beginner-friendly way to learn the deadlift." },
  { id: "single-arm-kettlebell-swing", name: "Single-Arm Kettlebell Swing", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings", "Core"], description: "Kettlebell swing with one hand on the handle. The trunk has to stop the bell twisting you." },
  { id: "smith-reverse-lunge", name: "Smith Machine Reverse Lunge", category: "Glutes", musclesWorked: ["Glutes", "Quads"], description: "Step back into a lunge under a Smith bar. Heavy single-leg work with the balance taken care of." },
  { id: "deficit-reverse-lunge", name: "Deficit Reverse Lunge", category: "Glutes", musclesWorked: ["Glutes", "Quads", "Hamstrings"], description: "Stand on a plate or low step and step back off it into the lunge. The extra depth puts the glute under a longer stretch.", isBodyweight: true },
  { id: "crossover-step-up", name: "Crossover Step-Up", category: "Glutes", musclesWorked: ["Glutes", "Quads"], description: "Stand beside a box and step up with the far leg, crossing in front. Extra work for the side of the glute.", isBodyweight: true },
  { id: "seated-banded-hip-abduction", name: "Seated Banded Hip Abduction", category: "Glutes", musclesWorked: ["Glutes"], description: "Seated on a bench, band above the knees, push the knees apart. Glute medius burnout with a band and nothing else." },
  { id: "monster-walk", name: "Monster Walk", category: "Glutes", musclesWorked: ["Glutes"], description: "Band around the knees or ankles, step forward and out on the diagonal. Glute medius work walking forwards and back rather than sideways." },
  { id: "side-plank-hip-abduction", name: "Side Plank Hip Abduction", category: "Glutes", musclesWorked: ["Glutes", "Obliques"], description: "Hold a side plank and raise the top leg. Works the glute medius on both sides at once.", isBodyweight: true },
  { id: "hip-airplane", name: "Hip Airplane", category: "Glutes", musclesWorked: ["Glutes", "Hamstrings", "Core"], description: "Hinge on one leg and rotate the pelvis open and closed. Hip control and glute strength through rotation.", isBodyweight: true },

  // Core
  { id: "plank", name: "Plank", category: "Core", musclesWorked: ["Core"], description: "Maintain rigid body position. Breathe throughout." },
  { id: "side-plank", name: "Side Plank", category: "Core", musclesWorked: ["Obliques", "Core"], description: "Lateral stability hold. Targets obliques and QL." },
  { id: "hollow-hold", name: "Hollow Body Hold", category: "Core", musclesWorked: ["Abs"], description: "Lower back pressed down, limbs extended. Total anterior-core tension." },
  { id: "crunch", name: "Crunch", category: "Core", musclesWorked: ["Abs"], description: "Curl the shoulders off the floor. Classic upper-ab movement.", isBodyweight: true },
  { id: "sit-up", name: "Sit-Up", category: "Core", musclesWorked: ["Abs", "Hip Flexors"], description: "Full flexion from lying to seated. Trains the abs and hip flexors.", isBodyweight: true },
  { id: "decline-sit-up", name: "Decline Sit-Up", category: "Core", musclesWorked: ["Abs", "Hip Flexors"], description: "Sit-up on a decline bench for added resistance.", isBodyweight: true },
  { id: "bicycle-crunch", name: "Bicycle Crunch", category: "Core", musclesWorked: ["Abs", "Obliques"], description: "Alternate elbow to opposite knee. Hits abs and obliques.", isBodyweight: true },
  { id: "reverse-crunch", name: "Reverse Crunch", category: "Core", musclesWorked: ["Abs"], description: "Curl the hips toward the ribs. Lower-ab emphasis.", isBodyweight: true },
  { id: "cable-crunch", name: "Cable Crunch", category: "Core", musclesWorked: ["Abs"], description: "Loaded flexion. Curl elbows toward knees." },
  { id: "ab-crunch-machine", name: "Ab Crunch Machine", category: "Core", musclesWorked: ["Abs"], description: "Seated machine crunch. Easy to load progressively." },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", category: "Core", musclesWorked: ["Abs", "Hip Flexors"], description: "Dead hang, raise legs to 90° or higher.", isBodyweight: true },
  { id: "leg-raise", name: "Lying Leg Raise", category: "Core", musclesWorked: ["Abs", "Hip Flexors"], description: "Raise straight legs from the floor. Lower-ab focus.", isBodyweight: true },
  { id: "toes-to-bar", name: "Toes-to-Bar", category: "Core", musclesWorked: ["Abs", "Hip Flexors"], description: "Hang and bring the toes to the bar. Advanced ab and grip control.", isBodyweight: true },
  { id: "flutter-kick", name: "Flutter Kicks", category: "Core", musclesWorked: ["Abs", "Hip Flexors"], description: "Small alternating leg kicks. Lower-ab endurance.", isBodyweight: true },
  { id: "v-up", name: "V-Up", category: "Core", musclesWorked: ["Abs"], description: "Simultaneously raise the torso and legs to meet. Full-ab contraction.", isBodyweight: true },
  { id: "ab-rollout", name: "Ab Wheel Rollout", category: "Core", musclesWorked: ["Abs"], description: "Advanced anti-extension. Brutal for core strength.", isBodyweight: true },
  { id: "dead-bug", name: "Dead Bug", category: "Core", musclesWorked: ["Abs"], description: "Extend opposite arm and leg while bracing. Anti-extension control.", isBodyweight: true },
  { id: "russian-twist", name: "Russian Twist", category: "Core", musclesWorked: ["Obliques", "Core"], description: "Seated rotation with weight. Oblique focus.", isBodyweight: true },
  { id: "pallof-press", name: "Pallof Press", category: "Core", musclesWorked: ["Obliques", "Abs"], description: "Press a cable straight out and resist rotation. Anti-rotation strength." },
  { id: "woodchopper", name: "Cable Woodchopper", category: "Core", musclesWorked: ["Obliques", "Abs"], description: "Diagonal cable chop across the body. Rotational core power." },
  { id: "hanging-knee-raise", name: "Hanging Knee Raise", category: "Core", musclesWorked: ["Abs", "Hip Flexors"], description: "Hang and bring the knees up to the chest. The way in to the hanging leg raise.", isBodyweight: true },
  { id: "dragon-flag", name: "Dragon Flag", category: "Core", musclesWorked: ["Abs"], description: "Lying on a bench, gripping behind the head, lower the rigid body from vertical. Brutal anti-extension.", isBodyweight: true },
  { id: "windshield-wiper", name: "Windshield Wipers", category: "Core", musclesWorked: ["Obliques", "Abs"], description: "Legs raised, sweep them side to side under control. Rotational core strength.", isBodyweight: true },
  { id: "l-sit", name: "L-Sit", category: "Core", musclesWorked: ["Abs", "Hip Flexors", "Triceps"], description: "Hands on parallettes or dip bars, hold the legs straight out in front. Compression strength." },
  { id: "bird-dog", name: "Bird Dog", category: "Core", musclesWorked: ["Core", "Lower Back", "Glutes"], description: "On hands and knees, reach the opposite arm and leg long. Trunk control without spinal load.", isBodyweight: true },
  { id: "plank-shoulder-tap", name: "Plank Shoulder Tap", category: "Core", musclesWorked: ["Core", "Shoulders"], description: "From a high plank, tap each shoulder with the opposite hand. Anti-rotation on the move.", isBodyweight: true },
  { id: "stir-the-pot", name: "Stir the Pot", category: "Core", musclesWorked: ["Abs", "Obliques"], description: "Forearms on a stability ball in a plank, draw small circles. A plank that fights back.", isBodyweight: true },
  { id: "db-side-bend", name: "Dumbbell Side Bend", category: "Core", musclesWorked: ["Obliques"], description: "One dumbbell at your side, bend toward it and come back up. Direct oblique work." },
  { id: "landmine-rotation", name: "Landmine Rotation", category: "Core", musclesWorked: ["Obliques", "Core", "Shoulders"], description: "Arms long, swing a landmine bar in an arc from hip to hip. Rotational power, controlled." },
  { id: "rotary-torso-machine", name: "Rotary Torso Machine", category: "Core", musclesWorked: ["Obliques"], description: "Seated machine that twists the torso against a pad. Direct, loadable oblique work." },
  { id: "suitcase-carry", name: "Suitcase Carry", category: "Core", musclesWorked: ["Obliques", "Core", "Forearms"], description: "Walk with a heavy weight in one hand only. The core has to stop you tipping over." },
  { id: "turkish-get-up", name: "Turkish Get-Up", category: "Core", musclesWorked: ["Core", "Shoulders", "Glutes"], description: "Stand up from the floor and lie back down with a kettlebell held overhead. Slow, full-body control." },
  { id: "standing-cable-crunch", name: "Standing Cable Crunch", category: "Core", musclesWorked: ["Abs"], description: "Facing away from a high pulley, rope over the shoulders, crunch the ribs toward the hips. Loaded flexion without kneeling." },
  { id: "cable-side-bend", name: "Cable Side Bend", category: "Core", musclesWorked: ["Obliques"], description: "Side-on to a low cable, handle in the far hand, bend away and come back up. Oblique tension through the whole rep." },
  { id: "captains-chair-knee-raise", name: "Captain's Chair Knee Raise", category: "Core", musclesWorked: ["Abs", "Hip Flexors"], description: "Forearms on the pads of a vertical knee-raise station, back against the rest. Knee raises with no grip limit and no swing.", isBodyweight: true },
  { id: "barbell-rollout", name: "Barbell Rollout", category: "Core", musclesWorked: ["Abs", "Core", "Lats"], description: "Roll a loaded barbell out from the knees on round plates. The ab wheel with a bar you'll find in any gym.", isBodyweight: true },
  { id: "stability-ball-rollout", name: "Stability Ball Rollout", category: "Core", musclesWorked: ["Abs", "Core"], description: "Kneeling, forearms on a stability ball, roll it forward into a long plank. The easier way in to the ab wheel.", isBodyweight: true },
  { id: "stability-ball-crunch", name: "Stability Ball Crunch", category: "Core", musclesWorked: ["Abs"], description: "Lower back on a stability ball, curl the ribs up and let them stretch back over it. More range than a floor crunch.", isBodyweight: true },
  { id: "stability-ball-pike", name: "Stability Ball Pike", category: "Core", musclesWorked: ["Abs", "Shoulders", "Hip Flexors"], description: "Feet on a ball in a push-up position, lift the hips high and roll the ball in. Hard compression work.", isBodyweight: true },
  { id: "overhead-carry", name: "Overhead Carry", category: "Core", musclesWorked: ["Core", "Shoulders", "Traps"], description: "Walk with a dumbbell or kettlebell locked out overhead, one hand or two. The trunk has to stay stacked under it." },
  { id: "front-rack-carry", name: "Front Rack Carry", category: "Core", musclesWorked: ["Core", "Back", "Shoulders"], description: "Walk with kettlebells held in the rack at your shoulders. The load in front tries to fold you, and the abs refuse." },
  { id: "hanging-oblique-knee-raise", name: "Hanging Oblique Knee Raise", category: "Core", musclesWorked: ["Obliques", "Abs", "Hip Flexors"], description: "Hang from a bar and bring the knees up toward one elbow, then the other. Hanging work for the sides.", isBodyweight: true },
  { id: "heel-taps", name: "Heel Taps", category: "Core", musclesWorked: ["Obliques", "Abs"], description: "Shoulders just off the floor, knees bent, reach side to side to touch each heel. Simple oblique burner.", isBodyweight: true },
  { id: "toe-touch-crunch", name: "Toe Touch Crunch", category: "Core", musclesWorked: ["Abs"], description: "Legs straight up, reach the hands toward the toes. A crunch that keeps the legs out of the way.", isBodyweight: true },
  { id: "hollow-rock", name: "Hollow Rock", category: "Core", musclesWorked: ["Abs", "Core"], description: "Hold the hollow shape and rock back and forth on it. The hollow hold with movement added.", isBodyweight: true },
  { id: "oblique-crunch", name: "Oblique Crunch", category: "Core", musclesWorked: ["Obliques"], description: "Lying with the knees dropped to one side, crunch straight up. Puts the crunch on the side of the waist.", isBodyweight: true },
  { id: "seated-knee-tuck", name: "Seated Knee Tuck", category: "Core", musclesWorked: ["Abs", "Hip Flexors"], description: "Sitting on the end of a bench, lean back and pull the knees in to the chest. Easy to set up, easy to scale.", isBodyweight: true },
  { id: "roman-chair-side-bend", name: "45-Degree Side Bend", category: "Core", musclesWorked: ["Obliques", "Lower Back"], description: "Side-on in a 45° back-extension bench, lower sideways and lift back up. Obliques against your own bodyweight.", isBodyweight: true },
  { id: "med-ball-slam", name: "Medicine Ball Slam", category: "Core", musclesWorked: ["Core", "Lats", "Shoulders"], description: "Lift a slam ball overhead and throw it into the floor as hard as you can. Explosive trunk flexion." },
  { id: "med-ball-rotational-throw", name: "Medicine Ball Rotational Throw", category: "Core", musclesWorked: ["Obliques", "Core", "Shoulders"], description: "Side-on to a wall, turn from the hips and throw a medicine ball into it. Rotational power, both sides." },
  { id: "ghd-sit-up", name: "GHD Sit-Up", category: "Core", musclesWorked: ["Abs", "Hip Flexors"], description: "Sit-up on a glute-ham developer, lowering back past parallel. Huge range, and a big step up from the floor.", isBodyweight: true },
  { id: "body-saw", name: "Body Saw", category: "Core", musclesWorked: ["Abs", "Core", "Shoulders"], description: "Forearm plank with the feet on sliders, rock the body forward and back. The plank turned into an anti-extension rep.", isBodyweight: true },
  { id: "plank-up-down", name: "Plank Up-Down", category: "Core", musclesWorked: ["Core", "Shoulders", "Triceps"], description: "Walk from a forearm plank up to a high plank and back down, one arm at a time. Keeps the hips still while the arms move.", isBodyweight: true },
  { id: "side-plank-hip-dip", name: "Side Plank Hip Dip", category: "Core", musclesWorked: ["Obliques", "Core"], description: "From a side plank, lower the hip toward the floor and lift it back up. The side plank done for reps.", isBodyweight: true },

  // Cardio
  { id: "running", name: "Running", category: "Cardio", musclesWorked: ["Legs", "Core", "Cardio"], description: "Steady state or intervals. Track pace and distance." },
  { id: "treadmill", name: "Treadmill", category: "Cardio", musclesWorked: ["Legs", "Cardio"], description: "Indoor running or walking with adjustable speed and incline." },
  { id: "incline-walk", name: "Incline Walk", category: "Cardio", musclesWorked: ["Glutes", "Legs", "Cardio"], description: "Steep treadmill walk. Low-impact cardio with glute emphasis." },
  { id: "walking", name: "Walking", category: "Cardio", musclesWorked: ["Legs", "Cardio"], description: "Easy steady-state cardio and active recovery. Track steps or distance." },
  { id: "cycling", name: "Cycling", category: "Cardio", musclesWorked: ["Legs", "Cardio"], description: "Low impact cardio. Stationary or outdoor." },
  { id: "assault-bike", name: "Assault Bike", category: "Cardio", musclesWorked: ["Legs", "Core", "Cardio"], description: "Fan bike using arms and legs. Punishing conditioning intervals." },
  { id: "elliptical", name: "Elliptical", category: "Cardio", musclesWorked: ["Legs", "Cardio"], description: "Low-impact full-stride cardio. Easy on the joints." },
  { id: "rowing", name: "Rowing Machine", category: "Cardio", musclesWorked: ["Back", "Legs", "Cardio"], description: "Full body cardio. Drive with legs, pull with back." },
  { id: "ski-erg", name: "Ski Erg", category: "Cardio", musclesWorked: ["Back", "Core", "Cardio"], description: "Double-pole skiing machine. Upper-body and core conditioning." },
  { id: "stairmaster", name: "StairMaster", category: "Cardio", musclesWorked: ["Glutes", "Legs", "Cardio"], description: "Simulated stair climbing. Cardio with glute emphasis." },
  { id: "jump-rope", name: "Jump Rope", category: "Cardio", musclesWorked: ["Calves", "Cardio", "Shoulders"], description: "High intensity. Excellent for conditioning and coordination." },
  { id: "battle-ropes", name: "Battle Ropes", category: "Cardio", musclesWorked: ["Shoulders", "Core", "Cardio"], description: "Wave heavy ropes. Upper-body power endurance." },
  { id: "burpees", name: "Burpees", category: "Cardio", musclesWorked: ["Legs", "Core", "Cardio"], description: "Squat, plank, jump. Full-body conditioning staple.", isBodyweight: true },
  { id: "box-jump", name: "Box Jumps", category: "Cardio", musclesWorked: ["Quads", "Glutes", "Cardio"], description: "Explosive jump onto a box. Power and conditioning.", isBodyweight: true },
  { id: "sled-push", name: "Sled Push", category: "Cardio", musclesWorked: ["Quads", "Glutes", "Cardio"], description: "Drive a loaded sled. Brutal legs and conditioning with no eccentric." },
  { id: "sled-drag", name: "Sled Drag", category: "Cardio", musclesWorked: ["Quads", "Glutes", "Cardio"], description: "Walk a sled backward or forward on a strap. Conditioning that's easy on the knees." },
  { id: "recumbent-bike", name: "Recumbent Bike", category: "Cardio", musclesWorked: ["Legs", "Cardio"], description: "Seated bike with a backrest. Low-impact cardio with the lower back supported." },
  { id: "arm-bike", name: "Arm Bike", category: "Cardio", musclesWorked: ["Shoulders", "Arms", "Cardio"], description: "Hand-cranked ergometer. Upper-body cardio when the legs need a day off." },
  { id: "swimming", name: "Swimming", category: "Cardio", musclesWorked: ["Back", "Shoulders", "Cardio"], description: "Laps in the pool. Full-body cardio with no impact." },
  { id: "hiking", name: "Hiking", category: "Cardio", musclesWorked: ["Legs", "Glutes", "Cardio"], description: "Walking on trails and hills. Long, steady cardio with plenty of climbing." },
  { id: "boxing", name: "Boxing", category: "Cardio", musclesWorked: ["Shoulders", "Core", "Cardio"], description: "Bag work, pads or shadowboxing in rounds. Conditioning with a skill attached." },
  { id: "mountain-climber", name: "Mountain Climbers", category: "Cardio", musclesWorked: ["Core", "Hip Flexors", "Cardio"], description: "From a high plank, drive the knees toward the chest in turn. Fast core and conditioning.", isBodyweight: true },
  { id: "jumping-jacks", name: "Jumping Jacks", category: "Cardio", musclesWorked: ["Legs", "Shoulders", "Cardio"], description: "Jump the feet out and the arms up, then back. The classic warm-up.", isBodyweight: true },
  { id: "high-knees", name: "High Knees", category: "Cardio", musclesWorked: ["Legs", "Hip Flexors", "Cardio"], description: "Run in place driving the knees to hip height. Quick, hard conditioning.", isBodyweight: true },
  { id: "bear-crawl", name: "Bear Crawl", category: "Cardio", musclesWorked: ["Shoulders", "Core", "Cardio"], description: "Crawl on hands and feet with the knees just off the floor. Shoulders, core and lungs.", isBodyweight: true },
  { id: "vertical-climber", name: "Vertical Climber", category: "Cardio", musclesWorked: ["Legs", "Shoulders", "Cardio"], description: "Upright climbing machine with hand and foot pedals moving in opposition. Brutal, low-impact full-body cardio." },
  { id: "ladder-climber", name: "Ladder Climber", category: "Cardio", musclesWorked: ["Legs", "Shoulders", "Cardio"], description: "Angled machine with an endless ladder that moves as you climb it. Hands and feet together, set by your own pace." },
  { id: "curved-treadmill", name: "Curved Treadmill", category: "Cardio", musclesWorked: ["Legs", "Glutes", "Cardio"], description: "Motorless treadmill with a curved deck. Your stride sets the speed, so it runs as hard as you push." },
  { id: "rucking", name: "Rucking", category: "Cardio", musclesWorked: ["Legs", "Traps", "Cardio"], description: "Walking with a weighted backpack or vest. Steady cardio that loads the legs and upper back." },
  { id: "shuttle-run", name: "Shuttle Runs", category: "Cardio", musclesWorked: ["Legs", "Glutes", "Cardio"], description: "Sprint to a line, touch it, turn and sprint back. Speed, turning and conditioning in one drill.", isBodyweight: true },
  { id: "kickboxing", name: "Kickboxing", category: "Cardio", musclesWorked: ["Legs", "Shoulders", "Core", "Cardio"], description: "Punches and kicks on a bag, pads or in a class, in rounds. Boxing with the legs brought in." },
  { id: "basketball", name: "Basketball", category: "Cardio", musclesWorked: ["Legs", "Calves", "Cardio"], description: "Pickup games or full court. Sprinting, jumping and cutting that adds up fast." },
  { id: "soccer", name: "Soccer", category: "Cardio", musclesWorked: ["Legs", "Hip Flexors", "Cardio"], description: "Matches or kickabouts. Long stretches of running broken up by sprints." },
  { id: "tennis", name: "Tennis", category: "Cardio", musclesWorked: ["Legs", "Shoulders", "Cardio"], description: "Singles or doubles. Short bursts of movement, stops and swings, over a long session." },
  { id: "pickleball", name: "Pickleball", category: "Cardio", musclesWorked: ["Legs", "Shoulders", "Cardio"], description: "Paddle game on a small court. Quick footwork and plenty of short rallies." },
  { id: "rock-climbing", name: "Rock Climbing", category: "Cardio", musclesWorked: ["Forearms", "Lats", "Cardio"], description: "Bouldering or roped climbing, indoors or out. Grip, pulling and problem solving under fatigue." },
  { id: "yoga", name: "Yoga", category: "Cardio", musclesWorked: ["Full Body"], description: "A class or your own flow. Mobility, balance and holds, logged by time." },
  { id: "pilates", name: "Pilates", category: "Cardio", musclesWorked: ["Core", "Glutes"], description: "Mat or reformer session. Slow, controlled trunk and hip work, logged by time." },
  { id: "skater-jumps", name: "Skater Jumps", category: "Cardio", musclesWorked: ["Glutes", "Quads", "Cardio"], description: "Leap side to side from one foot to the other like a speed skater. Lateral power and conditioning.", isBodyweight: true },
  { id: "plank-jacks", name: "Plank Jacks", category: "Cardio", musclesWorked: ["Core", "Shoulders", "Cardio"], description: "Jumping jacks with the feet from a high plank. The heart rate climbs while the trunk holds still.", isBodyweight: true },
  { id: "agility-ladder", name: "Agility Ladder Drills", category: "Cardio", musclesWorked: ["Legs", "Calves", "Cardio"], description: "Quick-foot patterns through a ladder laid on the floor. Footwork, rhythm and a warm-up that works.", isBodyweight: true },
  { id: "tire-flip", name: "Tire Flip", category: "Cardio", musclesWorked: ["Full Body", "Cardio"], description: "Drive a heavy tire up off the floor and push it over, then go again. Strongman conditioning." },
  { id: "bjj", name: "Brazilian Jiu-Jitsu", category: "Cardio", musclesWorked: ["Full Body", "Cardio"], description: "Drilling and rolling on the mats. Grappling rounds that leave nothing in the tank." },
];

export const MUSCLE_GROUPS = [
  "All", "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms", "Neck", "Legs", "Glutes", "Core", "Cardio"
] as const;

// Built-in holds that are logged for time rather than weight × reps. Kept as an
// id set (instead of editing every entry) because workouts embed copies of the
// exercise object — old logs won't carry a flag, but their ids still match.
const TIMED_EXERCISE_IDS = new Set([
  "dead-hang", "plank", "side-plank", "hollow-hold", "farmers-carry", "plate-pinch",
  "towel-hang", "barbell-hold", "neck-isometric-hold", "wall-sit", "copenhagen-plank",
  "l-sit", "front-lever-hold", "suitcase-carry",
  // Core carries: walked for time, like the suitcase carry.
  "overhead-carry", "front-rack-carry",
  // Upper-body holds (Shoulders, Forearms).
  "handstand-hold", "one-arm-dead-hang",
  // Leg holds: logged by the clock, like the wall sit.
  "single-leg-wall-sit", "adductor-squeeze",
]);

/** Timed exercises log a start/stop stopwatch per set: all cardio, the hold
 *  built-ins above, and custom exercises created with the Timed option. An
 *  explicit isTimed on the exercise (set when created/edited) wins over both. */
export function isTimedExercise(exercise: Exercise): boolean {
  if (exercise.isTimed != null) return exercise.isTimed;
  return exercise.category === "Cardio" || TIMED_EXERCISE_IDS.has(exercise.id);
}

// Derived from the library rather than hand-listed: tagging an entry above is
// all a new bodyweight exercise needs. Same reason as the timed set — workouts
// embed copies of the exercise object, so older logs carry no flag, but ids match.
const BODYWEIGHT_EXERCISE_IDS = new Set(
  EXERCISES.filter((e) => e.isBodyweight).map((e) => e.id)
);

/** Bodyweight exercises take the lifter's own weight as the load, so their
 *  weight field means *added* load — a plate on a dip belt, or a negative for
 *  the assisted machine. An explicit isBodyweight wins over the id list. */
export function isBodyweightExercise(exercise: Exercise): boolean {
  if (exercise.isBodyweight != null) return exercise.isBodyweight;
  return BODYWEIGHT_EXERCISE_IDS.has(exercise.id);
}

/**
 * Split on anything that isn't a letter or digit, so a hyphen and a space are
 * the same thing: "Pull-Up" and "Pull Up" both give ["pull", "up"].
 */
function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Shared by the Exercises tab and the add-exercise picker so the two can't
 * drift apart.
 *
 * The text term matches the **name only**. It used to match musclesWorked too,
 * which meant typing "shoulder" buried Shoulder Press under every bench and dip
 * variation that happens to list shoulders as a secondary — searching by muscle
 * is what the category chips are for.
 *
 * Every word typed has to match a word of the name, in one of two directions:
 *
 *   a name word contains it     "cline" finds Incline, "down" finds Pulldown
 *   it starts with a name word  "pullups" finds Pull-Up, "dips" finds Dip
 *
 * The second direction is the new one, and it's what makes punctuation and
 * plurals stop mattering: "Pull ups" used to find nothing, because the library
 * spells it "Pull-Up" and one substring test over the whole name can't see past
 * either the hyphen or the s. Word order doesn't matter, so "press bench" finds
 * Bench Press.
 *
 * Comparing word against word — rather than gluing the name into one string and
 * searching that — is what keeps this from getting loose. Squashed, "abs" finds
 * Cable Row through the seam between "cable" and "row", and an exercise you
 * have to notice is wrong costs more than one you have to search for again. For
 * the same reason there's no edit-distance matching: a dropped letter already
 * survives ("pul" sits inside "pull"), and going further would rescue "benhc
 * press" at the price of offering Dip when you typed Hip.
 *
 * A one-letter name word only matches the first way, or the "T" in T-Bar Row
 * would answer to every search beginning with a t.
 */
export function filterExercises(
  exercises: Exercise[],
  search: string,
  category: string
): Exercise[] {
  const terms = words(search);
  return exercises.filter((e) => {
    if (category !== "All" && e.category !== category) return false;
    if (terms.length === 0) return true;
    const nameWords = words(e.name);
    // The name read from each word to the end, with the gaps closed up:
    // "4-Way Neck Extension" gives "4wayneckextension", "wayneckextension"…
    // Lets words typed run together find a name that separates them — "4way"
    // for the machine labelled 4-Way, whose "4" is too short for the prefix
    // rule below. Anchored to the start of a word, so it can't reach through
    // one word into the next the way a squashed whole name would ("abs" in
    // "cABle rOW"), and a one-letter word only matches a term that starts with
    // the whole run after it.
    const runs = nameWords.map((_, i) => nameWords.slice(i).join(""));
    return terms.every(
      (term) =>
        nameWords.some(
          (word) => word.includes(term) || (word.length >= 2 && term.startsWith(word))
        ) || runs.some((run) => run.startsWith(term))
    );
  });
}

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
