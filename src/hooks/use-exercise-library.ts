import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { EXERCISES } from "@/lib/exercises";
import { subscribeExerciseLibrary, updateExerciseLibrary, type ExerciseLibrary } from "@/lib/firestore";
import { newId } from "@/lib/workout-utils";
import type { Exercise } from "@/types";

const EMPTY: ExerciseLibrary = { custom: [], removedIds: [], overrides: [] };

// All of a user's custom exercises live in a single Firestore document, so cap
// them to keep that doc well under Firestore's 1 MB limit. 200 is far more than
// anyone builds by hand (the app ships ~177 defaults) while staying tiny on disk.
export const MAX_CUSTOM_EXERCISES = 200;

// The user's effective exercise list: bundled defaults minus the ones they
// removed, plus their custom exercises. Workouts embed exercise copies, so
// removing something here never touches logged history.
export function useExerciseLibrary() {
  const { user } = useAuth();
  const [library, setLibrary] = useState<ExerciseLibrary>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reset on sign-out/account switch so one user's customizations never
    // leak into the next session.
    setLibrary(EMPTY);
    if (!user) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeExerciseLibrary(user.uid, (lib) => {
      setLibrary(lib);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const exercises = useMemo(() => {
    const removed = new Set(library.removedIds);
    const overrideById = new Map(library.overrides.map((e) => [e.id, e]));
    return [
      ...EXERCISES.filter((e) => !removed.has(e.id)).map((e) => overrideById.get(e.id) ?? e),
      ...library.custom,
    ];
  }, [library]);

  async function createExercise(input: Omit<Exercise, "id" | "isCustom">): Promise<Exercise> {
    // Backstop the UI's check so we can never overflow the library document.
    if (library.custom.length >= MAX_CUSTOM_EXERCISES) {
      throw new Error("custom exercise limit reached");
    }
    const exercise: Exercise = { ...input, id: `custom-${newId()}`, isCustom: true };
    await updateExerciseLibrary(user!.uid, { ...library, custom: [...library.custom, exercise] });
    return exercise;
  }

  // Works for defaults and customs alike: an edited default is stored as an
  // override under the same id, so the merged list swaps it in transparently.
  async function updateExercise(exercise: Exercise): Promise<void> {
    if (exercise.isCustom) {
      await updateExerciseLibrary(user!.uid, {
        ...library,
        custom: library.custom.map((e) => (e.id === exercise.id ? exercise : e)),
      });
    } else {
      await updateExerciseLibrary(user!.uid, {
        ...library,
        overrides: [...library.overrides.filter((e) => e.id !== exercise.id), exercise],
      });
    }
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
        overrides: library.overrides.filter((e) => e.id !== exercise.id),
      });
    }
  }

  async function resetLibrary(): Promise<void> {
    await updateExerciseLibrary(user!.uid, EMPTY);
  }

  return {
    exercises,
    loading,
    customCount: library.custom.length,
    // True when the library differs from the stock defaults — gates the reset action.
    isModified:
      library.custom.length > 0 || library.removedIds.length > 0 || library.overrides.length > 0,
    createExercise,
    updateExercise,
    deleteExercise,
    resetLibrary,
  };
}
