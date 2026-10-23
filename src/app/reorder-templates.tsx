import { ReorderScreen } from "@/components/reorder-list";
import { useWorkouts } from "@/hooks/use-workouts";
import { updateWorkout } from "@/lib/data";
import { totalSetCount } from "@/lib/workout-utils";
import type { Workout } from "@/types";

export default function ReorderTemplatesScreen() {
  const { templates } = useWorkouts();

  // Write each template's new position. orderIndex keeps every reader (this
  // app and plato-web) in agreement on the sequence.
  function persist(data: Workout[]) {
    data.forEach((t, i) => {
      if (t.orderIndex !== i) updateWorkout(t.id, { orderIndex: i });
    });
  }

  return (
    <ReorderScreen
      title="Reorder templates"
      items={templates}
      describe={(t) => ({
        title: t.name,
        meta: `${t.exercises.length} exercise${t.exercises.length === 1 ? "" : "s"} · ${totalSetCount(t)} sets`,
      })}
      onReorder={persist}
    />
  );
}
