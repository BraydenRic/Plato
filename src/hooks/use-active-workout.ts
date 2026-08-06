import { useEffect, useState } from "react";

import { useWorkouts } from "@/hooks/use-workouts";
import { liveWorkout } from "@/lib/workout-utils";
import type { Workout } from "@/types";

/**
 * How long a newly live workout is held back before the bar admits to it.
 *
 * Starting a workout navigates straight into it, and the push takes an
 * animation to cover the tabs — so a bar that appeared the instant the workout
 * became live would slide in *behind* the arriving screen and be visible for
 * the length of the transition. That is the same flash the Workouts list
 * already suppresses with the same delay; the two are timing against the same
 * animation, so they use the same number.
 */
export const REVEAL_DELAY_MS = 500;

/**
 * The in-progress workout the resume bar should offer, or null for none.
 *
 * The delay only ever applies to a workout that has just become live. Anything
 * else the bar cares about — sets logged, the name edited, a rest started —
 * leaves the id alone and comes through immediately, so the bar stays current
 * while you're reading it.
 */
export function useActiveWorkout(): Workout | null {
  const { active } = useWorkouts();
  const current = liveWorkout(active) ?? null;
  const currentId = current?.id ?? null;
  const [revealedId, setRevealedId] = useState<string | null>(null);

  useEffect(() => {
    // Forget which workout was revealed rather than leaving its id behind.
    // Dismissal is already instant either way — there is no workout left to
    // return — but a remembered id would match again if that same workout came
    // back, so finishing one and resuming it would skip the delay it is owed.
    if (!currentId) {
      setRevealedId(null);
      return;
    }
    const timer = setTimeout(() => setRevealedId(currentId), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [currentId]);

  return revealedId === currentId ? current : null;
}
