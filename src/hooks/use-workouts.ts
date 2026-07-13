import { useEffect, useState } from "react";
import { subscribeWorkouts } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import type { Workout } from "@/types";

// Single live subscription to the user's workouts (templates included),
// shared by the Workouts and Stats tabs.
export function useWorkouts() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Drop the previous user's data on sign-out/account switch so it can
    // never flash on screen for the next session.
    setWorkouts([]);
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeWorkouts(
      user.uid,
      (all) => {
        setWorkouts(all);
        setError(null);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user]);

  return {
    loading,
    error,
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
    active: workouts.filter((w) => !w.isTemplate && !w.completedAt && !!w.startedAt),
    // Created for a future (or past) day but never begun.
    planned: workouts.filter((w) => !w.isTemplate && !w.completedAt && !w.startedAt),
    // Sorted by when they happened, not when they were created — a backdated
    // log belongs with its day, and history reads newest-first.
    completed: workouts
      .filter((w) => !w.isTemplate && !!w.completedAt)
      .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime()),
  };
}
