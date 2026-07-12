import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { EXERCISES } from "@/lib/exercises";
import { subscribeExerciseLibrary, updateExerciseLibrary, type ExerciseLibrary } from "@/lib/firestore";
import { newId } from "@/lib/workout-utils";
import type { Exercise } from "@/types";

const EMPTY: ExerciseLibrary = { custom: [], removedIds: [] };

// The user's effective exercise list: bundled defaults minus the ones they
// removed, plus their custom exercises. Workouts embed exercise copies, so
// removing something here never touches logged history.
export function useExerciseLibrary() {
  const { user } = useAuth();
  const [library, setLibrary] = useState<ExerciseLibrary>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeExerciseLibrary(user.uid, (lib) => {
      setLibrary(lib);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const exercises = useMemo(() => {
    const removed = new Set(library.removedIds);
    return [...EXERCISES.filter((e) => !removed.has(e.id)), ...library.custom];
  }, [library]);

  async function createExercise(input: Omit<Exercise, "id" | "isCustom">): Promise<Exercise> {
    const exercise: Exercise = { ...input, id: `custom-${newId()}`, isCustom: true };
    await updateExerciseLibrary(user!.uid, { ...library, custom: [...library.custom, exercise] });
    return exercise;
  }

  async function deleteExercise(exercise: Exercise): Promise<void> {
    if (exercise.isCustom) {
      await updateExerciseLibrary(user!.uid, {
        ...library,
        custom: library.custom.filter((e) => e.id !== exercise.id),
      });
    } else if (!library.removedIds.includes(exercise.id)) {
      await updateExerciseLibrary(user!.uid, {
        ...library,
        removedIds: [...library.removedIds, exercise.id],
      });
    }
  }

  async function resetLibrary(): Promise<void> {
    await updateExerciseLibrary(user!.uid, EMPTY);
  }

  return {
    exercises,
    loading,
    // True when the library differs from the stock 61 — gates the reset action.
    isModified: library.custom.length > 0 || library.removedIds.length > 0,
    createExercise,
    deleteExercise,
    resetLibrary,
  };
}
