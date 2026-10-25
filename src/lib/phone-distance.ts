import type { Curve } from "./cardio-tracking";
import type { CardioSessionKind } from "@/types";

/**
 * Distance on foot from the iPhone's step counter, for a session with no
 * watch tracking it. The step counter is asked about windows of time; this
 * works out which windows — the session's moving stretches, cut into minutes
 * — and turns what it says about each into a curve, which cardio-tracking
 * makes splits of exactly as it does the watch's.
 *
 * Pure, so the arithmetic is proven in Jest; the asking happens in
 * use-phone-distance.
 */

export type Stretch = { fromMs: number; toMs: number };

/** What the step counter can measure: a session on foot. A bike's pedalling isn't steps. */
export function stepCounted(kind: CardioSessionKind): boolean {
  return kind === "run" || kind === "walk" || kind === "hike";
}

/**
 * Start to end, less the pauses, oldest first. Pauses may overlap or run
 * past either end — a pause still on at the end, banked as the session
 * finished — and are clipped to the session.
 */
export function movingStretches(startMs: number, endMs: number, pauses: Stretch[] = []): Stretch[] {
  const out: Stretch[] = [];
  let cursor = startMs;
  for (const pause of [...pauses].sort((a, b) => a.fromMs - b.fromMs)) {
    if (cursor >= endMs) break;
    const from = Math.max(pause.fromMs, startMs);
    const to = Math.min(pause.toMs, endMs);
    if (to <= cursor) continue;
    if (from > cursor) out.push({ fromMs: cursor, toMs: Math.min(from, endMs) });
    cursor = Math.max(cursor, to);
  }
  if (cursor < endMs) out.push({ fromMs: cursor, toMs: endMs });
  return out;
}

/** A minute: splits then land within a few seconds of the truth. */
const PIECE_MS = 60_000;
/** Most windows asked about at once. A session past ten hours gets longer pieces rather than more. */
const MAX_PIECES = 600;

/** The moving stretches cut into pieces of a minute at most, flat — from, to, from, to… — as the native call takes them. */
export function stepPieces(stretches: Stretch[]): number[] {
  const moving = stretches.reduce((sum, s) => sum + (s.toMs - s.fromMs), 0);
  const step = Math.max(PIECE_MS, Math.ceil(moving / MAX_PIECES));
  const flat: number[] = [];
  for (const stretch of stretches) {
    for (let from = stretch.fromMs; from < stretch.toMs; from += step) {
      flat.push(from, Math.min(from + step, stretch.toMs));
    }
  }
  return flat;
}

/** Distance against moving time, from the metres the step counter gave for each piece. */
export function curveFromPieces(pieces: number[], metres: number[]): Curve {
  const curve: Curve = { metres: [0], seconds: [0] };
  let distance = 0;
  let seconds = 0;
  for (let i = 0; i < metres.length && 2 * i + 1 < pieces.length; i++) {
    distance += Number.isFinite(metres[i]) ? Math.max(0, metres[i]) : 0;
    seconds += (pieces[2 * i + 1] - pieces[2 * i]) / 1000;
    curve.metres.push(distance);
    curve.seconds.push(seconds);
  }
  return curve;
}

/**
 * A watch's curve with the phone's stretch before the watch took over put in
 * front: from nothing to what the phone had counted, then the watch's points
 * carried on from there. So splits and fastest efforts cover the whole session.
 */
export function withLead(curve: Curve, metres: number, seconds: number): Curve {
  if (metres <= 0 && seconds <= 0) return curve;
  return {
    metres: [0, ...curve.metres.map((m) => m + metres)],
    seconds: [0, ...curve.seconds.map((s) => s + seconds)],
  };
}

/**
 * The curve brought up to `total` metres. The step counter files its
 * minute-by-minute history a little behind its live count, so at the end of
 * a session the last minute or two can come back short. A small shortfall is
 * put where it belongs, at the end; a big one — the history mostly missing —
 * is spread over the whole curve, so no single minute gets a burst of speed
 * that would turn up in the splits.
 */
export function matchTotal(curve: Curve, total: number): Curve {
  const counted = curve.metres[curve.metres.length - 1] ?? 0;
  if (counted <= 0 || total <= counted) return curve;
  if (total - counted <= total * 0.15) {
    return { metres: [...curve.metres.slice(0, -1), total], seconds: curve.seconds };
  }
  const factor = total / counted;
  return { metres: curve.metres.map((m) => m * factor), seconds: curve.seconds };
}

/** Less than this and nothing was really counted — the phone set down, not a walk. Saved without a distance. */
export const MIN_PHONE_METRES = 10;
