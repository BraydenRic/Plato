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
    if (!user) return;
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
    templates: workouts.filter((w) => w.isTemplate),
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
