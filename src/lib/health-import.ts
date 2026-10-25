import { BEST_EFFORTS, distanceKind } from "./cardio";
import { EXERCISES } from "./exercises";
import { newId } from "./workout-utils";
import type { BestEffortKey, TrackedCardio, Workout, WorkoutSet } from "@/types";

/**
 * Turning what Apple Health recorded into Plato workouts.
 *
 * Pure on purpose: the native module (modules/plato-health) only reads, and
 * everything that decides what a run *was* — its splits, its fastest mile,
 * which exercise it is — happens here, where Jest can check it. Nothing about
 * this can be tried in a simulator from here, so the arithmetic had better be
 * proven before it reaches a phone.
 */

/** One cardio workout, as the native module reads it out of Health. */
export interface HealthWorkout {
  /** Health's UUID for it. */
  id: string;
  /** Which kind, as a name: see IMPORTS for the ones that come in. */
  activity: string;
  indoor: boolean;
  startMs: number;
  endMs: number;
  /** Seconds moving. Health leaves pauses out of a workout's duration. */
  duration: number;
  /** Metres. */
  distance: number | null;
  activeCalories: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  /**
   * Pauses and resumes in the order they happened. Manual and automatic ones
   * are told apart because they overlap: auto-pause at a light, then a manual
   * pause on top, and the manual resume doesn't mean you're moving yet.
   */
  events: { type: "pause" | "resume" | "motionPause" | "motionResume"; ms: number }[];
  /** What recorded it, as Health shows it ("Brayden's Apple Watch"). */
  source: string;
  sourceBundle: string;
}

/** A stretch of distance Health logged during a workout. */
export interface DistanceSample {
  startMs: number;
  endMs: number;
  metres: number;
}

// ── Which workouts come in, and as what ──────────────────────────────────────

/**
 * Health workout types that come in, and the exercise and name each becomes.
 * Names follow what the Workout app calls them, so the run you just finished
 * is recognisably the same thing in both places.
 */
const IMPORTS: Record<string, { exerciseId: string; name: string; indoor?: { exerciseId: string; name: string } }> = {
  running: { exerciseId: "running", name: "Outdoor Run", indoor: { exerciseId: "treadmill", name: "Indoor Run" } },
  walking: { exerciseId: "walking", name: "Outdoor Walk", indoor: { exerciseId: "walking", name: "Indoor Walk" } },
  hiking: { exerciseId: "hiking", name: "Hike" },
  cycling: { exerciseId: "cycling", name: "Outdoor Cycle", indoor: { exerciseId: "cycling", name: "Indoor Cycle" } },
  rowing: { exerciseId: "rowing", name: "Rowing" },
  elliptical: { exerciseId: "elliptical", name: "Elliptical" },
  stairClimbing: { exerciseId: "stairmaster", name: "Stair Stepper" },
  swimming: { exerciseId: "swimming", name: "Swim" },
  jumpRope: { exerciseId: "jump-rope", name: "Jump Rope" },
};

/** The activity names the native module should ask Health for. */
export const IMPORTED_ACTIVITIES = Object.keys(IMPORTS);

/**
 * Workouts Plato itself saved to Health. None today; when the watch records
 * its own sessions they'll land in Health too, and must not come back in as
 * a second copy of a workout that's already here.
 */
const OWN_BUNDLE = "com.plato.workouts";

/** When each workout already brought in ran, to recognise a second app's copy of it. */
export function importedSpans(workouts: Workout[]): { startMs: number; endMs: number }[] {
  const spans: { startMs: number; endMs: number }[] = [];
  for (const w of workouts) {
    if (!w.startedAt || !w.completedAt) continue;
    if (!w.exercises.some((ex) => ex.sets.some((set) => set.tracked?.healthId))) continue;
    spans.push({ startMs: w.startedAt.getTime(), endMs: w.completedAt.getTime() });
  }
  return spans;
}

/**
 * Two recordings of one session: they share most of the shorter one's time.
 * A run recorded by the watch and by Strava overlaps almost completely; a walk
 * home straight after a run barely touches it.
 */
function sameSession(a: { startMs: number; endMs: number }, b: { startMs: number; endMs: number }): boolean {
  const shared = Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs);
  const shorter = Math.min(a.endMs - a.startMs, b.endMs - b.startMs);
  return shorter > 0 && shared >= shorter / 2;
}

/** Health ids already brought in, read off the workouts themselves. */
export function importedHealthIds(workouts: Workout[]): Set<string> {
  const ids = new Set<string>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const set of ex.sets) if (set.tracked?.healthId) ids.add(set.tracked.healthId);
    }
  }
  return ids;
}

/**
 * The workouts worth importing out of what Health handed back, oldest first —
 * and the ones left out as second copies of a session, so the caller can
 * remember those as handled too.
 *
 * `seen` is every id this phone has imported before, kept separately from the
 * workouts so that deleting an imported run in Plato is final: it's gone from
 * the workouts, but not from here, so the next import doesn't put it back.
 *
 * When two apps recorded the same session (the watch and Strava, a bike
 * computer and the watch), only one comes in — the Apple Watch's own if it's
 * one of them, since that's the copy with heart rate and splits — or the
 * week's distance would count it twice.
 */
export function workoutsToImport(
  found: HealthWorkout[],
  imported: Set<string>,
  seen: Set<string>,
  existing: { startMs: number; endMs: number }[] = []
): { fresh: HealthWorkout[]; duplicates: HealthWorkout[] } {
  const candidates = found.filter(
    (w) =>
      IMPORTS[w.activity] != null &&
      !imported.has(w.id) &&
      !seen.has(w.id) &&
      !w.sourceBundle.startsWith(OWN_BUNDLE) &&
      w.duration > 0
  );
  const apple = (w: HealthWorkout) => (w.sourceBundle.startsWith("com.apple") ? 0 : 1);
  const taken = [...existing];
  const fresh: HealthWorkout[] = [];
  const duplicates: HealthWorkout[] = [];
  for (const w of [...candidates].sort((a, b) => apple(a) - apple(b) || a.startMs - b.startMs)) {
    if (taken.some((span) => sameSession(span, w))) {
      duplicates.push(w);
    } else {
      taken.push(w);
      fresh.push(w);
    }
  }
  return { fresh: fresh.sort((a, b) => a.startMs - b.startMs), duplicates };
}

// ── Time and distance ────────────────────────────────────────────────────────

/**
 * Paused stretches, from Health's pause/resume events: paused for as long as
 * either a manual or an automatic pause is on.
 */
export function pausesFrom(events: HealthWorkout["events"], endMs: number): { startMs: number; endMs: number }[] {
  const pauses: { startMs: number; endMs: number }[] = [];
  let manual = false;
  let motion = false;
  let pausedAt: number | null = null;
  for (const e of [...events].sort((a, b) => a.ms - b.ms)) {
    if (e.type === "pause") manual = true;
    else if (e.type === "resume") manual = false;
    else if (e.type === "motionPause") motion = true;
    else if (e.type === "motionResume") motion = false;
    const paused = manual || motion;
    if (paused && pausedAt == null) pausedAt = e.ms;
    else if (!paused && pausedAt != null) {
      pauses.push({ startMs: pausedAt, endMs: e.ms });
      pausedAt = null;
    }
  }
  // Ended while paused: the pause runs to the end.
  if (pausedAt != null && pausedAt < endMs) pauses.push({ startMs: pausedAt, endMs });
  return pauses;
}

/**
 * Distance against moving time, as a line through (metres, seconds) points.
 *
 * Each sample's distance is taken to accrue evenly across it, which at the
 * few-seconds granularity a watch records is as fine as GPS is honest. Time is
 * *moving* time — pauses taken out — because a split you stopped for a drink in
 * the middle of isn't how fast you ran it, and the Workout app agrees.
 */
export function distanceCurve(
  samples: DistanceSample[],
  pauses: { startMs: number; endMs: number }[],
  startMs: number
): { metres: number[]; seconds: number[] } {
  const movingSeconds = (t: number) => {
    let paused = 0;
    for (const p of pauses) {
      const from = Math.max(p.startMs, startMs);
      const to = Math.min(p.endMs, t);
      if (to > from) paused += to - from;
    }
    return Math.max(0, (t - startMs - paused) / 1000);
  };
  const metres: number[] = [];
  const seconds: number[] = [];
  let total = 0;
  let lastT = 0;
  let lastEndMs = startMs;
  for (const s of [...samples].sort((a, b) => a.startMs - b.startMs)) {
    if (!(s.metres > 0) || s.endMs < s.startMs) continue;
    // Some apps log distance as instants: a reading stamped at one moment
    // holding everything since the last. Taken as instants, each would be a
    // jump of metres in no time, and the fastest kilometre would come out
    // quicker than it was run — so it's spread over the gap it covers.
    const fromMs = s.endMs > s.startMs ? s.startMs : Math.min(lastEndMs, s.endMs);
    // Clamped so an overlap between samples can't make time run backwards.
    const t0 = Math.max(lastT, movingSeconds(fromMs));
    const t1 = Math.max(t0, movingSeconds(s.endMs));
    metres.push(total, total + s.metres);
    seconds.push(t0, t1);
    total += s.metres;
    lastT = t1;
    lastEndMs = Math.max(lastEndMs, s.endMs);
  }
  return { metres, seconds };
}

/**
 * When the curve first reached `d` metres — or, with `latest`, when it last
 * stood there. The two differ only where distance stood still (waiting at a
 * light without pausing): an effort that ends there ended when you arrived,
 * and one that starts there started when you set off again.
 */
function timeAt(curve: { metres: number[]; seconds: number[] }, d: number, latest: boolean): number {
  const { metres, seconds } = curve;
  if (latest) {
    // Last point at or before d, then interpolate on toward the next.
    let lo = 0;
    let hi = metres.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (metres[mid] <= d) lo = mid;
      else hi = mid - 1;
    }
    if (metres[lo] === d || lo === metres.length - 1) return seconds[lo];
    const span = metres[lo + 1] - metres[lo];
    return seconds[lo] + ((d - metres[lo]) / span) * (seconds[lo + 1] - seconds[lo]);
  }
  // First point at or beyond d, then interpolate back from the one before.
  let lo = 0;
  let hi = metres.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (metres[mid] >= d) hi = mid;
    else lo = mid + 1;
  }
  if (lo === 0 || metres[lo] === d) return seconds[lo];
  const span = metres[lo] - metres[lo - 1];
  return seconds[lo - 1] + ((d - metres[lo - 1]) / span) * (seconds[lo] - seconds[lo - 1]);
}

function curveTotal(curve: { metres: number[] }): number {
  return curve.metres.length > 0 ? curve.metres[curve.metres.length - 1] : 0;
}

/** How far short of a distance still counts as covering it: rounding, not running. */
const DISTANCE_SLACK = 0.01;

/** Seconds for each whole `unitMetres` (a mile, a kilometre), in order. */
export function splits(curve: { metres: number[]; seconds: number[] }, unitMetres: number): number[] {
  const out: number[] = [];
  const total = curveTotal(curve);
  const whole = Math.floor((total + DISTANCE_SLACK) / unitMetres);
  let previous = 0;
  for (let k = 1; k <= whole; k++) {
    const at = timeAt(curve, Math.min(k * unitMetres, total), false);
    out.push(Math.round(at - previous));
    previous = at;
  }
  return out;
}

/**
 * Faster than any human has covered the distance — a GPS jump, not a record.
 * 2:20 per kilometre is quicker than the mile world record's pace.
 */
const FASTEST_PLAUSIBLE_SECONDS_PER_KM = 140;

/**
 * The fastest stretch of `distance` metres anywhere in the session.
 *
 * Time against distance is a straight line between points, so the difference
 * across a window of fixed length is too, and its minimum falls where either
 * end of the window sits on a point. Checking both families of window is exact,
 * not an approximation.
 */
export function fastest(curve: { metres: number[]; seconds: number[] }, distance: number): number | null {
  const total = curveTotal(curve);
  // Readings rarely sum to a round number exactly: a 5K's can come to
  // 4,999.999… m, which is still a 5K.
  if (total + DISTANCE_SLACK < distance) return null;
  const span = Math.min(distance, total);
  let best = Infinity;
  for (const m of curve.metres) {
    if (m >= span) best = Math.min(best, timeAt(curve, m, false) - timeAt(curve, m - span, true));
    if (m + span <= total) best = Math.min(best, timeAt(curve, m + span, false) - timeAt(curve, m, true));
  }
  if (!Number.isFinite(best) || best < (distance / 1000) * FASTEST_PLAUSIBLE_SECONDS_PER_KM) return null;
  return Math.round(best);
}

// ── Building the workout ─────────────────────────────────────────────────────

/** Which activities have distance samples worth asking for. */
export function wantsDistanceSamples(activity: string): boolean {
  const exerciseId = IMPORTS[activity]?.exerciseId;
  const exercise = EXERCISES.find((e) => e.id === exerciseId);
  const kind = exercise ? distanceKind(exercise) : null;
  return kind === "foot" || kind === "ride";
}

const MILE = 1609.344;

/** Drops absent fields: Firestore refuses undefined, and null reads as data. */
function present<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v != null)) as T;
}

/**
 * A finished Plato workout holding one Health workout: one exercise, one set.
 *
 * One set because that's what it was — a single continuous effort. Intervals
 * a watch recorded as one run are still one run; splitting them would invent
 * structure Health doesn't have.
 */
export function buildImportedWorkout(
  hw: HealthWorkout,
  samples: DistanceSample[],
  options: { userId: string; weightUnit: "lbs" | "kg" }
): Omit<Workout, "id"> {
  const target = IMPORTS[hw.activity];
  const as = hw.indoor && target.indoor ? target.indoor : target;
  const exercise = EXERCISES.find((e) => e.id === as.exerciseId)!;
  const kind = distanceKind(exercise);

  const curve = distanceCurve(samples, pausesFrom(hw.events, hw.endMs), hw.startMs);
  const hasCurve = curve.metres.length > 0;
  const onFootOrWheels = kind === "foot" || kind === "ride";

  let best: Partial<Record<BestEffortKey, number>> | undefined;
  if (hasCurve && hw.activity === "running") {
    best = {};
    for (const effort of BEST_EFFORTS) {
      const seconds = fastest(curve, effort.metres);
      if (seconds != null) best[effort.key] = seconds;
    }
  }

  const tracked: TrackedCardio = present({
    healthId: hw.id,
    source: hw.source || undefined,
    indoor: hw.indoor || undefined,
    activeCalories: hw.activeCalories != null ? Math.round(hw.activeCalories) : undefined,
    avgHeartRate: hw.avgHeartRate != null ? Math.round(hw.avgHeartRate) : undefined,
    maxHeartRate: hw.maxHeartRate != null ? Math.round(hw.maxHeartRate) : undefined,
    splitsMi: hasCurve && onFootOrWheels ? splits(curve, MILE) : undefined,
    splitsKm: hasCurve && onFootOrWheels ? splits(curve, 1000) : undefined,
    best: best && Object.keys(best).length > 0 ? best : undefined,
  });

  const completedAt = new Date(hw.endMs);
  const duration = Math.round(hw.duration);
  // Health's own total where it has one; it's what the Workout app shows.
  const distance = kind && hw.distance && hw.distance > 0 ? Math.round(hw.distance * 10) / 10 : undefined;
  const set: WorkoutSet = present({
    id: newId(),
    weightUnit: options.weightUnit,
    duration,
    distance,
    tracked,
    isCompleted: true,
    completedAt,
  });

  return {
    userId: options.userId,
    name: as.name,
    isTemplate: false,
    createdAt: new Date(hw.startMs),
    startedAt: new Date(hw.startMs),
    completedAt,
    durationMinutes: Math.max(1, Math.round(duration / 60)),
    totalVolume: 0,
    exercises: [{ id: newId(), exerciseId: exercise.id, exercise, orderIndex: 0, sets: [set] }],
  };
}
