import { useEffect, useState } from "react";
import { awaitingFirstSync, subscribeWorkouts } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { isActiveWorkout } from "@/lib/workout-utils";
import type { Workout } from "@/types";

/** What Home and History say while `awaitingSync` (see below). */
export const AWAITING_SYNC_MESSAGE =
  "Your workouts will appear once you're online. After that, this phone keeps a copy for when there's no signal.";

// Single live subscription to the user's workouts (templates included),
// shared by the Workouts and Stats tabs.
export function useWorkouts() {
  const { dataUserId } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // An empty list on a phone that has never been online since installing
  // doesn't mean "no workouts", it means "not here yet". Screens say so
  // instead of showing an empty history that reads as lost data.
  const [awaitingSync, setAwaitingSync] = useState(false);

  useEffect(() => {
    // Drop the previous user's data on sign-out/account switch so it can
    // never flash on screen for the next session.
    setWorkouts([]);
    setAwaitingSync(false);
    if (!dataUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeWorkouts(
      dataUserId,
      (all) => {
        setWorkouts(all);
        setAwaitingSync(awaitingFirstSync(dataUserId));
        setError(null);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [dataUserId]);

  return {
    loading,
    error,
    awaitingSync,
    // Manual order first (once the user has dragged them); anything without an
    // orderIndex falls to the end, newest first — the pre-reorder default.
    templates: workouts
      .filter((w) => w.isTemplate)
      .sort((a, b) => {
        const ai = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
        const bi = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
        return ai !== bi ? ai - bi : b.createdAt.getTime() - a.createdAt.getTime();
      }),
    // Started but unfinished — the live session(s).
    active: workouts.filter(isActiveWorkout),
    // Created for a future (or past) day but never begun.
    planned: workouts.filter((w) => !w.isTemplate && !w.completedAt && !w.startedAt),
    // Sorted by when they happened, not when they were created — a backdated
    // log belongs with its day, and history reads newest-first.
    completed: workouts
      .filter((w) => !w.isTemplate && !!w.completedAt)
      .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime()),
  };
}
