import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

import { ReorderScreen } from "@/components/reorder-list";
import { useWorkouts } from "@/hooks/use-workouts";
import { updateWorkout } from "@/lib/data";
import { completedSetCount, sameDay, sortDayWorkouts, totalSetCount, workoutDay } from "@/lib/workout-utils";
import type { Workout } from "@/types";

/**
 * Puts the workouts on one day in the order you want them listed on Home.
 *
 * `day` is the day's local midnight in milliseconds, which is what Home hands
 * over. The order is kept in each workout's orderIndex, the same field
 * templates use for theirs; nothing else reads it for a dated workout.
 */
export default function ReorderDayScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const { active, planned, completed } = useWorkouts();
  const date = useMemo(() => new Date(Number(day)), [day]);
  const items = useMemo(
    () => sortDayWorkouts([...active, ...planned, ...completed].filter((w) => sameDay(workoutDay(w), date))),
    [active, planned, completed, date]
  );

  function persist(data: Workout[]) {
    data.forEach((w, i) => {
      if (w.orderIndex !== i) updateWorkout(w.id, { orderIndex: i });
    });
  }

  return (
    <ReorderScreen
      title="Reorder workouts"
      items={items}
      describe={(w) => {
        const total = totalSetCount(w);
        const planning = !w.startedAt && !w.completedAt;
        return {
          title: w.name,
          meta: planning ? `${total} sets planned` : `${completedSetCount(w)}/${total} sets`,
        };
      }}
      onReorder={persist}
    />
  );
}
