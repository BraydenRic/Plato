import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { EXERCISES } from "@/lib/exercises";
import {
  LibraryNotLoadedError,
  subscribeExerciseLibrary,
  updateExerciseLibrary,
  type ExerciseLibrary,
} from "@/lib/data";
import { MAX_CUSTOM_EXERCISES, newId } from "@/lib/workout-utils";
import type { Exercise } from "@/types";

const EMPTY: ExerciseLibrary = { custom: [], removedIds: [], overrides: [] };

// Defined in workout-utils alongside the other caps so migration can reach it
// without importing a hook (which would cycle back through AuthContext).
// Re-exported here because screens have always imported it from this module.
export { MAX_CUSTOM_EXERCISES };

/**
 * What to say when a library change didn't save.
 *
 * Changes save to the phone first now, so a missing signal is no longer a
 * reason one fails. What can still stop one is a library that has never
 * loaded on this phone: a change built from it would replace the real one.
 */
export function libraryErrorMessage(e: unknown): string {
  return e instanceof LibraryNotLoadedError ? e.message : "Something went wrong. Try again.";
}

// The user's effective exercise list: bundled defaults minus the ones they
// removed, plus their custom exercises. Workouts embed exercise copies, so
// removing something here never touches logged history.
export function useExerciseLibrary() {
  const { dataUserId } = useAuth();
  const [library, setLibrary] = useState<ExerciseLibrary>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reset on sign-out/account switch so one user's customizations never
    // leak into the next session.
    setLibrary(EMPTY);
    if (!dataUserId) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeExerciseLibrary(dataUserId, (lib) => {
      setLibrary(lib);
      setLoading(false);
    });
    return unsubscribe;
  }, [dataUserId]);

  const exercises = useMemo(() => {
    const removed = new Set(library.removedIds);
    const overrideById = new Map(library.overrides.map((e) => [e.id, e]));
    return [
      ...EXERCISES.filter((e) => !removed.has(e.id)).map((e) => overrideById.get(e.id) ?? e),
      ...library.custom,
    ];
  }, [library]);

  // Every mutation needs a target. Reading it once per call (rather than
  // asserting non-null) keeps these safe if one fires during sign-out.
  function requireUserId(): string {
    if (!dataUserId) throw new Error("No active session.");
    return dataUserId;
  }

  async function createExercise(input: Omit<Exercise, "id" | "isCustom">): Promise<Exercise> {
    // Backstop the UI's check so we can never overflow the library document.
    if (library.custom.length >= MAX_CUSTOM_EXERCISES) {
      throw new Error("custom exercise limit reached");
    }
    const exercise: Exercise = { ...input, id: `custom-${newId()}`, isCustom: true };
    await updateExerciseLibrary(requireUserId(), {
      ...library,
      custom: [...library.custom, exercise],
    });
    return exercise;
  }

  // Works for defaults and customs alike: an edited default is stored as an
  // override under the same id, so the merged list swaps it in transparently.
  async function updateExercise(exercise: Exercise): Promise<void> {
    if (exercise.isCustom) {
      await updateExerciseLibrary(requireUserId(), {
        ...library,
        custom: library.custom.map((e) => (e.id === exercise.id ? exercise : e)),
      });
    } else {
      await updateExerciseLibrary(requireUserId(), {
        ...library,
        overrides: [...library.overrides.filter((e) => e.id !== exercise.id), exercise],
      });
    }
  }

  async function deleteExercise(exercise: Exercise): Promise<void> {
    if (exercise.isCustom) {
      await updateExerciseLibrary(requireUserId(), {
        ...library,
        custom: library.custom.filter((e) => e.id !== exercise.id),
      });
    } else if (!library.removedIds.includes(exercise.id)) {
      await updateExerciseLibrary(requireUserId(), {
        ...library,
        removedIds: [...library.removedIds, exercise.id],
        overrides: library.overrides.filter((e) => e.id !== exercise.id),
      });
    }
  }

  /**
   * Puts one edited built-in back as it ships: the override goes, so the stock
   * entry shows through again, and with it any correction made to it since.
   */
  async function restoreExercise(exercise: Exercise): Promise<void> {
    if (exercise.isCustom || !library.overrides.some((e) => e.id === exercise.id)) return;
    await updateExerciseLibrary(requireUserId(), {
      ...library,
      overrides: library.overrides.filter((e) => e.id !== exercise.id),
    });
  }

  /**
   * Every built-in back as it ships: hidden ones shown, edits undone. The
   * exercises you made stay. Wiping those too used to be the only way to get
   * one hidden exercise back, which cost everything you'd built to fix a
   * single mis-tap; you can still delete them one at a time.
   */
  async function restoreDefaults(): Promise<void> {
    await updateExerciseLibrary(requireUserId(), { ...library, removedIds: [], overrides: [] });
  }

  return {
    exercises,
    loading,
    customCount: library.custom.length,
    /** Whether a built-in has been hidden or edited: gates Restore defaults. */
    defaultsChanged: library.removedIds.length > 0 || library.overrides.length > 0,
    /** Whether this built-in has been edited, so it can be restored. */
    isEdited: (exerciseId: string) => library.overrides.some((e) => e.id === exerciseId),
    createExercise,
    updateExercise,
    deleteExercise,
    restoreExercise,
    restoreDefaults,
  };
}
