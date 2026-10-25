import { BEST_EFFORTS } from "./cardio";
import type { BestEffortKey, TrackedCardio } from "@/types";

/**
 * What a tracked session was, from what the watch measured — or, with no
 * watch, the iPhone's step counter (see phone-distance).
 *
 * Either gives how far it had gone at points through the session — distance
 * against moving time, pauses already left out — and everything a run is
 * judged by afterwards is worked out here: its splits, its fastest mile. Pure on purpose, where Jest can check it. Nothing about the tracking
 * itself can be tried from here without a watch on a wrist, so the arithmetic
 * had better be proven before it reaches one.
 */

/** Distance against moving time, as matching lists of points. */
export interface Curve {
  /** Metres covered, never decreasing. */
  metres: number[];
  /** Seconds moving at each, never decreasing. */
  seconds: number[];
}

/** Far more than any session needs; a cap so a malformed message can't be huge. */
export const MAX_CURVE_POINTS = 4000;

/**
 * The watch's readings, which arrive flat — metres, seconds, metres,
 * seconds… — checked and tidied: anything not a finite, non-negative number
 * fails the lot, and a step backwards (a corrected GPS fix) is held level
 * rather than allowed to make distance or time run in reverse.
 */
export function curveFromFlat(flat: unknown): Curve | null {
  if (!Array.isArray(flat) || flat.length < 4 || flat.length % 2 !== 0 || flat.length > MAX_CURVE_POINTS * 2) return null;
  if (!flat.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)) return null;
  const metres: number[] = [];
  const seconds: number[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    metres.push(Math.max(flat[i] as number, metres[metres.length - 1] ?? 0));
    seconds.push(Math.max(flat[i + 1] as number, seconds[seconds.length - 1] ?? 0));
  }
  return { metres, seconds };
}

/**
 * When the curve first reached `d` metres — or, with `latest`, when it last
 * stood there. The two differ only where distance stood still (waiting at a
 * light without pausing): an effort that ends there ended when you arrived,
 * and one that starts there started when you set off again.
 */
function timeAt(curve: Curve, d: number, latest: boolean): number {
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

function curveTotal(curve: Curve): number {
  return curve.metres.length > 0 ? curve.metres[curve.metres.length - 1] : 0;
}

/** How far short of a distance still counts as covering it: rounding, not running. */
const DISTANCE_SLACK = 0.01;

/** Seconds for each whole `unitMetres` (a mile, a kilometre), in order. */
export function splits(curve: Curve, unitMetres: number): number[] {
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
export function fastest(curve: Curve, distance: number): number | null {
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

const MILE = 1609.344;

/** Drops absent fields: Firestore refuses undefined, and null reads as data. */
function present<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v != null)) as T;
}

/** What a curve says about a session: its splits, and for a run, its fastest efforts. */
function curveFigures(curve: Curve | null, withSplits: boolean, isRun: boolean): Pick<TrackedCardio, "splitsMi" | "splitsKm" | "best"> {
  let best: Partial<Record<BestEffortKey, number>> | undefined;
  if (curve && isRun) {
    best = {};
    for (const effort of BEST_EFFORTS) {
      const seconds = fastest(curve, effort.metres);
      if (seconds != null) best[effort.key] = seconds;
    }
  }
  const split = !!curve && withSplits;
  return {
    splitsMi: split ? splits(curve!, MILE) : undefined,
    splitsKm: split ? splits(curve!, 1000) : undefined,
    best: best && Object.keys(best).length > 0 ? best : undefined,
  };
}

/**
 * The `tracked` part of a session's set, from what the watch sent at the end.
 * Splits for anything ridden or run on foot; fastest times for runs only,
 * since a fastest mile walked or cycled isn't a record anyone keeps.
 */
export function trackedFromWatch(input: {
  healthId: string | null;
  indoor: boolean;
  activeCalories: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  curve: Curve | null;
  withSplits: boolean;
  isRun: boolean;
}): TrackedCardio {
  return present({
    healthId: input.healthId ?? undefined,
    source: "Apple Watch",
    indoor: input.indoor || undefined,
    activeCalories: input.activeCalories != null ? Math.round(input.activeCalories) : undefined,
    avgHeartRate: input.avgHeartRate != null ? Math.round(input.avgHeartRate) : undefined,
    maxHeartRate: input.maxHeartRate != null ? Math.round(input.maxHeartRate) : undefined,
    ...curveFigures(input.curve, input.withSplits, input.isRun),
  });
}

/**
 * The `tracked` part of a session the iPhone's step counter measured: splits
 * and fastest efforts from its minute-by-minute distance, worked out the same
 * way as the watch's. No heart rate or calories — a phone can't tell.
 */
export function trackedFromPhone(input: { indoor: boolean; curve: Curve; isRun: boolean }): TrackedCardio {
  return present({
    source: "iPhone",
    indoor: input.indoor || undefined,
    ...curveFigures(input.curve, true, input.isRun),
  });
}
