import { ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useTeams } from '@/plugins/teams/hooks/useTeams';

import { useSchedulePlans } from '../hooks/useSchedulePlans';

export function ScheduleDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { plans } = useSchedulePlans();
  const { teams } = useTeams();

  const teamsWithTraining = useMemo(
    () => teams.filter((team) => team.training_times.length > 0).length,
    [teams],
  );
  const customEventCount = useMemo(
    () => plans.reduce((sum, plan) => sum + plan.event_count, 0),
    [plans],
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal kalendrar: <strong>{plans.length + 1}</strong>
        <br />
        <span className="text-muted-foreground">
          {teamsWithTraining} lag med träningstider
          {customEventCount > 0 && `, ${customEventCount} egna pass`}
        </span>
      </p>
      <RoundIconLabelButton
        icon={ChevronRight}
        label="Öppna Schedule"
        variant="secondary"
        alwaysExpanded
        onClick={(e) => {
          e.stopPropagation();
          onOpenPlugin();
        }}
      />
    </div>
  );
}
