import { EXERCISES } from "./exercises";

/**
 * How to actually perform each built-in exercise.
 *
 * Kept here, keyed by exercise id, rather than as fields on `Exercise` — and
 * that is not a filing preference. `WorkoutExercise` embeds the whole Exercise
 * object, and every workout is stored with its exercises inside it, so putting
 * this on the type would copy the same few hundred words of static text into
 * every workout document forever. It would also freeze each workout's copy at
 * whatever the wording was the day it was logged. Looked up at render time, one
 * edit here improves every screen at once and the database never sees it.
 *
 * Only the bundled exercises have an entry. Custom ones a user creates have
 * their own description and no guide, which the screen handles by showing
 * nothing rather than an empty heading.
 *
 * The wording is conventional gym-floor coaching, not medical advice — cues
 * most lifters would recognise, and the mistakes worth naming because they are
 * the ones people actually make. Nothing here is a substitute for a coach's
 * eyes on you, and anything that hurts is a reason to stop rather than to read
 * harder.
 */
/**
 * A mistake and what to do about it.
 *
 * Two fields rather than one sentence, because one sentence kept turning into
 * half of one. "Getting into position with the bells already overhead" names
 * something without saying what is wrong with it or what to do instead, and a
 * reader who did not already know the answer learned nothing. The shape is what
 * stops that: there is nowhere to put the mistake without also putting the fix.
 */
export interface FormFault {
  /** What people actually do. */
  mistake: string;
  /** Why it matters, or what to do instead. */
  fix: string;
}

export interface FormGuide {
  /** Getting into position before the first rep. */
  setup: string[];
  /** The rep itself. */
  execution: string[];
  /** The mistakes that actually happen, and what to do about each. */
  watchFor: FormFault[];
}

export const FORM_GUIDES: Record<string, FormGuide> = {
  "bench-press": {
    setup: [
      "Eyes under the bar, feet flat and driving into the floor.",
      "Pull the shoulder blades down and together, and keep them pinned there.",
      "Grip just outside shoulder width, wrists stacked over the elbows.",
    ],
    execution: [
      "Unrack to over the shoulders, then lower to mid-chest under control.",
      "Keep the elbows tucked to roughly 45° from the torso.",
      "Touch the chest without bouncing, then press back over the shoulders.",
    ],
    watchFor: [
      {
        mistake: "Hips lifting off the bench to grind a rep out.",
        fix: "Drop the weight. A rep you can only finish by arching is not a rep at that weight, and it puts the load on your lower back.",
      },
      {
        mistake: "Elbows flaring straight out to the sides, which hands the shoulder the load.",
        fix: "Think about tucking them to about 45 degrees from your ribs — closer to your sides than straight out.",
      },
    ],
  },
  "incline-bench": {
    setup: [
      "Set the bench to 30–45°. Steeper turns it into a shoulder press.",
      "Same setup as flat: shoulder blades retracted, feet planted.",
    ],
    execution: [
      "Lower to the upper chest, just below the collarbone.",
      "Press up and slightly back, finishing over the shoulders.",
    ],
    watchFor: [
      {
        mistake: "Chasing a steeper incline and losing the upper chest to the front delt.",
        fix: "Stay between 30 and 45 degrees. Past that your shoulders take over and it stops being a chest exercise.",
      },
      {
        mistake: "Bar drifting down toward the sternum as the set gets hard.",
        fix: "Aim for just below the collarbone every rep. If you can't, the set is over.",
      },
    ],
  },
  "decline-bench": {
    setup: [
      "Set a 15–30° decline and hook the legs securely.",
      "Retract the shoulder blades as you would on flat bench.",
    ],
    execution: [
      "Lower to the lower chest, elbows tucked.",
      "Press back up in a straight line over the shoulders.",
    ],
    watchFor: [
      {
        mistake: "Sitting up to unrack — have a spotter hand it off if you can.",
        fix: "Getting a heavy bar out of the rack from a decline is awkward and easy to lose. Ask for a hand-off.",
      },
      {
        mistake: "Head rush on the way up if you have been decline for a long set.",
        fix: "Sit up slowly between sets. Being upside down under load pools blood in your head.",
      },
    ],
  },
  "db-bench-press": {
    setup: [
      "Sit with the bells on your thighs, then kick them back as you lie down.",
      "Shoulder blades retracted, wrists neutral and stacked.",
    ],
    execution: [
      "Lower until the bells are level with the chest and you feel a stretch.",
      "Press up and slightly together without clashing them at the top.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbows drop far below the bench line.",
        fix: "Stop when your upper arms are level with your torso. Deeper stretches the front of the shoulder more than it works the chest.",
      },
      {
        mistake: "Dropping the bells at the end of a set instead of sitting up with them.",
        fix: "Bring them to your chest, then sit up with them — that is how you protect your shoulders and the gym floor.",
      },
    ],
  },
  "incline-db-press": {
    setup: [
      "Bench at 30–45°, bells kicked into position on the thighs.",
      "Keep the shoulder blades set against the pad.",
    ],
    execution: [
      "Lower to the upper chest with the elbows around 45°.",
      "Press up over the shoulders, stopping short of clashing the bells.",
    ],
    watchFor: [
      {
        mistake: "Shrugging the shoulders up toward the ears as you press.",
        fix: "Keep your shoulder blades pinned down against the bench so the chest presses, not the traps.",
      },
      {
        mistake: "Arching hard off the bench to turn it back into a flat press.",
        fix: "If you are arching to move the weight, the incline is too heavy. Go lighter and keep your back on the pad.",
      },
    ],
  },
  "decline-db-press": {
    setup: [
      "Set a modest decline and lock the legs in before taking the bells.",
      "Shoulder blades retracted against the pad.",
    ],
    execution: [
      "Lower to the lower chest, elbows tucked.",
      "Press back up over the shoulders.",
    ],
    watchFor: [
      {
        mistake: "Getting into position with the bells already overhead.",
        fix: "Rest them on your thighs and kick them up as you lie back. On a decline you cannot recover a bell that gets away from you overhead.",
      },
      {
        mistake: "Letting the bells wander apart at the bottom.",
        fix: "Keep them stacked over your elbows. Drifting wide turns a press into a fly your shoulders did not sign up for.",
      },
    ],
  },
  "machine-chest-press": {
    setup: [
      "Set the seat so the handles sit level with mid-chest.",
      "Back flat on the pad, feet planted.",
    ],
    execution: [
      "Press out until the elbows are almost straight.",
      "Return under control until you feel the chest stretch.",
    ],
    watchFor: [
      {
        mistake: "Seat too high, which turns it into an incline press for the shoulders.",
        fix: "The handles should line up with the middle of your chest before you start.",
      },
      {
        mistake: "Letting the weight stack touch down between reps.",
        fix: "Stop just short. Resting the stack drops the tension and gives you a break you did not earn.",
      },
    ],
  },
  "incline-machine-press": {
    setup: [
      "Seat set so the handles line up with the upper chest.",
      "Shoulders back against the pad.",
    ],
    execution: [
      "Press up and slightly in, stopping just short of lockout.",
      "Lower until you feel the stretch, not until the stack lands.",
    ],
    watchFor: [
      {
        mistake: "Pushing the head forward off the pad to finish a rep.",
        fix: "Keep your head back. If the rep needs your neck, it needs less weight.",
      },
    ],
  },
  "smith-bench-press": {
    setup: [
      "Set the bench so the bar path lands on mid-chest.",
      "Shoulder blades retracted; the fixed path will not correct you.",
    ],
    execution: [
      "Unhook, lower to the chest, press back up.",
      "Twist to re-hook only once the rep is finished.",
    ],
    watchFor: [
      {
        mistake: "Bench positioned so the fixed bar meets the throat or the belly.",
        fix: "Move the bench until the bar lands on your mid-chest, then set up. The rails will not correct a bad position.",
      },
      {
        mistake: "Relying on the rails and letting the setup get sloppy.",
        fix: "Set your shoulder blades and feet exactly as you would with a free bar.",
      },
    ],
  },
  "smith-incline-press": {
    setup: [
      "Bench at 30–45° under the bar, positioned so the path meets the upper chest.",
      "Shoulder blades set before you unhook.",
    ],
    execution: [
      "Lower to the upper chest, press back up, re-hook at the end of the set.",
    ],
    watchFor: [
      {
        mistake: "Bench drifting out of position between sets.",
        fix: "Check it each time. A few inches changes where the fixed bar meets your chest.",
      },
    ],
  },
  "pec-deck": {
    setup: [
      "Seat height so the handles sit at chest level.",
      "Back flat, a slight bend held in the elbows throughout.",
    ],
    execution: [
      "Bring the handles together in front of the chest, squeezing at the end.",
      "Open back up until you feel the stretch, not until the stack lands.",
    ],
    watchFor: [
      {
        mistake: "Turning it into a press by bending and straightening the elbows.",
        fix: "Fix a slight bend and keep it there. The movement happens at the shoulder, not the elbow.",
      },
      {
        mistake: "Going so deep at the back that the shoulder takes the stretch.",
        fix: "Stop when you feel your chest stretch, not when the machine runs out of travel.",
      },
    ],
  },
  "dumbbell-fly": {
    setup: [
      "Lie flat, bells pressed over the chest, elbows softly bent.",
      "That elbow angle stays fixed for the whole set.",
    ],
    execution: [
      "Open the arms wide until you feel a stretch across the chest.",
      "Bring them back together over the chest along the same arc.",
    ],
    watchFor: [
      {
        mistake: "Going far heavier than the movement allows and pressing instead.",
        fix: "Flyes are a stretch exercise. If you have to press it up, halve the weight.",
      },
      {
        mistake: "Dropping so deep the shoulders take the strain.",
        fix: "Stop at chest level. Below that the stretch is on the front of your shoulder, not the chest.",
      },
    ],
  },
  "incline-db-fly": {
    setup: [
      "Bench at 30–45°, bells pressed out, elbows softly bent.",
      "Shoulder blades set against the pad.",
    ],
    execution: [
      "Open wide to a stretch, then arc back together over the upper chest.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbow angle open and close — that makes it a press.",
        fix: "Set the bend at the start and hold it the whole set.",
      },
    ],
  },
  "cable-crossover": {
    setup: [
      "Pulleys set high, one step forward into a split stance.",
      "Soft bend in the elbows, chest up.",
    ],
    execution: [
      "Draw the handles down and together in front of you.",
      "Let them travel back out until you feel the stretch.",
    ],
    watchFor: [
      {
        mistake: "Leaning so far forward the lower back does the work.",
        fix: "Hinge a little and stay there. If your back is fatiguing before your chest, you have leaned too far.",
      },
      {
        mistake: "Snapping the elbows straight at the bottom.",
        fix: "Keep a soft bend throughout. Locking out under a cable puts the whole load on the joint.",
      },
    ],
  },
  "low-cable-fly": {
    setup: [
      "Pulleys at the bottom, split stance, palms facing forward.",
      "Slight bend in the elbows, chest tall.",
    ],
    execution: [
      "Sweep the handles up and together toward chin height.",
      "Lower along the same arc under control.",
    ],
    watchFor: [
      {
        mistake: "Shrugging the shoulders to finish the rep.",
        fix: "Stop the rep where your chest stops working. Shrugging just adds trap to a chest exercise.",
      },
    ],
  },
  "high-cable-fly": {
    setup: [
      "Pulleys set high, split stance, soft elbows.",
      "Hinge forward slightly from the hips.",
    ],
    execution: [
      "Bring the handles down and together toward the waist.",
      "Return along the same path to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Turning it into a pushdown by driving with the triceps.",
        fix: "Lead with the upper arms and keep the elbow angle fixed.",
      },
    ],
  },
  "incline-cable-fly": {
    setup: [
      "Incline bench between two low pulleys, bench at 30–45°.",
      "Soft elbows, shoulder blades set.",
    ],
    execution: [
      "Arc the handles up and together over the upper chest.",
      "Open back out to a stretch under control.",
    ],
    watchFor: [
      {
        mistake: "Bench positioned so the cables drag on the frame.",
        fix: "Move the bench out until the cables run clear through the whole arc.",
      },
    ],
  },
  "push-up": {
    setup: [
      "Hands a little wider than the shoulders, under the chest.",
      "Body in one line from head to heels, glutes and abs braced.",
    ],
    execution: [
      "Lower until the chest is just off the floor, elbows around 45°.",
      "Press back up and finish with the shoulder blades spread.",
    ],
    watchFor: [
      {
        mistake: "Hips sagging or piking up to shorten the rep.",
        fix: "Squeeze your glutes and abs so you move as one piece. If you cannot hold the line, do them on your knees.",
      },
      {
        mistake: "Head reaching for the floor ahead of the chest.",
        fix: "Your chest should touch first. Leading with your head hides half the range.",
      },
    ],
  },
  "dips-chest": {
    setup: [
      "Grip parallel bars, arms locked, shoulders down away from the ears.",
      "Lean the torso forward and cross the ankles behind you.",
    ],
    execution: [
      "Lower until the upper arms are about parallel to the floor.",
      "Press back up, keeping the forward lean throughout.",
    ],
    watchFor: [
      {
        mistake: "Dropping below a comfortable shoulder stretch.",
        fix: "Stop where it stops feeling like a stretch and starts feeling like a pinch. That depth is yours and it will improve.",
      },
      {
        mistake: "Losing the forward lean, which turns it into a triceps dip.",
        fix: "Stay leaned over the whole set. Upright is a different exercise.",
      },
    ],
  },
  "weighted-dips-chest": {
    setup: [
      "Load a dip belt before you get on the bars.",
      "Same forward lean as bodyweight chest dips.",
    ],
    execution: [
      "Lower under control to upper arms parallel, then press back up.",
    ],
    watchFor: [
      {
        mistake: "Adding weight before the bodyweight version is comfortable and controlled.",
        fix: "Get to about ten clean bodyweight dips first. The belt multiplies whatever your form already is.",
      },
    ],
  },
  "landmine-press": {
    setup: [
      "One end of a barbell in a landmine or a corner, other end at the shoulder.",
      "Stagger the stance, brace the midsection.",
    ],
    execution: [
      "Press up and forward along the bar's arc until the arm is straight.",
      "Return to the shoulder under control.",
    ],
    watchFor: [
      {
        mistake: "Twisting the torso to help the press.",
        fix: "Square your hips and shoulders to the bar and let the arm do the work.",
      },
    ],
  },
  "svend-press": {
    setup: [
      "Press two plates together flat against the chest.",
      "Elbows up, chest tall.",
    ],
    execution: [
      "Squeeze the plates hard and press straight out until the arms lock.",
      "Draw them back to the chest keeping the squeeze on.",
    ],
    watchFor: [
      {
        mistake: "Letting the squeeze go mid-rep, which is the entire exercise.",
        fix: "Press the plates together hard the whole time. The load is the squeeze, not the weight.",
      },
    ],
  },
  "iso-lateral-chest-press": {
    setup: [
      "Set the seat so the handles sit level with mid-chest.",
      "Load both sides evenly and check the plates before you sit down.",
      "Back flat on the pad, shoulder blades set, feet planted.",
    ],
    execution: [
      "Press both handles out together until the elbows are almost straight.",
      "Return slowly until you feel the chest stretch, then press again.",
      "Work one arm at a time if you want to find the weaker side.",
    ],
    watchFor: [
      {
        mistake: "One arm finishing its rep ahead of the other.",
        fix: "Press both handles at the same speed. The independent arms are there to expose a weak side, not to let the strong one carry it.",
      },
      {
        mistake: "Shoulders rolling forward off the pad at lockout.",
        fix: "Keep your shoulder blades pinned back against the pad and stop just short of straight arms.",
      },
    ],
  },
  "iso-lateral-incline-press": {
    setup: [
      "Seat set so the handles start level with the upper chest.",
      "Load both sides evenly, then sit with your back flat on the pad.",
    ],
    execution: [
      "Press up and slightly in, stopping just short of lockout.",
      "Lower under control until the upper chest stretches.",
    ],
    watchFor: [
      {
        mistake: "Seat so low that the handles start above the shoulders.",
        fix: "Raise the seat until the handles line up with your upper chest, or the front delts do the work.",
      },
      {
        mistake: "Arching off the pad to push the last reps up.",
        fix: "Keep your lower back on the pad. If you need the arch, take a plate off each side.",
      },
    ],
  },
  "floor-press": {
    setup: [
      "Lie under a bar set low in a rack, eyes under the bar.",
      "Knees bent with feet flat, or legs straight if that keeps you steadier.",
      "Shoulder blades pulled together, grip just outside shoulder width.",
    ],
    execution: [
      "Lower until the upper arms rest on the floor, and pause there.",
      "Press back up over the shoulders without bouncing the elbows.",
    ],
    watchFor: [
      {
        mistake: "Slamming the elbows into the floor on the way down.",
        fix: "Lower under control and let your upper arms settle onto the floor. The pause is the point of the lift.",
      },
      {
        mistake: "Setting up without safeties because the floor feels safe.",
        fix: "Set the safety pins just above your chest. Pinned on the floor under a bar is no better than on a bench.",
      },
    ],
  },
  "cable-chest-press": {
    setup: [
      "Set both pulleys at chest height and take a handle in each hand.",
      "Step forward into a split stance so the stack lifts off.",
      "Brace the midsection and keep the chest tall.",
    ],
    execution: [
      "Press the handles forward and slightly together until the arms are nearly straight.",
      "Let the elbows come back until the chest stretches, then press again.",
    ],
    watchFor: [
      {
        mistake: "Leaning into the press so bodyweight moves the handles.",
        fix: "Stay tall and move only your arms. If you have to lean, step further forward or lighten the stack.",
      },
      {
        mistake: "Letting the cables pull the arms back past the shoulders.",
        fix: "Stop when your elbows line up with your torso and keep control of the handles the whole way back.",
      },
    ],
  },
  "db-pullover": {
    setup: [
      "Lie across or along a bench, holding one dumbbell over the chest with both hands.",
      "Cup the top plate of the bell with the palms, thumbs wrapped around the handle.",
      "Keep a soft bend in the elbows and hold it there.",
    ],
    execution: [
      "Lower the bell back behind the head in an arc until you feel the stretch.",
      "Pull it back over the chest along the same arc.",
    ],
    watchFor: [
      {
        mistake: "Bending and straightening the elbows so it becomes a triceps extension.",
        fix: "Lock in a slight bend and keep it. The movement comes from your shoulders, not your elbows.",
      },
      {
        mistake: "Lowering further than the shoulders are ready for.",
        fix: "Stop at a comfortable stretch, usually when your arms line up with your torso, and build range over time.",
      },
    ],
  },
  "squeeze-press": {
    setup: [
      "Lie on a flat bench with a dumbbell in each hand, palms facing each other.",
      "Press the bells together over the chest so they touch along their length.",
    ],
    execution: [
      "Keep crushing the bells together as you lower them to the chest.",
      "Press back up, still squeezing, and pause at the top.",
    ],
    watchFor: [
      {
        mistake: "Letting the bells drift apart as the set gets hard.",
        fix: "Crush them together the whole rep. The squeeze is what makes this a chest exercise and not a light close-grip press.",
      },
      {
        mistake: "Using bells so heavy that the elbows flare to move them.",
        fix: "Go lighter than your normal press and keep your elbows close to your sides.",
      },
    ],
  },
  "incline-push-up": {
    setup: [
      "Hands on a bench, box or bar, slightly wider than the shoulders.",
      "Walk the feet back until the body is one straight line.",
    ],
    execution: [
      "Lower the chest to the edge, elbows about 45° from the torso.",
      "Press back up, keeping the hips in line.",
      "Lower the surface over the weeks as you get stronger.",
    ],
    watchFor: [
      {
        mistake: "Hips sagging toward the floor.",
        fix: "Squeeze your glutes and brace your abs so your body moves as one plank.",
      },
      {
        mistake: "Stopping halfway down.",
        fix: "Touch your chest to the edge every rep. A higher surface with full range beats a lower one with half.",
      },
    ],
  },
  "decline-push-up": {
    setup: [
      "Feet on a bench or box behind you, hands on the floor at shoulder width.",
      "Body in one line from head to heels.",
    ],
    execution: [
      "Lower the chest toward the floor with the elbows tucked to about 45°.",
      "Press back up without letting the hips pike or sag.",
    ],
    watchFor: [
      {
        mistake: "Piking the hips up so it turns into a shoulder press.",
        fix: "Keep a straight line from your shoulders to your heels. If you cannot, use a lower box.",
      },
      {
        mistake: "Letting the head drop toward the floor first.",
        fix: "Keep your neck in line and lead with your chest, not your face.",
      },
    ],
  },
  "archer-push-up": {
    setup: [
      "Hands set much wider than a normal push-up, fingers turned slightly out.",
      "Body in one straight line, feet a little wider for balance.",
    ],
    execution: [
      "Shift down toward one hand, bending that arm while the other straightens out to the side.",
      "Press back up to the middle and alternate sides.",
    ],
    watchFor: [
      {
        mistake: "Bending both arms equally so it is just a wide push-up.",
        fix: "Keep the straight arm straight and let the bent arm take most of your weight.",
      },
      {
        mistake: "Twisting the hips toward the working side.",
        fix: "Keep your hips square to the floor. If they twist, the range is too deep for now.",
      },
    ],
  },
  "clap-push-up": {
    setup: [
      "Normal push-up position, hands just outside the shoulders.",
      "Warm up with regular push-ups first.",
    ],
    execution: [
      "Lower under control, then press hard enough for the hands to leave the floor.",
      "Clap quickly and land with soft, bent elbows.",
      "Reset between reps if you need to.",
    ],
    watchFor: [
      {
        mistake: "Landing on locked arms.",
        fix: "Catch yourself with your elbows bent and absorb the landing, the same way you would land a jump.",
      },
      {
        mistake: "Grinding out reps when the height has gone.",
        fix: "Stop the set when you no longer leave the floor cleanly. This is power work, so every rep should be fast.",
      },
    ],
  },
  "ring-dip": {
    setup: [
      "Rings at a height where your feet clear the floor at the bottom.",
      "Jump to straight arms with the rings pressed into your sides.",
      "Turn the palms slightly out at the top to lock the support.",
    ],
    execution: [
      "Lower until the shoulders dip just below the elbows, keeping the rings close to the body.",
      "Press back up to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Rings drifting wide away from the body.",
        fix: "Keep the rings pulled into your sides the whole rep. If they drift, go back to bar dips until the support is solid.",
      },
      {
        mistake: "Dropping deep before you can hold the top position still.",
        fix: "Build steady support holds on the rings first, then add range a little at a time.",
      },
    ],
  },
  "decline-machine-press": {
    setup: [
      "Set the seat so the handles line up with the lower part of your chest.",
      "Sit with the back flat on the pad and the shoulder blades pulled down and together.",
    ],
    execution: [
      "Press the handles forward and down until the arms are nearly straight.",
      "Let them come back until the chest stretches, then press again.",
    ],
    watchFor: [
      {
        mistake: "Seat set too high, so the press drifts up toward the shoulders.",
        fix: "Lower the seat until the handles start level with your lower chest. The downward angle is what makes it a decline press.",
      },
      {
        mistake: "Shoulders rolling forward off the pad at lockout.",
        fix: "Keep your shoulder blades pinned to the pad and stop just short of locking out. Reaching further only shifts the work to the front delts.",
      },
    ],
  },
  "iso-lateral-decline-press": {
    setup: [
      "Load both sides evenly and set the seat so the handles sit at lower-chest height.",
      "Plant the feet, set the shoulder blades back, and grip the handles.",
    ],
    execution: [
      "Press both handles out along the machine's downward path.",
      "Lower under control until you feel the stretch, then press again.",
      "Work one arm at a time if one side keeps finishing first.",
    ],
    watchFor: [
      {
        mistake: "One arm locking out well before the other.",
        fix: "Move the handles together and let the weaker side set the pace. That imbalance is the reason to use an independent-arm machine.",
      },
      {
        mistake: "Bouncing the handles off the bottom stop.",
        fix: "Stop just before the plates touch down and press from a controlled stretch, so the chest takes the load rather than the machine.",
      },
    ],
  },
  "iso-lateral-wide-chest-press": {
    setup: [
      "Load both sides evenly and set the seat so the handles line up with mid-chest.",
      "Grip the handles wide, shoulder blades pulled back into the pad.",
    ],
    execution: [
      "Press the handles forward as they travel in toward each other.",
      "Bring them back slowly until the chest is fully stretched.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbows flare up level with the shoulders.",
        fix: "Keep your elbows a little below shoulder height. The wide handles already stretch the chest, and higher elbows just load the front of the shoulder.",
      },
      {
        mistake: "Shortening the range to move more plates.",
        fix: "Take every rep back to a full stretch. The deep range is what this machine offers over the standard press.",
      },
    ],
  },
  "smith-decline-press": {
    setup: [
      "Set a decline bench under the Smith bar so it lines up with your lower chest.",
      "Hook the legs in, grip just outside shoulder width, and set the shoulder blades.",
    ],
    execution: [
      "Twist the bar off the hooks and lower it to the lower chest.",
      "Press back up without locking out hard at the top.",
    ],
    watchFor: [
      {
        mistake: "Bench set so the bar lands on the neck or upper chest.",
        fix: "Lower the bar empty before you load it and move the bench until it touches your lower chest. The Smith bar can't follow you if you're in the wrong place.",
      },
      {
        mistake: "Forgetting to set the safety stops.",
        fix: "Set the stops just below your chest before the first set. On a decline you can't easily sit up out from under a stuck bar.",
      },
    ],
  },
  "flat-cable-fly": {
    setup: [
      "Place a flat bench between two cables set at the lowest position.",
      "Lie back with a handle in each hand, arms above the chest with a slight bend.",
    ],
    execution: [
      "Open the arms out wide in an arc until the chest stretches.",
      "Bring the handles back together over the chest and squeeze.",
    ],
    watchFor: [
      {
        mistake: "Bending the elbows more as the handles come down, turning it into a press.",
        fix: "Lock the elbows at a slight bend and keep that angle. The arc should come from your shoulders.",
      },
      {
        mistake: "Bench too far forward or back, so the cables pull toward the head or feet.",
        fix: "Line your chest up with the pulleys so the cables pull straight out to the sides, not at an angle along your body.",
      },
    ],
  },
  "single-arm-cable-fly": {
    setup: [
      "Set one pulley at about chest height and stand side-on to it.",
      "Take the handle in the near hand and step out until the arm is pulled back.",
    ],
    execution: [
      "Sweep the handle across the body in an arc until the hand passes the midline.",
      "Return slowly until the chest stretches, then go again.",
      "Finish all reps on one side, then turn around.",
    ],
    watchFor: [
      {
        mistake: "Rotating the whole torso to drag the handle across.",
        fix: "Keep your hips and chest square and let only the arm move. If you have to twist, lighten the stack.",
      },
      {
        mistake: "Stopping at the middle of the body.",
        fix: "Carry the hand past your midline. Crossing over is the part a two-handed fly can't reach.",
      },
    ],
  },
  "decline-db-fly": {
    setup: [
      "Set a bench to a slight decline and hook the legs in.",
      "Press the dumbbells up over the lower chest, palms facing each other.",
    ],
    execution: [
      "Open the arms out in a wide arc with a slight bend in the elbows.",
      "Stop at a comfortable stretch, then bring the bells back together.",
    ],
    watchFor: [
      {
        mistake: "Letting the bells drop far below the bench.",
        fix: "Stop when your upper arms are level with your torso. Going lower mostly stretches the front of the shoulder.",
      },
      {
        mistake: "Picking bells too heavy to control out wide.",
        fix: "Go lighter than your incline or flat fly. The decline puts you in an awkward spot to bail from.",
      },
    ],
  },
  "wide-grip-bench": {
    setup: [
      "Set up as for a normal bench, then take the grip a hand-width or two wider.",
      "Pull the shoulder blades down and back, feet driving into the floor.",
    ],
    execution: [
      "Lower the bar to mid-chest, slightly higher than on a normal grip.",
      "Press back up over the shoulders.",
    ],
    watchFor: [
      {
        mistake: "Going so wide the elbows point straight out to the sides.",
        fix: "Stay within the rings on the bar or just outside them. Wider than that loads the shoulder more than the chest.",
      },
      {
        mistake: "Wrists bending back under the bar.",
        fix: "Set the bar low in your palm over the forearm bones, so the wrist stays straight as the grip widens.",
      },
    ],
  },
  "reverse-grip-bench": {
    setup: [
      "Lie on the bench and take an underhand grip at about shoulder width.",
      "Have a spotter help with the unrack, as the grip makes it awkward.",
    ],
    execution: [
      "Lower the bar to the lower chest with the elbows tucked close to the sides.",
      "Press back up and slightly back toward the face.",
    ],
    watchFor: [
      {
        mistake: "Using a loose, thumbless grip.",
        fix: "Wrap your thumbs fully around the bar. An underhand bar can roll out of the hands, and it rolls toward your face.",
      },
      {
        mistake: "Starting with your normal bench weight.",
        fix: "Start well below your usual bench and work up. The groove is different and takes a few sessions to learn.",
      },
    ],
  },
  "paused-bench-press": {
    setup: [
      "Set up exactly as for your normal bench press.",
      "Use a lighter weight than usual, as the pause takes away the bounce.",
    ],
    execution: [
      "Lower the bar to the chest and hold it there, still, for a one or two count.",
      "Keep everything tight during the pause, then press.",
    ],
    watchFor: [
      {
        mistake: "Letting the bar sink into the chest and relaxing during the pause.",
        fix: "Keep the bar resting lightly on your chest and stay braced. A soft pause lets the shoulders roll forward and the bar drift.",
      },
      {
        mistake: "Cutting the pause shorter as the set gets hard.",
        fix: "Count the same pause on every rep, or have someone call press. A shorter pause turns it back into a normal bench.",
      },
    ],
  },
  "db-floor-press": {
    setup: [
      "Sit on the floor with the dumbbells on your thighs, then lie back with them at your chest.",
      "Knees bent, feet flat, upper arms resting on the floor.",
    ],
    execution: [
      "Press the bells up over the chest.",
      "Lower until the upper arms touch the floor, pause briefly, then press again.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbows crash onto the floor.",
        fix: "Lower until your arms touch down gently, then press. The floor sets the depth, but it shouldn't take a hit.",
      },
      {
        mistake: "Flaring the elbows straight out to the sides.",
        fix: "Keep your elbows about 45 degrees from your ribs, the same as a bench press.",
      },
    ],
  },
  "single-arm-db-bench-press": {
    setup: [
      "Lie on a flat bench with one dumbbell, feet planted wide.",
      "Hold the bench edge or rest the free hand on your stomach.",
    ],
    execution: [
      "Lower the bell to the side of the chest, elbow at about 45°.",
      "Press it back up without letting the body roll toward it.",
      "Finish the reps on one side, then switch.",
    ],
    watchFor: [
      {
        mistake: "Torso rolling toward the dumbbell.",
        fix: "Brace your abs and drive both feet into the floor. Staying flat is half the exercise.",
      },
      {
        mistake: "Using a bell too heavy to control on the way down.",
        fix: "Go lighter than one side of your normal dumbbell press. Losing control of a single bell pulls you off the bench.",
      },
    ],
  },
  "neutral-grip-db-press": {
    setup: [
      "Lie on a flat bench with the dumbbells at the chest, palms facing each other.",
      "Shoulder blades set, elbows close to the sides.",
    ],
    execution: [
      "Press the bells straight up, keeping the palms facing in.",
      "Lower until the bells touch the sides of the chest, then press again.",
    ],
    watchFor: [
      {
        mistake: "Letting the bells turn into a normal grip as the set gets hard.",
        fix: "Keep your palms facing each other the whole set. The neutral grip is what keeps the elbows tucked and the shoulders comfortable.",
      },
      {
        mistake: "Pressing the bells together like a squeeze press.",
        fix: "Keep them about shoulder width apart. Crushing them together is a different exercise and shortens the press.",
      },
    ],
  },
  "knee-push-up": {
    setup: [
      "Kneel on a mat, hands on the floor just wider than the shoulders.",
      "Walk the hands forward until you are in one line from knees to head.",
    ],
    execution: [
      "Lower the chest to the floor with the elbows about 45° from the body.",
      "Press back up, keeping the hips in line with the shoulders.",
    ],
    watchFor: [
      {
        mistake: "Hips staying high so only the head dips.",
        fix: "Keep a straight line from your knees to your shoulders and bring your chest, not your face, toward the floor.",
      },
      {
        mistake: "Staying on the knees long after they have got easy.",
        fix: "Once you can do fifteen clean reps, start mixing in incline or full push-ups. The knees are a starting point, not the destination.",
      },
    ],
  },
  "wide-grip-push-up": {
    setup: [
      "Push-up position with the hands a hand-width or two outside the shoulders.",
      "Fingers turned slightly out, body in one straight line.",
    ],
    execution: [
      "Lower the chest to the floor between the hands.",
      "Press back up without letting the hips sag.",
    ],
    watchFor: [
      {
        mistake: "Hands so wide the elbows go straight out and the range gets tiny.",
        fix: "Bring your hands in until you can still touch your chest to the floor. Wider only helps if you keep the full range.",
      },
      {
        mistake: "Hips sagging toward the floor.",
        fix: "Squeeze your glutes and brace your abs so your body moves as one plank.",
      },
    ],
  },
  "deficit-push-up": {
    setup: [
      "Place two push-up handles, plates, or blocks at shoulder width.",
      "Grip them in push-up position, body in a straight line.",
    ],
    execution: [
      "Lower until the chest drops below the level of the hands.",
      "Press back up to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Going deeper than the shoulders are ready for.",
        fix: "Start with a low deficit, an inch or two, and raise it over the weeks. The stretch should feel strong, never sharp.",
      },
      {
        mistake: "Letting the shoulders shrug up toward the ears at the bottom.",
        fix: "Keep your shoulders pulled down and push the floor away. The extra depth should come from your chest, not your shoulder joint sagging.",
      },
    ],
  },
  "ring-push-up": {
    setup: [
      "Set the rings a few inches off the floor, at shoulder width.",
      "Grip them in push-up position with straight arms, rings close to the body.",
    ],
    execution: [
      "Lower the chest between the rings, keeping them from drifting out.",
      "Press back up and turn the palms slightly out at the top.",
    ],
    watchFor: [
      {
        mistake: "Rings sliding apart as you lower.",
        fix: "Squeeze the rings in toward your body the whole way down. If they keep drifting, raise them higher to make it easier.",
      },
      {
        mistake: "Hips sagging while you fight the wobble.",
        fix: "Brace your abs and glutes before each rep. A solid plank makes the rings much easier to control.",
      },
    ],
  },
  "one-arm-push-up": {
    setup: [
      "Push-up position with the feet wider than the shoulders.",
      "Put one hand under the chest and the other behind the back.",
    ],
    execution: [
      "Lower the chest toward the floor, keeping the hips square.",
      "Press back up to a straight arm, then switch sides.",
    ],
    watchFor: [
      {
        mistake: "Twisting the hips open to make the rep easier.",
        fix: "Keep both hips facing the floor. If they twist, practise with your hand on a bench until you can stay square.",
      },
      {
        mistake: "Cutting the range to half reps.",
        fix: "Use a higher surface with full range instead. Lower the surface as you get stronger, the same way you learned the push-up.",
      },
    ],
  },
  "pseudo-planche-push-up": {
    setup: [
      "Push-up position with the hands beside the hips, fingers turned out.",
      "Shift the shoulders forward past the hands and hold them there.",
    ],
    execution: [
      "Lower the chest toward the floor, keeping the forward lean.",
      "Press back up, staying leaned forward at the top.",
    ],
    watchFor: [
      {
        mistake: "Losing the lean so it becomes a normal push-up.",
        fix: "Keep your shoulders in front of your hands for the whole set. Lean less if you need to, but keep the same lean every rep.",
      },
      {
        mistake: "Leaning so far forward the wrists hurt.",
        fix: "Warm up your wrists first and start with a small lean. Turning your fingers further out also takes some strain off.",
      },
    ],
  },
  "deadlift": {
    setup: [
      "Bar over mid-foot, shins almost touching, feet about hip width.",
      "Hinge and grip just outside the legs; drop the hips until the shins meet the bar.",
      "Chest up, lats tight, and pull the slack out of the bar before you move it.",
    ],
    execution: [
      "Push the floor away and let the bar drag up the legs.",
      "Hips and shoulders rise together — the hips must not shoot up first.",
      "Stand tall and lock the hips; do not lean back at the top.",
    ],
    watchFor: [
      {
        mistake: "Rounding the lower back once the weight gets heavy.",
        fix: "Stop the set. A rounded pull is the single most reliable way to hurt your back, and no rep is worth it.",
      },
      {
        mistake: "The bar swinging out away from the shins and pulling you forward.",
        fix: "Drag it up your legs. If it swings out, your hips started too high.",
      },
    ],
  },
  "rack-pull": {
    setup: [
      "Set the pins so the bar starts at or just below the knee.",
      "Same grip and brace as a deadlift, shins close to the bar.",
    ],
    execution: [
      "Drive the hips forward and pull the bar up the thighs to lockout.",
      "Lower back to the pins under control rather than dropping it.",
    ],
    watchFor: [
      {
        mistake: "Loading far heavier than a deadlift and letting the back round.",
        fix: "The shorter range tempts you to overload it. Use a weight you could hold position with for the full set.",
      },
      {
        mistake: "Bouncing the bar off the pins to start the next rep.",
        fix: "Come to a full stop each rep. The bounce loads your spine with a shock you did not choose.",
      },
    ],
  },
  "pull-up": {
    setup: [
      "Grip the bar slightly wider than the shoulders, palms forward.",
      "Hang with the shoulders pulled down out of the ears.",
    ],
    execution: [
      "Drive the elbows down and back until the chin clears the bar.",
      "Lower all the way to straight arms under control.",
    ],
    watchFor: [
      {
        mistake: "Kipping or swinging to get the last rep.",
        fix: "End the set. Swinging trains your hips, not your back — use a band or a machine if you need more reps.",
      },
      {
        mistake: "Stopping halfway down and losing the stretch at the bottom.",
        fix: "Straighten your arms fully every rep. The bottom is where the lat actually grows.",
      },
    ],
  },
  "wide-pull-up": {
    setup: [
      "Grip well outside shoulder width, palms forward.",
      "Set the shoulders down before the first rep.",
    ],
    execution: [
      "Pull the chest toward the bar, elbows tracking down and out.",
      "Lower to a full hang under control.",
    ],
    watchFor: [
      {
        mistake: "Going so wide the range shrinks to a few inches.",
        fix: "Come in until you can pull your chest to the bar. Wide does not mean better.",
      },
    ],
  },
  "chin-up": {
    setup: [
      "Palms facing you, hands about shoulder width.",
      "Hang with the shoulders set down.",
    ],
    execution: [
      "Pull the elbows down to your sides until the chin clears the bar.",
      "Lower to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbows drift forward, which hands the work to the biceps alone.",
        fix: "Pull your elbows down to your sides, not out in front of you.",
      },
    ],
  },
  "inverted-row": {
    setup: [
      "Bar set at about hip height, body underneath it, heels on the floor.",
      "Body in one straight line, glutes and abs braced.",
    ],
    execution: [
      "Pull the chest to the bar, elbows tucked.",
      "Lower under control to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Hips sagging so the body bends instead of the arms.",
        fix: "Squeeze your glutes and hold a straight line from your head to your heels.",
      },
    ],
  },
  "barbell-row": {
    setup: [
      "Hinge to roughly 45°, bar hanging at arm's length.",
      "Grip about shoulder width, lats engaged, back flat.",
    ],
    execution: [
      "Row the bar to the lower ribs or upper stomach.",
      "Lower under control without letting the torso rise.",
    ],
    watchFor: [
      {
        mistake: "Standing up a little on each rep to heave the weight.",
        fix: "Pick a torso angle and hold it for the whole set. If it rises, the weight is too heavy.",
      },
      {
        mistake: "Rowing to the chest, which turns it into a rear-delt exercise.",
        fix: "Row to your lower ribs or belly button to hit the lats.",
      },
    ],
  },
  "pendlay-row": {
    setup: [
      "Torso parallel to the floor, bar resting on the ground each rep.",
      "Flat back, tight brace.",
    ],
    execution: [
      "Explode the bar to the lower chest, then set it back down.",
      "Reset the position before each rep — every rep starts dead.",
    ],
    watchFor: [
      {
        mistake: "Letting the torso rise as you get tired, which makes it a barbell row.",
        fix: "Reset flat before every rep. If you cannot, you have run out of Pendlay rows for today.",
      },
    ],
  },
  "dumbbell-row": {
    setup: [
      "One hand and knee on a bench, other foot planted.",
      "Back flat and roughly parallel to the floor.",
    ],
    execution: [
      "Row the bell to the hip, elbow tucked past the ribs.",
      "Lower all the way to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Twisting the torso to lift more than the back can.",
        fix: "Keep your shoulders square to the bench. The rotation is your body borrowing from your obliques.",
      },
      {
        mistake: "Yanking with the arm and never moving the shoulder blade.",
        fix: "Let the shoulder blade travel at the bottom and pull it back at the top — that is the range the lat works through.",
      },
    ],
  },
  "chest-supported-row": {
    setup: [
      "Chest against the pad, feet planted, arms hanging.",
      "Set the pad so your chin clears the top.",
    ],
    execution: [
      "Row the handles to the ribs, squeezing the shoulder blades.",
      "Lower to a full stretch.",
    ],
    watchFor: [
      {
        mistake: "Peeling the chest off the pad, which gives the lower back the load.",
        fix: "Stay glued to the pad. Being unable to cheat is the entire reason to use this machine.",
      },
    ],
  },
  "machine-row": {
    setup: [
      "Chest on the pad, seat set so the handles are at mid-chest.",
      "Feet planted, back flat.",
    ],
    execution: [
      "Pull the handles back, driving the elbows past the torso.",
      "Return to a stretch without letting the stack land.",
    ],
    watchFor: [
      {
        mistake: "Leaning back to move a heavier stack.",
        fix: "Keep your torso still and let your arms and shoulder blades do the work.",
      },
    ],
  },
  "meadows-row": {
    setup: [
      "Landmine bar, stand side-on in a staggered stance.",
      "Hinge over and grip the sleeve with the outside hand.",
    ],
    execution: [
      "Row the sleeve up toward the hip, elbow flaring slightly.",
      "Lower to a deep stretch under control.",
    ],
    watchFor: [
      {
        mistake: "Rotating the torso open instead of keeping it square.",
        fix: "Face the same direction the whole set; the twist is your back giving up range to your hips.",
      },
    ],
  },
  "cable-row": {
    setup: [
      "Feet on the plate, soft knees, torso upright.",
      "Reach forward to a stretch without rounding the lower back.",
    ],
    execution: [
      "Pull the handle to the stomach, elbows past the ribs.",
      "Let it travel back out to a full stretch.",
    ],
    watchFor: [
      {
        mistake: "Rocking back and forth from the hips to swing the stack.",
        fix: "Keep your torso upright and still. Only your arms and shoulder blades should move.",
      },
      {
        mistake: "Shrugging the shoulders at the finish.",
        fix: "Pull your shoulder blades back and down, not up.",
      },
    ],
  },
  "t-bar-row": {
    setup: [
      "Straddle the bar, chest up, hinge to about 45°.",
      "Grip the handles and set the lats before the first rep.",
    ],
    execution: [
      "Row the handles to the stomach, elbows tucked.",
      "Lower to a stretch keeping the torso angle fixed.",
    ],
    watchFor: [
      {
        mistake: "Standing up through the rep to heave the weight.",
        fix: "Hold your hinge. Rising to lift is the sign to drop a plate.",
      },
    ],
  },
  "lat-pulldown": {
    setup: [
      "Thighs locked under the pad, grip a little wider than the shoulders.",
      "Sit tall with a slight lean back and hold that angle.",
    ],
    execution: [
      "Pull the bar to the upper chest, driving the elbows down.",
      "Let it rise to a full stretch with the shoulders coming up.",
    ],
    watchFor: [
      {
        mistake: "Leaning back further and further to turn it into a row.",
        fix: "Pick a slight lean and keep it. Growing lean means the weight is winning.",
      },
      {
        mistake: "Pulling behind the neck, which asks a lot of the shoulder for nothing.",
        fix: "Pull to your upper chest instead. It works the same muscle without the shoulder position.",
      },
    ],
  },
  "wide-grip-pulldown": {
    setup: [
      "Grip well outside the shoulders, thighs under the pad.",
      "Chest up, small lean back held throughout.",
    ],
    execution: [
      "Pull to the collarbone, elbows down and out.",
      "Return to a full stretch.",
    ],
    watchFor: [
      {
        mistake: "A grip so wide the bar only travels a few inches.",
        fix: "Narrow it until you get a full stretch at the top and the bar to your collarbone at the bottom.",
      },
    ],
  },
  "neutral-grip-pulldown": {
    setup: [
      "Use a V-handle or parallel bars, thighs pinned.",
      "Sit tall, chest up.",
    ],
    execution: [
      "Pull the handle to the upper chest, elbows driving down close to the body.",
      "Let the arms extend fully at the top.",
    ],
    watchFor: [
      {
        mistake: "Rocking the torso to get the last couple of reps.",
        fix: "Sit still. When the rocking starts, the set is done.",
      },
    ],
  },
  "single-arm-pulldown": {
    setup: [
      "One handle, kneeling or seated, thighs stable.",
      "Start with the arm straight and the shoulder blade reaching up.",
    ],
    execution: [
      "Pull the elbow down to the side, letting the shoulder blade travel with it.",
      "Return to a full overhead stretch.",
    ],
    watchFor: [
      {
        mistake: "Twisting the torso to pull, rather than letting the lat do it.",
        fix: "Stay square and think about driving the elbow down past your ribs.",
      },
    ],
  },
  "straight-arm-pulldown": {
    setup: [
      "Stand facing a high pulley, bar at arm's length, slight hinge.",
      "Fix a small bend in the elbows and keep it.",
    ],
    execution: [
      "Sweep the bar down to the thighs in an arc, feeling the lats.",
      "Let it rise back to shoulder height under control.",
    ],
    watchFor: [
      {
        mistake: "Bending and straightening the elbows — that makes it a pushdown.",
        fix: "Lock a slight bend in and move only at the shoulder.",
      },
    ],
  },
  "cable-pullover": {
    setup: [
      "High pulley with a rope or bar, hinge forward slightly.",
      "Soft, fixed elbow angle.",
    ],
    execution: [
      "Pull the handle down in an arc to the hips.",
      "Let it travel back overhead to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbows collapse and turning it into a triceps movement.",
        fix: "Hold the elbow angle fixed; the arc should come from your shoulders.",
      },
    ],
  },
  "face-pull": {
    setup: [
      "Rope at roughly face height, step back to tension.",
      "Palms facing in, arms straight to start.",
    ],
    execution: [
      "Pull the rope to the face, splitting the ends past the ears.",
      "Finish with the elbows high and the shoulder blades squeezed.",
    ],
    watchFor: [
      {
        mistake: "Pulling to the chest with low elbows, which is just a row.",
        fix: "Keep your elbows at or above shoulder height and split the rope past your ears.",
      },
      {
        mistake: "Loading it so heavy that the whole body leans back.",
        fix: "Face pulls work light. If you are counterbalancing, take plates off.",
      },
    ],
  },
  "barbell-shrug": {
    setup: [
      "Bar at arm's length, feet hip width, chest up.",
      "Arms stay straight the whole set.",
    ],
    execution: [
      "Shrug the shoulders straight up toward the ears.",
      "Lower under control to a full stretch.",
    ],
    watchFor: [
      {
        mistake: "Rolling the shoulders, which adds nothing and grinds the joint.",
        fix: "Shrug straight up and straight down.",
      },
      {
        mistake: "Bending the elbows to turn it into a half-row.",
        fix: "Keep your arms straight; your traps do not need help from your biceps.",
      },
    ],
  },
  "dumbbell-shrug": {
    setup: [
      "A bell in each hand at the sides, arms straight.",
      "Stand tall, chest up.",
    ],
    execution: [
      "Shrug straight up, pause, and lower to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Leaning side to side to alternate the effort.",
        fix: "Stand square and shrug both together.",
      },
    ],
  },
  "back-extension": {
    setup: [
      "Pads at the hip crease so you can hinge freely.",
      "Cross the arms or hold a plate at the chest.",
    ],
    execution: [
      "Hinge down until you feel the hamstrings stretch.",
      "Drive the hips into the pad to return to a straight line.",
    ],
    watchFor: [
      {
        mistake: "Hyperextending at the top and cranking the lower back backwards.",
        fix: "Stop at a straight line from your head to your heels. Past that you are just compressing your spine.",
      },
    ],
  },
  "iso-lateral-high-row": {
    setup: [
      "Set the seat so you have to reach up to the handles with the arms long.",
      "Chest against the pad if there is one, feet planted.",
    ],
    execution: [
      "Pull the handles down and back, driving the elbows toward the hips.",
      "Pause, then let the arms travel back up to a full stretch.",
    ],
    watchFor: [
      {
        mistake: "Leaning back to swing the weight down.",
        fix: "Stay against the pad and pull with your arms and back only. Lighten it if you need the lean.",
      },
      {
        mistake: "Cutting the stretch short at the top.",
        fix: "Let your arms go long and your shoulder blades rise before each rep. The stretch is where the lats do most of their work.",
      },
    ],
  },
  "iso-lateral-low-row": {
    setup: [
      "Set the seat so the handles are low and in front, chest against the pad.",
      "Feet planted and back flat.",
    ],
    execution: [
      "Row the handles back past the hips, keeping the elbows close to the body.",
      "Squeeze, then reach forward to a full stretch.",
    ],
    watchFor: [
      {
        mistake: "Rocking off the chest pad to finish the rep.",
        fix: "Keep your chest on the pad. If you have to rock, the weight is heavier than your back can pull.",
      },
      {
        mistake: "Shrugging the shoulders up toward the ears.",
        fix: "Keep your shoulders down and think about pulling your elbows back, not your hands up.",
      },
    ],
  },
  "iso-lateral-pulldown": {
    setup: [
      "Thighs snug under the pads, handles overhead with the arms long.",
      "Load both sides evenly.",
    ],
    execution: [
      "Pull the handles down toward the shoulders, driving the elbows down and back.",
      "Let them rise back up under control to a full stretch.",
      "Try one arm at a time to find a weaker side.",
    ],
    watchFor: [
      {
        mistake: "Leaning well back so it becomes a row.",
        fix: "Stay nearly upright with only a slight lean, and pull your elbows down toward your ribs.",
      },
      {
        mistake: "One arm leading while the other lags.",
        fix: "Match both handles rep for rep. If one side cannot keep up, train it alone for a few sets.",
      },
    ],
  },
  "reverse-grip-pulldown": {
    setup: [
      "Grip the bar underhand at shoulder width.",
      "Thighs locked under the pads, chest up.",
    ],
    execution: [
      "Pull the bar to the upper chest, keeping the elbows close in front of the body.",
      "Return to straight arms under control.",
    ],
    watchFor: [
      {
        mistake: "Turning it into a biceps curl by pulling with the hands.",
        fix: "Think about driving your elbows down to your ribs. Your hands are just hooks on the bar.",
      },
      {
        mistake: "Gripping wide with the palms up, which strains the wrists and elbows.",
        fix: "Keep your grip at about shoulder width. Underhand works best narrow.",
      },
    ],
  },
  "assisted-pull-up": {
    setup: [
      "Set the assistance, then kneel or stand on the pad and take the handles.",
      "Pick an overhand grip a little wider than the shoulders.",
      "Log the assistance as a negative weight so progress shows as it goes down.",
    ],
    execution: [
      "Pull until the chin clears the handles, chest up.",
      "Lower all the way to straight arms under control.",
    ],
    watchFor: [
      {
        mistake: "Letting the pad fire you up from the bottom.",
        fix: "Start every rep from a controlled hang and pull. If the pad does all the work, reduce the assistance.",
      },
      {
        mistake: "Never reducing the assistance.",
        fix: "Take a little assistance off whenever you hit the top of your rep range. That is how this turns into a real pull-up.",
      },
    ],
  },
  "neutral-grip-pull-up": {
    setup: [
      "Grip the parallel handles with the palms facing each other.",
      "Hang with straight arms and the shoulders slightly engaged.",
    ],
    execution: [
      "Pull until the chin clears the handles, driving the elbows down.",
      "Lower to a full hang every rep.",
    ],
    watchFor: [
      {
        mistake: "Kicking the legs to get over the top.",
        fix: "Keep your legs still and slightly in front of you. If you need the kick, the set is done.",
      },
      {
        mistake: "Stopping short of a full hang between reps.",
        fix: "Straighten your arms at the bottom of every rep. Half reps build half the strength.",
      },
    ],
  },
  "scapular-pull-up": {
    setup: [
      "Hang from a bar with an overhand grip and straight arms.",
      "Let the shoulders rise toward the ears.",
    ],
    execution: [
      "Pull the shoulder blades down and back so the body rises an inch or two.",
      "Keep the arms straight, pause, then lower back to the hang.",
    ],
    watchFor: [
      {
        mistake: "Bending the elbows to get more height.",
        fix: "Keep your arms straight. The movement is small and comes only from your shoulder blades.",
      },
      {
        mistake: "Rushing through them as a warm-up afterthought.",
        fix: "Pause at the top of each rep. The control you build here is what starts every pull-up.",
      },
    ],
  },
  "muscle-up": {
    setup: [
      "Grip the bar or rings with a false grip if you have one.",
      "Master strict pull-ups and straight bar dips before you try these.",
    ],
    execution: [
      "Pull explosively toward the lower chest, driving the bar down and away.",
      "Lean the chest over the bar as the elbows come up, then press out to straight arms.",
      "Lower back down under control rather than dropping.",
    ],
    watchFor: [
      {
        mistake: "Pulling to the chin like a normal pull-up and getting stuck under the bar.",
        fix: "Pull higher and faster, aiming the bar at your lower chest or belly so you have room to turn over.",
      },
      {
        mistake: "One arm getting over before the other, the so-called chicken wing.",
        fix: "Build more pulling height until both elbows can come over together. Uneven transitions are hard on the shoulder.",
      },
    ],
  },
  "front-lever-hold": {
    setup: [
      "Hang from a bar with an overhand grip, arms straight.",
      "Start with the knees tucked to the chest.",
    ],
    execution: [
      "Pull the straight arms down toward the hips until the back is level with the floor.",
      "Hold that line, then lower out of it under control.",
      "Extend the legs over the weeks as the hold gets steadier.",
    ],
    watchFor: [
      {
        mistake: "Bending the elbows to get into position.",
        fix: "Keep your arms locked straight and use a more tucked position until you can hold it that way.",
      },
      {
        mistake: "Hips sagging below the shoulders.",
        fix: "Squeeze your glutes and pull your ribs down. A shorter hold with a level body counts more than a long one that sags.",
      },
    ],
  },
  "rope-climb": {
    setup: [
      "Check there is a mat under the rope.",
      "Grab the rope high and learn a foot lock before you climb for height.",
    ],
    execution: [
      "Pull with the arms, bring the knees up, and pinch the rope between the feet.",
      "Stand up on the foot lock, reach higher, and repeat.",
      "Climb down hand under hand rather than sliding.",
    ],
    watchFor: [
      {
        mistake: "Sliding down the rope, which burns the hands and legs.",
        fix: "Climb down hand under hand with the feet controlling the speed, the same way you went up.",
      },
      {
        mistake: "Climbing on arms alone and burning out halfway up.",
        fix: "Learn a foot lock. Your legs can carry your weight while your arms reach, which makes the climb far safer.",
      },
    ],
  },
  "single-arm-cable-row": {
    setup: [
      "Seated or kneeling facing a cable at mid-height with one handle.",
      "Brace the free hand on your thigh or the bench.",
    ],
    execution: [
      "Row the handle toward the hip, keeping the elbow close to the body.",
      "Let the arm reach forward to a full stretch, allowing the shoulder blade to follow.",
    ],
    watchFor: [
      {
        mistake: "Twisting the torso to drag the handle back.",
        fix: "Keep your chest facing the cable. A little rotation at the end is fine; spinning to finish the rep is not.",
      },
      {
        mistake: "Pulling the hand to the chest so the biceps does the work.",
        fix: "Aim your elbow at your back pocket. That line puts the lats in charge.",
      },
    ],
  },
  "renegade-row": {
    setup: [
      "High plank with the hands on two dumbbells, feet set wide.",
      "Brace the core and squeeze the glutes.",
    ],
    execution: [
      "Row one dumbbell to the hip while pressing the other into the floor.",
      "Set it down under control and repeat on the other side.",
    ],
    watchFor: [
      {
        mistake: "Hips twisting toward the ceiling on each row.",
        fix: "Widen your feet and keep your hips square. Use lighter bells if you cannot stop the twist.",
      },
      {
        mistake: "Using round dumbbells that can roll under the supporting hand.",
        fix: "Use hexagonal, flat-sided dumbbells on level ground so the bell you are leaning on cannot tip.",
      },
    ],
  },
  "machine-pullover": {
    setup: [
      "Set the seat so the shoulders line up with the machine's pivot.",
      "Elbows on the pads, hands resting lightly on the bar.",
    ],
    execution: [
      "Drive the elbows down and forward in an arc until the bar reaches your stomach.",
      "Let the arms return overhead slowly to a full stretch.",
    ],
    watchFor: [
      {
        mistake: "Gripping hard and pulling with the hands.",
        fix: "Push through your elbows and keep your hands relaxed. That keeps the biceps out and the lats working.",
      },
      {
        mistake: "Seat set so the shoulders sit below or above the pivot.",
        fix: "Line your shoulder joint up with the machine's pivot point, or the arc will pinch at the top.",
      },
    ],
  },
  "trap-bar-deadlift": {
    setup: [
      "Stand in the centre of the bar, feet about hip width.",
      "Hinge and bend the knees to grip the handles in the middle.",
      "Chest up, back flat, and brace before you pull.",
    ],
    execution: [
      "Push the floor away and stand up tall, hips and shoulders rising together.",
      "Lower by pushing the hips back and bending the knees until the plates touch down.",
    ],
    watchFor: [
      {
        mistake: "Hips shooting up first so the back does the lifting.",
        fix: "Drive through your whole foot and keep your chest up as you break the floor. Hips and shoulders rise together.",
      },
      {
        mistake: "Gripping off-centre so the bar tips forward or back.",
        fix: "Take the handles in the middle. If the bar tilts as it leaves the floor, adjust your hands before the next rep.",
      },
    ],
  },
  "power-clean": {
    setup: [
      "Bar over the middle of the foot, feet hip width.",
      "Grip just outside the legs, back flat, shoulders slightly ahead of the bar.",
      "Learn it from a coach or with an empty bar first.",
    ],
    execution: [
      "Push the floor away to bring the bar past the knees, keeping it close.",
      "At mid-thigh, extend the hips hard and shrug so the bar keeps rising.",
      "Pull yourself under, whipping the elbows forward to catch it on the shoulders in a quarter squat.",
    ],
    watchFor: [
      {
        mistake: "Pulling with the arms early and reverse-curling the bar up.",
        fix: "Keep your arms long until the hips have fully opened. The legs and hips launch the bar; the arms only guide you under it.",
      },
      {
        mistake: "Catching with the elbows low so the bar lands on the wrists.",
        fix: "Whip your elbows forward and up so the bar lands on your shoulders, with your fingers only lightly holding it.",
      },
    ],
  },
  "hang-clean": {
    setup: [
      "Deadlift the bar to standing, grip just outside the thighs.",
      "Hinge slightly so the bar slides to just above the knees.",
    ],
    execution: [
      "Drive the hips through hard, bringing the bar up close to the body.",
      "Shrug, pull yourself under, and catch it on the shoulders with the elbows high.",
      "Stand up fully before resetting to the hang.",
    ],
    watchFor: [
      {
        mistake: "Swinging the bar out in front with the hips.",
        fix: "Keep the bar brushing your thighs as you extend. A bar that loops forward pulls you off balance on the catch.",
      },
      {
        mistake: "Bending the elbows before the hips have finished.",
        fix: "Keep your arms long like ropes until the hip drive is complete, then pull yourself under the bar.",
      },
    ],
  },
  "cable-shrug": {
    setup: [
      "Stand facing a low pulley with a straight bar, or between two low pulleys with handles.",
      "Arms straight, shoulders relaxed down.",
    ],
    execution: [
      "Shrug the shoulders straight up toward the ears.",
      "Pause at the top, then lower all the way down.",
    ],
    watchFor: [
      {
        mistake: "Rolling the shoulders in circles.",
        fix: "Move straight up and straight down. Rolling adds nothing for the traps and grinds the shoulder.",
      },
      {
        mistake: "Bending the elbows to pull the weight up.",
        fix: "Keep your arms straight and relaxed; only your shoulders should move.",
      },
    ],
  },
  "smith-shrug": {
    setup: [
      "Set the bar at mid-thigh height and step up to it.",
      "Grip just outside the thighs and unrack with straight arms.",
    ],
    execution: [
      "Shrug straight up, pause, and lower to a full stretch.",
      "Rack the bar by twisting the hooks back on when the set ends.",
    ],
    watchFor: [
      {
        mistake: "Heavy, tiny reps with no pause at the top.",
        fix: "Pick a weight you can hold at the top for a second. The pause is where the traps actually work.",
      },
      {
        mistake: "Standing too far from the bar so it drags up the thighs.",
        fix: "Step in until the bar hangs straight down from your shoulders without touching your legs.",
      },
    ],
  },
  "machine-back-extension": {
    setup: [
      "Set the seat so the pad sits across the upper back and the hips line up with the pivot.",
      "Feet planted on the platform, belt across the thighs if there is one.",
    ],
    execution: [
      "Push back against the pad until the torso is upright.",
      "Return forward slowly, stopping before the weight stack lands.",
    ],
    watchFor: [
      {
        mistake: "Throwing the torso back into an arch.",
        fix: "Stop when you are sitting upright. Driving past that puts the load on your lower back joints, not the muscles.",
      },
      {
        mistake: "Starting with a heavy weight on an unfamiliar machine.",
        fix: "Start light for a couple of sessions. The lower back responds well to steady progress and badly to big jumps.",
      },
    ],
  },
  "superman": {
    setup: [
      "Lie face down with the arms stretched overhead and legs straight.",
      "Look at the floor to keep the neck neutral.",
    ],
    execution: [
      "Lift the arms, chest and legs a few inches off the floor together.",
      "Pause for a second or two, then lower back down.",
    ],
    watchFor: [
      {
        mistake: "Cranking the head up to look forward.",
        fix: "Keep your eyes on the floor so your neck stays in line with the rest of your spine.",
      },
      {
        mistake: "Swinging up and down quickly.",
        fix: "Lift slowly and hold at the top. The work is in the pause, not the swing.",
      },
    ],
  },
  "wide-grip-cable-row": {
    setup: [
      "Attach a long straight or lat bar to the low cable.",
      "Grip well outside the shoulders, feet on the plate, torso upright.",
    ],
    execution: [
      "Row the bar to the lower chest with the elbows flaring out and back.",
      "Squeeze the shoulder blades together, then reach forward to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Tucking the elbows so it turns back into a normal cable row.",
        fix: "Let your elbows travel out at roughly 60–70° from your sides and pull to your chest, not your stomach. That is what moves the work to the upper back.",
      },
      {
        mistake: "Leaning back to finish each rep.",
        fix: "Keep your torso still and upright. If you have to rock back, lighten the stack.",
      },
    ],
  },
  "iso-lateral-row": {
    setup: [
      "Set the seat so the handles line up with the middle of your chest.",
      "Chest against the pad, feet planted, one handle in each hand.",
    ],
    execution: [
      "Row straight back, driving the elbows past the torso.",
      "Pause, then let the arms reach forward until the shoulder blades spread.",
      "Try a few sets one arm at a time to find a weaker side.",
    ],
    watchFor: [
      {
        mistake: "Lifting the chest off the pad to throw the weight back.",
        fix: "Stay in contact with the pad for the whole set. If you cannot, the plates are heavier than your back can row.",
      },
      {
        mistake: "Short, choppy reps that never reach a stretch.",
        fix: "Let your arms go fully long at the front of every rep. The stretch is half of what the machine is for.",
      },
    ],
  },
  "chest-supported-t-bar-row": {
    setup: [
      "Stand on the foot plate and lie your chest on the angled pad.",
      "Take the wide or narrow handles, and let the arms hang straight.",
    ],
    execution: [
      "Row the handles toward the ribs, keeping the chest on the pad.",
      "Squeeze the shoulder blades together, then lower to a full stretch.",
    ],
    watchFor: [
      {
        mistake: "Pushing up through the legs so the chest leaves the pad.",
        fix: "Keep your chest pressed into the pad and your legs quiet. Taking the legs out of the lift is the point of this machine.",
      },
      {
        mistake: "Stopping the plates just short of the bottom every rep.",
        fix: "Lower until your arms are straight and your shoulders are pulled forward. Half reps leave most of the back work on the table.",
      },
    ],
  },
  "seal-row": {
    setup: [
      "Set a flat bench high enough that the bar hangs clear of the floor with your arms straight.",
      "Lie face down with the chin just over the end, and take the bar with an overhand grip.",
    ],
    execution: [
      "Row the bar up until it touches the underside of the bench.",
      "Lower all the way to straight arms before the next rep.",
    ],
    watchFor: [
      {
        mistake: "Lifting the head and chest off the bench to finish the rep.",
        fix: "Keep your chest down on the bench. If the bar only reaches the pad by peeling up, lower the weight.",
      },
      {
        mistake: "A bench so low the plates hit the floor before the arms straighten.",
        fix: "Raise the bench on boxes or plates until you can reach a full stretch without the bar touching down.",
      },
    ],
  },
  "incline-db-row": {
    setup: [
      "Set a bench to about 30–45° and lie face down with the chest on the pad.",
      "A dumbbell in each hand, arms hanging straight, toes on the floor.",
    ],
    execution: [
      "Row both dumbbells up toward the hips, elbows close to the body.",
      "Squeeze at the top, then lower until the arms are straight.",
    ],
    watchFor: [
      {
        mistake: "Pushing off the toes so the chest lifts off the pad.",
        fix: "Keep your chest glued to the bench. The support is there so your back does the work, not your legs.",
      },
      {
        mistake: "Letting the head crane up to watch the dumbbells.",
        fix: "Keep your neck in line with your spine, looking at the floor just ahead of the bench.",
      },
    ],
  },
  "bent-over-db-row": {
    setup: [
      "Dumbbell in each hand, feet hip width, soft knees.",
      "Hinge at the hips until the torso is at about 45° or lower, back flat.",
    ],
    execution: [
      "Row both dumbbells toward the hips, elbows brushing the sides.",
      "Lower to straight arms while holding the hinge still.",
    ],
    watchFor: [
      {
        mistake: "Standing up a little more every rep as the set goes on.",
        fix: "Hold the same hinge angle from the first rep to the last. Rising up turns it into a shrug.",
      },
      {
        mistake: "Rounding the lower back to reach the dumbbells down.",
        fix: "Keep your back flat and push your hips back further instead. Lighter dumbbells make that easier to hold.",
      },
    ],
  },
  "gorilla-row": {
    setup: [
      "Two kettlebells on the floor between the feet, stance wider than the shoulders.",
      "Hinge deeply with a flat back and grip both handles.",
    ],
    execution: [
      "Row one bell to the hip while pressing the other into the floor.",
      "Lower it back down and row the other side.",
    ],
    watchFor: [
      {
        mistake: "Twisting the torso open to lift the bell higher.",
        fix: "Keep your chest facing the floor. A little rotation is natural; turning sideways takes the work off your back.",
      },
      {
        mistake: "Standing up out of the hinge between reps.",
        fix: "Stay down for the whole set with your hips back. The held hinge is part of what makes this row hard.",
      },
    ],
  },
  "reverse-grip-barbell-row": {
    setup: [
      "Take the bar with an underhand grip at about shoulder width.",
      "Hinge to roughly 30–45°, a little more upright than an overhand row.",
    ],
    execution: [
      "Row the bar to the lower stomach, driving the elbows back close to the body.",
      "Lower to straight arms, keeping the torso angle fixed.",
    ],
    watchFor: [
      {
        mistake: "Curling the bar up with the biceps.",
        fix: "Think about driving your elbows back behind you. Your hands are only hooks holding the bar.",
      },
      {
        mistake: "Using a wide underhand grip that strains the wrists.",
        fix: "Keep your hands about shoulder width apart. An underhand grip is much more comfortable when it is narrow.",
      },
    ],
  },
  "smith-row": {
    setup: [
      "Set the bar at about knee height and stand close to it.",
      "Grip just outside the legs, hinge to about 45°, and unrack by twisting the bar.",
    ],
    execution: [
      "Row the bar to the lower chest, keeping your back flat.",
      "Lower to straight arms and rack it when the set is done.",
    ],
    watchFor: [
      {
        mistake: "Standing so the bar path drags against the thighs.",
        fix: "Step back until the bar runs straight up and down in front of your legs without touching them.",
      },
      {
        mistake: "Letting the hinge rise because the machine holds the bar.",
        fix: "Keep the same hinge angle for every rep. The fixed path steadies the bar, not your torso.",
      },
    ],
  },
  "weighted-pull-up": {
    setup: [
      "Hang the weight from a dip belt, or hold a dumbbell between the feet.",
      "Take your normal pull-up grip and start from a still hang.",
      "Log only the added weight.",
    ],
    execution: [
      "Pull until the chin clears the bar, chest up.",
      "Lower all the way to straight arms under control.",
    ],
    watchFor: [
      {
        mistake: "Adding weight before bodyweight reps are strict.",
        fix: "Get to about eight clean bodyweight reps before you load them. Extra weight makes any half rep worse.",
      },
      {
        mistake: "The plate swinging and pulling you into a kip.",
        fix: "Start each rep from a dead stop and keep your legs still. Shorten the belt chain so the weight hangs close.",
      },
    ],
  },
  "weighted-chin-up": {
    setup: [
      "Belt on with the weight hanging close, underhand grip at shoulder width.",
      "Start from a still hang with the arms straight.",
      "Log only the added weight.",
    ],
    execution: [
      "Pull until the chin clears the bar, elbows driving down in front of you.",
      "Lower slowly to a full hang.",
    ],
    watchFor: [
      {
        mistake: "Stopping short of straight arms at the bottom.",
        fix: "Straighten your arms fully on every rep. Weighted half reps look strong and build much less.",
      },
      {
        mistake: "Jumping in weight too quickly.",
        fix: "Add small plates and let the reps come back before the next jump. The elbows need time to catch up with the load.",
      },
    ],
  },
  "negative-pull-up": {
    setup: [
      "Use a box or jump to get the chin over the bar.",
      "Take an overhand grip and hold the top position for a moment.",
    ],
    execution: [
      "Lower yourself as slowly as you can, aiming for three to five seconds.",
      "Reach a full hang, then step back up for the next rep.",
    ],
    watchFor: [
      {
        mistake: "Dropping the last half of the rep.",
        fix: "Control the whole way down to straight arms. The bottom half is where most people get stuck on a full pull-up.",
      },
      {
        mistake: "Doing so many that the elbows ache the next day.",
        fix: "Keep the sets short, around three to five slow reps. Lowering work is harder on the body than it feels at the time.",
      },
    ],
  },
  "archer-pull-up": {
    setup: [
      "Take an overhand grip much wider than a normal pull-up.",
      "Hang with straight arms and the shoulders set.",
    ],
    execution: [
      "Pull toward one hand while the other arm straightens out along the bar.",
      "Lower under control and alternate sides.",
    ],
    watchFor: [
      {
        mistake: "Bending both arms equally so it becomes a wide pull-up.",
        fix: "Keep the assisting arm as straight as you can. The more it helps, the less the working side learns.",
      },
      {
        mistake: "Twisting the body toward the working side.",
        fix: "Keep your chest square to the bar and slide your chin toward the working hand.",
      },
    ],
  },
  "kipping-pull-up": {
    setup: [
      "Grip the bar just outside the shoulders.",
      "Be able to do several strict pull-ups first.",
    ],
    execution: [
      "Swing between an arched position and a hollow position from the shoulders.",
      "As you snap into the hollow, drive the hips up and pull the chin over the bar.",
      "Push away from the bar at the top and flow back into the next swing.",
    ],
    watchFor: [
      {
        mistake: "Learning the kip before you have strict pulling strength.",
        fix: "Build to at least five strict pull-ups first. The kip adds speed, and the shoulders need the strength to control it.",
      },
      {
        mistake: "A wild swing from the knees that loses the rhythm.",
        fix: "Keep your legs together and drive the swing from your shoulders and hips. A tight, small kip links reps far better.",
      },
    ],
  },
  "ring-row": {
    setup: [
      "Set rings or suspension straps at about waist height.",
      "Hold the handles, lean back with straight arms, and walk the feet forward.",
      "Body in a straight line from head to heels.",
    ],
    execution: [
      "Row the chest up to the handles, turning the palms in as you pull.",
      "Lower back to straight arms under control.",
    ],
    watchFor: [
      {
        mistake: "Hips sagging so only the upper body moves.",
        fix: "Squeeze your glutes and keep your body straight like a moving plank. Step your feet back if you cannot hold it.",
      },
      {
        mistake: "Shrugging the shoulders up to the ears at the top.",
        fix: "Pull your shoulder blades back and down as you row. Lead with your chest, not your chin.",
      },
    ],
  },
  "trap-bar-shrug": {
    setup: [
      "Stand in the centre of a hex bar and deadlift it up to standing.",
      "Arms straight, shoulders relaxed down.",
    ],
    execution: [
      "Shrug the shoulders straight up toward the ears.",
      "Pause at the top, then lower all the way down.",
    ],
    watchFor: [
      {
        mistake: "Bending the elbows to help the weight up.",
        fix: "Keep your arms straight and loose. Only your shoulders should move, or the biceps start taking over.",
      },
      {
        mistake: "Loading it so heavily the reps become tiny bounces.",
        fix: "Choose a weight you can hold at the top for a second. A full, paused shrug does more than a heavy twitch.",
      },
    ],
  },
  "behind-back-shrug": {
    setup: [
      "Set the bar in a rack at about hip height.",
      "Back up to it and grip it behind the thighs, palms facing back, a little wider than the hips.",
    ],
    execution: [
      "Lift the bar out of the rack and shrug straight up.",
      "Pause at the top, then lower to a full stretch.",
    ],
    watchFor: [
      {
        mistake: "Leaning forward so the bar pulls you over.",
        fix: "Stand tall with your chest up. Let the bar rest lightly against the backs of your legs.",
      },
      {
        mistake: "Picking the bar up from the floor behind you.",
        fix: "Take it from a rack or pins at hip height. Lifting it off the floor behind your back is awkward and needless.",
      },
    ],
  },
  "machine-shrug": {
    setup: [
      "Set the pads or handles so you start with the arms straight and the shoulders down.",
      "Stand or sit tall, feet planted.",
    ],
    execution: [
      "Shrug straight up toward the ears.",
      "Hold for a moment, then lower all the way down.",
    ],
    watchFor: [
      {
        mistake: "Rolling the shoulders forward or in circles.",
        fix: "Move straight up and straight down. Rolling adds nothing for the traps and makes the load harder to control.",
      },
      {
        mistake: "Cutting the bottom short so the stack never settles.",
        fix: "Let your shoulders drop fully between reps. That stretch is part of the range the traps need.",
      },
    ],
  },
  "snatch-grip-deadlift": {
    setup: [
      "Bar over the middle of the foot, grip out near the collars.",
      "Hips lower than a normal deadlift, back flat, chest up.",
      "Brace hard before you pull.",
    ],
    execution: [
      "Push the floor away, keeping the bar close to the legs.",
      "Stand tall at the top, then lower it along the same path.",
    ],
    watchFor: [
      {
        mistake: "Starting with the hips as high as a normal deadlift.",
        fix: "Sit your hips lower to reach the wider grip. Hips too high and the back ends up rounding over the bar.",
      },
      {
        mistake: "Grip giving out long before the back does.",
        fix: "Use straps for heavy sets. The wide grip is there to work the upper back, not to test your hands.",
      },
    ],
  },
  "deficit-deadlift": {
    setup: [
      "Stand on a plate or low platform, usually one to three inches high.",
      "Set up as for a normal deadlift: bar over mid-foot, back flat, lats tight.",
    ],
    execution: [
      "Drive through the floor and break the bar away from the ground.",
      "Stand tall, then lower back to the plates under control.",
    ],
    watchFor: [
      {
        mistake: "Standing on a platform so high the back rounds to reach the bar.",
        fix: "Choose a height you can set up for with a flat back. A small deficit done well beats a big one done hunched.",
      },
      {
        mistake: "Using the same weight as your normal deadlift.",
        fix: "Start lighter. The extra range makes the lift noticeably harder, and that extra work is the reason to do it.",
      },
    ],
  },
  "power-snatch": {
    setup: [
      "Wide grip so the bar sits in the hip crease when you stand up.",
      "Bar over mid-foot, back flat, shoulders slightly ahead of the bar.",
      "Learn it from a coach or with a PVC pipe and empty bar first.",
    ],
    execution: [
      "Push the floor away and keep the bar close as it passes the knees.",
      "At the hips, extend hard and shrug, then pull yourself under the bar.",
      "Catch it overhead with locked arms in a partial squat, then stand.",
    ],
    watchFor: [
      {
        mistake: "Swinging the bar out in front of you with the hips.",
        fix: "Keep the bar brushing your thighs as you extend. A bar that loops forward pulls you off balance at the catch.",
      },
      {
        mistake: "Pressing the bar out with soft elbows at the catch.",
        fix: "Punch your arms to lockout as you drop under. If you have to press it out, the weight is too heavy for now.",
      },
    ],
  },
  "clean-and-jerk": {
    setup: [
      "Clean grip just outside the legs, bar over mid-foot.",
      "Learn both halves separately with a coach or an empty bar before you put them together.",
    ],
    execution: [
      "Clean the bar to the shoulders and stand up fully.",
      "Reset the grip if needed, dip straight down through the legs, and drive the bar overhead.",
      "Catch it on locked arms, get the feet under you, and stand still before lowering.",
    ],
    watchFor: [
      {
        mistake: "Dipping forward onto the toes before the jerk.",
        fix: "Dip straight down with your weight in your heels and torso upright. A forward dip sends the bar out in front.",
      },
      {
        mistake: "Rushing into the jerk before you are balanced after the clean.",
        fix: "Stand fully and take a breath before you dip. A second to settle makes the jerk far more reliable.",
      },
    ],
  },
  "clean-pull": {
    setup: [
      "Set up exactly as for a clean: grip just outside the legs, bar over mid-foot.",
      "Back flat and shoulders slightly ahead of the bar.",
    ],
    execution: [
      "Lift the bar past the knees at the same speed you would clean it.",
      "At mid-thigh, drive the hips through and shrug hard, rising onto the toes.",
      "Keep the arms long, then lower the bar under control.",
    ],
    watchFor: [
      {
        mistake: "Bending the elbows and turning it into a high pull.",
        fix: "Keep your arms straight like ropes. The pull trains the legs and hips to move the bar, not the arms.",
      },
      {
        mistake: "Leaning back at the top instead of driving up.",
        fix: "Finish tall with your shoulders over the bar or slightly behind it. Throwing your weight backward wastes the drive.",
      },
    ],
  },
  "dumbbell-snatch": {
    setup: [
      "Dumbbell on the floor between the feet, feet about shoulder width.",
      "Squat down with a flat back and grip the handle with one hand.",
    ],
    execution: [
      "Drive through the legs and hips, keeping the dumbbell close to the body.",
      "Pull it up and punch it overhead to a locked arm in one motion.",
      "Lower it to the shoulder, then to the floor, and switch hands as planned.",
    ],
    watchFor: [
      {
        mistake: "Pulling the dumbbell up with the arm and pressing it out.",
        fix: "Let the hips launch the weight and use your arm to guide it. It should arrive overhead, not be pushed there.",
      },
      {
        mistake: "Rounding the back to pick it off the floor.",
        fix: "Squat down to the dumbbell with your chest up. Speed does not excuse a rounded back at the start.",
      },
    ],
  },
  "kettlebell-clean": {
    setup: [
      "Kettlebell on the floor a little in front of you, feet about shoulder width.",
      "Hinge and grip the handle with one hand, thumb pointing back.",
    ],
    execution: [
      "Hike the bell back between the legs, then drive the hips forward.",
      "Keep the elbow close and let the bell travel up the body into the rack at your shoulder.",
      "Drop it back between the legs for the next rep.",
    ],
    watchFor: [
      {
        mistake: "The bell flipping over and banging the forearm.",
        fix: "Keep it close and slip your hand around the handle as it rises, rather than letting it arc out and flip over.",
      },
      {
        mistake: "Curling the bell up with the arm.",
        fix: "Drive it with your hips just like a swing. The arm only keeps it close on the way up.",
      },
    ],
  },
  "band-row": {
    setup: [
      "Anchor a band at chest height, or sit and loop it around the feet.",
      "Step back or reach forward until the band is taut with the arms straight.",
    ],
    execution: [
      "Row the handles to the ribs, squeezing the shoulder blades together.",
      "Let the arms go back out slowly against the band.",
    ],
    watchFor: [
      {
        mistake: "Letting the band snap the arms back forward.",
        fix: "Control the return as much as the pull. The band is trying to yank you, and resisting it is half the work.",
      },
      {
        mistake: "Standing so close that there is no tension at the start.",
        fix: "Step back until the band is tight with your arms straight. It should pull on you from the very first inch.",
      },
    ],
  },
  "ohp": {
    setup: [
      "Bar on the front delts, hands just outside the shoulders.",
      "Feet hip width, glutes and abs braced, ribs down.",
    ],
    execution: [
      "Move the head back slightly and press the bar straight up past the face.",
      "Once it clears, push the head through so the bar finishes over the mid-foot.",
    ],
    watchFor: [
      {
        mistake: "Leaning back from the lower back instead of bracing the midsection.",
        fix: "Squeeze your glutes and pull your ribs down before you press. If you still have to lean, the weight is too heavy.",
      },
      {
        mistake: "Pressing around the face and finishing with the bar out in front.",
        fix: "Move your head back an inch, press straight up, then push your head through so the bar ends over the middle of your foot.",
      },
    ],
  },
  "dumbbell-ohp": {
    setup: [
      "Bells at shoulder height, palms forward, elbows slightly in front.",
      "Stand tall with the ribs down and the glutes tight.",
    ],
    execution: [
      "Press up until the arms are straight, bells finishing over the shoulders.",
      "Lower to ear height under control.",
    ],
    watchFor: [
      {
        mistake: "Arching the lower back to press a weight the shoulders cannot.",
        fix: "Brace your midsection and drop the weight. A pressed rep that bends your back is a back exercise.",
      },
      {
        mistake: "Clashing the bells overhead.",
        fix: "Stop them a few inches apart. Banging them together costs you nothing and risks your wrists.",
      },
    ],
  },
  "seated-db-press": {
    setup: [
      "Bench upright with the back supported, bells at shoulder height.",
      "Feet planted, ribs down against the pad.",
    ],
    execution: [
      "Press overhead until the arms lock out.",
      "Lower under control to about ear height.",
    ],
    watchFor: [
      {
        mistake: "Sliding the hips forward and arching off the backrest.",
        fix: "Sit right back into the seat and keep your ribs down against the pad.",
      },
    ],
  },
  "machine-shoulder-press": {
    setup: [
      "Seat set so the handles start at shoulder height.",
      "Back flat against the pad.",
    ],
    execution: [
      "Press up to nearly straight arms.",
      "Lower under control until the handles reach the shoulders.",
    ],
    watchFor: [
      {
        mistake: "Seat too low, which forces the shoulder into an awkward start.",
        fix: "Raise it until the handles start level with your shoulders.",
      },
    ],
  },
  "smith-shoulder-press": {
    setup: [
      "Bench upright, positioned so the fixed bar path passes close to the face.",
      "Ribs down, feet planted.",
    ],
    execution: [
      "Unhook, press to lockout, lower to chin height.",
      "Re-hook once the set is finished.",
    ],
    watchFor: [
      {
        mistake: "Bench placed so the bar travels well in front of the shoulders.",
        fix: "Shift the bench until the fixed path passes close to your face. The Smith will not adjust to you.",
      },
    ],
  },
  "arnold-press": {
    setup: [
      "Bells at chest height, palms facing you, elbows in.",
      "Sit or stand tall with the ribs down.",
    ],
    execution: [
      "Press up while rotating the palms to face forward.",
      "Reverse the rotation exactly on the way down.",
    ],
    watchFor: [
      {
        mistake: "Rushing the rotation so it happens after the press rather than during it.",
        fix: "Turn your palms gradually as you press, finishing the rotation exactly as your arms straighten.",
      },
    ],
  },
  "lateral-raise": {
    setup: [
      "A bell in each hand at the sides, small fixed bend in the elbows.",
      "Stand tall, shoulders down.",
    ],
    execution: [
      "Raise the arms out to the sides to about shoulder height.",
      "Lower slowly — most of the value is on the way down.",
    ],
    watchFor: [
      {
        mistake: "Swinging the weight up with the hips.",
        fix: "Stand still and go lighter. Lateral raises are small-muscle work and swinging skips the muscle entirely.",
      },
      {
        mistake: "Shrugging, which hands the work to the traps.",
        fix: "Keep your shoulders pressed down and stop the raise at shoulder height.",
      },
    ],
  },
  "cable-lateral-raise": {
    setup: [
      "Low pulley behind you, handle in the outside hand.",
      "Stand side-on, soft bend in the elbow.",
    ],
    execution: [
      "Raise the arm out to shoulder height against the cable.",
      "Lower slowly all the way down.",
    ],
    watchFor: [
      {
        mistake: "Leaning away from the stack to cheat the last reps.",
        fix: "Stand upright. When you start counterbalancing, the set is finished.",
      },
    ],
  },
  "machine-lateral-raise": {
    setup: [
      "Seat set so the pads sit just above the elbows.",
      "Chest against the pad, shoulders down.",
    ],
    execution: [
      "Drive the elbows out and up to shoulder height.",
      "Lower under control without letting the stack land.",
    ],
    watchFor: [
      {
        mistake: "Pushing with the hands rather than leading with the elbows.",
        fix: "Drive your elbows out and up; your hands are just along for the ride.",
      },
    ],
  },
  "front-raise": {
    setup: [
      "Bells in front of the thighs, palms down, soft elbows.",
      "Ribs down, glutes tight.",
    ],
    execution: [
      "Raise to about shoulder height and no higher.",
      "Lower under control.",
    ],
    watchFor: [
      {
        mistake: "Rocking back to swing the bells up.",
        fix: "Brace and go lighter. If your torso moves, your front delts are not doing the work.",
      },
    ],
  },
  "cable-front-raise": {
    setup: [
      "Low pulley behind you, handle in one hand at the thigh.",
      "Stand tall with a soft elbow.",
    ],
    execution: [
      "Raise forward to shoulder height against constant tension.",
      "Lower slowly.",
    ],
    watchFor: [
      {
        mistake: "Leaning back as the set gets hard.",
        fix: "Stay upright and stop when you cannot. The lean is your hips taking over.",
      },
    ],
  },
  "plate-front-raise": {
    setup: [
      "Hold a plate at 3 and 9 o'clock in front of the thighs.",
      "Soft elbows, ribs down.",
    ],
    execution: [
      "Raise to eye level, then lower under control.",
    ],
    watchFor: [
      {
        mistake: "Using the hips to start each rep.",
        fix: "Start each rep from a dead stop with your torso still.",
      },
    ],
  },
  "reverse-fly": {
    setup: [
      "Hinge forward to roughly 45°, bells hanging beneath the chest.",
      "Soft, fixed elbow bend; back flat.",
    ],
    execution: [
      "Raise the arms out to the sides, leading with the elbows.",
      "Squeeze the shoulder blades, then lower to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Standing up through the rep.",
        fix: "Hold your hinge for the whole set. Rising is your lower back joining in.",
      },
      {
        mistake: "Going heavy enough that it becomes a row.",
        fix: "Rear delts are small. Use a weight you can raise with straight-ish arms and no elbow bend.",
      },
    ],
  },
  "rear-delt-machine": {
    setup: [
      "Chest on the pad, handles set so the arms start in front of you.",
      "Slight bend in the elbows.",
    ],
    execution: [
      "Sweep the arms back and out, squeezing the shoulder blades.",
      "Return under control to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Pulling with the elbows tucked, which makes it a row.",
        fix: "Sweep your arms wide and back, elbows away from your body.",
      },
    ],
  },
  "cable-rear-delt": {
    setup: [
      "Two high pulleys crossed in front of you, opposite handles in each hand.",
      "Soft elbows, chest up.",
    ],
    execution: [
      "Pull the arms apart and back, finishing wide.",
      "Return under control.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbows bend and straighten through the rep.",
        fix: "Fix a slight bend and hold it — the movement is at the shoulder.",
      },
    ],
  },
  "upright-row": {
    setup: [
      "Bar or bells at the thighs, grip about shoulder width.",
      "Stand tall, shoulders down.",
    ],
    execution: [
      "Pull the elbows up and out to about chest height.",
      "Lower under control.",
    ],
    watchFor: [
      {
        mistake: "A narrow grip pulled to the chin — hard on the shoulder for many people.",
        fix: "Widen to shoulder width and stop at chest height. If it still pinches, do lateral raises instead — you lose nothing.",
      },
    ],
  },
  "landmine-shoulder-press": {
    setup: [
      "Barbell end at the shoulder, staggered stance, midsection braced.",
      "Free hand out for balance or on the hip.",
    ],
    execution: [
      "Press up and forward along the bar's arc to a straight arm.",
      "Return to the shoulder under control.",
    ],
    watchFor: [
      {
        mistake: "Twisting the torso into the press.",
        fix: "Square your hips and shoulders and let the arm press on its own.",
      },
    ],
  },
  "iso-lateral-shoulder-press": {
    setup: [
      "Set the seat so the handles start just above shoulder height.",
      "Back flat against the pad, feet planted.",
    ],
    execution: [
      "Press both handles overhead until the arms are nearly straight.",
      "Lower slowly until the handles are back level with the shoulders.",
    ],
    watchFor: [
      {
        mistake: "Arching the lower back off the pad to finish reps.",
        fix: "Keep your back against the pad and your ribs down. If you need the arch, the weight is too heavy.",
      },
      {
        mistake: "Stopping the handles well above the shoulders on the way down.",
        fix: "Bring them all the way back to shoulder height each rep. The bottom half is where the delts work hardest.",
      },
    ],
  },
  "push-press": {
    setup: [
      "Bar in the front rack on the shoulders, grip just outside shoulder width.",
      "Feet hip width, core braced, elbows slightly in front of the bar.",
    ],
    execution: [
      "Dip a few inches by bending the knees, keeping the torso upright.",
      "Drive up through the legs and press the bar overhead in one motion.",
      "Lower it back to the shoulders, absorbing it with a slight knee bend.",
    ],
    watchFor: [
      {
        mistake: "Dipping by leaning forward at the hips.",
        fix: "Bend only at your knees and keep your torso vertical, so the leg drive goes straight up into the bar.",
      },
      {
        mistake: "Pausing between the dip and the drive.",
        fix: "Go straight from the dip into the drive. The bounce out of the bottom is what moves the extra weight.",
      },
    ],
  },
  "z-press": {
    setup: [
      "Sit on the floor with the legs straight out in front, inside a rack.",
      "Take the bar from pins set at shoulder height, grip just outside the shoulders.",
    ],
    execution: [
      "Press the bar straight up, moving the head back slightly to clear it.",
      "Lower to the upper chest and press again, staying tall the whole time.",
    ],
    watchFor: [
      {
        mistake: "Rounding the lower back and slumping as the set goes on.",
        fix: "Sit tall and brace hard. If you cannot stay upright with straight legs, sit with your legs apart or start with dumbbells.",
      },
      {
        mistake: "Pressing the bar forward away from the face.",
        fix: "Keep the bar close to your face and finish directly over the top of your head.",
      },
    ],
  },
  "kettlebell-press": {
    setup: [
      "Clean the bell to the rack position, resting on the outside of the forearm.",
      "Wrist straight, elbow tucked in front of the ribs, glutes squeezed.",
    ],
    execution: [
      "Press the bell straight up, letting the forearm rotate naturally.",
      "Lower back to the rack under control.",
    ],
    watchFor: [
      {
        mistake: "Wrist bent back under the weight of the bell.",
        fix: "Grip the handle deep in your palm, toward the thumb, and keep your wrist straight.",
      },
      {
        mistake: "Leaning away to the side to get it overhead.",
        fix: "Squeeze your glutes and the opposite fist, and stay tall. If you lean, use a lighter bell.",
      },
    ],
  },
  "pike-push-up": {
    setup: [
      "Start in a push-up position, then walk the feet in so the hips rise into an upside-down V.",
      "Hands shoulder width, head between the arms.",
    ],
    execution: [
      "Bend the elbows and lower the top of the head toward the floor in front of the hands.",
      "Press back up to straight arms.",
      "Put the feet on a box to make it harder.",
    ],
    watchFor: [
      {
        mistake: "Letting the hips drop so it becomes a normal push-up.",
        fix: "Keep your hips high over your shoulders so the press is going overhead.",
      },
      {
        mistake: "Elbows flaring straight out to the sides.",
        fix: "Let them angle back at about 45 degrees, the same path you would press a bar overhead.",
      },
    ],
  },
  "handstand-push-up": {
    setup: [
      "Kick up into a handstand facing a wall, hands shoulder width about a hand's length away.",
      "Put a folded mat under your head.",
    ],
    execution: [
      "Lower under control until the head touches the mat.",
      "Press back up to straight arms, keeping the body tight.",
    ],
    watchFor: [
      {
        mistake: "Dropping onto the head at the bottom.",
        fix: "Lower slowly and touch your head down gently. If you cannot control the descent, stay with pike push-ups for now.",
      },
      {
        mistake: "Arching heavily into the wall.",
        fix: "Squeeze your glutes and pull your ribs in so your body stays in a straight line.",
      },
    ],
  },
  "band-pull-apart": {
    setup: [
      "Hold a light band at shoulder width with straight arms at chest height.",
      "Stand tall, shoulders down.",
    ],
    execution: [
      "Pull the band apart until it touches the chest, squeezing the shoulder blades.",
      "Return slowly, keeping tension in the band.",
    ],
    watchFor: [
      {
        mistake: "Shrugging the shoulders up as the band stretches.",
        fix: "Keep your shoulders down away from your ears and move from the back of the shoulder.",
      },
      {
        mistake: "Letting the band snap back between reps.",
        fix: "Control the return. Half the work of the exercise is resisting the band on the way back in.",
      },
    ],
  },
  "rear-delt-row": {
    setup: [
      "Hinge forward with dumbbells or a barbell, or lie chest down on an incline bench.",
      "Grip wider than a normal row.",
    ],
    execution: [
      "Row with the elbows flared out at about 90° from the body, toward the upper chest.",
      "Squeeze the back of the shoulders, then lower under control.",
    ],
    watchFor: [
      {
        mistake: "Elbows drifting in toward the sides.",
        fix: "Keep your elbows out wide. Once they tuck in, the lats take over and it becomes a normal row.",
      },
      {
        mistake: "Going heavy and heaving with the lower back.",
        fix: "Go light. The rear delts are small, and a weight you have to swing is working something else.",
      },
    ],
  },
  "y-raise": {
    setup: [
      "Lie chest down on an incline bench set at about 30–45°.",
      "Light dumbbells hanging straight down, thumbs pointing up.",
    ],
    execution: [
      "Raise the arms up and out at a diagonal to make a Y with the body.",
      "Pause at ear height, then lower slowly.",
    ],
    watchFor: [
      {
        mistake: "Picking weights that are too heavy and shrugging them up.",
        fix: "Use the lightest dumbbells you can find. This works small muscles, and even two to five pounds is plenty for most people.",
      },
      {
        mistake: "Lifting the chest off the bench to get more height.",
        fix: "Keep your chest on the pad and raise only as high as your arms can go on their own.",
      },
    ],
  },
  "cable-external-rotation": {
    setup: [
      "Set a cable at elbow height and stand side-on to it, working the far arm.",
      "Elbow bent to 90° and pinned at your side, a rolled towel between elbow and ribs.",
    ],
    execution: [
      "Rotate the forearm out away from the body, keeping the elbow in place.",
      "Return slowly to the start.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbow drift away from the body.",
        fix: "Keep the towel squeezed between your elbow and ribs. If it falls, your elbow has moved.",
      },
      {
        mistake: "Using a weight that needs the whole body to move.",
        fix: "Go light and slow. Rotator cuff work should feel easy, controlled and a little boring.",
      },
    ],
  },
  "kettlebell-halo": {
    setup: [
      "Hold a light kettlebell upside down by the horns at chest height.",
      "Stand tall with the glutes and abs braced.",
    ],
    execution: [
      "Circle the bell around the head, keeping it close to the neck.",
      "Return to the front and reverse direction on the next rep.",
    ],
    watchFor: [
      {
        mistake: "Moving the head instead of the bell.",
        fix: "Keep your head still and move the bell around it. The shoulders should be doing the moving.",
      },
      {
        mistake: "Arching the back as the bell passes behind the head.",
        fix: "Brace your abs and keep your ribs down. If you cannot, go lighter.",
      },
    ],
  },
  "seated-barbell-press": {
    setup: [
      "Set an upright bench inside a rack, with the bar on pins or hooks just above shoulder height.",
      "Sit with the back against the pad, feet flat, grip just outside the shoulders.",
    ],
    execution: [
      "Unrack and press the bar straight up, moving the head back slightly to clear it.",
      "Lower to the upper chest and press again.",
    ],
    watchFor: [
      {
        mistake: "Arching the lower back off the pad to push the bar up.",
        fix: "Keep your back against the pad and your ribs down. Leaning back turns it into an incline press.",
      },
      {
        mistake: "Pressing the bar forward in front of the face.",
        fix: "Keep the bar close to your face and finish with it over the top of your head.",
      },
    ],
  },
  "behind-the-neck-press": {
    setup: [
      "Only use this if you can hold a bar behind your neck with a wide grip and no discomfort.",
      "Take the bar from a rack on the upper traps, grip wider than for a front press.",
    ],
    execution: [
      "Press the bar straight up from behind the head.",
      "Lower under control to about ear level or the base of the neck.",
    ],
    watchFor: [
      {
        mistake: "Forcing the bar lower than the shoulders allow.",
        fix: "Stop at the depth your shoulders reach comfortably, even if that's the top of your head. Depth that has to be forced isn't worth having here.",
      },
      {
        mistake: "Poking the head forward to make room for the bar.",
        fix: "Keep your head in line with your spine. Lighten the bar if you need to crane your neck to clear it.",
      },
    ],
  },
  "single-arm-db-shoulder-press": {
    setup: [
      "Stand or sit with one dumbbell at the shoulder, palm facing in or forward.",
      "Brace the abs and squeeze the free fist.",
    ],
    execution: [
      "Press the bell straight up until the arm is straight.",
      "Lower back to the shoulder and repeat, then switch sides.",
    ],
    watchFor: [
      {
        mistake: "Leaning away from the dumbbell to get it up.",
        fix: "Stay tall and square. Resisting that lean is the point of pressing one side at a time, so drop the weight if you're tipping.",
      },
      {
        mistake: "Starting with the stronger arm every time.",
        fix: "Start with your weaker arm and match its reps on the stronger side, so the gap closes instead of growing.",
      },
    ],
  },
  "bottoms-up-kb-press": {
    setup: [
      "Pick a kettlebell much lighter than your normal press.",
      "Hold it upside down by the handle, bell above the fist, forearm vertical.",
    ],
    execution: [
      "Squeeze the handle hard and press the bell straight overhead.",
      "Lower slowly back to the start, keeping the bell balanced.",
    ],
    watchFor: [
      {
        mistake: "Loose grip, so the bell tips over.",
        fix: "Crush the handle as hard as you can. The grip is what keeps it upright, and a bell that tips is telling you to squeeze harder or go lighter.",
      },
      {
        mistake: "Standing where a dropped bell could hit you.",
        fix: "Keep your head clear of the bell's path and let it fall away from you if it tips. Never try to save it with your face under it.",
      },
    ],
  },
  "push-jerk": {
    setup: [
      "Bar in the front rack on the shoulders, grip just outside shoulder width.",
      "Feet hip width, weight in the heels, torso upright.",
    ],
    execution: [
      "Dip a few inches at the knees, then drive hard through the legs.",
      "As the bar leaves the shoulders, push yourself down under it into a partial squat.",
      "Catch it on locked arms, then stand up with it overhead.",
    ],
    watchFor: [
      {
        mistake: "Pressing the bar out instead of getting under it.",
        fix: "Punch yourself down under the bar the moment the leg drive ends. The arms should lock it out, not grind it up.",
      },
      {
        mistake: "Dipping forward onto the toes.",
        fix: "Keep your weight through your whole foot and your torso vertical, so the drive goes straight up into the bar.",
      },
    ],
  },
  "split-jerk": {
    setup: [
      "Bar in the front rack, grip just outside the shoulders.",
      "Know which foot goes forward before you start.",
    ],
    execution: [
      "Dip at the knees and drive the bar up hard with the legs.",
      "Split the feet, one forward and one back, dropping under the bar onto locked arms.",
      "Step the front foot back, then the back foot forward, to stand with the bar overhead.",
    ],
    watchFor: [
      {
        mistake: "Landing with the feet in a line, like on a tightrope.",
        fix: "Keep your feet about hip width apart side to side in the split. A narrow landing leaves you nothing to balance on.",
      },
      {
        mistake: "Recovering back foot first.",
        fix: "Bring your front foot back first, then the back foot in. Stepping the back foot first shifts the bar forward and it's easy to lose it.",
      },
    ],
  },
  "viking-press": {
    setup: [
      "Fit a handle attachment to a landmine or step into the viking press machine.",
      "Hold the handles at shoulder height, palms facing in, feet planted.",
    ],
    execution: [
      "Press the handles up along the arc until the arms are straight.",
      "Lower back to the shoulders under control.",
    ],
    watchFor: [
      {
        mistake: "Leaning back to turn it into a chest press.",
        fix: "Squeeze your glutes and keep your ribs down. The arc of the bar already gives you a natural angle.",
      },
      {
        mistake: "Standing too close so the handles hit the face.",
        fix: "Take a step back until the handles clear your chin on the way up. Adjust before you load the bar, not during a set.",
      },
    ],
  },
  "lean-away-lateral-raise": {
    setup: [
      "Hold a sturdy post or rack upright with one hand, feet close to its base.",
      "Lean away until the free arm hangs out from the body with a dumbbell.",
    ],
    execution: [
      "Raise the dumbbell out to the side until the arm is level with the shoulder.",
      "Lower slowly all the way back down, then switch sides after the set.",
    ],
    watchFor: [
      {
        mistake: "Pulling on the post to swing the weight up.",
        fix: "Keep your supporting arm straight and still. It holds the lean and nothing else.",
      },
      {
        mistake: "Using your normal lateral raise dumbbell.",
        fix: "Go a step lighter. The lean makes the bottom of the rep harder, which is exactly where a normal raise is easy.",
      },
    ],
  },
  "band-lateral-raise": {
    setup: [
      "Stand on the middle of a light band, feet hip width.",
      "Hold an end in each hand at your sides, elbows slightly bent.",
    ],
    execution: [
      "Raise the arms out to the sides until they are level with the shoulders.",
      "Lower slowly against the band.",
    ],
    watchFor: [
      {
        mistake: "Shrugging to get the last few inches.",
        fix: "Keep your shoulders down and stop at shoulder height. The band is hardest at the top, so shrugging is the first thing that happens.",
      },
      {
        mistake: "Letting the band snap the arms back down.",
        fix: "Control the lowering. Stand on one end each for less tension if you can't.",
      },
    ],
  },
  "cable-y-raise": {
    setup: [
      "Set both pulleys at the bottom and cross the cables, holding the left in the right hand and the right in the left.",
      "Step back until the stack lifts, arms low and crossed in front of the hips.",
    ],
    execution: [
      "Raise the arms up and out into a Y, thumbs pointing up.",
      "Pause just above shoulder height, then lower slowly back to the cross.",
    ],
    watchFor: [
      {
        mistake: "Shrugging the shoulders up toward the ears.",
        fix: "Keep your shoulders down as the arms rise. The lower traps should be pulling the shoulder blades down, not up.",
      },
      {
        mistake: "Going heavy and arching the back to finish.",
        fix: "Use a light weight and stay tall. This is a small-muscle exercise, and the top of the Y is where it counts.",
      },
    ],
  },
  "side-lying-lateral-raise": {
    setup: [
      "Set a bench to a low incline and lie on your side on it.",
      "Hold a light dumbbell in the top hand, arm hanging across the body.",
    ],
    execution: [
      "Raise the dumbbell up and out until the arm points at the ceiling.",
      "Lower slowly back across the body.",
    ],
    watchFor: [
      {
        mistake: "Rolling back on the bench to help the weight up.",
        fix: "Stay stacked on your side with your hips still. Only your arm should move.",
      },
      {
        mistake: "Rushing the bottom of the rep.",
        fix: "Take your time low down. This version is hardest at the start of the raise, and that's the part it's for.",
      },
    ],
  },
  "landmine-lateral-raise": {
    setup: [
      "Stand side-on to a landmine with the bar end in the far hand.",
      "Hold it low across the front of the hip, arm slightly bent.",
    ],
    execution: [
      "Raise the bar end up and out to the side until the arm is at shoulder height.",
      "Lower slowly back across the body.",
    ],
    watchFor: [
      {
        mistake: "Turning the torso to swing the bar up.",
        fix: "Keep your chest facing forward and your hips still. Stand a little further from the bar if you keep rotating.",
      },
      {
        mistake: "Holding the bar by the very tip so it slips.",
        fix: "Grip the sleeve firmly just below the end, or use a handle attachment so the bar can't slide out.",
      },
    ],
  },
  "cable-upright-row": {
    setup: [
      "Attach a straight bar or rope to a low pulley.",
      "Stand close with a grip about shoulder width.",
    ],
    execution: [
      "Pull the handle up the front of the body, leading with the elbows.",
      "Stop when the elbows reach shoulder height, then lower slowly.",
    ],
    watchFor: [
      {
        mistake: "Pulling the elbows up above the shoulders.",
        fix: "Stop with your elbows level with your shoulders. Higher than that crowds the shoulder joint without working the delts any harder.",
      },
      {
        mistake: "Standing too far from the stack, so the cable drags you forward.",
        fix: "Stand close enough that the cable runs almost straight up your body.",
      },
    ],
  },
  "db-upright-row": {
    setup: [
      "Stand holding a dumbbell in each hand in front of the thighs, palms facing you.",
      "Shoulders down, chest up.",
    ],
    execution: [
      "Lift the bells up the front of the body, leading with the elbows.",
      "Stop when the elbows are level with the shoulders, then lower slowly.",
    ],
    watchFor: [
      {
        mistake: "Pulling the bells up to the chin.",
        fix: "Stop when your elbows reach shoulder height. The bells can end lower than the chin, and that's fine.",
      },
      {
        mistake: "Hitching the hips to swing the weight.",
        fix: "Stand still and let the shoulders lift the weight. If you need a hip drive, the bells are too heavy.",
      },
    ],
  },
  "barbell-front-raise": {
    setup: [
      "Stand holding a barbell or EZ bar with an overhand grip at shoulder width.",
      "Bar resting against the thighs, arms straight with a soft bend.",
    ],
    execution: [
      "Raise the bar in front of you to shoulder height.",
      "Lower slowly back to the thighs.",
    ],
    watchFor: [
      {
        mistake: "Leaning back to swing the bar up.",
        fix: "Brace your abs and keep your torso still. If you have to lean, the bar is too heavy.",
      },
      {
        mistake: "Raising the bar above the head.",
        fix: "Stop at shoulder or eye height. Higher than that shifts the work to the traps without adding anything for the front delts.",
      },
    ],
  },
  "side-lying-rear-delt-raise": {
    setup: [
      "Lie on your side on a flat bench, a light dumbbell in the top hand.",
      "Let the arm hang down in front of the chest with a slight bend.",
    ],
    execution: [
      "Raise the dumbbell up and slightly back until the arm points at the ceiling.",
      "Lower slowly back down in front of you.",
    ],
    watchFor: [
      {
        mistake: "Rolling the body back to help lift.",
        fix: "Stay on your side with your hips stacked. The bench is there to stop you cheating, so let it.",
      },
      {
        mistake: "Bending the elbow more and more to shorten the lever.",
        fix: "Keep the same slight bend all set. Use a lighter bell if the arm keeps folding.",
      },
    ],
  },
  "single-arm-cable-rear-delt": {
    setup: [
      "Set a pulley at shoulder height and stand side-on to it.",
      "Reach across the body with the far hand and grip the handle or cable end.",
    ],
    execution: [
      "Pull the arm back across and out to the side, keeping it nearly straight.",
      "Stop when the arm is in line with the shoulders, then return slowly.",
    ],
    watchFor: [
      {
        mistake: "Turning the torso away from the cable.",
        fix: "Keep your chest facing forward. If your whole body turns, the back and hips are doing the pulling.",
      },
      {
        mistake: "Bending the elbow into a row.",
        fix: "Keep the arm long with a soft bend. Once the elbow bends, the lats and biceps take over from the rear delt.",
      },
    ],
  },
  "cuban-press": {
    setup: [
      "Stand with light dumbbells or an empty bar, overhand grip.",
      "Start with the arms hanging in front of the thighs.",
    ],
    execution: [
      "Pull up into an upright row until the upper arms are level with the shoulders.",
      "Keeping the elbows high, rotate the forearms up until the hands are above the elbows.",
      "Press overhead, then reverse each step back down.",
    ],
    watchFor: [
      {
        mistake: "Going heavy.",
        fix: "Use a very light weight. The rotation step is limited by the small rotator cuff muscles, and they tire long before the delts.",
      },
      {
        mistake: "Dropping the elbows during the rotation.",
        fix: "Keep your elbows at shoulder height while the forearms turn up, so the rotation happens at the shoulder.",
      },
    ],
  },
  "side-lying-external-rotation": {
    setup: [
      "Lie on your side with the top elbow bent to 90° and pinned to your ribs.",
      "Hold a light dumbbell with the forearm resting across the stomach.",
      "A rolled towel between elbow and ribs helps.",
    ],
    execution: [
      "Rotate the forearm up away from the body, keeping the elbow in place.",
      "Lower slowly back to the stomach.",
    ],
    watchFor: [
      {
        mistake: "Lifting the elbow off the ribs to raise the weight higher.",
        fix: "Keep the towel squeezed in place. The range is short, and that's normal for this movement.",
      },
      {
        mistake: "Choosing a dumbbell that needs a heave to move.",
        fix: "Go very light, often two to five pounds. Rotator cuff work should feel slow and controlled.",
      },
    ],
  },
  "cable-internal-rotation": {
    setup: [
      "Set a cable at elbow height and stand side-on, working the near arm.",
      "Elbow bent to 90° and pinned at your side, forearm pointing out toward the cable.",
    ],
    execution: [
      "Rotate the forearm in across the stomach, keeping the elbow in place.",
      "Return slowly to the start.",
    ],
    watchFor: [
      {
        mistake: "Twisting the torso to bring the hand across.",
        fix: "Keep your hips and chest still. Only the forearm should swing, like a gate on a hinge.",
      },
      {
        mistake: "Elbow drifting forward or away from the body.",
        fix: "Keep a towel squeezed between your elbow and ribs. If it drops, your elbow has moved.",
      },
    ],
  },
  "wall-walk": {
    setup: [
      "Lie face down with the feet against a wall and the hands by the chest.",
      "Press up into a push-up position.",
    ],
    execution: [
      "Walk the feet up the wall while walking the hands back toward it.",
      "Go as close to the wall as you can control, ideally chest to wall.",
      "Walk back down the same way, one step at a time.",
    ],
    watchFor: [
      {
        mistake: "Letting the lower back arch as you get close to the wall.",
        fix: "Squeeze your glutes and pull your ribs in. Stop further from the wall until you can hold a straight line.",
      },
      {
        mistake: "Dropping down from the top instead of walking out.",
        fix: "Walk the hands out and the feet down in small steps. Coming down is the part most people lose control of.",
      },
    ],
  },
  "handstand-hold": {
    setup: [
      "Face a wall and place the hands shoulder width about a hand's length from it.",
      "Kick up so the heels rest on the wall, or walk up it chest-first.",
    ],
    execution: [
      "Push the floor away with straight arms and hold.",
      "Keep the body in one line with the ribs pulled in and the legs together.",
      "Come down before the arms give out.",
    ],
    watchFor: [
      {
        mistake: "Sinking into the shoulders with bent arms.",
        fix: "Lock your elbows and push tall through your shoulders, as if trying to lift yourself off the floor.",
      },
      {
        mistake: "Holding until the arms buckle.",
        fix: "Come down while you still have strength left. Know how to cartwheel or step out before you try it away from the wall.",
      },
    ],
  },
  "barbell-curl": {
    setup: [
      "Bar at arm's length, grip about shoulder width, palms up.",
      "Elbows pinned at the sides, ribs down.",
    ],
    execution: [
      "Curl to shoulder height without letting the elbows drift forward.",
      "Lower all the way to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Swinging the hips to start each rep.",
        fix: "Stand still, or put your back against a wall. Momentum takes the work off the muscle you came for.",
      },
      {
        mistake: "Stopping halfway down, which skips the part that builds the most.",
        fix: "Straighten your arms fully every rep. The stretched position does most of the growing.",
      },
    ],
  },
  "ez-bar-curl": {
    setup: [
      "Grip the angled sections, palms up, elbows at the sides.",
      "Stand tall with the ribs down.",
    ],
    execution: [
      "Curl to shoulder height, lower to full extension.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbows travel forward at the top.",
        fix: "Keep them pinned at your sides. Once they swing forward, your shoulders are lifting the weight.",
      },
    ],
  },
  "dumbbell-curl": {
    setup: [
      "A bell in each hand, palms forward, elbows at the sides.",
      "Shoulders down, ribs braced.",
    ],
    execution: [
      "Curl both together or alternate, to shoulder height.",
      "Lower fully under control.",
    ],
    watchFor: [
      {
        mistake: "Leaning back to heave the bells up.",
        fix: "Brace and go lighter. The lean is your lower back curling for you.",
      },
    ],
  },
  "hammer-curl": {
    setup: [
      "Bells at the sides, palms facing in, and they stay that way.",
      "Elbows pinned, chest up.",
    ],
    execution: [
      "Curl straight up keeping the neutral grip.",
      "Lower to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Rotating the palms, which turns it into a standard curl.",
        fix: "Keep your palms facing each other the whole way — that neutral grip is the point.",
      },
    ],
  },
  "incline-hammer-curl": {
    setup: [
      "Bench at about 45°, arms hanging back behind the torso.",
      "Neutral grip throughout.",
    ],
    execution: [
      "Curl up keeping the elbows still, then lower to a deep stretch.",
    ],
    watchFor: [
      {
        mistake: "Swinging the shoulders forward to start the rep.",
        fix: "Let your arms hang behind you and keep them there. That stretch is why you chose the incline.",
      },
    ],
  },
  "incline-curl": {
    setup: [
      "Bench at about 45°, bells hanging with the arms behind the body.",
      "Palms forward, shoulders relaxed down.",
    ],
    execution: [
      "Curl up without moving the elbows, then lower to a full stretch.",
    ],
    watchFor: [
      {
        mistake: "Letting the shoulders roll forward, which kills the stretch that makes this useful.",
        fix: "Keep your shoulders back against the bench and let only your elbows move.",
      },
    ],
  },
  "preacher-curl": {
    setup: [
      "Armpits over the top of the pad, upper arms flat against it.",
      "Grip a bar or bell with the palms up.",
    ],
    execution: [
      "Curl up to about three-quarters, keeping tension.",
      "Lower slowly to nearly straight — this bottom is where injuries happen if you drop it.",
    ],
    watchFor: [
      {
        mistake: "Bouncing out of the bottom with a heavy weight.",
        fix: "Lower slowly and pause. A preacher bench puts your elbow in its weakest position at the bottom.",
      },
    ],
  },
  "spider-curl": {
    setup: [
      "Chest against the upright side of a preacher bench, arms hanging straight down.",
      "Palms up, elbows still.",
    ],
    execution: [
      "Curl up to a hard squeeze, then lower to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Rocking the chest off the pad.",
        fix: "Stay flat against it. Rocking is how you turn a strict curl into a sloppy one.",
      },
    ],
  },
  "cable-curl": {
    setup: [
      "Low pulley, bar or handle, elbows at the sides.",
      "Step back far enough to keep tension at the bottom.",
    ],
    execution: [
      "Curl up to shoulder height, lower under control.",
    ],
    watchFor: [
      {
        mistake: "Letting the stack land between reps.",
        fix: "Stop just short of the bottom so tension stays on the whole set.",
      },
    ],
  },
  "cable-hammer-curl": {
    setup: [
      "Rope on a low pulley, neutral grip, elbows pinned.",
      "Stand tall.",
    ],
    execution: [
      "Curl up keeping the palms facing each other, then lower fully.",
    ],
    watchFor: [
      {
        mistake: "Pulling the rope apart at the top instead of just curling.",
        fix: "Keep your hands the same distance apart and just curl.",
      },
    ],
  },
  "high-cable-curl": {
    setup: [
      "Two high pulleys, a handle in each hand, arms out at shoulder height.",
      "Stand in the middle, chest up.",
    ],
    execution: [
      "Curl the hands toward the ears without dropping the elbows.",
      "Return to straight arms under control.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbows fall as you tire.",
        fix: "Hold them at shoulder height. Dropping them turns the curl into a pulldown.",
      },
    ],
  },
  "concentration-curl": {
    setup: [
      "Seated, elbow braced against the inside of the thigh.",
      "Arm hanging straight down, palm up.",
    ],
    execution: [
      "Curl to the shoulder, squeeze, and lower to full extension.",
    ],
    watchFor: [
      {
        mistake: "Using the leg to push the arm up.",
        fix: "Brace your elbow against your thigh but do not push with it — the arm lifts alone.",
      },
    ],
  },
  "zottman-curl": {
    setup: [
      "Bells at the sides, palms up to start.",
      "Elbows pinned.",
    ],
    execution: [
      "Curl up with the palms up, rotate to palms down at the top.",
      "Lower slowly in the palms-down position, then rotate back.",
    ],
    watchFor: [
      {
        mistake: "Rushing the lowering phase, which is the whole point of the movement.",
        fix: "Take three seconds down with your palm facing the floor. That eccentric is why Zottman curls exist.",
      },
    ],
  },
  "machine-curl": {
    setup: [
      "Seat and pad set so the elbows line up with the machine's pivot.",
      "Chest against the pad.",
    ],
    execution: [
      "Curl up to a squeeze, lower to nearly straight.",
    ],
    watchFor: [
      {
        mistake: "Elbows off the pivot, which loads the joint at an angle.",
        fix: "Adjust the seat until your elbows sit right on the machine's hinge.",
      },
    ],
  },
  "bayesian-curl": {
    setup: [
      "Set a cable low and stand facing away from it, handle in one hand.",
      "Step forward so the arm is pulled back behind the body.",
    ],
    execution: [
      "Curl the handle forward and up, keeping the elbow behind the torso.",
      "Lower slowly until the arm is fully straight and stretched behind you.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbow swing forward as you curl.",
        fix: "Keep your upper arm pointing down and slightly back. The stretched start is the reason to do this curl.",
      },
      {
        mistake: "Standing too close so the cable goes slack at the bottom.",
        fix: "Step forward until the cable is pulling your arm back even when it is straight.",
      },
    ],
  },
  "drag-curl": {
    setup: [
      "Stand holding a barbell with an underhand grip at shoulder width.",
      "Let the bar touch the front of your thighs.",
    ],
    execution: [
      "Curl the bar up while pulling the elbows back, dragging it up your body.",
      "Stop at the lower chest, squeeze, then lower along the same path.",
    ],
    watchFor: [
      {
        mistake: "Letting the bar drift away from the body.",
        fix: "Keep the bar in contact with your torso the whole way up. If it floats out, it has become a normal curl.",
      },
      {
        mistake: "Leaning back to help the bar up.",
        fix: "Stay upright and let your elbows travel back instead of your shoulders.",
      },
    ],
  },
  "cross-body-hammer-curl": {
    setup: [
      "Stand holding dumbbells at your sides, palms facing in.",
      "Elbows close to the body.",
    ],
    execution: [
      "Curl one bell across the body toward the opposite shoulder, keeping the palm facing in.",
      "Lower under control and alternate arms.",
    ],
    watchFor: [
      {
        mistake: "Swinging the torso to throw the bell across.",
        fix: "Keep your body still and move only your forearm. Lighter bells with a clean path do more.",
      },
      {
        mistake: "Rushing the lowering phase.",
        fix: "Take two seconds on the way down. The brachialis responds well to a slow, controlled lower.",
      },
    ],
  },
  "band-curl": {
    setup: [
      "Stand on the middle of the band with the feet hip width.",
      "Hold the ends with the palms facing forward, elbows at the sides.",
    ],
    execution: [
      "Curl the hands up to the shoulders and squeeze.",
      "Lower slowly against the band's pull.",
    ],
    watchFor: [
      {
        mistake: "Letting the band snap the hands back down.",
        fix: "Control the lowering. A band pulls hardest at the top and will yank your arms back down if you let it.",
      },
      {
        mistake: "Elbows drifting forward to shorten the stretch.",
        fix: "Keep your elbows pinned at your sides. Widen your stance on the band for more tension instead.",
      },
    ],
  },
  "db-preacher-curl": {
    setup: [
      "Set the preacher seat so the armpit sits snug over the top of the pad.",
      "Hold one dumbbell with the back of the upper arm flat on the pad.",
    ],
    execution: [
      "Curl the dumbbell up until the forearm is nearly vertical.",
      "Lower slowly until the arm is almost straight, then switch sides after the set.",
    ],
    watchFor: [
      {
        mistake: "Dropping fast into the bottom and bouncing out of it.",
        fix: "Lower under control and stop just short of locking out. The bottom is where the arm is most exposed on a preacher.",
      },
      {
        mistake: "Lifting the elbow off the pad to finish the rep.",
        fix: "Keep your upper arm pressed into the pad. If it lifts, the dumbbell is too heavy.",
      },
    ],
  },
  "cable-preacher-curl": {
    setup: [
      "Place a preacher bench in front of a low pulley with a straight bar or EZ attachment.",
      "Sit with the armpits over the pad and the cable running up to the hands.",
    ],
    execution: [
      "Curl the bar up toward the shoulders and squeeze at the top.",
      "Lower slowly until the arms are nearly straight.",
    ],
    watchFor: [
      {
        mistake: "Bench too close to the stack, so the cable pulls straight up.",
        fix: "Move the bench back until the cable pulls toward the pulley at an angle. That angle is what keeps tension on at the top.",
      },
      {
        mistake: "Lifting the elbows off the pad to finish.",
        fix: "Keep the backs of your arms on the pad the whole rep and let only the forearms move.",
      },
    ],
  },
  "hammer-preacher-curl": {
    setup: [
      "Set the preacher seat so the armpit sits over the pad.",
      "Hold a dumbbell with the palm facing in, thumb up.",
    ],
    execution: [
      "Curl the dumbbell up, keeping the palm facing in.",
      "Lower slowly until the arm is nearly straight.",
    ],
    watchFor: [
      {
        mistake: "Letting the wrist turn palm-up as you curl.",
        fix: "Keep your thumb pointing up the whole rep. The neutral grip is what shifts the work to the brachialis.",
      },
      {
        mistake: "Letting the dumbbell drop at the bottom.",
        fix: "Control the lowering and stop short of a hard lockout, the same as any preacher curl.",
      },
    ],
  },
  "single-arm-cable-curl": {
    setup: [
      "Set a pulley at the bottom with a single handle.",
      "Stand facing the stack, handle in one hand, elbow at your side.",
    ],
    execution: [
      "Curl the handle up, turning the palm up as you go.",
      "Lower slowly until the arm is straight, then switch sides.",
    ],
    watchFor: [
      {
        mistake: "Leaning back to help the weight up.",
        fix: "Stand tall and brace. A light single-arm curl should never need your lower back.",
      },
      {
        mistake: "Letting the elbow drift forward at the top.",
        fix: "Keep your elbow by your side. Once it moves forward, the front of the shoulder starts helping.",
      },
    ],
  },
  "wide-grip-barbell-curl": {
    setup: [
      "Stand holding a barbell underhand, hands a little wider than the shoulders.",
      "Elbows at your sides, shoulders back.",
    ],
    execution: [
      "Curl the bar up to the shoulders, keeping the elbows still.",
      "Lower under control to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Going so wide the wrists bend back.",
        fix: "Bring the grip in until your wrists stay straight. A slightly wide grip does the job, and more just strains the wrist.",
      },
      {
        mistake: "Swinging the bar up with the hips.",
        fix: "Stay upright and use a weight you can curl without momentum.",
      },
    ],
  },
  "close-grip-ez-curl": {
    setup: [
      "Stand holding an EZ bar on the inner bends, hands a few inches apart.",
      "Elbows at your sides, shoulders back.",
    ],
    execution: [
      "Curl the bar up toward the chin, keeping the elbows by the ribs.",
      "Lower slowly to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Elbows flaring out to the sides as you curl.",
        fix: "Keep your elbows tucked into your ribs. A narrow grip tends to push them out, so think about keeping them close.",
      },
      {
        mistake: "Cutting the rep short at the bottom.",
        fix: "Straighten your arms fully at the bottom of each rep. Half reps at a close grip mostly train the forearms.",
      },
    ],
  },
  "waiter-curl": {
    setup: [
      "Hold one dumbbell upright with both palms flat under the top plate.",
      "Let it hang in front of you, elbows at your sides.",
    ],
    execution: [
      "Curl the dumbbell up to chest height, keeping it upright.",
      "Squeeze at the top, then lower slowly.",
    ],
    watchFor: [
      {
        mistake: "Letting the dumbbell tilt toward you.",
        fix: "Keep the handle vertical the whole rep. Pressing your palms up into the plate keeps it level.",
      },
      {
        mistake: "Wrapping the fingers around the handle.",
        fix: "Keep your palms open under the plate. Gripping the handle turns it back into a regular curl.",
      },
    ],
  },
  "bodyweight-bicep-curl": {
    setup: [
      "Hold rings or a bar set at about chest height with an underhand grip.",
      "Walk the feet forward and lean back until the arms are straight, body in one line.",
    ],
    execution: [
      "Curl yourself up by bending only the elbows, bringing the hands toward the forehead.",
      "Lower back to straight arms under control.",
    ],
    watchFor: [
      {
        mistake: "Pulling with the back so it becomes a row.",
        fix: "Keep your elbows pointing forward and let them bend without dropping to your sides. The hands go to your forehead, not your chest.",
      },
      {
        mistake: "Hips sagging as you pull.",
        fix: "Squeeze your glutes and hold a straight line. Step your feet back to make it easier rather than bending in the middle.",
      },
    ],
  },
  "kettlebell-curl": {
    setup: [
      "Hold a kettlebell by the handle with the bell hanging below, palm forward.",
      "Elbow at your side, standing tall.",
    ],
    execution: [
      "Curl the bell up to the shoulder, keeping the wrist straight.",
      "Lower slowly to a straight arm.",
    ],
    watchFor: [
      {
        mistake: "Letting the bell pull the wrist back.",
        fix: "Grip the handle firmly and keep your wrist in line with your forearm. The offset weight will try to bend it, so fight that.",
      },
      {
        mistake: "Swinging the bell up with the body.",
        fix: "Stand still and curl with the arm alone. A lighter bell with a clean curl beats a heavy one with a hip swing.",
      },
    ],
  },
  "lying-cable-curl": {
    setup: [
      "Lie on your back on the floor with the feet toward a low pulley.",
      "Hold a straight bar with an underhand grip, arms straight and elbows by your sides.",
    ],
    execution: [
      "Curl the bar up toward the shoulders, keeping the upper arms on the floor.",
      "Lower slowly back to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Lifting the elbows off the floor to finish the curl.",
        fix: "Keep the backs of your upper arms on the floor. The floor is what makes this curl strict.",
      },
      {
        mistake: "Lying too close to the pulley so the cable goes slack.",
        fix: "Slide back until the weight stays lifted when your arms are straight.",
      },
    ],
  },
  "close-grip-bench": {
    setup: [
      "Grip about shoulder width — no narrower, or the wrists complain.",
      "Shoulder blades retracted, feet planted.",
    ],
    execution: [
      "Lower to the lower chest with the elbows tucked close to the ribs.",
      "Press back up, driving through the triceps.",
    ],
    watchFor: [
      {
        mistake: "Gripping so narrow the hands touch, which strains the wrists.",
        fix: "Set your hands about shoulder width. Close-grip means closer than normal, not touching.",
      },
      {
        mistake: "Letting the elbows flare, which hands it back to the chest.",
        fix: "Tuck them close to your ribs the whole way down.",
      },
    ],
  },
  "jm-press": {
    setup: [
      "Close-ish grip, bar over the shoulders, elbows tucked.",
      "Retract the shoulder blades.",
    ],
    execution: [
      "Lower the bar toward the upper chest and throat in a shallow arc.",
      "Press back up along the same path.",
    ],
    watchFor: [
      {
        mistake: "Going heavy before the movement is grooved — it is hard on the elbows.",
        fix: "Learn the path with an empty bar for a few sessions before adding plates.",
      },
    ],
  },
  "skull-crusher": {
    setup: [
      "Lie flat, bar or EZ bar pressed over the shoulders.",
      "Upper arms angled slightly back, elbows fixed.",
    ],
    execution: [
      "Lower to just above the forehead by bending only at the elbow.",
      "Press back up without letting the upper arms drift.",
    ],
    watchFor: [
      {
        mistake: "Flaring the elbows out to move more weight.",
        fix: "Keep them pointing at the ceiling. Flaring recruits your chest and cheats the triceps.",
      },
      {
        mistake: "Letting the upper arms swing, which turns it into a press.",
        fix: "Freeze your upper arms and bend only at the elbow.",
      },
    ],
  },
  "tricep-pushdown": {
    setup: [
      "High pulley, straight bar, elbows pinned at the sides.",
      "Stand tall with a small forward lean.",
    ],
    execution: [
      "Push down until the arms are straight, squeeze.",
      "Let the bar rise until the forearms are past parallel.",
    ],
    watchFor: [
      {
        mistake: "Leaning over the bar and pressing with the chest.",
        fix: "Stand tall with a small lean and keep your elbows at your sides.",
      },
      {
        mistake: "Elbows drifting forward and back through the rep.",
        fix: "Pin them to your ribs; only your forearms should move.",
      },
    ],
  },
  "rope-pushdown": {
    setup: [
      "Rope on a high pulley, elbows at the sides.",
      "Neutral grip, thumbs up.",
    ],
    execution: [
      "Push down and spread the rope ends apart at the bottom.",
      "Return under control to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Never separating the rope, which loses the best part of the contraction.",
        fix: "Spread the ends apart at the bottom and squeeze.",
      },
    ],
  },
  "single-arm-pushdown": {
    setup: [
      "High pulley, one handle, palm down or neutral.",
      "Elbow pinned to the side.",
    ],
    execution: [
      "Push down to a straight arm and squeeze.",
      "Return under control.",
    ],
    watchFor: [
      {
        mistake: "Letting the shoulder rotate to help.",
        fix: "Keep your upper arm still and square. If it turns, go lighter.",
      },
    ],
  },
  "reverse-grip-pushdown": {
    setup: [
      "High pulley, straight bar, palms facing up.",
      "Elbows tight to the sides.",
    ],
    execution: [
      "Push down to straight arms, squeeze, and return under control.",
    ],
    watchFor: [
      {
        mistake: "Gripping so hard the forearms fail before the triceps do.",
        fix: "Hold the bar just firmly enough to control it — this is a triceps exercise.",
      },
    ],
  },
  "overhead-tricep": {
    setup: [
      "Weight held overhead with both hands, elbows pointing forward.",
      "Ribs down, core braced.",
    ],
    execution: [
      "Lower behind the head until you feel the stretch.",
      "Press back up without letting the elbows flare.",
    ],
    watchFor: [
      {
        mistake: "Arching the lower back to get the weight overhead.",
        fix: "Brace your midsection and pull your ribs down. If you cannot get it overhead braced, it is too heavy.",
      },
    ],
  },
  "cable-overhead-extension": {
    setup: [
      "Rope on a low or high pulley, face away, rope behind the head.",
      "Split stance, elbows pointing forward.",
    ],
    execution: [
      "Extend the arms overhead, spreading the rope at the top.",
      "Lower to a deep stretch behind the head.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbows flare wide as the set gets hard.",
        fix: "Keep them pointing forward and close to your head.",
      },
    ],
  },
  "db-overhead-extension": {
    setup: [
      "One bell held with both hands overhead, or one per arm.",
      "Elbows forward, ribs down.",
    ],
    execution: [
      "Lower behind the head to a stretch, then press back up.",
    ],
    watchFor: [
      {
        mistake: "Dropping the bell behind the head faster than you can control.",
        fix: "Lower it deliberately. Behind your head is the one place you cannot catch it.",
      },
    ],
  },
  "machine-tricep-extension": {
    setup: [
      "Seat set so the elbows line up with the pivot.",
      "Back against the pad.",
    ],
    execution: [
      "Extend to straight arms, squeeze, return under control.",
    ],
    watchFor: [
      {
        mistake: "Letting the stack land at the top of each rep.",
        fix: "Stop just short so tension stays on.",
      },
    ],
  },
  "dips-tricep": {
    setup: [
      "Parallel bars, arms locked, torso as upright as you can hold it.",
      "Shoulders pulled down away from the ears.",
    ],
    execution: [
      "Lower until the upper arms are about parallel, elbows tracking back.",
      "Press back to lockout staying upright.",
    ],
    watchFor: [
      {
        mistake: "Leaning forward, which shifts the work to the chest.",
        fix: "Stay as upright as you can hold. Forward lean is a chest dip.",
      },
      {
        mistake: "Dropping deeper than the shoulder is comfortable with.",
        fix: "Stop at upper arms parallel. Deeper adds shoulder strain, not triceps.",
      },
    ],
  },
  "bench-dips": {
    setup: [
      "Hands on a bench behind you, legs out in front.",
      "Shoulders down, chest up.",
    ],
    execution: [
      "Lower until the upper arms are about parallel.",
      "Press back up to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Going very deep — this position is hard on the front of the shoulder.",
        fix: "Stop at upper arms parallel. Bench dips put your shoulder in a rotated position that does not like depth.",
      },
    ],
  },
  "diamond-push-up": {
    setup: [
      "Hands together under the chest, index fingers and thumbs touching.",
      "Body in one line, core braced.",
    ],
    execution: [
      "Lower with the elbows tracking back along the ribs.",
      "Press back to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Hips sagging as the triceps tire.",
        fix: "Squeeze your glutes and hold the line, or drop to your knees for the last reps.",
      },
    ],
  },
  "kickback": {
    setup: [
      "Hinge forward, upper arm parallel to the torso and pinned there.",
      "Bell in hand, elbow bent to 90°.",
    ],
    execution: [
      "Straighten the arm back, squeeze at the top.",
      "Return to 90° under control.",
    ],
    watchFor: [
      {
        mistake: "Swinging the upper arm instead of moving only at the elbow.",
        fix: "Pin your upper arm parallel to your torso and hold it there.",
      },
    ],
  },
  "tate-press": {
    setup: [
      "Lie flat on a bench with dumbbells pressed up over the chest.",
      "Turn the palms to face your feet, bells end to end.",
    ],
    execution: [
      "Bend the elbows out to the sides and lower the inner heads of the bells to your chest.",
      "Extend back up by straightening the elbows, keeping the upper arms still.",
    ],
    watchFor: [
      {
        mistake: "Letting the upper arms move so it becomes a press.",
        fix: "Keep your upper arms fixed and move only at your elbows. The triceps do the work, not the chest.",
      },
      {
        mistake: "Going heavy and dropping the bells onto the chest.",
        fix: "Choose light bells and lower slowly. This is a finishing exercise, not one to max out.",
      },
    ],
  },
  "cable-tricep-kickback": {
    setup: [
      "Set a cable low and take the cable end or a handle in one hand.",
      "Hinge forward with the upper arm tucked tight to the side, parallel to the floor.",
    ],
    execution: [
      "Straighten the arm back until it is fully extended, and squeeze.",
      "Bend back to 90° under control.",
    ],
    watchFor: [
      {
        mistake: "Swinging the upper arm to move the weight.",
        fix: "Keep your upper arm parallel to the floor and still. Only your forearm should move.",
      },
      {
        mistake: "Stopping short of a full lockout.",
        fix: "Straighten your arm completely and hold for a moment. The squeeze at the end is what this exercise is for.",
      },
    ],
  },
  "cross-body-cable-extension": {
    setup: [
      "Set a cable at shoulder height and stand side-on, reaching across with the far hand.",
      "Grip the cable end with the elbow bent and the hand near the opposite shoulder.",
    ],
    execution: [
      "Extend the arm out across the body until it is straight.",
      "Return under control until the hand is back by the shoulder.",
    ],
    watchFor: [
      {
        mistake: "Pulling the elbow back like a row instead of extending it.",
        fix: "Keep your elbow at the same height and straighten your arm from the elbow, like a sideways pushdown.",
      },
      {
        mistake: "Turning the torso away from the cable to finish.",
        fix: "Keep your chest facing forward and let only your arm move.",
      },
    ],
  },
  "bodyweight-tricep-extension": {
    setup: [
      "Set a bar in a rack or Smith machine around hip height, or lower to make it harder.",
      "Grip it shoulder width and walk the feet back into a straight plank.",
    ],
    execution: [
      "Bend only the elbows, lowering the head under the bar.",
      "Push back out to straight arms by extending the elbows.",
    ],
    watchFor: [
      {
        mistake: "Hips sagging or piking as you lower.",
        fix: "Keep your body in a straight plank. Raise the bar if you cannot hold the line.",
      },
      {
        mistake: "Letting the elbows flare wide.",
        fix: "Keep your elbows pointing at the floor, roughly shoulder width, the same as a skull crusher.",
      },
    ],
  },
  "assisted-dip": {
    setup: [
      "Set the assistance, then kneel or stand on the pad and grip the handles.",
      "Start at the top with the arms straight and the chest up.",
      "Log the assistance as a negative weight so progress shows as it goes down.",
    ],
    execution: [
      "Lower until the upper arms are about parallel with the floor.",
      "Press back up to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Sinking deeper than the shoulders are comfortable with.",
        fix: "Stop at upper arms parallel. Going deeper mostly stretches the front of the shoulder.",
      },
      {
        mistake: "Never reducing the assistance.",
        fix: "Take some off whenever you reach the top of your rep range, until you can do full dips on your own.",
      },
    ],
  },
  "incline-skull-crusher": {
    setup: [
      "Set a bench to about 30° and lie back holding an EZ bar or dumbbells.",
      "Press the weight up, then let the arms tilt back slightly past vertical.",
    ],
    execution: [
      "Bend the elbows and lower the weight behind the top of the head.",
      "Extend back up to the start without moving the upper arms.",
    ],
    watchFor: [
      {
        mistake: "Letting the upper arms swing forward so it turns into a press.",
        fix: "Keep your upper arms angled back and still. Only your elbows should bend.",
      },
      {
        mistake: "Elbows flaring wide as the weight comes down.",
        fix: "Keep your elbows pointing up and about shoulder width apart. A narrower EZ grip helps if they keep drifting out.",
      },
    ],
  },
  "decline-skull-crusher": {
    setup: [
      "Set a bench to a slight decline and hook the legs in.",
      "Hold an EZ bar or dumbbells over the chest with straight arms.",
    ],
    execution: [
      "Bend the elbows and lower the weight toward the forehead.",
      "Extend back to straight arms, keeping the upper arms still.",
    ],
    watchFor: [
      {
        mistake: "Bringing the arms forward to vertical so the triceps rest at the top.",
        fix: "Keep your arms tilted slightly back toward your head. That small angle keeps the triceps working at lockout.",
      },
      {
        mistake: "Losing control of the weight near the face.",
        fix: "Lower slowly and go lighter than on a flat bench. The decline makes it harder to bail out, so have a spotter for heavy sets.",
      },
    ],
  },
  "cable-skull-crusher": {
    setup: [
      "Place a flat bench in front of a low pulley with a bar or rope attached.",
      "Lie with the head toward the stack, arms straight up over the face holding the attachment.",
    ],
    execution: [
      "Bend the elbows and lower the hands toward the forehead.",
      "Extend back to straight arms and squeeze.",
    ],
    watchFor: [
      {
        mistake: "Letting the cable pull the upper arms back toward the stack.",
        fix: "Keep your upper arms pointing up and still. If the cable drags them back, the stack is too heavy.",
      },
      {
        mistake: "Bench too close to the pulley so the cable runs along the body.",
        fix: "Slide the bench away until the cable pulls back at an angle over your head. That's what keeps tension on at lockout.",
      },
    ],
  },
  "single-arm-overhead-extension": {
    setup: [
      "Sit on an upright bench or stand, holding one dumbbell overhead.",
      "Upper arm beside the head, elbow pointing up.",
    ],
    execution: [
      "Bend the elbow and lower the dumbbell behind the head.",
      "Extend back to a straight arm, then switch sides after the set.",
    ],
    watchFor: [
      {
        mistake: "Elbow drifting out to the side.",
        fix: "Keep your elbow pointing at the ceiling. Support it lightly with the free hand if it keeps wandering.",
      },
      {
        mistake: "Arching the lower back to get the weight up.",
        fix: "Brace your abs and keep your ribs down. Sitting on a bench with back support makes that easier.",
      },
    ],
  },
  "ez-bar-overhead-extension": {
    setup: [
      "Sit on an upright bench and hold an EZ bar overhead on the inner or outer bends.",
      "Arms straight, elbows pointing up.",
    ],
    execution: [
      "Bend the elbows and lower the bar behind the head.",
      "Extend back to straight arms without moving the upper arms.",
    ],
    watchFor: [
      {
        mistake: "Elbows flaring wide as the bar lowers.",
        fix: "Keep your elbows about shoulder width and pointing up. A narrower grip on the bar helps.",
      },
      {
        mistake: "Starting too heavy to control behind the head.",
        fix: "Begin light and add weight slowly. Getting a heavy bar back overhead from behind the neck is awkward, so leave room.",
      },
    ],
  },
  "smith-close-grip-bench": {
    setup: [
      "Set a flat bench under the Smith bar so it lines up with the lower chest.",
      "Grip about shoulder width and set the safety stops just below the chest.",
    ],
    execution: [
      "Twist the bar off the hooks and lower it to the lower chest, elbows tucked.",
      "Press back up to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Hands so close the wrists bend in.",
        fix: "Keep your hands about shoulder width. Closer doesn't add triceps work, and it strains the wrists.",
      },
      {
        mistake: "Elbows flaring out as you press.",
        fix: "Keep your elbows close to your sides the whole rep. Flaring shifts the work back to the chest.",
      },
    ],
  },
  "band-pushdown": {
    setup: [
      "Loop a band over a pull-up bar or high anchor.",
      "Hold the ends with the elbows bent and tucked at your sides.",
    ],
    execution: [
      "Push the hands down until the arms are straight, and squeeze.",
      "Let the hands rise back to chest height under control.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbows drift forward and up as the band pulls.",
        fix: "Keep your elbows pinned at your sides. Step back for more tension instead of leaning over the band.",
      },
      {
        mistake: "Letting the band snap the hands back up.",
        fix: "Control the way up. Resisting the band on the return is half the work.",
      },
    ],
  },
  "band-overhead-extension": {
    setup: [
      "Anchor a band low behind you, or stand on it with one foot.",
      "Hold the band behind the head with the elbows bent and pointing up.",
    ],
    execution: [
      "Extend the arms overhead until they are straight.",
      "Lower the hands back behind the head slowly.",
    ],
    watchFor: [
      {
        mistake: "Elbows flaring out wide.",
        fix: "Keep your elbows pointing up, close to your head. Wide elbows turn it into more of a shoulder movement.",
      },
      {
        mistake: "Leaning forward to stretch the band.",
        fix: "Stand tall with a staggered stance and keep your ribs down. Use a stronger band if you need more tension.",
      },
    ],
  },
  "straight-bar-dip": {
    setup: [
      "Jump to a support on top of a single straight bar, arms locked.",
      "Bar in front of the hips, body leaning slightly forward.",
    ],
    execution: [
      "Lower until the bar is close to the chest, elbows bending back.",
      "Press back up to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Hips drifting back away from the bar as you lower.",
        fix: "Keep the bar close to your body and lean your chest forward over it on the way down. Letting the legs sit slightly in front helps you balance.",
      },
      {
        mistake: "Dropping into the bottom and bouncing.",
        fix: "Lower under control. Start with parallel-bar dips if you can't yet control the depth on a single bar.",
      },
    ],
  },
  "close-grip-push-up": {
    setup: [
      "Push-up position with the hands directly under the shoulders.",
      "Body in one straight line from head to heels.",
    ],
    execution: [
      "Lower the chest to the floor with the elbows brushing the ribs.",
      "Press back up to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Elbows flaring out as the set gets hard.",
        fix: "Keep your elbows pointing back toward your feet. Once they flare, it becomes a normal push-up.",
      },
      {
        mistake: "Hips sagging toward the floor.",
        fix: "Squeeze your glutes and brace your abs. Put your hands on a bench if you can't hold the line.",
      },
    ],
  },
  "rolling-db-extension": {
    setup: [
      "Lie on a flat bench with dumbbells pressed up over the chest, palms facing in.",
      "Pick bells a little heavier than your skull crusher weight.",
    ],
    execution: [
      "Bend the elbows and lower the bells beside the head, letting the upper arms tilt back.",
      "Roll the elbows forward to bring the bells over the chest.",
      "Press them back up to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Turning it into a pullover by swinging the arms far back.",
        fix: "Let your upper arms tilt back only a little. The elbows do most of the bending, and the roll is short.",
      },
      {
        mistake: "Letting the bells hit the bench or the head.",
        fix: "Lower beside your head, not onto it, and stop short of the bench. Go lighter until the path is automatic.",
      },
    ],
  },
  "wrist-curl": {
    setup: [
      "Forearms on a bench or the thighs, palms up, wrists just past the edge.",
      "Bar held in the fingers at the bottom.",
    ],
    execution: [
      "Let the bar roll to the fingertips, then curl it up as far as it goes.",
      "Lower under control.",
    ],
    watchFor: [
      {
        mistake: "Lifting the forearms off the bench to help.",
        fix: "Keep them flat. If they lift, the weight is too heavy for your wrists.",
      },
    ],
  },
  "dumbbell-wrist-curl": {
    setup: [
      "Forearm braced, palm up, wrist past the edge.",
      "One bell per hand.",
    ],
    execution: [
      "Curl the wrist up, then lower to a full stretch.",
    ],
    watchFor: [
      {
        mistake: "Rushing — this one responds to slow reps.",
        fix: "Take two seconds up and two down, and let the bar roll to your fingertips at the bottom.",
      },
    ],
  },
  "machine-wrist-curl": {
    setup: [
      "Forearms on the pad, palms up.",
      "Wrists free to move past the edge.",
    ],
    execution: [
      "Curl up, squeeze, lower to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Loading so heavy the wrist cannot complete the range.",
        fix: "Drop the weight until you can go from a full stretch to a full curl.",
      },
    ],
  },
  "reverse-wrist-curl": {
    setup: [
      "Forearms braced, palms down, wrists past the edge.",
      "Light bar — much lighter than palms-up.",
    ],
    execution: [
      "Lift the back of the hand toward the ceiling, then lower under control.",
    ],
    watchFor: [
      {
        mistake: "Going too heavy; this side of the forearm is far weaker.",
        fix: "Start with about a third of what you use palms-up.",
      },
    ],
  },
  "dumbbell-reverse-wrist-curl": {
    setup: [
      "Forearm braced, palm down, bell in hand.",
      "Wrist free past the edge.",
    ],
    execution: [
      "Raise the back of the hand, squeeze, lower slowly.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbow lift to help.",
        fix: "Brace your forearm down and move only at the wrist.",
      },
    ],
  },
  "machine-reverse-wrist-curl": {
    setup: [
      "Forearms on the pad, palms down.",
      "Light load.",
    ],
    execution: [
      "Extend the wrists up, then lower under control.",
    ],
    watchFor: [
      {
        mistake: "Adding weight faster than the wrists adapt.",
        fix: "Add small increments over weeks. Wrists complain louder and longer than most joints.",
      },
    ],
  },
  "behind-back-wrist-curl": {
    setup: [
      "Stand with a bar behind you, held at arm's length, palms back.",
      "Stand tall.",
    ],
    execution: [
      "Let the bar roll down the fingers, then curl the wrists up.",
      "Lower under control.",
    ],
    watchFor: [
      {
        mistake: "Bending the elbows to help.",
        fix: "Keep your arms straight; the bar should only move because your wrists moved.",
      },
    ],
  },
  "reverse-barbell-curl": {
    setup: [
      "Bar at the thighs, palms down, shoulder-width grip.",
      "Elbows pinned at the sides.",
    ],
    execution: [
      "Curl up to shoulder height keeping the palms down.",
      "Lower to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Loading it like a normal curl — this is much harder, so go lighter.",
        fix: "Start about 40% below your usual curl. The palms-down grip is a big disadvantage.",
      },
    ],
  },
  "wrist-roller": {
    setup: [
      "Hold the roller at arm's length, shoulder height, weight hanging.",
      "Arms straight, shoulders down.",
    ],
    execution: [
      "Roll the weight all the way up one hand at a time, then all the way down.",
      "Lowering under control is where most of the work is.",
    ],
    watchFor: [
      {
        mistake: "Letting the arms drop as the shoulders tire.",
        fix: "Hold them out at shoulder height, and stop the set when you cannot.",
      },
    ],
  },
  "farmers-carry": {
    setup: [
      "Heavy bell or handle in each hand, stand tall, shoulders down.",
      "Brace the midsection before the first step.",
    ],
    execution: [
      "Walk a set distance or time with short, controlled steps.",
      "Keep the ribs down and do not let the torso lean.",
    ],
    watchFor: [
      {
        mistake: "Leaning back or to one side under the load.",
        fix: "Stand tall with your ribs down. If you are leaning, the weight is too heavy to carry safely.",
      },
    ],
  },
  "plate-pinch": {
    setup: [
      "Pinch two smooth plates together between the fingers and thumb.",
      "Stand tall, arms at the sides.",
    ],
    execution: [
      "Hold for time until the grip is genuinely failing.",
      "Set them down deliberately rather than dropping them.",
    ],
    watchFor: [
      {
        mistake: "Dropping plates on your feet — do this over a mat or a rack.",
        fix: "Stand over a mat or in a rack, and set them down rather than releasing them.",
      },
    ],
  },
  "dead-hang": {
    setup: [
      "Grip a pull-up bar about shoulder width.",
      "Let the body hang with the shoulders active, not fully slack.",
    ],
    execution: [
      "Hold for time, breathing steadily.",
    ],
    watchFor: [
      {
        mistake: "Hanging completely limp at the shoulder for long periods.",
        fix: "Keep a little tension in your shoulders rather than sinking into the joint.",
      },
    ],
  },
  "hand-gripper": {
    setup: [
      "Set the gripper deep in the hand, handle across the base of the fingers.",
      "Pick a strength you can close for several reps to start.",
    ],
    execution: [
      "Squeeze until the handles touch, and hold for a moment.",
      "Open slowly under control.",
    ],
    watchFor: [
      {
        mistake: "Doing hundreds of easy reps every day.",
        fix: "Treat it like any lift: a gripper you can only close a few times, for a few sets, with rest days between.",
      },
      {
        mistake: "Letting the gripper spring open.",
        fix: "Resist it on the way open. The slow return builds strength too, and protects your fingers.",
      },
    ],
  },
  "finger-curl": {
    setup: [
      "Sit with the forearms on your thighs or a bench, palms up, holding a barbell.",
      "Wrists just past the edge.",
    ],
    execution: [
      "Let the bar roll down to the fingertips, keeping hold of it.",
      "Curl the fingers to roll it back into the palm, then curl the wrists up.",
    ],
    watchFor: [
      {
        mistake: "Letting the bar roll so far it slips out of the fingers.",
        fix: "Roll it only to where you can still hold it firmly. Start light until you know where that point is.",
      },
      {
        mistake: "Starting with a heavy bar and straining the fingers.",
        fix: "Begin with an empty bar or light dumbbells. Finger tendons adapt more slowly than muscle.",
      },
    ],
  },
  "towel-hang": {
    setup: [
      "Loop two towels over a pull-up bar, shoulder width apart.",
      "Grip one towel in each hand, hands at the same height.",
    ],
    execution: [
      "Lift the feet and hang with the shoulders slightly engaged.",
      "Hold for time, then step down before the grip fails completely.",
    ],
    watchFor: [
      {
        mistake: "Hanging until the hands let go on their own.",
        fix: "Keep a box or bench under you and step down when your grip starts to slip, rather than dropping.",
      },
      {
        mistake: "Thin or slippery towels that slide on the bar.",
        fix: "Use thick gym towels and check they cannot slide off the bar before you hang your full weight from them.",
      },
    ],
  },
  "barbell-hold": {
    setup: [
      "Set the bar on pins or blocks at about knee height in a rack.",
      "Grip double overhand, hands just outside the thighs.",
    ],
    execution: [
      "Stand up to lockout with the shoulders back.",
      "Hold for time, then lower back to the pins with control.",
    ],
    watchFor: [
      {
        mistake: "Switching to straps or a mixed grip to hold more.",
        fix: "Stay double overhand. The point is to train your grip, so let it be what limits you.",
      },
      {
        mistake: "Rounding the shoulders forward as the grip tires.",
        fix: "Keep your chest up and shoulders back. When you cannot, the set is over.",
      },
    ],
  },
  "reverse-ez-bar-curl": {
    setup: [
      "Stand holding an EZ bar overhand on the angled grips.",
      "Elbows at your sides, wrists straight.",
    ],
    execution: [
      "Curl the bar up toward the shoulders, keeping the palms down.",
      "Lower slowly to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Wrists bending back as the bar rises.",
        fix: "Keep your knuckles in line with your forearms. If the wrists fold, the weight is too heavy for the forearms to hold.",
      },
      {
        mistake: "Using your normal curl weight.",
        fix: "Start well below your regular EZ curl. The overhand grip puts the smaller forearm muscles in charge.",
      },
    ],
  },
  "reverse-db-curl": {
    setup: [
      "Stand with a dumbbell in each hand, palms facing back.",
      "Elbows at your sides.",
    ],
    execution: [
      "Curl the bells up, keeping the palms facing down.",
      "Lower slowly to straight arms.",
    ],
    watchFor: [
      {
        mistake: "Turning the palms in toward a hammer curl as it gets hard.",
        fix: "Keep your palms facing down the whole rep. The overhand position is what puts the work on the forearm.",
      },
      {
        mistake: "Swinging the bells with the body.",
        fix: "Stand still and let the elbows be the only joint that moves. Lighter bells with a clean path do more here.",
      },
    ],
  },
  "reverse-cable-curl": {
    setup: [
      "Attach a straight bar to a low pulley.",
      "Stand close, holding it overhand at shoulder width, elbows at your sides.",
    ],
    execution: [
      "Curl the bar up to the shoulders, keeping the wrists straight.",
      "Lower slowly until the arms are straight.",
    ],
    watchFor: [
      {
        mistake: "Letting the elbows drift forward to finish the rep.",
        fix: "Keep your elbows pinned at your sides. Moving them forward hands the work to the shoulders.",
      },
      {
        mistake: "Knuckles dropping toward the floor at the top.",
        fix: "Keep your wrists straight and knuckles up throughout. A bent wrist takes tension off the brachioradialis.",
      },
    ],
  },
  "reverse-preacher-curl": {
    setup: [
      "Sit at a preacher bench with an EZ bar or straight bar held overhand.",
      "Backs of the upper arms flat on the pad.",
    ],
    execution: [
      "Curl the bar up until the forearms are nearly vertical.",
      "Lower slowly until the arms are almost straight.",
    ],
    watchFor: [
      {
        mistake: "Letting the bar drop fast into the bottom.",
        fix: "Control the lowering and stop just short of lockout. The preacher angle is least forgiving at the bottom.",
      },
      {
        mistake: "Wrists bending back under the load.",
        fix: "Go lighter and keep your knuckles in line with your forearms for the whole set.",
      },
    ],
  },
  "wrist-pronation": {
    setup: [
      "Sit with the forearm resting on your thigh or a bench, wrist just past the edge.",
      "Hold a hammer or a dumbbell loaded on one end only, handle pointing up.",
    ],
    execution: [
      "Rotate the forearm to lower the weight out to the side, turning the palm up.",
      "Rotate it back up through vertical and over toward palm down.",
      "Move slowly in both directions.",
    ],
    watchFor: [
      {
        mistake: "Holding the handle too far from the weighted end.",
        fix: "Choke up toward the head to start. Sliding your hand down the handle makes it much harder, so do that gradually.",
      },
      {
        mistake: "Lifting the forearm or twisting the shoulder to help.",
        fix: "Keep your forearm flat on the support. The turn should come only from the forearm rotating.",
      },
    ],
  },
  "wrist-supination": {
    setup: [
      "Sit with the forearm resting on your thigh or a bench, wrist just past the edge.",
      "Hold a hammer or a dumbbell loaded on one end only, handle pointing up.",
    ],
    execution: [
      "Rotate the forearm to lower the weight to the inside, turning the palm down.",
      "Rotate it back up through vertical and over toward palm up.",
      "Move slowly in both directions.",
    ],
    watchFor: [
      {
        mistake: "Letting the weight drop fast at the end of the turn.",
        fix: "Control it all the way down. A long lever gathers speed quickly, and the end of the range is where the forearm is weakest.",
      },
      {
        mistake: "Rolling the elbow off the support.",
        fix: "Keep your elbow and forearm pressed down. Only your forearm should rotate, not your whole arm.",
      },
    ],
  },
  "cable-wrist-curl": {
    setup: [
      "Kneel or sit facing a low pulley with a straight bar attached.",
      "Rest the forearms on a bench or your thighs, palms up, wrists just past the edge.",
    ],
    execution: [
      "Let the bar lower as the wrists bend back.",
      "Curl the wrists up as far as they go and squeeze.",
    ],
    watchFor: [
      {
        mistake: "Forearms lifting off the support to help.",
        fix: "Keep your forearms pressed down. Only your wrists should move.",
      },
      {
        mistake: "Sitting so close the cable pulls straight up.",
        fix: "Move back until the cable pulls toward the stack at an angle, so there is still tension when your wrists are curled up.",
      },
    ],
  },
  "band-finger-extension": {
    setup: [
      "Loop a rubber band or finger-extension band around the fingers and thumb.",
      "Start with the fingertips bunched together.",
    ],
    execution: [
      "Spread the fingers and thumb open as wide as you can against the band.",
      "Close them back together slowly.",
    ],
    watchFor: [
      {
        mistake: "Using a band so strong the fingers barely open.",
        fix: "Choose a band you can open fully for 15 to 25 reps. This is high-rep balancing work, not a strength test.",
      },
      {
        mistake: "Letting the band snap the fingers shut.",
        fix: "Close your hand slowly. The controlled return is part of the work for the small extensor muscles.",
      },
    ],
  },
  "one-arm-dead-hang": {
    setup: [
      "Build up a solid two-arm dead hang first.",
      "Grab the bar with one hand, standing on a box so you can step on and off.",
    ],
    execution: [
      "Lift the feet and hang from one hand, shoulder slightly engaged rather than slack.",
      "Hold for time, then step down and switch hands.",
    ],
    watchFor: [
      {
        mistake: "Hanging completely loose in the shoulder.",
        fix: "Keep a little tension, pulling the shoulder away from your ear. Hanging fully slack on one arm puts all the load on the joint.",
      },
      {
        mistake: "Hanging until the grip gives out.",
        fix: "Step down while you still have grip left. Use the free hand on the bar lightly if you need help building up.",
      },
    ],
  },
  "plate-neck-flexion": {
    setup: [
      "Lie face up on a bench with the head and neck off the end.",
      "Fold a towel over the forehead and hold a light plate on it with both hands.",
      "Start with a plate much lighter than you think you need.",
    ],
    execution: [
      "Let the head lower back slowly to a comfortable stretch.",
      "Curl the chin toward the chest, pause, and lower back down.",
    ],
    watchFor: [
      {
        mistake: "Jerking the head up and letting it drop.",
        fix: "Move slowly in both directions, two or three seconds each way. The neck responds well to smooth, controlled reps.",
      },
      {
        mistake: "Letting the head drop further back than is comfortable.",
        fix: "Stop at a mild stretch. Your neck should never be hanging at the end of its range under load.",
      },
    ],
  },
  "plate-neck-extension": {
    setup: [
      "Lie face down on a bench with the head and neck off the end.",
      "Fold a towel over the back of the head and hold a light plate on it with both hands.",
    ],
    execution: [
      "Lower the chin toward the chest under control.",
      "Lift the head back up until it is level with the body, and pause.",
    ],
    watchFor: [
      {
        mistake: "Cranking the head up to look at the ceiling.",
        fix: "Stop when your head is in line with your spine. Going past that adds load to the joints without extra muscle work.",
      },
      {
        mistake: "The plate sliding off the back of the head.",
        fix: "Hold it firmly with both hands on the towel, and pick a weight you can keep steady without shifting.",
      },
    ],
  },
  "lateral-neck-flexion": {
    setup: [
      "Lie on your side on a bench with the head off the end.",
      "Hold a light plate on a folded towel against the side of the head.",
    ],
    execution: [
      "Let the head lower toward the floor under control.",
      "Lift the ear toward the top shoulder, pause, and lower.",
      "Do the same reps on both sides.",
    ],
    watchFor: [
      {
        mistake: "Twisting the head so the face turns toward the floor or ceiling.",
        fix: "Keep your nose pointing straight ahead. The movement is a pure side bend.",
      },
      {
        mistake: "Hitching the shoulder up to meet the ear.",
        fix: "Keep your top shoulder still and let your neck do the lifting.",
      },
    ],
  },
  "neck-harness-extension": {
    setup: [
      "Fit the harness snugly on the head and clip a light plate to the chain.",
      "Stand hinged forward with the hands on the thighs, or sit with the forearms on the knees.",
    ],
    execution: [
      "Let the chin drop toward the chest under control.",
      "Lift the head back to neutral, in line with your spine.",
      "Take the plate off the chain before you straighten up.",
    ],
    watchFor: [
      {
        mistake: "Swinging the weight with the whole body.",
        fix: "Brace your hands on your thighs and move only your head. If the weight swings, lighten it.",
      },
      {
        mistake: "Standing up with the weight still hanging from the head.",
        fix: "Set the plate down on a box or the floor first. Standing up under load swings it into your legs and pulls on your neck.",
      },
    ],
  },
  "neck-machine-flexion": {
    setup: [
      "Face the pad and set the seat so it meets your forehead.",
      "Hold the handles and sit tall with the shoulders still.",
    ],
    execution: [
      "Push the head forward and down against the pad, bringing the chin toward the chest.",
      "Return slowly to upright.",
    ],
    watchFor: [
      {
        mistake: "Bending at the waist to move the pad.",
        fix: "Keep your torso upright against the seat and move only your head and neck.",
      },
      {
        mistake: "Jumping up the weight stack quickly.",
        fix: "Progress in small steps. Neck strength builds steadily and punishes impatience.",
      },
    ],
  },
  "neck-machine-extension": {
    setup: [
      "Sit facing away from the pad and set the seat so it meets the back of your head.",
      "Hold the handles and keep the shoulders still.",
    ],
    execution: [
      "Push the head back against the pad until it is in line with the spine.",
      "Return slowly until the chin is toward the chest.",
    ],
    watchFor: [
      {
        mistake: "Leaning back with the whole torso.",
        fix: "Keep your torso upright and let only your head travel.",
      },
      {
        mistake: "Pushing the head back to look at the ceiling.",
        fix: "Stop at neutral, with your head in line with your spine. Past that, the joints take the load.",
      },
    ],
  },
  "neck-machine-lateral-flexion": {
    setup: [
      "Sit side-on and set the pad against the side of your head, just above the ear.",
      "Hold the handles and keep both shoulders level.",
    ],
    execution: [
      "Tilt the head sideways against the pad, ear toward the shoulder.",
      "Return slowly to upright and switch sides after the set.",
    ],
    watchFor: [
      {
        mistake: "Dropping the shoulder toward the pad to fake the range.",
        fix: "Keep both shoulders level and still. The range comes from your neck, and it is smaller than you expect.",
      },
      {
        mistake: "Doing more reps or weight on the stronger side.",
        fix: "Match weight and reps on both sides, starting with whichever side is weaker.",
      },
    ],
  },
  "banded-neck-flexion": {
    setup: [
      "Anchor a light band behind you at head height.",
      "Loop it over the forehead with a towel under it, and step forward until it pulls.",
    ],
    execution: [
      "Nod the chin down and forward against the band.",
      "Return slowly to neutral.",
    ],
    watchFor: [
      {
        mistake: "Letting the band snap the head back.",
        fix: "Control the return every rep. Use a lighter band or step closer if you cannot.",
      },
      {
        mistake: "Bending forward at the hips to stretch the band.",
        fix: "Stand tall and move only your head. Step further from the anchor for more tension instead.",
      },
    ],
  },
  "banded-neck-extension": {
    setup: [
      "Anchor a light band in front of you at head height.",
      "Loop it around the back of the head with a towel under it, and step back until it pulls.",
    ],
    execution: [
      "Take the head back until it is in line with the spine.",
      "Let it return slowly toward the chest.",
    ],
    watchFor: [
      {
        mistake: "Leaning back to stretch the band.",
        fix: "Stay tall and move only your head. Step further back for more tension.",
      },
      {
        mistake: "Tipping the head back to look at the ceiling.",
        fix: "Stop with your head level. The back of the neck works through the range from chin-down to neutral.",
      },
    ],
  },
  "neck-isometric-hold": {
    setup: [
      "Sit or stand tall with the head level.",
      "Place a hand on the forehead, back of the head, or side of the head.",
    ],
    execution: [
      "Press the head into the hand while the hand resists, so nothing moves.",
      "Hold for the set time, then switch direction.",
      "Work front, back and both sides.",
    ],
    watchFor: [
      {
        mistake: "Pressing all out from the first second.",
        fix: "Build up to a firm, steady push over a few seconds. Moderate pressure you can hold beats a sudden max effort.",
      },
      {
        mistake: "Holding the breath while you press.",
        fix: "Breathe steadily through the hold. If you cannot, ease off the pressure.",
      },
    ],
  },
  "chin-tuck": {
    setup: [
      "Lie face up with the knees bent and the head resting on the floor.",
      "Arms relaxed at the sides.",
    ],
    execution: [
      "Tuck the chin in as if making a double chin.",
      "Keeping the tuck, lift the head an inch off the floor and hold for a few seconds.",
      "Lower the head, then release the tuck.",
    ],
    watchFor: [
      {
        mistake: "Jutting the chin forward as the head lifts.",
        fix: "Keep the chin tucked the whole time. The lift is small, and the tuck is the part that trains the deep neck muscles.",
      },
      {
        mistake: "Lifting the head high like a crunch.",
        fix: "Lift only an inch or so. Higher than that and the big muscles at the front of the neck take over.",
      },
    ],
  },
  "wrestlers-bridge": {
    setup: [
      "Lie face up on a thick mat with the knees bent and feet flat, wide apart.",
      "Put the hands on the mat beside the head to take some of your weight.",
    ],
    execution: [
      "Lift the hips and roll onto the top of the head, arching the back.",
      "Rock slowly forward toward the forehead and back toward the crown.",
      "Take weight off the hands only as the neck gets stronger.",
    ],
    watchFor: [
      {
        mistake: "Doing it on a hard floor.",
        fix: "Always use a thick mat. The top of your head is taking your weight, and a hard surface makes every small slip worse.",
      },
      {
        mistake: "Rocking fast or through a big range from day one.",
        fix: "Start with small, slow rocks and your hands helping. Build range over weeks, the same as any neck training.",
      },
    ],
  },
  "front-neck-bridge": {
    setup: [
      "Kneel on a thick mat and place the forehead on it, hands beside the head.",
      "Straighten the legs so the weight rests on the forehead, feet, and hands.",
    ],
    execution: [
      "Rock slowly forward onto the top of the head and back onto the forehead.",
      "Shift weight off the hands only as it gets easier.",
    ],
    watchFor: [
      {
        mistake: "Taking all your weight on the head straight away.",
        fix: "Start from the knees with your hands carrying most of the load. Straighten your legs only once the kneeling version is easy.",
      },
      {
        mistake: "Rolling past the top of the head.",
        fix: "Keep the rock small, between your forehead and the top of your head. Rolling further bends the neck under your full weight.",
      },
    ],
  },
  "banded-lateral-neck-flexion": {
    setup: [
      "Anchor a light band at head height and stand side-on to it.",
      "Loop it around the side of the head nearest the anchor, towel underneath.",
      "Step away until the band pulls.",
    ],
    execution: [
      "Tilt the head away from the anchor, ear toward the far shoulder.",
      "Return slowly to upright, then turn around to work the other side.",
    ],
    watchFor: [
      {
        mistake: "Leaning the whole body away from the anchor.",
        fix: "Stand tall and move only your head. Step further from the anchor for more tension instead.",
      },
      {
        mistake: "Turning the chin as you tilt.",
        fix: "Keep your face pointing forward. Think about bringing your ear toward your shoulder, not your chin.",
      },
    ],
  },
  "neck-harness-flexion": {
    setup: [
      "Clip a head harness to a cable set at head height and stand facing away from it.",
      "Step forward until the cable pulls the head gently back to neutral.",
      "Stagger the feet and brace.",
    ],
    execution: [
      "Nod the chin down toward the chest against the cable.",
      "Return slowly to neutral.",
    ],
    watchFor: [
      {
        mistake: "Letting the cable pull the head back past neutral.",
        fix: "Stop each rep with your head level. Use a lighter weight or step back if the cable keeps tipping your head back.",
      },
      {
        mistake: "Bending forward at the waist to move the weight.",
        fix: "Keep your torso still and upright. Only your head should nod, so go lighter until that's true.",
      },
    ],
  },
  "squat": {
    setup: [
      "Bar on the upper back, hands set wherever the shoulders allow.",
      "Feet about shoulder width, toes turned out slightly.",
      "Big breath into the belly and brace before you unrack.",
    ],
    execution: [
      "Break at the hips and knees together and sit down between the feet.",
      "Descend until the hip crease passes the knee, or as deep as you can hold position.",
      "Drive up through the whole foot, hips and chest rising together.",
    ],
    watchFor: [
      {
        mistake: "Knees caving in as you come out of the hole.",
        fix: "Push your knees out toward your little toes on the way up. If they still cave, the weight is too heavy.",
      },
      {
        mistake: "The chest dropping so the hips shoot up first and it becomes a good morning.",
        fix: "Drive your chest and hips up together. If your hips lead, lower the weight and film a set.",
      },
    ],
  },
  "front-squat": {
    setup: [
      "Bar across the front delts, elbows high — the elbows hold the bar, not the hands.",
      "Feet about shoulder width, torso tall.",
    ],
    execution: [
      "Sit straight down keeping the elbows up and the chest vertical.",
      "Drive up without letting the elbows drop.",
    ],
    watchFor: [
      {
        mistake: "Elbows dropping, which dumps the bar forward.",
        fix: "Keep them high and pointing forward the whole rep — the bar sits on them, not your hands.",
      },
      {
        mistake: "Chasing depth at the cost of an upright torso.",
        fix: "Stop where you can stay vertical. Depth you cannot hold position in is not depth.",
      },
    ],
  },
  "goblet-squat": {
    setup: [
      "Hold a bell or kettlebell at the chest, elbows tucked underneath.",
      "Feet about shoulder width.",
    ],
    execution: [
      "Squat down between the knees, elbows tracking inside the thighs.",
      "Stand back up, keeping the weight tight to the chest.",
    ],
    watchFor: [
      {
        mistake: "Letting the weight drift away from the body.",
        fix: "Keep it tight against your chest; away from you it becomes a lower-back exercise.",
      },
    ],
  },
  "smith-squat": {
    setup: [
      "Feet slightly forward of the bar since the path is fixed.",
      "Bar on the upper back, brace before unhooking.",
    ],
    execution: [
      "Descend to depth on the fixed path, then drive back up.",
      "Re-hook only once the set is done.",
    ],
    watchFor: [
      {
        mistake: "Feet placed under the bar, which forces the knees forward awkwardly.",
        fix: "Step your feet slightly forward of the bar so the fixed path suits your hips.",
      },
    ],
  },
  "box-squat": {
    setup: [
      "Box set so the hip crease lands at or just below knee height.",
      "Wider stance than a normal squat, toes out.",
    ],
    execution: [
      "Sit back onto the box under control and pause without relaxing.",
      "Drive up off the box without rocking.",
    ],
    watchFor: [
      {
        mistake: "Crashing down onto the box, which loads the spine sharply.",
        fix: "Sit back and touch under control, then pause without relaxing.",
      },
    ],
  },
  "safety-bar-squat": {
    setup: [
      "Bar yoke on the shoulders, hands on the handles.",
      "Expect it to push you forward more than a straight bar.",
    ],
    execution: [
      "Squat to depth fighting to keep the chest up.",
      "Drive up through the whole foot.",
    ],
    watchFor: [
      {
        mistake: "Letting the bar's forward pull turn it into a good morning.",
        fix: "Fight to keep your chest up and expect to use less weight than a straight bar.",
      },
    ],
  },
  "hack-squat": {
    setup: [
      "Back and hips flat against the pad, feet mid-platform.",
      "Shoulders under the pads.",
    ],
    execution: [
      "Descend until the thighs are at least parallel.",
      "Drive back up without locking the knees hard at the top.",
    ],
    watchFor: [
      {
        mistake: "Hips peeling off the pad at the bottom.",
        fix: "Stop just above the depth where they lift. That point is your range today.",
      },
    ],
  },
  "pendulum-squat": {
    setup: [
      "Back against the pad, feet on the platform, shoulders under the pads.",
      "Brace before releasing the safeties.",
    ],
    execution: [
      "Descend deep along the arc, then drive back up.",
      "The arc lets you go deeper than a hack squat — use it.",
    ],
    watchFor: [
      {
        mistake: "Bouncing out of the bottom.",
        fix: "Pause briefly at the deepest point and drive up from a dead stop.",
      },
    ],
  },
  "belt-squat": {
    setup: [
      "Belt around the hips, feet on the platforms.",
      "Hold the handles lightly for balance only.",
    ],
    execution: [
      "Squat to depth with a tall torso — no bar on the back to fight.",
      "Drive up through the whole foot.",
    ],
    watchFor: [
      {
        mistake: "Pulling hard on the handles to assist the lift.",
        fix: "Rest your hands there for balance only; the legs do the work.",
      },
    ],
  },
  "leg-press": {
    setup: [
      "Feet mid-platform about shoulder width, back and hips flat on the pad.",
      "Release the safeties and take the weight.",
    ],
    execution: [
      "Lower until the knees reach roughly 90° or a little past.",
      "Press back up without snapping the knees straight.",
    ],
    watchFor: [
      {
        mistake: "Lowering so far the hips curl off the pad — that rounds the lower back under load.",
        fix: "Stop where your hips start to lift. That is the bottom of your safe range.",
      },
      {
        mistake: "Locking the knees hard at the top.",
        fix: "Stop just short of straight and keep tension on the muscle.",
      },
    ],
  },
  "single-leg-press": {
    setup: [
      "One foot centred on the platform, hips flat against the pad.",
      "Other leg out of the way.",
    ],
    execution: [
      "Lower under control to a deep but comfortable knee bend.",
      "Press back up without locking out.",
    ],
    watchFor: [
      {
        mistake: "Letting the hip rotate as you tire.",
        fix: "Keep your hips square to the pad. When they twist, the set is done.",
      },
    ],
  },
  "lunges": {
    setup: [
      "Stand tall, feet hip width, core braced.",
      "Weight in each hand or a bar on the back.",
    ],
    execution: [
      "Step forward and lower until the back knee is just off the floor.",
      "Push back to the start through the front heel.",
    ],
    watchFor: [
      {
        mistake: "The front knee collapsing inward.",
        fix: "Track your knee over your second toe. Slow down and go lighter until it holds.",
      },
      {
        mistake: "Leaning the torso over the front thigh.",
        fix: "Stay upright. Leaning shifts the work off the leg and onto your lower back.",
      },
    ],
  },
  "walking-lunge": {
    setup: [
      "Stand tall with the weight held at the sides.",
      "Clear a straight path before you start.",
    ],
    execution: [
      "Step forward, lower the back knee toward the floor, then step through into the next rep.",
      "Keep the torso upright throughout.",
    ],
    watchFor: [
      {
        mistake: "Short steps that put all the load on the front knee.",
        fix: "Take a longer stride so your hip and glute share the work.",
      },
    ],
  },
  "reverse-lunge": {
    setup: [
      "Stand tall, weight at the sides or a bar on the back.",
      "Core braced.",
    ],
    execution: [
      "Step backwards and lower the back knee toward the floor.",
      "Drive through the front heel to return.",
    ],
    watchFor: [
      {
        mistake: "Stepping back so far the front heel lifts.",
        fix: "Shorten the step until your front foot stays flat.",
      },
    ],
  },
  "bulgarian-squat": {
    setup: [
      "Rear foot on a bench, front foot far enough forward to squat freely.",
      "Torso upright, weights at the sides.",
    ],
    execution: [
      "Lower until the back knee is close to the floor.",
      "Drive up through the front heel.",
    ],
    watchFor: [
      {
        mistake: "Front foot too close, which jams the knee forward.",
        fix: "Move it further forward until your shin is roughly vertical at the bottom.",
      },
      {
        mistake: "Bouncing the back knee off the ground.",
        fix: "Stop an inch short of the floor and reverse from there.",
      },
    ],
  },
  "step-up": {
    setup: [
      "Box at about knee height, weights at the sides.",
      "Stand close enough to step on without reaching.",
    ],
    execution: [
      "Step up driving through the whole front foot, stand fully tall.",
      "Lower under control rather than dropping down.",
    ],
    watchFor: [
      {
        mistake: "Pushing off the trailing foot to launch yourself up.",
        fix: "Let the back foot rest and drive entirely through the foot on the box.",
      },
    ],
  },
  "sissy-squat": {
    setup: [
      "Hold a support, heels raised or on a sissy bench.",
      "Body in one line from knees to head.",
    ],
    execution: [
      "Bend the knees and lean back, letting the knees travel forward.",
      "Return by contracting the quads.",
    ],
    watchFor: [
      {
        mistake: "Going deeper than the knees are ready for — build to this one slowly.",
        fix: "Use a support and a small range at first, adding depth over weeks.",
      },
    ],
  },
  "leg-extension": {
    setup: [
      "Back against the pad, knees lined up with the machine's pivot.",
      "Ankle pad just above the top of the foot.",
    ],
    execution: [
      "Extend to straight legs and squeeze.",
      "Lower under control without letting the stack land.",
    ],
    watchFor: [
      {
        mistake: "Knees off the pivot, which loads the joint at an angle.",
        fix: "Adjust the seat until your knee lines up with the machine's hinge.",
      },
      {
        mistake: "Slamming into lockout with a heavy stack.",
        fix: "Squeeze into the top rather than kicking into it.",
      },
    ],
  },
  "romanian-dl": {
    setup: [
      "Bar at the hips, feet hip width, soft knees that stay soft.",
      "Shoulders back, lats tight, bar close to the legs.",
    ],
    execution: [
      "Push the hips back and let the bar slide down the thighs.",
      "Stop when the hamstrings run out of stretch, then drive the hips forward.",
    ],
    watchFor: [
      {
        mistake: "Bending the knees more to reach lower — this is a hip hinge, not a squat.",
        fix: "Set a soft knee bend at the start and keep it fixed; go lower only by pushing your hips further back.",
      },
      {
        mistake: "Rounding the lower back at the bottom.",
        fix: "Stop where your hamstrings stop stretching. Past that your spine is taking the range.",
      },
    ],
  },
  "good-morning": {
    setup: [
      "Bar on the upper back, feet hip width, soft knees.",
      "Brace hard before the first rep.",
    ],
    execution: [
      "Hinge at the hips, pushing them back, until the torso is near parallel.",
      "Drive the hips forward to stand.",
    ],
    watchFor: [
      {
        mistake: "Going far heavier than the hinge can control.",
        fix: "Good mornings work light. If your back rounds at all, halve it.",
      },
      {
        mistake: "Rounding the back to reach lower.",
        fix: "Keep a flat back and let the range be what it is.",
      },
    ],
  },
  "leg-curl": {
    setup: [
      "Lie face down, knees just off the end of the pad.",
      "Ankle pad on the achilles, hips pressed into the bench.",
    ],
    execution: [
      "Curl the heels toward the glutes, squeeze at the top.",
      "Lower under control to nearly straight.",
    ],
    watchFor: [
      {
        mistake: "Hips lifting off the pad to swing the weight.",
        fix: "Press your hips down and go lighter — lifting them is your lower back joining in.",
      },
    ],
  },
  "seated-leg-curl": {
    setup: [
      "Knees on the pivot, thigh pad clamped down.",
      "Back against the pad.",
    ],
    execution: [
      "Curl the heels down and under, squeeze.",
      "Return under control to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Sliding forward in the seat as the set goes on.",
        fix: "Clamp the thigh pad tighter and sit right back before each set.",
      },
    ],
  },
  "nordic-curl": {
    setup: [
      "Ankles anchored, knees on a pad, body in one line from knees to head.",
      "Hands ready in front of you to catch.",
    ],
    execution: [
      "Lower forward as slowly as you can control.",
      "Catch with the hands and push back just enough to return.",
    ],
    watchFor: [
      {
        mistake: "Attempting full reps before you can control the lowering — start with a band or a partial.",
        fix: "Loop a band under your chest, or lower only partway, until you can control the whole descent.",
      },
    ],
  },
  "glute-ham-raise": {
    setup: [
      "Feet secured, pads at the thighs, body in one line.",
      "Hands at the chest or behind the head.",
    ],
    execution: [
      "Lower forward under control, then pull back with the hamstrings.",
      "Keep the hips extended the whole way — do not fold.",
    ],
    watchFor: [
      {
        mistake: "Hinging at the hips to make it easier.",
        fix: "Keep your hips straight and let your hamstrings do all of it.",
      },
    ],
  },
  "adductor-machine": {
    setup: [
      "Seated with the pads on the inside of the thighs.",
      "Start at a comfortable stretch, not the machine's maximum.",
    ],
    execution: [
      "Squeeze the legs together, pause, and open under control.",
    ],
    watchFor: [
      {
        mistake: "Setting the start position wider than the groin is warmed up for.",
        fix: "Start narrow and open the range up over a few sets.",
      },
    ],
  },
  "calf-raise": {
    setup: [
      "Balls of the feet on a step or platform, heels free.",
      "Stand tall, knees straight but not locked.",
    ],
    execution: [
      "Rise as high onto the toes as you can and pause.",
      "Lower until you feel a full stretch in the calf.",
    ],
    watchFor: [
      {
        mistake: "Bouncing through short, fast reps with no pause at either end.",
        fix: "Pause a second at the top and get a full stretch at the bottom.",
      },
    ],
  },
  "seated-calf-raise": {
    setup: [
      "Balls of the feet on the platform, pads over the lower thighs.",
      "This one bends the knee, which favours the soleus underneath.",
    ],
    execution: [
      "Rise to a full contraction, pause, and lower to a deep stretch.",
    ],
    watchFor: [
      {
        mistake: "Rushing the reps and skipping the stretch.",
        fix: "Let your heels drop fully and pause there before each rep.",
      },
    ],
  },
  "leg-press-calf-raise": {
    setup: [
      "Balls of the feet at the bottom edge of the platform, legs nearly straight.",
      "Keep the safeties engaged.",
    ],
    execution: [
      "Push the platform away with the toes, then lower to a full stretch.",
    ],
    watchFor: [
      {
        mistake: "Letting the knees bend and turning it into a partial press.",
        fix: "Keep your legs almost straight; only your ankles should move.",
      },
    ],
  },
  "donkey-calf-raise": {
    setup: [
      "Hinge forward with support under the chest or hands, balls of the feet on a step.",
      "Load across the hips if the machine allows.",
    ],
    execution: [
      "Rise onto the toes, pause, lower to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Bending the knees to bounce the weight up.",
        fix: "Keep the legs straight and drive through the balls of your feet.",
      },
    ],
  },
  "tibialis-raise": {
    setup: [
      "Heels on the floor, back against a wall, feet out in front.",
      "Add a weight over the toes if bodyweight is easy.",
    ],
    execution: [
      "Pull the toes up toward the shins as far as they go.",
      "Lower under control.",
    ],
    watchFor: [
      {
        mistake: "Rushing — this muscle responds to slow, full-range reps.",
        fix: "Take two seconds up and two down through the fullest range you have.",
      },
    ],
  },
  "stiff-leg-deadlift": {
    setup: [
      "Bar over the middle of the foot, feet hip width.",
      "Knees only slightly bent, and they stay that way.",
      "Grip just outside the legs, back flat.",
    ],
    execution: [
      "Push the hips back and lower the bar to the floor or as far as your back stays flat.",
      "Stand up by driving the hips forward, keeping the bar close to the legs.",
    ],
    watchFor: [
      {
        mistake: "Rounding the lower back to reach the floor.",
        fix: "Only go as low as you can with a flat back. Lower from blocks if the floor is out of reach.",
      },
      {
        mistake: "Bending the knees more as the set gets harder.",
        fix: "Keep the same slight knee bend every rep. Once the knees bend more it turns into a regular deadlift.",
      },
    ],
  },
  "db-romanian-deadlift": {
    setup: [
      "Stand holding a dumbbell in each hand in front of the thighs.",
      "Feet hip width, soft bend in the knees.",
    ],
    execution: [
      "Push the hips back and slide the bells down the front of the legs.",
      "Stop when the hamstrings are fully stretched, then drive the hips forward to stand.",
    ],
    watchFor: [
      {
        mistake: "Letting the bells drift away from the legs.",
        fix: "Keep them brushing your thighs and shins. Weight held out in front pulls on your lower back.",
      },
      {
        mistake: "Squatting down instead of hinging.",
        fix: "Keep your shins nearly vertical and push your hips back, as if closing a door behind you with them.",
      },
    ],
  },
  "single-leg-rdl": {
    setup: [
      "Stand on one leg with a slight bend in the knee, weight in the opposite hand.",
      "Hold a rack or bench with the free hand if balance is limiting you.",
    ],
    execution: [
      "Hinge forward, reaching the free leg straight back as the torso lowers.",
      "Stop at a strong stretch in the standing hamstring, then drive back up.",
    ],
    watchFor: [
      {
        mistake: "Hips rotating open so the back leg turns out.",
        fix: "Point the toes of your back foot at the floor and keep both hips level.",
      },
      {
        mistake: "Chasing depth while wobbling.",
        fix: "Hold onto something for balance. Steady reps load the hamstring; wobbly ones only train balance.",
      },
    ],
  },
  "standing-leg-curl": {
    setup: [
      "Stand on the platform with the pad just above the back of the working ankle.",
      "Hips against the support pad, hands on the handles.",
    ],
    execution: [
      "Curl the heel up toward the glute and squeeze.",
      "Lower slowly to a straight leg.",
    ],
    watchFor: [
      {
        mistake: "Hips pulling away from the pad to swing the weight.",
        fix: "Keep your hips pressed into the pad. If they move, drop the weight.",
      },
      {
        mistake: "Letting the weight crash down.",
        fix: "Take two or three seconds on the way down. The lowering is where hamstrings get strong.",
      },
    ],
  },
  "stability-ball-leg-curl": {
    setup: [
      "Lie on your back with the heels on a stability ball, arms out on the floor.",
      "Lift the hips so the body is straight from shoulders to heels.",
    ],
    execution: [
      "Keep the hips up and curl the ball toward you with your heels.",
      "Roll it back out slowly without letting the hips drop.",
    ],
    watchFor: [
      {
        mistake: "Hips sagging as the ball rolls in.",
        fix: "Push your hips up as you curl, so they finish higher than they started.",
      },
      {
        mistake: "Letting the ball roll out on its own.",
        fix: "Control the ball on the way out. Try one leg at a time once both are easy.",
      },
    ],
  },
  "zercher-squat": {
    setup: [
      "Set the bar in a rack at about hip height.",
      "Hook the bar into the crooks of the elbows, hands clasped, and stand up with it.",
      "Wrap the bar in a pad or towel if it digs in.",
    ],
    execution: [
      "Squat down between the legs, keeping the torso upright.",
      "Drive back up through the whole foot.",
    ],
    watchFor: [
      {
        mistake: "Rounding the upper back as the bar pulls forward.",
        fix: "Squeeze your upper back and keep your elbows up. Lighten the bar if you round.",
      },
      {
        mistake: "Resting the elbows on the thighs at the bottom.",
        fix: "Keep your elbows between your knees. Resting them on your legs lets your back relax under load.",
      },
    ],
  },
  "landmine-squat": {
    setup: [
      "Hold the loaded end of a landmine bar at the chest with both hands.",
      "Step back so you lean slightly into the bar, feet shoulder width.",
    ],
    execution: [
      "Squat down, letting the bar travel in its arc.",
      "Drive up through the whole foot back to standing.",
    ],
    watchFor: [
      {
        mistake: "Letting the bar drop away from the chest.",
        fix: "Keep the bar held tight against your chest. If it drifts, your upper back is losing position.",
      },
      {
        mistake: "Standing too far forward so the bar pushes you back.",
        fix: "Adjust your feet until you can squat straight down with a slight lean into the bar.",
      },
    ],
  },
  "thruster": {
    setup: [
      "Bar in the front rack on the shoulders, or dumbbells held at the shoulders.",
      "Feet shoulder width, elbows high.",
    ],
    execution: [
      "Front squat down to full depth.",
      "Drive up hard and use that momentum to press the weight overhead in one motion.",
      "Bring it back to the shoulders as you sink into the next squat.",
    ],
    watchFor: [
      {
        mistake: "Pressing before the legs have finished driving.",
        fix: "Let the legs launch the bar. The press starts as your hips reach the top, not before.",
      },
      {
        mistake: "Elbows dropping in the squat so the bar rolls forward.",
        fix: "Keep your elbows up throughout the squat. Dropping them tips the weight and your chest forward.",
      },
    ],
  },
  "wall-ball": {
    setup: [
      "Stand arm's length from a wall with a medicine ball held at the chest.",
      "Feet shoulder width, eyes on a target on the wall.",
    ],
    execution: [
      "Squat to full depth, then drive up and throw the ball to the target.",
      "Catch it on the way down and go straight into the next squat.",
    ],
    watchFor: [
      {
        mistake: "Throwing with the arms only and cutting the squat short.",
        fix: "Squat to full depth every rep and let your legs throw the ball. The arms just guide it.",
      },
      {
        mistake: "Standing so close that the ball comes back into your face.",
        fix: "Stand about an arm's length from the wall so the ball drops in front of you.",
      },
    ],
  },
  "split-squat": {
    setup: [
      "Stand in a long staggered stance, back heel lifted.",
      "Hold weights at your sides or use just bodyweight.",
    ],
    execution: [
      "Drop the back knee straight down toward the floor.",
      "Push through the front foot back up, keeping the stance fixed.",
    ],
    watchFor: [
      {
        mistake: "A stance so short that the front heel lifts.",
        fix: "Lengthen your stance until your front foot stays flat at the bottom.",
      },
      {
        mistake: "Front knee caving in.",
        fix: "Keep your front knee tracking over your toes the whole rep.",
      },
    ],
  },
  "pistol-squat": {
    setup: [
      "Stand on one leg with the other held straight out in front.",
      "Hold a post or TRX, or squat to a box, until you can do full reps.",
    ],
    execution: [
      "Sit down slowly on the standing leg, arms reaching forward for balance.",
      "Drive back up without letting the free foot touch the floor.",
    ],
    watchFor: [
      {
        mistake: "The standing heel lifting at the bottom.",
        fix: "Keep your heel down. A small plate under it helps while your ankle mobility catches up.",
      },
      {
        mistake: "Dropping into the bottom and bouncing out.",
        fix: "Lower under control. Use a box or support until you can own the whole range.",
      },
    ],
  },
  "bodyweight-squat": {
    setup: [
      "Feet about shoulder width, toes turned out slightly.",
      "Arms forward or hands at the chest for balance.",
    ],
    execution: [
      "Sit down between the heels as deep as you can with a flat back.",
      "Stand back up, squeezing the glutes at the top.",
    ],
    watchFor: [
      {
        mistake: "Heels lifting off the floor.",
        fix: "Keep your weight across the whole foot. Widen your stance or turn your toes out more if the heels rise.",
      },
      {
        mistake: "Knees caving in.",
        fix: "Push your knees out over your toes on the way up.",
      },
    ],
  },
  "jump-squat": {
    setup: [
      "Feet shoulder width, arms ready to swing.",
      "Warm up with some bodyweight squats first.",
    ],
    execution: [
      "Dip into a quarter to half squat, then jump as high as you can.",
      "Land softly on the balls of the feet, rolling back to the heels, and reset.",
    ],
    watchFor: [
      {
        mistake: "Landing stiff-legged.",
        fix: "Land with bent knees and hips, as quietly as you can. Soft landings mean your muscles are absorbing the force.",
      },
      {
        mistake: "Knees caving in on the landing.",
        fix: "Land with your knees over your toes. If they cave, jump lower until they stop.",
      },
    ],
  },
  "wall-sit": {
    setup: [
      "Back flat against a wall, feet about two feet out in front.",
      "Slide down until the thighs are parallel to the floor.",
    ],
    execution: [
      "Hold with the knees over the ankles and the back flat against the wall.",
      "Breathe steadily and keep the hands off the thighs.",
    ],
    watchFor: [
      {
        mistake: "Pushing on the thighs with the hands.",
        fix: "Cross your arms or hold them out in front. Pushing on your legs takes the load off them.",
      },
      {
        mistake: "Feet too close so the knees travel past the toes.",
        fix: "Walk your feet out until your shins are vertical at the bottom.",
      },
    ],
  },
  "lateral-lunge": {
    setup: [
      "Stand with the feet together, or hold a dumbbell at the chest.",
      "Toes pointing forward.",
    ],
    execution: [
      "Take a big step out to the side and sit the hips back over that foot.",
      "Keep the other leg straight, then push back to the start.",
    ],
    watchFor: [
      {
        mistake: "Stepping out and bending the knee without sitting back.",
        fix: "Push your hips back as you bend, like a one-sided squat. The hip should go back, not just down.",
      },
      {
        mistake: "The working heel lifting.",
        fix: "Keep your whole foot flat. Take a shorter step if your heel comes up.",
      },
    ],
  },
  "cossack-squat": {
    setup: [
      "Wide stance, toes turned out slightly.",
      "Hold a light weight at the chest to counterbalance, or hold onto something.",
    ],
    execution: [
      "Shift down onto one leg, the other leg straightening with the toes pointing up.",
      "Go as deep as you can with the heel flat, then shift across to the other side.",
    ],
    watchFor: [
      {
        mistake: "The heel of the bent leg lifting.",
        fix: "Only go as deep as your heel allows. Depth comes with practice, and a lifted heel just moves the strain to the knee.",
      },
      {
        mistake: "Rounding forward to reach depth.",
        fix: "Keep your chest up. A counterweight held at the chest makes this easier.",
      },
    ],
  },
  "sumo-squat": {
    setup: [
      "Wide stance, toes turned out, holding a dumbbell or kettlebell between the legs.",
      "Chest up, arms long.",
    ],
    execution: [
      "Squat straight down, pushing the knees out over the toes.",
      "Drive back up and squeeze the glutes at the top.",
    ],
    watchFor: [
      {
        mistake: "Knees caving in toward each other.",
        fix: "Push your knees out in line with your toes the whole way down and up.",
      },
      {
        mistake: "Leaning forward to reach the weight toward the floor.",
        fix: "Stay upright. Stand on two boxes if you want the bell to go deeper.",
      },
    ],
  },
  "reverse-nordic": {
    setup: [
      "Kneel on a pad with the feet anchored or toes tucked.",
      "Body upright in a straight line from knees to head.",
    ],
    execution: [
      "Lean the whole body back from the knees as far as you can control.",
      "Pull yourself back to upright using the quads.",
    ],
    watchFor: [
      {
        mistake: "Bending at the hips to make it easier.",
        fix: "Squeeze your glutes and keep a straight line from your knees to your head.",
      },
      {
        mistake: "Going further back than you can return from.",
        fix: "Start with a small range and build it up. A band anchored in front can help you back up.",
      },
    ],
  },
  "cable-hip-adduction": {
    setup: [
      "Attach an ankle strap to a low cable and stand side-on, strap on the near leg.",
      "Hold the machine for balance.",
    ],
    execution: [
      "Sweep the leg in across the front of the body.",
      "Let it return slowly out to the side.",
    ],
    watchFor: [
      {
        mistake: "Leaning the torso to swing the leg across.",
        fix: "Stand tall and move only your leg. If you have to lean, use a lighter weight.",
      },
      {
        mistake: "Letting the cable pull the leg out too wide.",
        fix: "Control the return and stop at a comfortable stretch in your inner thigh.",
      },
    ],
  },
  "copenhagen-plank": {
    setup: [
      "Lie on your side with the top leg resting on a bench, forearm under the shoulder.",
      "Rest the inside of the knee on the bench to make it easier, or the ankle to make it harder.",
    ],
    execution: [
      "Lift the hips until the body is in a straight line, held up by the top leg.",
      "Hold for time, then switch sides.",
    ],
    watchFor: [
      {
        mistake: "Starting with the ankle on the bench.",
        fix: "Begin with your knee on the bench. The adductors take time to build up to the full lever.",
      },
      {
        mistake: "Hips sagging toward the floor.",
        fix: "Press your top leg down into the bench and lift your hips. End the set when you cannot hold the line.",
      },
    ],
  },
  "single-leg-calf-raise": {
    setup: [
      "Stand on one foot on a step, heel hanging off, holding a rail for balance.",
      "Hold a dumbbell in the other hand to add load.",
    ],
    execution: [
      "Rise as high as you can onto the ball of the foot, and pause.",
      "Lower slowly until the heel drops below the step.",
    ],
    watchFor: [
      {
        mistake: "Bouncing through quick, short reps.",
        fix: "Pause at the top and at the bottom. The full stretch and squeeze are what grow the calf.",
      },
      {
        mistake: "Rolling onto the outside of the foot.",
        fix: "Push through your big toe as you rise so your ankle stays straight.",
      },
    ],
  },
  "smith-calf-raise": {
    setup: [
      "Set the bar at shoulder height and put a plate or step under the bar.",
      "Balls of the feet on the plate, bar across the upper back.",
    ],
    execution: [
      "Unrack and rise as high as you can onto the toes.",
      "Lower until the heels drop below the plate for a full stretch.",
    ],
    watchFor: [
      {
        mistake: "Bending the knees to push the bar up.",
        fix: "Keep your legs straight. Only your ankles should move.",
      },
      {
        mistake: "A plate that slides under the feet.",
        fix: "Use a stable step or a plate on a non-slip mat, and check it before loading heavy.",
      },
    ],
  },
  "hip-thrust": {
    setup: [
      "Shoulder blades on a bench, bar across the hips with a pad.",
      "Feet flat, shins vertical at the top, chin tucked.",
    ],
    execution: [
      "Drive through the heels and lift the hips to a straight line from knee to shoulder.",
      "Squeeze hard at the top, then lower under control.",
    ],
    watchFor: [
      {
        mistake: "Arching the lower back at the top instead of finishing with the glutes.",
        fix: "Tuck your ribs down and finish by squeezing your glutes, not by leaning back.",
      },
      {
        mistake: "Feet too far forward, which hands the work to the hamstrings.",
        fix: "Move them back until your shins are vertical at the top.",
      },
    ],
  },
  "machine-hip-thrust": {
    setup: [
      "Back against the pad, belt or pad across the hips.",
      "Feet flat, shins vertical at lockout.",
    ],
    execution: [
      "Drive the hips up to full extension and squeeze.",
      "Lower under control without letting the stack land.",
    ],
    watchFor: [
      {
        mistake: "Pushing through the toes rather than the heels.",
        fix: "Drive through your heels; you should be able to lift your toes.",
      },
    ],
  },
  "single-leg-hip-thrust": {
    setup: [
      "Shoulder blades on a bench, one foot planted, other leg raised.",
      "Hips level before you start.",
    ],
    execution: [
      "Drive up through the planted heel to full extension.",
      "Lower under control keeping the hips square.",
    ],
    watchFor: [
      {
        mistake: "Letting the raised side of the hip drop through the rep.",
        fix: "Keep your hips level. If one side sags, the working glute is not strong enough yet.",
      },
    ],
  },
  "b-stance-hip-thrust": {
    setup: [
      "Shoulder blades on a bench, one foot planted, the other's heel just ahead as a kickstand.",
      "Most of the load stays on the planted foot.",
    ],
    execution: [
      "Drive up through the working heel to full extension and squeeze.",
      "Lower under control.",
    ],
    watchFor: [
      {
        mistake: "Pushing evenly through both feet, which makes it an ordinary thrust.",
        fix: "Keep the kickstand heel light — most of the drive comes from the planted foot.",
      },
    ],
  },
  "glute-bridge": {
    setup: [
      "Lie on the floor, feet flat and close to the glutes.",
      "Arms at the sides, chin tucked.",
    ],
    execution: [
      "Drive through the heels and lift the hips until the body is straight.",
      "Squeeze, then lower under control.",
    ],
    watchFor: [
      {
        mistake: "Pushing the hips so high the lower back takes over.",
        fix: "Stop at a straight line from your knees to your shoulders.",
      },
    ],
  },
  "cable-pull-through": {
    setup: [
      "Low pulley behind you, rope between the legs, step forward to tension.",
      "Soft knees, chest up.",
    ],
    execution: [
      "Hinge at the hips letting the rope travel back, then drive the hips forward.",
      "Finish standing tall with a glute squeeze.",
    ],
    watchFor: [
      {
        mistake: "Squatting instead of hinging.",
        fix: "Push your hips back rather than bending your knees; your shins should stay near vertical.",
      },
      {
        mistake: "Leaning back at the top.",
        fix: "Finish standing tall with a glute squeeze, not leaning backwards.",
      },
    ],
  },
  "cable-kickback": {
    setup: [
      "Ankle strap on a low pulley, hold the frame for balance.",
      "Slight hinge forward, core braced.",
    ],
    execution: [
      "Drive the leg back and up, squeezing the glute.",
      "Return under control without letting the stack land.",
    ],
    watchFor: [
      {
        mistake: "Arching the lower back to get more range.",
        fix: "Keep your ribs down and let the range be whatever your hip gives you.",
      },
    ],
  },
  "reverse-hyper": {
    setup: [
      "Hips at the edge of the pad, torso supported, hands gripping the handles.",
      "Legs hanging with the strap or pads in place.",
    ],
    execution: [
      "Swing the legs up to about hip height using the glutes.",
      "Lower under control rather than letting them fall.",
    ],
    watchFor: [
      {
        mistake: "Using momentum so the machine swings you instead of the other way round.",
        fix: "Control both directions. If the machine is throwing you, go lighter.",
      },
    ],
  },
  "sumo-dl": {
    setup: [
      "Wide stance, toes turned out, hands inside the legs.",
      "Hips lower than a conventional pull, chest up, lats tight.",
      "Pull the slack out before you move the bar.",
    ],
    execution: [
      "Push the floor apart and stand, keeping the bar against the legs.",
      "Lock the hips out at the top without leaning back.",
    ],
    watchFor: [
      {
        mistake: "Hips rising first and turning it into a stiff-legged pull.",
        fix: "Push the floor apart with your legs so hips and shoulders rise together.",
      },
      {
        mistake: "Knees caving in off the floor.",
        fix: "Screw your feet into the floor and push your knees out over your toes.",
      },
    ],
  },
  "curtsy-lunge": {
    setup: [
      "Stand tall, weight at the sides or at the chest.",
      "Core braced.",
    ],
    execution: [
      "Step one leg back and across behind the other, lowering the back knee.",
      "Drive back up through the front heel.",
    ],
    watchFor: [
      {
        mistake: "Crossing so far behind that the hips and knee twist.",
        fix: "Step back and across only as far as your hips stay square.",
      },
    ],
  },
  "abduction-machine": {
    setup: [
      "Seated with the pads on the outside of the thighs.",
      "Sit upright, or lean forward slightly to bias the upper glute.",
    ],
    execution: [
      "Push the knees apart, pause at the end, and return under control.",
    ],
    watchFor: [
      {
        mistake: "Slamming the stack back down between reps.",
        fix: "Return under control and stop just short of the bottom.",
      },
    ],
  },
  "banded-lateral-walk": {
    setup: [
      "Band around the thighs just above the knees, feet hip width.",
      "Quarter squat, chest up.",
    ],
    execution: [
      "Step sideways keeping constant tension on the band.",
      "Do not let the feet come all the way together between steps.",
    ],
    watchFor: [
      {
        mistake: "Standing tall, which takes the tension off the glutes.",
        fix: "Stay in a quarter squat the whole way across.",
      },
    ],
  },
  "frog-pump": {
    setup: [
      "On your back, soles of the feet together, knees out wide.",
      "Heels drawn in toward the hips.",
    ],
    execution: [
      "Drive the hips up by squeezing the glutes, then lower under control.",
    ],
    watchFor: [
      {
        mistake: "Pushing through the outside of the feet instead of squeezing the glutes.",
        fix: "Press your heels together and drive from the glutes.",
      },
    ],
  },
  "kettlebell-swing": {
    setup: [
      "Bell on the floor a foot in front of you, feet shoulder width.",
      "Hinge and grip the bell with both hands, back flat.",
    ],
    execution: [
      "Hike the bell back between the legs like a football snap.",
      "Snap the hips forward to float the bell to chest height, arms relaxed.",
      "Let it fall back and hinge to catch it, then go again.",
    ],
    watchFor: [
      {
        mistake: "Squatting the swing instead of hinging.",
        fix: "Push your hips back with only a slight knee bend. The power comes from your hips snapping forward.",
      },
      {
        mistake: "Lifting the bell with the arms.",
        fix: "Let your arms act like ropes. If you are raising it with your shoulders, drive harder with your hips.",
      },
    ],
  },
  "smith-hip-thrust": {
    setup: [
      "Set a bench beside the Smith machine and sit with the bar over your hips, padded.",
      "Upper back on the bench, feet flat and shins vertical at the top.",
    ],
    execution: [
      "Unrack by driving the hips up, then lower and thrust up to a straight line from knee to shoulder.",
      "Squeeze at the top, then lower under control.",
    ],
    watchFor: [
      {
        mistake: "Bench so close that the bar path pins you into it.",
        fix: "Adjust your setup before loading so the bar travels straight up and down over your hips.",
      },
      {
        mistake: "Arching the lower back to finish.",
        fix: "Tuck your ribs and chin and finish with your glutes, not your spine.",
      },
    ],
  },
  "machine-glute-kickback": {
    setup: [
      "Set up on the machine with the working foot on the plate or pad.",
      "Chest on the support, hands on the handles, hips square.",
    ],
    execution: [
      "Drive the leg back until the hip is fully extended, and squeeze.",
      "Return under control without letting the weight stack land.",
    ],
    watchFor: [
      {
        mistake: "Arching the lower back to get the leg higher.",
        fix: "Stop when your hip is straight. Past that, your lower back is doing the moving.",
      },
      {
        mistake: "Rotating the hips open as the leg goes back.",
        fix: "Keep both hips facing the floor and push straight back.",
      },
    ],
  },
  "donkey-kick": {
    setup: [
      "Hands under the shoulders and knees under the hips.",
      "Keep one knee bent at 90°.",
    ],
    execution: [
      "Drive that foot up toward the ceiling until the thigh is level with the body.",
      "Squeeze, lower, and repeat before switching sides.",
    ],
    watchFor: [
      {
        mistake: "Arching the lower back to kick higher.",
        fix: "Brace your abs and stop when your thigh is level with your body.",
      },
      {
        mistake: "Swinging the leg up with momentum.",
        fix: "Lift slowly and pause at the top. Add an ankle weight or band once that is easy.",
      },
    ],
  },
  "fire-hydrant": {
    setup: [
      "Hands under the shoulders and knees under the hips.",
      "Back flat and core braced.",
    ],
    execution: [
      "Lift one bent leg out to the side, keeping the knee bent.",
      "Pause at the top, lower, and repeat before switching sides.",
    ],
    watchFor: [
      {
        mistake: "Leaning the whole body away to lift the leg higher.",
        fix: "Keep your weight centred between your hands. The range is smaller than it looks, and that is fine.",
      },
      {
        mistake: "Rushing the reps.",
        fix: "Pause at the top of each rep. Add a band around the knees once it gets easy.",
      },
    ],
  },
  "clamshell": {
    setup: [
      "Lie on your side with the hips and knees bent, feet together.",
      "Loop a band just above the knees if you have one.",
    ],
    execution: [
      "Keep the feet touching and open the top knee as far as you can without the hips rolling.",
      "Lower slowly and repeat before switching sides.",
    ],
    watchFor: [
      {
        mistake: "Rolling the top hip backward to open further.",
        fix: "Keep your hips stacked. Rest your top hand on your hip to feel for any roll.",
      },
      {
        mistake: "Letting the feet come apart.",
        fix: "Keep your heels pressed together. The hinge is at the hip, like a clam opening.",
      },
    ],
  },
  "side-lying-hip-abduction": {
    setup: [
      "Lie on your side with the legs straight and stacked.",
      "Bend the bottom knee for balance if you need to.",
    ],
    execution: [
      "Raise the top leg with the toes pointing forward.",
      "Lower slowly without letting it rest on the bottom leg.",
    ],
    watchFor: [
      {
        mistake: "Turning the toes up toward the ceiling.",
        fix: "Keep your toes pointing forward or slightly down, so the side of your glute does the lift instead of your hip flexors.",
      },
      {
        mistake: "Letting the leg drift forward.",
        fix: "Keep your leg in line with your body, or even slightly behind it.",
      },
    ],
  },
  "cable-hip-abduction": {
    setup: [
      "Attach an ankle strap to a low cable and stand side-on, strap on the far leg.",
      "Hold the machine for balance and stand tall.",
    ],
    execution: [
      "Sweep the leg out to the side, away from the machine.",
      "Return slowly until the feet are close together.",
    ],
    watchFor: [
      {
        mistake: "Leaning the torso away to get the leg higher.",
        fix: "Stay upright. The range is short, and a lean lets your lower back take over.",
      },
      {
        mistake: "Rotating the toes up to the ceiling.",
        fix: "Keep your toes pointing forward so the side of the glute does the work.",
      },
    ],
  },
  "plank": {
    setup: [
      "Forearms under the shoulders, feet hip width.",
      "Body in one line from head to heels.",
    ],
    execution: [
      "Squeeze the glutes and abs and hold, breathing normally.",
      "Stop the set when the hips start to drop, not when the clock says so.",
    ],
    watchFor: [
      {
        mistake: "Hips sagging toward the floor, which loads the lower back.",
        fix: "Squeeze your glutes and abs; end the set when the sag starts rather than holding a broken position.",
      },
      {
        mistake: "Piking the hips up to make it easier.",
        fix: "Lower your hips until your body is one straight line, even if that shortens the hold.",
      },
    ],
  },
  "side-plank": {
    setup: [
      "Forearm under the shoulder, feet stacked or staggered.",
      "Hips lifted so the body is a straight line.",
    ],
    execution: [
      "Hold, keeping the top hip stacked over the bottom one.",
      "Breathe steadily rather than holding your breath.",
    ],
    watchFor: [
      {
        mistake: "Letting the bottom hip sink toward the floor.",
        fix: "Push the floor away and lift your hip back to a straight line, or drop to your knee.",
      },
    ],
  },
  "hollow-hold": {
    setup: [
      "On your back, lower back pressed flat into the floor.",
      "Arms overhead, legs straight.",
    ],
    execution: [
      "Lift the shoulders and legs just off the floor and hold that shape.",
      "The lower back must stay flat — raise the legs higher if it lifts.",
    ],
    watchFor: [
      {
        mistake: "Letting the lower back arch off the floor, which is the whole point of the position.",
        fix: "Raise your legs higher until your back presses flat again.",
      },
    ],
  },
  "crunch": {
    setup: [
      "On your back, knees bent, feet flat, hands at the chest or temples.",
      "Chin in a neutral position.",
    ],
    execution: [
      "Curl the shoulders off the floor by shortening the abs.",
      "Lower under control.",
    ],
    watchFor: [
      {
        mistake: "Pulling on the head with the hands.",
        fix: "Rest your fingertips at your temples and lead with your ribs, not your neck.",
      },
      {
        mistake: "Turning it into a sit-up by hinging at the hip.",
        fix: "Only lift your shoulder blades off the floor; your lower back stays down.",
      },
    ],
  },
  "sit-up": {
    setup: [
      "Knees bent, feet flat or anchored, hands at the chest.",
      "Chin neutral.",
    ],
    execution: [
      "Curl up to a seated position, then lower under control.",
    ],
    watchFor: [
      {
        mistake: "Yanking the neck forward to start each rep.",
        fix: "Keep your chin in a neutral spot and curl up from your abs.",
      },
    ],
  },
  "decline-sit-up": {
    setup: [
      "Legs hooked on a decline bench, hands at the chest.",
      "Set a modest decline before you add weight.",
    ],
    execution: [
      "Curl up, rounding the spine rather than hinging stiffly.",
      "Lower under control to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Dropping back fast at the end of the rep.",
        fix: "Lower under control. The way down is half the work.",
      },
    ],
  },
  "bicycle-crunch": {
    setup: [
      "On your back, lower back flat, legs raised and knees bent.",
      "Hands lightly at the temples.",
    ],
    execution: [
      "Bring one elbow toward the opposite knee as the other leg extends.",
      "Alternate at a controlled pace.",
    ],
    watchFor: [
      {
        mistake: "Racing through reps and yanking the neck side to side.",
        fix: "Slow down and rotate from your ribs; your hands are only resting on your head.",
      },
    ],
  },
  "reverse-crunch": {
    setup: [
      "On your back, hands at the sides, knees bent over the hips.",
      "Lower back pressed flat.",
    ],
    execution: [
      "Curl the hips off the floor bringing the knees toward the chest.",
      "Lower under control without letting the feet touch down.",
    ],
    watchFor: [
      {
        mistake: "Swinging the legs to generate the momentum.",
        fix: "Start each rep from still and curl your hips off the floor deliberately.",
      },
    ],
  },
  "cable-crunch": {
    setup: [
      "Kneel facing a high pulley, rope at the sides of the head.",
      "Hips stay fixed — they do not move all set.",
    ],
    execution: [
      "Crunch down by rounding the spine, elbows toward the thighs.",
      "Return under control to a stretch.",
    ],
    watchFor: [
      {
        mistake: "Hinging at the hips, which makes it a pulldown with your abs along for the ride.",
        fix: "Keep your hips fixed and round your spine down toward your thighs.",
      },
    ],
  },
  "ab-crunch-machine": {
    setup: [
      "Seat and pads set so the pivot lines up with the mid-torso.",
      "Grip the handles lightly.",
    ],
    execution: [
      "Crunch by shortening the abs, not by pulling with the arms.",
      "Return under control.",
    ],
    watchFor: [
      {
        mistake: "Pulling the handles with the lats to move the stack.",
        fix: "Hold the handles loosely and crunch with your abs.",
      },
    ],
  },
  "hanging-leg-raise": {
    setup: [
      "Hang from a bar, shoulders active and pulled down.",
      "Legs together, body still before the first rep.",
    ],
    execution: [
      "Raise the legs to at least hip height, curling the pelvis up at the top.",
      "Lower under control without swinging.",
    ],
    watchFor: [
      {
        mistake: "Swinging into each rep, which makes it momentum rather than abs.",
        fix: "Pause hanging still between reps, and use straps if your grip gives out first.",
      },
      {
        mistake: "Stopping at hip height without curling the pelvis, which skips the abs entirely.",
        fix: "Finish by tilting your pelvis up toward your ribs at the top.",
      },
    ],
  },
  "leg-raise": {
    setup: [
      "On your back, hands under the hips or at the sides.",
      "Lower back pressed flat into the floor.",
    ],
    execution: [
      "Raise the legs to vertical, then lower as far as you can without the back arching.",
      "That point is your range — it will improve.",
    ],
    watchFor: [
      {
        mistake: "Letting the lower back peel off the floor on the way down.",
        fix: "Stop lowering at the point it lifts. That range will grow.",
      },
    ],
  },
  "toes-to-bar": {
    setup: [
      "Hang from a bar with an active shoulder.",
      "Legs together.",
    ],
    execution: [
      "Raise the legs all the way to touch the bar, curling the pelvis.",
      "Lower under control.",
    ],
    watchFor: [
      {
        mistake: "Kipping so hard the movement becomes a swing.",
        fix: "Control the descent and pause at the bottom before the next rep.",
      },
    ],
  },
  "flutter-kick": {
    setup: [
      "On your back, hands under the hips, legs straight and just off the floor.",
      "Lower back flat.",
    ],
    execution: [
      "Alternate small, quick kicks without letting the back arch.",
      "Keep the legs low enough to be hard, high enough to hold position.",
    ],
    watchFor: [
      {
        mistake: "Letting the lower back lift as the set goes on.",
        fix: "Raise your legs a little higher, or end the set.",
      },
    ],
  },
  "v-up": {
    setup: [
      "On your back, arms overhead, legs straight.",
      "Lower back flat to start.",
    ],
    execution: [
      "Lift the arms and legs together to meet over the hips.",
      "Lower under control without touching down.",
    ],
    watchFor: [
      {
        mistake: "Throwing the arms to generate momentum.",
        fix: "Move your arms and legs at the same speed and keep your back flat.",
      },
    ],
  },
  "ab-rollout": {
    setup: [
      "Kneel with the wheel under the shoulders, core braced.",
      "Ribs down, glutes squeezed.",
    ],
    execution: [
      "Roll out only as far as you can hold a flat back, then pull back.",
      "Range comes with time — do not chase it.",
    ],
    watchFor: [
      {
        mistake: "Letting the hips sag and the lower back arch at full extension.",
        fix: "Roll out only as far as you can hold a flat back, and build the range over weeks.",
      },
    ],
  },
  "dead-bug": {
    setup: [
      "On your back, arms straight up, knees over the hips at 90°.",
      "Lower back pressed flat into the floor.",
    ],
    execution: [
      "Lower one arm and the opposite leg toward the floor, then return.",
      "The lower back stays flat the whole time.",
    ],
    watchFor: [
      {
        mistake: "Moving so far that the back arches — shorten the range instead.",
        fix: "Stop each limb where your back stays flat; a smaller range done properly is the exercise.",
      },
    ],
  },
  "russian-twist": {
    setup: [
      "Sit with the knees bent, torso leaning back, feet up or down.",
      "Hold a weight at the chest.",
    ],
    execution: [
      "Rotate the torso side to side, moving from the ribs rather than the arms.",
      "Control the turn at each end.",
    ],
    watchFor: [
      {
        mistake: "Swinging the arms while the torso stays still.",
        fix: "Rotate from your ribs and let your arms follow.",
      },
    ],
  },
  "pallof-press": {
    setup: [
      "Stand side-on to a cable at chest height, handle at the sternum.",
      "Feet hip width, core braced against the pull.",
    ],
    execution: [
      "Press the handle straight out and resist the rotation.",
      "Return to the chest without letting the torso turn.",
    ],
    watchFor: [
      {
        mistake: "Letting the torso rotate toward the stack — resisting that is the exercise.",
        fix: "Brace and refuse the twist. If you cannot, take weight off.",
      },
    ],
  },
  "woodchopper": {
    setup: [
      "Cable set high or low, handle in both hands, feet planted.",
      "Brace the midsection.",
    ],
    execution: [
      "Pull diagonally across the body, rotating from the torso.",
      "Return under control along the same path.",
    ],
    watchFor: [
      {
        mistake: "Pulling with the arms while the torso stays square.",
        fix: "Turn from your midsection and let your arms stay in front of your chest.",
      },
    ],
  },
  "hanging-knee-raise": {
    setup: [
      "Hang from a bar with straight arms and an overhand grip.",
      "Shoulders slightly engaged, legs together.",
    ],
    execution: [
      "Bring the knees up toward the chest, curling the pelvis at the top.",
      "Lower slowly to a full hang without swinging.",
    ],
    watchFor: [
      {
        mistake: "Swinging the body to get the knees up.",
        fix: "Pause at the bottom of every rep until the swing stops. Momentum takes the work away from your abs.",
      },
      {
        mistake: "Lifting the knees only to hip height.",
        fix: "Curl your pelvis up at the top so your knees travel toward your chest. That curl is where the abs work.",
      },
    ],
  },
  "dragon-flag": {
    setup: [
      "Lie on a bench and grip it behind your head.",
      "Roll up onto the upper back with the body pointing at the ceiling.",
    ],
    execution: [
      "Lower the body as one straight piece, keeping only the upper back on the bench.",
      "Stop before you lose the line, then raise back up.",
      "Start with negatives or bent knees before full reps.",
    ],
    watchFor: [
      {
        mistake: "Bending at the hips as you lower.",
        fix: "Keep a straight line from your shoulders to your feet. Bend your knees to shorten the lever if you cannot.",
      },
      {
        mistake: "Resting the weight on the neck.",
        fix: "Stay on your upper back and shoulders, never your neck. Grip the bench hard to hold that position.",
      },
    ],
  },
  "windshield-wiper": {
    setup: [
      "Lie on your back with the arms out wide, legs raised to vertical.",
      "Harder version: hang from a bar with the legs raised.",
    ],
    execution: [
      "Lower the legs together to one side under control.",
      "Bring them back through the middle and over to the other side.",
    ],
    watchFor: [
      {
        mistake: "Letting the legs drop to the floor.",
        fix: "Only go as far as you can control. Bend your knees to make it easier.",
      },
      {
        mistake: "Shoulders lifting off the floor.",
        fix: "Press your arms into the floor to keep your upper back down, and shorten the range if you still lift.",
      },
    ],
  },
  "l-sit": {
    setup: [
      "Hands on parallettes, dip bars or two boxes, arms straight.",
      "Push the shoulders down away from the ears.",
    ],
    execution: [
      "Lift the legs straight out in front until they are level with the hips.",
      "Hold for time, then lower the feet down.",
      "Tuck the knees if the straight-leg version is too hard.",
    ],
    watchFor: [
      {
        mistake: "Shoulders shrugging up to the ears.",
        fix: "Push hard through your hands and keep your shoulders down. That is what holds your body up.",
      },
      {
        mistake: "Legs drooping toward the floor.",
        fix: "Use a tucked position until you can keep straight legs level. A good tuck hold builds more than a sagging L-sit.",
      },
    ],
  },
  "bird-dog": {
    setup: [
      "Hands under the shoulders and knees under the hips.",
      "Back flat, eyes on the floor.",
    ],
    execution: [
      "Reach one arm forward and the opposite leg back until both are level with the body.",
      "Pause, return, and switch sides.",
    ],
    watchFor: [
      {
        mistake: "Hips tilting as the leg lifts.",
        fix: "Keep your hips level, as if balancing a glass of water on your lower back.",
      },
      {
        mistake: "Lifting the leg high enough to arch the back.",
        fix: "Stop when your leg is in line with your body. Higher than that turns it into a back bend.",
      },
    ],
  },
  "plank-shoulder-tap": {
    setup: [
      "High plank position, hands under the shoulders.",
      "Feet a little wider than usual for balance.",
    ],
    execution: [
      "Lift one hand and tap the opposite shoulder.",
      "Put it back down and switch, keeping the hips still.",
    ],
    watchFor: [
      {
        mistake: "Hips rocking side to side with each tap.",
        fix: "Squeeze your glutes and widen your feet. The hips staying still is the whole exercise.",
      },
      {
        mistake: "Hips drifting up into a pike.",
        fix: "Keep your body in a straight line from head to heels. Slow the taps down if the line breaks.",
      },
    ],
  },
  "stir-the-pot": {
    setup: [
      "Forearms on a stability ball, feet on the floor behind you in a plank.",
      "Brace the abs and squeeze the glutes.",
    ],
    execution: [
      "Draw small circles on the ball with the forearms.",
      "Do all the reps one way, then reverse direction.",
    ],
    watchFor: [
      {
        mistake: "Making huge circles that pull the hips around.",
        fix: "Keep the circles small. The hips should stay still while the arms move.",
      },
      {
        mistake: "Lower back sagging as the ball moves.",
        fix: "Widen your feet and brace harder. End the set when you cannot hold the plank line.",
      },
    ],
  },
  "db-side-bend": {
    setup: [
      "Stand tall with a dumbbell in one hand at your side.",
      "Free hand on the hip or behind the head.",
    ],
    execution: [
      "Bend sideways toward the dumbbell, sliding it down the leg.",
      "Pull back up using the opposite side of the waist, then switch sides.",
    ],
    watchFor: [
      {
        mistake: "Holding a dumbbell in each hand.",
        fix: "Use only one dumbbell. With one in each hand they balance each other out and the obliques do almost nothing.",
      },
      {
        mistake: "Twisting or leaning forward as you bend.",
        fix: "Bend straight to the side, as if your back were against a wall.",
      },
    ],
  },
  "landmine-rotation": {
    setup: [
      "Hold the end of a landmine bar overhead with both hands, arms long.",
      "Feet shoulder width, core braced.",
    ],
    execution: [
      "Lower the bar in an arc toward one hip, pivoting the back foot.",
      "Bring it back up over the head and across to the other hip.",
    ],
    watchFor: [
      {
        mistake: "Bending the arms and pulling with the shoulders.",
        fix: "Keep your arms long and let your trunk and hips turn the bar.",
      },
      {
        mistake: "Letting the bar drop fast at the end of the arc.",
        fix: "Control the bar all the way down. Stopping it is as much work as starting it.",
      },
    ],
  },
  "rotary-torso-machine": {
    setup: [
      "Set the start position so it matches the side you are turning toward.",
      "Sit tall with the knees locked in and the chest against the pad.",
    ],
    execution: [
      "Rotate the torso through the machine's range, leading with the ribs.",
      "Return slowly and switch sides after the set.",
    ],
    watchFor: [
      {
        mistake: "Setting the range wider than you can control.",
        fix: "Start with a small range and let it open up over time. Forceful end-range twisting is not where the obliques do their best work.",
      },
      {
        mistake: "Throwing the weight with momentum.",
        fix: "Move slowly in both directions. The obliques work hardest when the whole rep is controlled.",
      },
    ],
  },
  "suitcase-carry": {
    setup: [
      "Heavy dumbbell or kettlebell in one hand, the other hand free.",
      "Stand tall, shoulders level.",
    ],
    execution: [
      "Walk a set distance or time with steady steps.",
      "Switch hands and repeat.",
    ],
    watchFor: [
      {
        mistake: "Leaning away from the weight or toward it.",
        fix: "Stay perfectly upright with your shoulders level. That resistance to tipping is the exercise.",
      },
      {
        mistake: "Letting the weight hand drift away from the body.",
        fix: "Keep the weight close to your side and your arm straight.",
      },
    ],
  },
  "turkish-get-up": {
    setup: [
      "Lie on your back with a kettlebell pressed up in one hand, arm straight.",
      "Bend the knee on the same side and put that foot flat.",
      "Learn the steps without a weight, or with a shoe balanced on your fist, first.",
    ],
    execution: [
      "Roll onto the opposite elbow, then the hand, keeping the bell pointed at the ceiling.",
      "Lift the hips, sweep the straight leg under into a kneel, and stand up.",
      "Reverse each step slowly to lie back down.",
    ],
    watchFor: [
      {
        mistake: "Taking your eyes off the bell.",
        fix: "Keep looking at the kettlebell until you are standing. It keeps your arm straight above you.",
      },
      {
        mistake: "Rushing through the steps.",
        fix: "Pause at each position. The get-up is a slow movement, and speed is how the bell gets away from you.",
      },
    ],
  },
  "standing-cable-crunch": {
    setup: [
      "Set a rope on the high pulley and stand facing away from the stack.",
      "Hold the rope ends by the shoulders, feet hip width, knees soft.",
    ],
    execution: [
      "Crunch the ribs down toward the hips, rounding the spine.",
      "Come back up slowly to a stretch without letting the stack pull you tall.",
    ],
    watchFor: [
      {
        mistake: "Bending at the hips so it becomes a bow.",
        fix: "Keep your hips still and curl your spine. The movement comes from your ribs moving toward your pelvis.",
      },
      {
        mistake: "Pulling the rope down with the arms.",
        fix: "Pin your hands at your shoulders and let your torso move them. The arms only hold the rope in place.",
      },
    ],
  },
  "cable-side-bend": {
    setup: [
      "Stand side-on to a low pulley with a handle in the far hand.",
      "Feet hip width, the free hand on your hip.",
    ],
    execution: [
      "Lean away from the cable by bending at the waist.",
      "Let the cable draw you back toward it slowly, then switch sides after the set.",
    ],
    watchFor: [
      {
        mistake: "Twisting or leaning forward as you bend.",
        fix: "Bend straight to the side, as if your back were pressed against a wall.",
      },
      {
        mistake: "Pulling the handle up with the arm.",
        fix: "Keep your working arm straight and relaxed. The bend at your waist does the lifting.",
      },
    ],
  },
  "captains-chair-knee-raise": {
    setup: [
      "Back against the pad and forearms on the arm rests, gripping the handles.",
      "Let the legs hang straight down.",
    ],
    execution: [
      "Bring the knees up toward the chest, curling the pelvis off the back pad at the top.",
      "Lower slowly until the legs hang straight again.",
    ],
    watchFor: [
      {
        mistake: "Swinging the legs up and letting them drop.",
        fix: "Lower under control and pause at the bottom. Momentum takes the work away from your abs.",
      },
      {
        mistake: "Stopping with the thighs level and the back flat on the pad.",
        fix: "Tilt your pelvis up at the top so your hips lift slightly off the pad. That curl is where the abs do their job.",
      },
    ],
  },
  "barbell-rollout": {
    setup: [
      "Load the bar with round plates so it rolls smoothly.",
      "Kneel behind it with the hands shoulder width apart and the shoulders over the bar.",
    ],
    execution: [
      "Roll the bar forward, lowering the hips and chest together.",
      "Go only as far as you can keep a flat back, then pull it back in with the abs.",
    ],
    watchFor: [
      {
        mistake: "Hips sagging and the lower back arching at the far end.",
        fix: "Stop short of the point where your back arches. The range grows over weeks, not in one session.",
      },
      {
        mistake: "Rolling back in by sticking the hips up first.",
        fix: "Bring your hips and chest back together. Think about pulling the bar in with your stomach, not pushing your hips back.",
      },
    ],
  },
  "stability-ball-rollout": {
    setup: [
      "Kneel with a stability ball in front and your forearms resting on top.",
      "Brace the abs and squeeze the glutes.",
    ],
    execution: [
      "Roll the ball forward, letting the body lengthen from the knees.",
      "Stop while the back is still flat, then roll back in.",
    ],
    watchFor: [
      {
        mistake: "Letting the lower back sag as the ball rolls out.",
        fix: "Keep your ribs down and your glutes tight. Stop the roll wherever the sag would begin.",
      },
      {
        mistake: "Pushing the hips back instead of letting the ball travel.",
        fix: "Keep your hips moving forward in line with your shoulders. Folding at the hips takes the load off your abs.",
      },
    ],
  },
  "stability-ball-crunch": {
    setup: [
      "Sit on a stability ball and walk the feet out until your lower back rests on it.",
      "Feet wide for balance, hands at the chest or temples.",
    ],
    execution: [
      "Let the upper back stretch over the ball, then curl the ribs up.",
      "Pause at the top and lower back into the stretch.",
    ],
    watchFor: [
      {
        mistake: "Rolling the ball back and forth instead of crunching.",
        fix: "Keep your hips still and the ball in place. Only your upper body should move.",
      },
      {
        mistake: "Feet so close together that you wobble off the ball.",
        fix: "Widen your stance until you feel steady. You cannot crunch hard when you are busy balancing.",
      },
    ],
  },
  "stability-ball-pike": {
    setup: [
      "Push-up position with the hands under the shoulders and the shins or feet on a ball.",
      "Body in a straight line.",
    ],
    execution: [
      "Lift the hips toward the ceiling, rolling the ball in toward the hands.",
      "Lower back to the straight line under control.",
      "Tuck the knees in instead if the full pike is too hard.",
    ],
    watchFor: [
      {
        mistake: "Hips sagging between reps.",
        fix: "Return to a straight plank every rep, not a sag. Squeeze your glutes to hold it.",
      },
      {
        mistake: "Shoulders drifting back behind the hands at the top.",
        fix: "Keep your shoulders stacked over your wrists as your hips rise. That keeps the load on your abs, not your wrists.",
      },
    ],
  },
  "overhead-carry": {
    setup: [
      "Press a dumbbell or kettlebell overhead and lock the arm out.",
      "Stand tall with the ribs down and the biceps near the ear.",
    ],
    execution: [
      "Walk a set distance or time with steady steps.",
      "Switch hands, or carry one in each hand if you are using two.",
    ],
    watchFor: [
      {
        mistake: "Arching the lower back to get the weight overhead.",
        fix: "Pull your ribs down and squeeze your glutes. If you still arch, go lighter or carry at the shoulder instead.",
      },
      {
        mistake: "Letting the elbow bend as you tire.",
        fix: "Keep your arm locked straight. Set the weight down before the elbow softens rather than walking it out bent.",
      },
    ],
  },
  "front-rack-carry": {
    setup: [
      "Clean two kettlebells into the rack, resting against the forearms and chest.",
      "Elbows tucked in, wrists straight, standing tall.",
    ],
    execution: [
      "Walk a set distance or time with short, even steps.",
      "Breathe behind the brace rather than holding the breath.",
    ],
    watchFor: [
      {
        mistake: "Leaning back to balance the weight in front.",
        fix: "Stay stacked with your ribs over your hips. Holding that position against the load is what trains the abs.",
      },
      {
        mistake: "Elbows flaring out so the bells slide down the arms.",
        fix: "Squeeze your elbows in toward your ribs. The bells should sit snugly in the rack, not hang off your forearms.",
      },
    ],
  },
  "hanging-oblique-knee-raise": {
    setup: [
      "Hang from a bar with straight arms and the shoulders set.",
      "Legs together, body still.",
    ],
    execution: [
      "Bring the knees up and across toward one side, curling the pelvis.",
      "Lower slowly to a full hang, then go to the other side.",
    ],
    watchFor: [
      {
        mistake: "Swinging the legs sideways with momentum.",
        fix: "Pause at the bottom until the body is still. The obliques only work when you lift the knees, not throw them.",
      },
      {
        mistake: "Twisting the knees without lifting them.",
        fix: "Raise your knees toward your chest first, then angle them to the side. Height and rotation both count.",
      },
    ],
  },
  "heel-taps": {
    setup: [
      "Lie on your back with the knees bent and feet flat, a little wider than hip width.",
      "Lift the shoulders just off the floor, arms by your sides.",
    ],
    execution: [
      "Reach one hand down to touch that heel by bending sideways.",
      "Go back through the middle and reach to the other heel.",
    ],
    watchFor: [
      {
        mistake: "Letting the shoulders drop to the floor between taps.",
        fix: "Keep your shoulder blades off the floor for the whole set. The held crunch is what keeps the abs working.",
      },
      {
        mistake: "Tucking the chin hard into the chest.",
        fix: "Leave a fist-sized gap between your chin and chest so your neck stays relaxed.",
      },
    ],
  },
  "toe-touch-crunch": {
    setup: [
      "Lie on your back with the legs straight up over the hips.",
      "Arms reaching up toward the feet.",
    ],
    execution: [
      "Curl the shoulders off the floor and reach the fingertips toward the toes.",
      "Lower the shoulders back down under control.",
    ],
    watchFor: [
      {
        mistake: "Letting the legs drift down toward the floor.",
        fix: "Keep your legs pointing straight up. Bend your knees slightly if your hamstrings pull them down.",
      },
      {
        mistake: "Reaching with the arms while the shoulders stay down.",
        fix: "Lift your shoulder blades off the floor by curling your ribs up. The reach should come from the crunch.",
      },
    ],
  },
  "hollow-rock": {
    setup: [
      "Get into a hollow hold: lower back pressed down, arms overhead, legs straight and off the floor.",
    ],
    execution: [
      "Rock back and forth, keeping the shape completely fixed.",
      "Let the rock come from the whole body moving as one piece.",
    ],
    watchFor: [
      {
        mistake: "Bending at the hips to create the rock.",
        fix: "Keep your body locked in one banana shape. If it folds, stop and reset the hold before you rock again.",
      },
      {
        mistake: "Lower back peeling off the floor as you tire.",
        fix: "Bring your arms or legs in closer to shorten the lever. A smaller shape held properly is the right version.",
      },
    ],
  },
  "oblique-crunch": {
    setup: [
      "Lie on your back, then drop both bent knees over to one side.",
      "Keep the shoulders flat, hands lightly at the temples.",
    ],
    execution: [
      "Crunch straight up toward the ceiling, lifting the shoulders off the floor.",
      "Lower under control, then switch the knees to the other side after the set.",
    ],
    watchFor: [
      {
        mistake: "Pulling the head up with the hands.",
        fix: "Rest your fingertips at your temples and lead with your ribs. Your neck should not be doing the lifting.",
      },
      {
        mistake: "Letting the knees drift back to the middle.",
        fix: "Keep your knees resting on the floor to one side. That angle is what moves the crunch onto your obliques.",
      },
    ],
  },
  "seated-knee-tuck": {
    setup: [
      "Sit on the end of a flat bench, hands gripping the sides behind you.",
      "Lean back slightly and lift the feet off the floor.",
    ],
    execution: [
      "Pull the knees in toward the chest as the torso comes forward to meet them.",
      "Extend the legs back out without letting the feet touch down.",
    ],
    watchFor: [
      {
        mistake: "Leaning so far back the hip flexors do everything.",
        fix: "Stay only slightly reclined and curl your torso toward your knees as they come in.",
      },
      {
        mistake: "Kicking the legs out fast and letting them drop.",
        fix: "Extend your legs slowly and keep them off the floor. The way out is half the work.",
      },
    ],
  },
  "roman-chair-side-bend": {
    setup: [
      "Lie side-on in a 45° back-extension bench, hip on the pad and feet stacked under the rollers.",
      "Arms crossed on the chest or hands at the temples.",
    ],
    execution: [
      "Lower the torso sideways toward the floor.",
      "Lift back up until the body is in a straight line, then switch sides after the set.",
    ],
    watchFor: [
      {
        mistake: "Rotating the chest toward the floor as you lower.",
        fix: "Keep your shoulders stacked one over the other. Turning takes the load off your obliques.",
      },
      {
        mistake: "Lifting well past straight at the top.",
        fix: "Stop when your body forms a straight line. Crunching higher adds little and pinches the side of the waist.",
      },
    ],
  },
  "med-ball-slam": {
    setup: [
      "Use a slam ball, one made to hit the floor without bouncing back.",
      "Stand with the feet shoulder width and the ball held at the chest.",
    ],
    execution: [
      "Lift the ball overhead, rising onto the toes.",
      "Slam it straight down in front of you, bending at the hips and knees.",
      "Squat to pick it up and go again.",
    ],
    watchFor: [
      {
        mistake: "Using a bouncy ball that flies back up at your face.",
        fix: "Use a dead-bounce slam ball. A regular medicine ball can rebound hard and fast.",
      },
      {
        mistake: "Throwing with the arms only while standing tall.",
        fix: "Drive the ball down by pulling your ribs toward your hips. The trunk is doing the throwing.",
      },
    ],
  },
  "med-ball-rotational-throw": {
    setup: [
      "Stand side-on to a solid wall, about an arm's length or two away.",
      "Hold the medicine ball at the hip farthest from the wall.",
    ],
    execution: [
      "Turn the hips and chest toward the wall and throw the ball into it.",
      "Catch it on the rebound, reset, and repeat before switching sides.",
    ],
    watchFor: [
      {
        mistake: "Throwing with the arms while the feet stay planted.",
        fix: "Pivot your back foot and turn your hips first. Rotational power starts from the ground.",
      },
      {
        mistake: "Using a heavy ball that makes every throw slow.",
        fix: "Pick a light ball you can throw fast. The point is speed, and a heavy ball kills it.",
      },
    ],
  },
  "ghd-sit-up": {
    setup: [
      "Set the foot plate so your hips sit just off the end of the seat.",
      "Hook the feet under the rollers and sit upright.",
      "Build up slowly: a few reps the first sessions, then more.",
    ],
    execution: [
      "Lower back until the torso is level with the floor or a little below.",
      "Kick the knees straight and sit back up, reaching forward.",
    ],
    watchFor: [
      {
        mistake: "Doing a big set the first time you try them.",
        fix: "Start with a handful of reps and add a few each week. They hit the abs much harder than they feel during the set.",
      },
      {
        mistake: "Dropping far below parallel with no control.",
        fix: "Lower only as far as you can come back up from smoothly. Parallel is plenty to start with.",
      },
    ],
  },
  "body-saw": {
    setup: [
      "Forearm plank with the feet on sliders, towels or a slick floor.",
      "Body in one line from head to heels.",
    ],
    execution: [
      "Push back from the forearms so the body slides backward.",
      "Pull forward past the start, keeping the hips level the whole time.",
    ],
    watchFor: [
      {
        mistake: "Hips sagging as the body slides back.",
        fix: "Only slide back as far as you can hold a flat back. Squeeze your glutes the whole time.",
      },
      {
        mistake: "Piking the hips up to make it easier.",
        fix: "Keep your body straight like a plank. Shorten the slide instead of breaking the line.",
      },
    ],
  },
  "plank-up-down": {
    setup: [
      "Forearm plank with the feet a little wider than usual.",
      "Glutes and abs tight.",
    ],
    execution: [
      "Place one hand, then the other, to press up into a high plank.",
      "Lower back to the forearms one arm at a time, and switch the lead arm each rep.",
    ],
    watchFor: [
      {
        mistake: "Hips swaying side to side as you change arms.",
        fix: "Widen your feet and squeeze your glutes. Keeping your hips still is the whole exercise.",
      },
      {
        mistake: "Hips piking up to make the transitions easier.",
        fix: "Hold a straight line from your head to your heels. Slow down if the line breaks.",
      },
    ],
  },
  "side-plank-hip-dip": {
    setup: [
      "Side plank on the forearm, elbow under the shoulder.",
      "Feet stacked or staggered, body in a straight line.",
    ],
    execution: [
      "Lower the bottom hip toward the floor without touching down.",
      "Lift it back up past the straight line, then repeat before switching sides.",
    ],
    watchFor: [
      {
        mistake: "Rolling the chest toward the floor as you dip.",
        fix: "Keep your top shoulder stacked over the bottom one. The hip moves straight up and down.",
      },
      {
        mistake: "Letting the shoulder sink into the joint.",
        fix: "Push the floor away with your forearm. That keeps your shoulder strong while your hip moves.",
      },
    ],
  },
  "running": {
    setup: [
      "Start with a few minutes of easy movement before picking up the pace.",
      "Shoulders relaxed, arms swinging from the shoulder not the elbow.",
    ],
    execution: [
      "Land with the foot under the hips rather than reaching out in front.",
      "Hold a pace you could just about hold a conversation at, unless intervals are the plan.",
    ],
    watchFor: [
      {
        mistake: "Adding distance and pace in the same week — pick one.",
        fix: "Increase one variable at a time, by about ten percent, and hold the other steady.",
      },
    ],
  },
  "treadmill": {
    setup: [
      "Set a small incline (1–2%) so it feels closer to running outside.",
      "Stand tall, look ahead rather than down at the console.",
    ],
    execution: [
      "Run without gripping the handles.",
      "Step onto the side rails to change anything rather than fumbling mid-stride.",
    ],
    watchFor: [
      {
        mistake: "Holding the rails, which takes load off and skews the calorie readout.",
        fix: "Let go and slow down until you can. The number on the console is only true hands-free.",
      },
    ],
  },
  "incline-walk": {
    setup: [
      "Set a steep incline and a walking pace you can sustain.",
      "Stand tall, arms swinging freely.",
    ],
    execution: [
      "Walk without holding on, letting the glutes and calves do the work.",
      "Raise the incline before the speed if it gets easy.",
    ],
    watchFor: [
      {
        mistake: "Gripping the handles, which removes most of the point of the incline.",
        fix: "Drop the speed until you can walk hands-free at that incline.",
      },
    ],
  },
  "walking": {
    setup: [
      "Comfortable shoes, upright posture.",
      "Nothing else to set up — that is the appeal.",
    ],
    execution: [
      "Walk at a pace that raises the breathing slightly.",
      "Steady time on feet is the goal, not intensity.",
    ],
    watchFor: [
      {
        mistake: "Treating it as too easy to log — it adds up.",
        fix: "Log it. Steady walking is most people's largest source of weekly activity.",
      },
    ],
  },
  "cycling": {
    setup: [
      "Saddle height so the knee is nearly straight at the bottom of the stroke.",
      "Hands relaxed on the bars.",
    ],
    execution: [
      "Pedal smoothly, pushing and pulling through the whole circle.",
      "Adjust resistance rather than just spinning faster.",
    ],
    watchFor: [
      {
        mistake: "Saddle too low, which grinds the knees over long sessions.",
        fix: "Raise it until your knee is almost straight at the bottom of the pedal stroke.",
      },
    ],
  },
  "assault-bike": {
    setup: [
      "Saddle height as with any bike, hands on the moving handles.",
      "Feet flat on the pedals.",
    ],
    execution: [
      "Drive with the legs and arms together.",
      "Resistance rises with effort, so pace yourself early in an interval.",
    ],
    watchFor: [
      {
        mistake: "Opening at full effort and having nothing left after twenty seconds.",
        fix: "Start at about eighty percent and build. Resistance rises with your effort, so it punishes a fast start.",
      },
    ],
  },
  "elliptical": {
    setup: [
      "Feet flat on the pedals, hands on the moving handles.",
      "Stand tall rather than leaning on the console.",
    ],
    execution: [
      "Push and pull evenly with the arms and legs.",
      "Change resistance rather than just moving faster.",
    ],
    watchFor: [
      {
        mistake: "Leaning on the fixed handles and coasting.",
        fix: "Stand tall and use the moving handles, or let go entirely.",
      },
    ],
  },
  "rowing": {
    setup: [
      "Feet strapped in, shins vertical at the catch, arms straight.",
      "Sit tall with the shoulders in front of the hips.",
    ],
    execution: [
      "Legs, then body, then arms on the drive. Arms, body, legs on the recovery.",
      "The legs do most of the work — the arms finish the stroke.",
    ],
    watchFor: [
      {
        mistake: "Pulling with the arms first and heaving the back.",
        fix: "Legs, then body, then arms — in that order every stroke.",
      },
    ],
  },
  "ski-erg": {
    setup: [
      "Stand facing the machine, handles overhead, feet hip width.",
      "Soft knees, core braced.",
    ],
    execution: [
      "Pull down and back, hinging at the hips and finishing past the thighs.",
      "Return to overhead under control.",
    ],
    watchFor: [
      {
        mistake: "Pulling with the arms only and never using the hinge.",
        fix: "Hinge at your hips on every pull; your arms just finish the stroke.",
      },
    ],
  },
  "stairmaster": {
    setup: [
      "Stand tall, hands resting lightly on the rails.",
      "Set a pace you can hold for the whole session.",
    ],
    execution: [
      "Take full steps rather than short shuffles.",
      "Let the legs carry you rather than leaning on the rails.",
    ],
    watchFor: [
      {
        mistake: "Hanging off the handles, which makes the readout meaningless.",
        fix: "Rest your hands lightly and slow the pace until your legs carry you.",
      },
    ],
  },
  "jump-rope": {
    setup: [
      "Rope length so the handles reach the armpits when you stand on the middle.",
      "Elbows in, turning from the wrists.",
    ],
    execution: [
      "Small jumps, landing on the balls of the feet.",
      "Keep the jumps low — barely off the floor is enough.",
    ],
    watchFor: [
      {
        mistake: "Jumping far higher than the rope needs, which tires the calves quickly.",
        fix: "Barely leave the floor — an inch is plenty.",
      },
    ],
  },
  "battle-ropes": {
    setup: [
      "Face the anchor, quarter squat, an end in each hand.",
      "Core braced, chest up.",
    ],
    execution: [
      "Drive alternating or simultaneous waves down the rope.",
      "Keep the hips loaded rather than standing upright.",
    ],
    watchFor: [
      {
        mistake: "Standing tall and flailing with the arms alone.",
        fix: "Stay in a quarter squat and drive the waves from your hips.",
      },
    ],
  },
  "burpees": {
    setup: [
      "Stand tall with room to drop.",
      "Core braced.",
    ],
    execution: [
      "Drop to a plank, chest to the floor, then jump the feet back in and stand or jump.",
      "Keep the hips from sagging in the plank position.",
    ],
    watchFor: [
      {
        mistake: "Letting the lower back sag on the way down as you tire.",
        fix: "Brace your midsection, or step your feet back instead of jumping them.",
      },
    ],
  },
  "box-jump": {
    setup: [
      "Box at a height you can land on comfortably, feet hip width.",
      "Stand close enough to jump without lunging forward.",
    ],
    execution: [
      "Swing the arms, jump, and land softly with bent knees.",
      "Step back down rather than jumping down.",
    ],
    watchFor: [
      {
        mistake: "Jumping down between reps, which is where achilles injuries come from.",
        fix: "Step down one foot at a time, every rep, no exceptions.",
      },
      {
        mistake: "Picking a box height you can barely reach.",
        fix: "Choose one you can land on softly with room to spare. Box jumps train power, not courage.",
      },
    ],
  },
  "sled-push": {
    setup: [
      "Load the sled, hands high on the uprights or low for more drive.",
      "Body leaning forward in a straight line from head to heels.",
    ],
    execution: [
      "Drive with short, powerful steps, keeping the arms locked.",
      "Steady effort beats sprinting for the first five metres.",
    ],
    watchFor: [
      {
        mistake: "Letting the hips rise so the back rounds under the push.",
        fix: "Keep a straight line from your head to your heels and drive with your legs.",
      },
    ],
  },
  "sled-drag": {
    setup: [
      "Attach a strap or rope to the sled and hold it or clip it to a belt.",
      "Load a weight you can move at a steady pace.",
    ],
    execution: [
      "Walk backward with short steps, leaning slightly back against the strap.",
      "Or face forward and drive with the legs, arms pulling the handles.",
    ],
    watchFor: [
      {
        mistake: "Loading it so heavily that you have to jerk it into motion.",
        fix: "Choose a weight you can move smoothly from a standstill. Steady steps beat lurching ones.",
      },
      {
        mistake: "Rounding the back to pull harder.",
        fix: "Stay tall with your chest up and let your legs do the pulling.",
      },
    ],
  },
  "recumbent-bike": {
    setup: [
      "Set the seat so the knee is only slightly bent at the far end of the pedal stroke.",
      "Sit back against the backrest.",
    ],
    execution: [
      "Pedal smoothly at a steady pace.",
      "Raise the resistance rather than just spinning faster.",
    ],
    watchFor: [
      {
        mistake: "Seat too close so the knees come up high.",
        fix: "Move the seat back until your leg is almost straight at full extension.",
      },
      {
        mistake: "Coasting because it feels easy.",
        fix: "Set a resistance where talking takes a little effort. The backrest makes it comfortable, not optional.",
      },
    ],
  },
  "arm-bike": {
    setup: [
      "Set the seat so the crank lines up with the shoulders.",
      "Sit tall with the feet planted.",
    ],
    execution: [
      "Turn the handles in smooth circles, pushing and pulling evenly.",
      "Try reversing direction partway through.",
    ],
    watchFor: [
      {
        mistake: "Shrugging and hunching the shoulders.",
        fix: "Sit tall and keep your shoulders down. Lower the resistance if you start to hunch.",
      },
      {
        mistake: "Only ever cranking forward.",
        fix: "Spend some time going backward too, so the muscles on both sides of the shoulder get worked.",
      },
    ],
  },
  "swimming": {
    setup: [
      "Pick a lane that matches your pace.",
      "Goggles on, and a warm-up of easy lengths first.",
    ],
    execution: [
      "Swim steady lengths, breathing on a regular rhythm.",
      "Mix strokes or add rest between lengths to keep your form good.",
    ],
    watchFor: [
      {
        mistake: "Holding the breath until you are gasping.",
        fix: "Breathe out steadily underwater so you only need to breathe in when your face turns.",
      },
      {
        mistake: "Swimming every length flat out.",
        fix: "Swim most lengths at a pace you could hold for a while. Your technique falls apart when you are exhausted.",
      },
    ],
  },
  "hiking": {
    setup: [
      "Supportive footwear, water, and a route that matches your time.",
      "Tell someone where you are going on remote trails.",
    ],
    execution: [
      "Walk at a steady pace you can keep for a long time.",
      "Shorten your stride on steep climbs and descents.",
    ],
    watchFor: [
      {
        mistake: "Charging up the first climb and fading after.",
        fix: "Start easier than you feel you need to. A pace you can hold all day covers more ground.",
      },
      {
        mistake: "Long, heel-first strides on the way down.",
        fix: "Take shorter steps downhill with soft knees. Descents are harder on the legs than they feel.",
      },
    ],
  },
  "boxing": {
    setup: [
      "Wrap your hands and wear gloves for bag or pad work.",
      "Stand side-on in your stance, hands up by the face.",
    ],
    execution: [
      "Work in timed rounds with short rests between them.",
      "Punch from the legs and hips, returning the hands to guard each time.",
    ],
    watchFor: [
      {
        mistake: "Hitting the bag without wraps.",
        fix: "Wrap your hands every session. The small bones in your hand are not built to hit something that hard bare.",
      },
      {
        mistake: "Arm punching with the feet planted.",
        fix: "Turn your hips and pivot your feet with each punch. The power comes from the ground up.",
      },
    ],
  },
  "mountain-climber": {
    setup: [
      "High plank, hands under the shoulders.",
      "Body in a straight line from head to heels.",
    ],
    execution: [
      "Drive one knee toward the chest, then switch legs in a running rhythm.",
      "Keep the hips level with the shoulders.",
    ],
    watchFor: [
      {
        mistake: "Hips bouncing high in the air.",
        fix: "Keep your hips level with your shoulders. Slow down until you can hold the plank.",
      },
      {
        mistake: "Tapping the feet only a few inches forward.",
        fix: "Bring each knee well in toward your chest. A shorter, faster tap is not doing the same work.",
      },
    ],
  },
  "jumping-jacks": {
    setup: [
      "Stand with the feet together, arms at the sides.",
      "Supportive shoes on a firm surface.",
    ],
    execution: [
      "Jump the feet out wide as the arms swing up overhead.",
      "Jump back to the start and keep a steady rhythm.",
    ],
    watchFor: [
      {
        mistake: "Landing flat-footed and heavy.",
        fix: "Stay light on the balls of your feet with soft knees. Quiet landings are easier on your joints.",
      },
      {
        mistake: "Arms only going halfway up.",
        fix: "Reach all the way overhead each rep. Half reps take away half the effort.",
      },
    ],
  },
  "high-knees": {
    setup: [
      "Stand tall with the feet hip width.",
      "Arms bent, ready to pump.",
    ],
    execution: [
      "Run on the spot, driving the knees up to hip height.",
      "Stay on the balls of the feet and pump the arms.",
    ],
    watchFor: [
      {
        mistake: "Leaning back as the knees come up.",
        fix: "Stay tall or lean very slightly forward. Leaning back makes your legs work less.",
      },
      {
        mistake: "Knees dropping lower as you tire.",
        fix: "Slow down before you let the knees drop. Height matters more than speed.",
      },
    ],
  },
  "bear-crawl": {
    setup: [
      "On hands and feet with the knees an inch off the floor.",
      "Back flat, hands under the shoulders.",
    ],
    execution: [
      "Crawl forward moving the opposite hand and foot together.",
      "Take small steps and keep the knees low.",
    ],
    watchFor: [
      {
        mistake: "Hips rising high into a pike.",
        fix: "Keep your back flat and your hips at shoulder height, with your knees just off the floor.",
      },
      {
        mistake: "Taking big lunging steps.",
        fix: "Keep your steps small. Shorter steps keep your trunk steady and your hips from swaying.",
      },
    ],
  },
  "vertical-climber": {
    setup: [
      "Feet in the pedals and hands on the handles at about head height.",
      "Stand tall, close to the machine.",
    ],
    execution: [
      "Climb with the opposite hand and foot moving together.",
      "Use long strokes for steady work and short, fast ones for intervals.",
    ],
    watchFor: [
      {
        mistake: "Tiny strokes that only use the bottom of the range.",
        fix: "Reach high with your hands and let your legs travel through a full step. Longer strokes make it proper full-body work.",
      },
      {
        mistake: "Hanging back away from the machine on straight arms.",
        fix: "Stay close with your hips under you. Leaning back puts the effort on your grip instead of your legs.",
      },
    ],
  },
  "ladder-climber": {
    setup: [
      "Step onto the rungs holding the side rails, then take the rungs with your hands.",
      "Wear the waist belt if the machine has one; it sets the speed from your position.",
    ],
    execution: [
      "Climb at a steady rhythm, hands and feet working together.",
      "Climb faster to speed the ladder up and slow down to ease off.",
    ],
    watchFor: [
      {
        mistake: "Letting the ladder carry you to the bottom of the frame.",
        fix: "Keep climbing to stay near the middle. When you drift low, climb a little faster to hold your place.",
      },
      {
        mistake: "Holding the side rails and climbing with the legs only.",
        fix: "Use the rungs with your hands too. Arms and legs together is what makes the machine worth using.",
      },
    ],
  },
  "curved-treadmill": {
    setup: [
      "Hold the rails and step onto the middle of the curved deck.",
      "Start by walking to feel how the belt responds.",
    ],
    execution: [
      "Move forward up the curve to speed up and drift back to slow down.",
      "Run on the balls of the feet with a slight forward lean.",
    ],
    watchFor: [
      {
        mistake: "Striding far out front, which brakes the belt.",
        fix: "Land with your feet under your hips and push back. That is what drives the belt on a motorless treadmill.",
      },
      {
        mistake: "Sprinting from the first step.",
        fix: "Build up over the first minute. The belt only moves as fast as you push, so a hard start empties you quickly.",
      },
    ],
  },
  "rucking": {
    setup: [
      "Pack the weight high and close to the back, with the straps snug.",
      "Start light, around 10–15% of your bodyweight, on a route you know.",
    ],
    execution: [
      "Walk at a brisk pace, standing tall with a slight forward lean.",
      "Add distance before you add weight.",
    ],
    watchFor: [
      {
        mistake: "Loading the pack heavy on the first outing.",
        fix: "Start light and add a little weight every week or two. The feet, knees and back need time to adapt.",
      },
      {
        mistake: "Weight sitting low in the pack and dragging on the shoulders.",
        fix: "Pack the heavy item high and tight against your back. A low load pulls you backward and rounds your posture.",
      },
    ],
  },
  "shuttle-run": {
    setup: [
      "Mark two lines, often 5 to 25 metres apart.",
      "Warm up well before you start sprinting.",
    ],
    execution: [
      "Sprint to the far line, plant, touch it, and turn.",
      "Sprint back and repeat for the set distance or time.",
    ],
    watchFor: [
      {
        mistake: "Turning upright with the feet close together.",
        fix: "Drop your hips and take shorter steps into each turn. A low, wide stance stops faster and pushes off harder.",
      },
      {
        mistake: "Always turning the same way.",
        fix: "Alternate the direction you turn each time. It keeps both legs sharing the braking work.",
      },
    ],
  },
  "kickboxing": {
    setup: [
      "Wrap your hands and wear gloves for bag or pad work.",
      "Side-on stance, hands up by the face, weight on the balls of the feet.",
    ],
    execution: [
      "Work in timed rounds with short rests between them.",
      "Turn the hips into punches and kicks, and bring the hands back to guard each time.",
    ],
    watchFor: [
      {
        mistake: "Dropping the hands every time you kick.",
        fix: "Keep your hands up at your face while your legs work. The habit matters as soon as there is a partner.",
      },
      {
        mistake: "Kicking higher than your hips allow.",
        fix: "Kick to a height you can reach with control and balance. Height comes with mobility, not effort.",
      },
    ],
  },
  "basketball": {
    setup: [
      "Wear court shoes with good ankle support.",
      "Warm up with jogging, shuffles and a few jumps before a game.",
    ],
    execution: [
      "Play at whatever pace the game sets, and log the time on court.",
      "Drink between games, especially on long sessions.",
    ],
    watchFor: [
      {
        mistake: "Going straight from the car into a full-speed game.",
        fix: "Take five minutes to jog, shuffle and jump first. Sudden cuts and landings are rough on cold legs.",
      },
      {
        mistake: "Landing from jumps stiff-legged.",
        fix: "Land on the balls of your feet with soft knees and let your legs absorb it.",
      },
    ],
  },
  "soccer": {
    setup: [
      "Boots or shoes that suit the surface.",
      "Warm up with jogging, side steps and a few short sprints.",
    ],
    execution: [
      "Play and log your time on the pitch.",
      "Rest between matches and keep drinking on warm days.",
    ],
    watchFor: [
      {
        mistake: "Sprinting flat out before the legs are warm.",
        fix: "Build up with a few gradually faster runs first. Hamstrings do not like a cold, sudden sprint.",
      },
      {
        mistake: "Skipping leg training because you play.",
        fix: "Keep some strength work for the legs and hips. Stronger legs cope far better with the sprints and changes of direction.",
      },
    ],
  },
  "tennis": {
    setup: [
      "Court shoes, not running shoes, for the side-to-side movement.",
      "Warm up with easy rallies before playing points.",
    ],
    execution: [
      "Play sets or drills and log the time on court.",
      "Stay on the balls of the feet between shots.",
    ],
    watchFor: [
      {
        mistake: "Swinging with the arm alone.",
        fix: "Turn your hips and shoulders into each stroke. Power from the body takes the strain off your elbow and shoulder.",
      },
      {
        mistake: "Standing flat-footed while waiting for the ball.",
        fix: "Take a small split step as your opponent hits. You will reach more balls with less effort.",
      },
    ],
  },
  "pickleball": {
    setup: [
      "Court shoes that grip well for quick side steps.",
      "Warm up with some easy dinks and gentle movement.",
    ],
    execution: [
      "Play games and log the time on court.",
      "Keep your knees bent and paddle up, ready for fast exchanges.",
    ],
    watchFor: [
      {
        mistake: "Backpedalling to chase lobs.",
        fix: "Turn and move sideways or at an angle. Running backward is the common way to fall on a court.",
      },
      {
        mistake: "Playing for hours with no warm-up.",
        fix: "Spend a few minutes moving and rallying easily first. Quick lunges on cold legs are where strains start.",
      },
    ],
  },
  "rock-climbing": {
    setup: [
      "Climbing shoes, chalk, and a harness and trained belayer for roped routes.",
      "Warm up on a few easy climbs before trying anything hard.",
    ],
    execution: [
      "Climb with the legs pushing you up and the arms mostly holding on.",
      "Keep the hips close to the wall and rest on straight arms where you can.",
    ],
    watchFor: [
      {
        mistake: "Pulling up on bent arms the whole route.",
        fix: "Hang on straight arms whenever you can and push with your legs. Bent arms burn out the forearms fast.",
      },
      {
        mistake: "Jumping off the top of a boulder problem.",
        fix: "Climb down as far as you can, then drop onto the mat with soft knees. Big falls onto stiff legs are how ankles go.",
      },
    ],
  },
  "yoga": {
    setup: [
      "A non-slip mat and clothes you can move freely in.",
      "Blocks or a strap if the class uses them.",
    ],
    execution: [
      "Move through the poses with steady breathing.",
      "Go only as deep into each position as you can while breathing easily.",
    ],
    watchFor: [
      {
        mistake: "Forcing a stretch because the person next to you goes deeper.",
        fix: "Work at your own range. Use a block or bend your knees; flexibility builds with regular practice, not force.",
      },
      {
        mistake: "Holding the breath in difficult poses.",
        fix: "Breathe slowly through your nose. If you cannot breathe steadily, ease off until you can.",
      },
    ],
  },
  "pilates": {
    setup: [
      "Mat, or a reformer set up by the instructor.",
      "Start with a beginner class if the equipment is new to you.",
    ],
    execution: [
      "Move slowly and with control, following the breathing cues.",
      "Keep the trunk braced while the arms and legs move.",
    ],
    watchFor: [
      {
        mistake: "Rushing through reps to keep up.",
        fix: "Slow down and control each movement. Speed takes the work away from the small muscles the method is built around.",
      },
      {
        mistake: "Lower back arching off the mat during leg work.",
        fix: "Bend your knees or lift your legs higher until your back stays down. That position is the point of the exercise.",
      },
    ],
  },
  "skater-jumps": {
    setup: [
      "Stand on one leg with a slight bend in the knee.",
      "Clear space to either side.",
    ],
    execution: [
      "Jump sideways off the standing leg and land on the other foot.",
      "Let the trailing leg swing behind, then jump back the other way.",
    ],
    watchFor: [
      {
        mistake: "Landing with a straight, stiff leg.",
        fix: "Land softly with your knee bent and your hips back. Hold the landing for a moment if you wobble.",
      },
      {
        mistake: "Knee caving inward on the landing.",
        fix: "Keep your knee pointing over your toes when you land. Shorten the jump until you can.",
      },
    ],
  },
  "plank-jacks": {
    setup: [
      "High plank with the hands under the shoulders.",
      "Feet together, body in a straight line.",
    ],
    execution: [
      "Jump the feet out wide, then back together.",
      "Keep the hips level and the hands still.",
    ],
    watchFor: [
      {
        mistake: "Hips bouncing up and down with each jump.",
        fix: "Brace your abs and keep your hips at shoulder height. Slow the jumps down until they stay level.",
      },
      {
        mistake: "Shoulders drifting back behind the wrists.",
        fix: "Keep your shoulders stacked over your hands. It is easier on the wrists and keeps the plank solid.",
      },
    ],
  },
  "agility-ladder": {
    setup: [
      "Lay the ladder flat on a surface with good grip.",
      "Pick a pattern and walk it slowly first.",
    ],
    execution: [
      "Move through the rungs on the balls of the feet.",
      "Speed up only once the pattern is clean.",
    ],
    watchFor: [
      {
        mistake: "Going fast and treading on the rungs.",
        fix: "Slow down until every foot lands cleanly. Speed follows accuracy, not the other way round.",
      },
      {
        mistake: "Looking down at the feet the whole time.",
        fix: "Glance ahead down the ladder instead. Keeping your head up is part of what the drill trains.",
      },
    ],
  },
  "tire-flip": {
    setup: [
      "Squat low at the tire with the chest against it and the fingers under the edge.",
      "Feet back a little, back flat.",
    ],
    execution: [
      "Drive forward and up into the tire with the legs and hips.",
      "As it rises, get a knee or hands under it and push it over.",
    ],
    watchFor: [
      {
        mistake: "Deadlifting the tire with a rounded back.",
        fix: "Drive into the tire with your chest and legs, not straight up with your back. It moves forward as much as up.",
      },
      {
        mistake: "Curling the tire up with the arms.",
        fix: "Keep your arms fairly straight until the tire is past your hips, then switch to a hard push.",
      },
    ],
  },
  "bjj": {
    setup: [
      "Clean gi or rash guard, trimmed nails, and a mouthguard if you use one.",
      "Warm up with the class drills before rolling.",
    ],
    execution: [
      "Drill techniques, then roll in timed rounds with rest between.",
      "Log the session length, or just the rolling time if you prefer.",
    ],
    watchFor: [
      {
        mistake: "Waiting too long to tap.",
        fix: "Tap early and often, especially when you are new. There is always another round.",
      },
      {
        mistake: "Rolling at full effort every round.",
        fix: "Match your intensity to your partner and save hard rounds for when you want them. Tight, tense rolls tire you out fastest.",
      },
    ],
  },
};

/** The guide for an exercise, or undefined for a custom one. */
export function formGuideFor(exerciseId: string): FormGuide | undefined {
  return FORM_GUIDES[exerciseId];
}

/**
 * Bundled exercise ids with no guide yet.
 *
 * Exported so a test can assert it is empty rather than a reader having to
 * cross-check two lists by eye.
 */
export function exercisesMissingGuides(): string[] {
  return EXERCISES.filter((e) => !FORM_GUIDES[e.id]).map((e) => e.id);
}

/** Guide ids that no longer match a bundled exercise. */
export function orphanedGuides(): string[] {
  const ids = new Set(EXERCISES.map((e) => e.id));
  return Object.keys(FORM_GUIDES).filter((id) => !ids.has(id));
}
