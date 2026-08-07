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
