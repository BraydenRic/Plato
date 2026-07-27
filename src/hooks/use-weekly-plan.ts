import { useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { subscribeWeeklyPlan, setWeeklyPlan, EMPTY_WEEKLY_PLAN, type WeeklyPlan } from "@/lib/data";

// The user's recurring weekday → template split (see subscribeWeeklyPlan). Empty
// slots are rest days. Changing a day writes the whole array back.
export function useWeeklyPlan() {
  const { dataUserId } = useAuth();
  const [plan, setPlan] = useState<WeeklyPlan>(EMPTY_WEEKLY_PLAN);

  useEffect(() => {
    setPlan(EMPTY_WEEKLY_PLAN);
    if (!dataUserId) return;
    return subscribeWeeklyPlan(dataUserId, setPlan);
  }, [dataUserId]);

  // Assign (or clear, with null) a template to a weekday (0 = Sunday).
  async function assignDay(weekday: number, templateId: string | null) {
    if (!dataUserId) return;
    const next = [...plan];
    next[weekday] = templateId;
    setPlan(next); // optimistic — the subscription confirms it
    try {
      await setWeeklyPlan(dataUserId, next);
    } catch (e) {
      // Roll back the optimistic change if the write is rejected (e.g. the
      // weeklyPlans Firestore rule hasn't been added yet).
      setPlan(plan);
      console.warn("Couldn't save weekly split", e);
    }
  }

  return { plan, assignDay };
}
