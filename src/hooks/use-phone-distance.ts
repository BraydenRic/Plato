import { useEffect, useState } from "react";

import PlatoMotion from "../../modules/plato-motion";
import { resumed } from "@/lib/cardio-session";
import { trackedFromPhone } from "@/lib/cardio-tracking";
import {
  MIN_PHONE_METRES,
  curveFromPieces,
  matchTotal,
  movingStretches,
  stepCounted,
  stepPieces,
  type Stretch,
} from "@/lib/phone-distance";
import type { Curve } from "@/lib/cardio-tracking";
import { traceWatch } from "@/lib/watch-trace";
import type { TrackedCardio, Workout } from "@/types";

/** Plato has been told no, rather than not asked yet. */
function refusedMotion(): boolean {
  try {
    const status = PlatoMotion?.authorization();
    return status === "denied" || status === "restricted";
  } catch {
    return true;
  }
}

/**
 * Whether the step counter can measure this session: one on foot, on an
 * iPhone that counts distance, where Plato hasn't been refused Motion &
 * Fitness. Not yet asked counts as yes — asking is how the question gets put.
 *
 * A session begun on build 67 kept only its paused total, not each pause, so
 * there's no knowing which minutes to leave out: it's asked how far instead.
 */
export function canCount(workout: Workout): boolean {
  if (!PlatoMotion || !workout.startedAt || !workout.cardio || !stepCounted(workout.cardio.kind)) return false;
  const kept = (workout.cardio.pauses ?? []).reduce((sum, p) => sum + (p.toMs - p.fromMs) / 1000, 0);
  if ((workout.cardio.pausedSeconds ?? 0) - kept > 1) return false;
  try {
    return PlatoMotion.isAvailable() && !refusedMotion();
  } catch {
    return false;
  }
}

/** After a failed count, how long before trying again — unless Plato was refused, which no retry fixes. */
const RETRY_MS = 5_000;

function flat(stretches: Stretch[]): number[] {
  return stretches.flatMap((s) => [s.fromMs, s.toMs]);
}

/**
 * How far the step counter says a running session has gone, for the figure
 * under the clock. Null when it can't say.
 *
 * The stretches before the last resume are asked about once; the one under
 * way is counted live from its start. So a pause — and whatever walking
 * about happened in it — is never in the figure, and a running count never
 * needs subtracting from.
 */
export function usePhoneDistance(workout: Workout, enabled: boolean): number | null {
  const [banked, setBanked] = useState<number | null>(null);
  // Tagged with the start of the stretch it counts from, so a reading from
  // before a pause or a resume is never added to the stretches since.
  const [live, setLive] = useState<{ fromMs: number; metres: number } | null>(null);
  const [refused, setRefused] = useState(false);
  // Bumped to start counting again after a one-off failure.
  const [attempt, setAttempt] = useState(0);
  const counting = enabled && !refused && canCount(workout);
  const startMs = workout.startedAt?.getTime();
  const pausedAtMs = workout.cardio?.pausedAtMs;
  const pauses = workout.cardio?.pauses;
  // One key for "the pauses changed", so a new array from the store with the
  // same pauses in it doesn't restart the count.
  const pausesKey = JSON.stringify(pauses ?? []);
  // Where the stretch under way began: the last resume, or the start.
  const liveFromMs = pausedAtMs == null ? (pauses?.length ? pauses[pauses.length - 1].toMs : startMs) : undefined;

  useEffect(() => {
    if (!counting || !PlatoMotion || startMs == null) return;
    const motion = PlatoMotion;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    // Refused for good, the figure goes; anything else — the permission sheet
    // still up, a hiccup — is tried again shortly rather than given up on.
    const failed = (why: string) => {
      if (cancelled) return;
      traceWatch(`steps: ${why}`);
      if (refusedMotion()) setRefused(true);
      else if (retry == null) retry = setTimeout(() => setAttempt((n) => n + 1), RETRY_MS);
    };
    const stretches = movingStretches(startMs, pausedAtMs ?? Date.now(), JSON.parse(pausesKey) as Stretch[]);
    // Running, the last stretch is the one under way: counted live.
    const underWay = pausedAtMs == null ? stretches.pop() : undefined;

    motion
      .distances(flat(stretches))
      .then((metres) => {
        if (!cancelled) setBanked(metres.reduce((sum, m) => sum + Math.max(0, m), 0));
      })
      .catch((e: unknown) => failed(`couldn't count (${e instanceof Error ? e.message : String(e)})`));

    if (!underWay) {
      return () => {
        cancelled = true;
        clearTimeout(retry);
      };
    }
    const subscription = motion.addListener("onDistance", (reading) => {
      if (cancelled) return;
      if ("error" in reading) failed(`live count failed (code ${reading.error})`);
      else setLive({ fromMs: underWay.fromMs, metres: reading.distance });
    });
    motion.startUpdates(underWay.fromMs);
    return () => {
      cancelled = true;
      clearTimeout(retry);
      subscription.remove();
      motion.stopUpdates();
    };
  }, [counting, startMs, pausedAtMs, pausesKey, attempt]);

  const sinceResume = live && live.fromMs === liveFromMs ? live.metres : 0;
  return counting && banked != null ? banked + sinceResume : null;
}

/**
 * What the step counter made of a session ending at `nowMs`: its distance,
 * and its splits from minute-by-minute counts. Null only when it can't say at
 * all — no step counter, no permission — and the session asks how far.
 *
 * Never less than `liveMetres`, the figure that was on the screen: the
 * minute-by-minute history trails the live count, and build 68 asked "How far
 * did you go?" after a run the screen had shown as 0.02 mi. Next to nothing
 * counted is an answer too — saved without a distance, Add distance waiting
 * on the finished screen — not a question.
 */
export async function measureOnPhone(
  workout: Workout,
  nowMs: number,
  liveMetres: number | null
): Promise<{ distance?: number; tracked?: TrackedCardio } | null> {
  if (!PlatoMotion || !canCount(workout)) return null;
  const cardio = resumed(workout, nowMs)!;
  const pieces = stepPieces(movingStretches(workout.startedAt!.getTime(), nowMs, cardio.pauses));
  const live = liveMetres ?? 0;
  let curve: Curve | null = null;
  try {
    if (pieces.length > 0) curve = curveFromPieces(pieces, await PlatoMotion.distances(pieces));
  } catch (e) {
    traceWatch(`steps: couldn't read the minutes (${e instanceof Error ? e.message : String(e)})`);
    // Turned off since the start, and nothing live either: ask.
    if (live <= 0) return null;
  }
  const counted = curve ? curve.metres[curve.metres.length - 1] : 0;
  const distance = Math.max(counted, live);
  traceWatch(`steps: ${Math.round(counted)} m by the minute, ${Math.round(live)} m live`);
  if (distance < MIN_PHONE_METRES) return {};
  const tracked =
    curve && counted > 0
      ? trackedFromPhone({ indoor: !!cardio.indoor, curve: matchTotal(curve, distance), isRun: cardio.kind === "run" })
      : { source: "iPhone", ...(cardio.indoor ? { indoor: true } : {}) };
  return { distance, tracked };
}

/**
 * Metres the step counter counted from the start up to `untilMs`, pauses left
 * out: the stretch the phone had before a watch took over. Null when it
 * can't say.
 */
export async function stepsBefore(workout: Workout, untilMs: number): Promise<number | null> {
  if (!PlatoMotion || !canCount(workout)) return null;
  const stretches = movingStretches(workout.startedAt!.getTime(), untilMs, workout.cardio!.pauses);
  if (stretches.length === 0) return 0;
  try {
    const metres = await PlatoMotion.distances(flat(stretches));
    return metres.reduce((sum, m) => sum + Math.max(0, m), 0);
  } catch {
    return null;
  }
}

/** The before-the-watch distance, for the figure under the clock. Asked once per takeover. */
export function useStepsBefore(workout: Workout, untilMs: number | null): number | null {
  const [counted, setCounted] = useState<{ untilMs: number; metres: number } | null>(null);
  const possible = untilMs != null && canCount(workout);

  // Asked again when the session changes — a pause or resume from the watch,
  // rare — which costs a few step-counter queries and keeps it right.
  useEffect(() => {
    if (!possible || untilMs == null) return;
    let cancelled = false;
    void stepsBefore(workout, untilMs).then((metres) => {
      if (!cancelled && metres != null) setCounted({ untilMs, metres });
    });
    return () => {
      cancelled = true;
    };
  }, [possible, untilMs, workout]);

  return possible && counted?.untilMs === untilMs ? counted.metres : null;
}
