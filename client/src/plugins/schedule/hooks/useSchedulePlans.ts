import { useCallback, useEffect, useState } from 'react';

import { scheduleApi } from '../api/scheduleApi';
import type { SchedulePlan } from '../types/schedule';

export function useSchedulePlans() {
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allPlans = await scheduleApi.getSchedules();
      setPlans(allPlans.filter((plan) => !plan.is_team_calendar));
    } catch {
      setError('load');
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const createPlan = useCallback(async (name: string) => {
    const plan = await scheduleApi.createSchedule(name.trim());
    setPlans((prev) => [plan, ...prev]);
    return plan;
  }, []);

  const renamePlan = useCallback(async (id: string, name: string) => {
    const plan = await scheduleApi.renameSchedule(id, name.trim());
    setPlans((prev) => prev.map((item) => (item.id === id ? plan : item)));
    return plan;
  }, []);

  const deletePlan = useCallback(async (id: string) => {
    await scheduleApi.deleteSchedule(id);
    setPlans((prev) => prev.filter((plan) => plan.id !== id));
  }, []);

  const addPlanEventCount = useCallback((id: string, count: number) => {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.id === id ? { ...plan, event_count: plan.event_count + count } : plan,
      ),
    );
  }, []);

  const adjustPlanEventCount = useCallback((id: string, delta: number) => {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.id === id ? { ...plan, event_count: Math.max(0, plan.event_count + delta) } : plan,
      ),
    );
  }, []);

  const setPlanEventCount = useCallback((id: string, count: number) => {
    setPlans((prev) =>
      prev.map((plan) => (plan.id === id ? { ...plan, event_count: count } : plan)),
    );
  }, []);

  const [eventsRevision, setEventsRevision] = useState<Record<string, number>>({});

  const bumpPlanEventsRevision = useCallback((id: string) => {
    setEventsRevision((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  return {
    plans,
    isLoading,
    error,
    loadPlans,
    createPlan,
    renamePlan,
    deletePlan,
    addPlanEventCount,
    adjustPlanEventCount,
    setPlanEventCount,
    eventsRevision,
    bumpPlanEventsRevision,
  };
}

export type SchedulePlansState = ReturnType<typeof useSchedulePlans>;
