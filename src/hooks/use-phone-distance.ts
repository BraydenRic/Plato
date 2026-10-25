import { useEffect, useState } from "react";

import PlatoMotion from "../../modules/plato-motion";
import { resumed } from "@/lib/cardio-session";
import { trackedFromPhone } from "@/lib/cardio-tracking";
import { MIN_PHONE_METRES, curveFromPieces, movingStretches, stepCounted, stepPieces, type Stretch } from "@/lib/phone-distance";
import { traceWatch } from "@/lib/watch-trace";
import type { TrackedCardio, Workout } from "@/types";

/**
 * Whether the step counter can measure this session: one on foot, on an
 * iPhone that counts distance, where Plato hasn't been refused Motion &
 * Fitness. Not yet asked counts as yes — asking is how the question gets put.
 */
function canCount(workout: Workout): boolean {
  if (!PlatoMotion || !workout.startedAt || !workout.cardio || !stepCounted(workout.cardio.kind)) return false;
  try {
    const status = PlatoMotion.authorization();
    return PlatoMotion.isAvailable() && status !== "denied" && status !== "restricted";
  } catch {
    return false;
  }
}

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
  const [sinceResume, setSinceResume] = useState(0);
  const [refused, setRefused] = useState(false);
  const counting = enabled && !refused && canCount(workout);
  const startMs = workout.startedAt?.getTime();
  const pausedAtMs = workout.cardio?.pausedAtMs;
  // One key for "the pauses changed", so a new array from the store with the
  // same pauses in it doesn't restart the count.
  const pausesKey = JSON.stringify(workout.cardio?.pauses ?? []);

  useEffect(() => {
    if (!counting || !PlatoMotion || startMs == null) return;
    const motion = PlatoMotion;
    let cancelled = false;
    const pauses: Stretch[] = JSON.parse(pausesKey);
    const stretches = movingStretches(startMs, pausedAtMs ?? Date.now(), pauses);
    // Running, the last stretch is the one under way: counted live.
    const live = pausedAtMs == null ? stretches.pop() : undefined;

    motion
      .distances(flat(stretches))
      .then((metres) => {
        if (cancelled) return;
        setBanked(metres.reduce((sum, m) => sum + Math.max(0, m), 0));
        setSinceResume(0);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        traceWatch(`steps: couldn't count (${e instanceof Error ? e.message : String(e)})`);
        setRefused(true);
      });

    if (!live) return () => void (cancelled = true);
    const subscription = motion.addListener("onDistance", (reading) => {
      if (cancelled) return;
      if ("error" in reading) {
        traceWatch(`steps: live count failed (code ${reading.error})`);
        setRefused(true);
      } else {
        setSinceResume(reading.distance);
      }
    });
    motion.startUpdates(live.fromMs);
    return () => {
      cancelled = true;
      subscription.remove();
      motion.stopUpdates();
    };
  }, [counting, startMs, pausedAtMs, pausesKey]);

  return counting && banked != null ? banked + sinceResume : null;
}

/**
 * What the step counter made of a session ending at `nowMs`: its distance,
 * and its splits from minute-by-minute counts. Null when it can't say — no
 * step counter, no permission, or next to nothing counted — and the session
 * asks how far, as it always did.
 */
export async function measureOnPhone(
  workout: Workout,
  nowMs: number
): Promise<{ distance: number; tracked: TrackedCardio } | null> {
  if (!PlatoMotion || !canCount(workout)) return null;
  const cardio = resumed(workout, nowMs)!;
  const pieces = stepPieces(movingStretches(workout.startedAt!.getTime(), nowMs, cardio.pauses));
  if (pieces.length === 0) return null;
  try {
    const curve = curveFromPieces(pieces, await PlatoMotion.distances(pieces));
    const distance = curve.metres[curve.metres.length - 1];
    traceWatch(`steps: ${Math.round(distance)} m over ${pieces.length / 2} pieces`);
    if (distance < MIN_PHONE_METRES) return null;
    return { distance, tracked: trackedFromPhone({ indoor: !!cardio.indoor, curve, isRun: cardio.kind === "run" }) };
  } catch (e) {
    traceWatch(`steps: couldn't measure the session (${e instanceof Error ? e.message : String(e)})`);
    return null;
  }
}
