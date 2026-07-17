import { ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useTeams } from '@/plugins/teams/hooks/useTeams';

import { useSchedulePlans } from '../hooks/useSchedulePlans';

export function ScheduleDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { t } = useTranslation();
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
        {t('schedule.dashboardCalendars', { count: plans.length + 1 })}
        <br />
        <span className="text-muted-foreground">
          {t('schedule.dashboardTeamsWithTraining', { count: teamsWithTraining })}
          {customEventCount > 0 &&
            ` · ${t('schedule.dashboardCustomEvents', { count: customEventCount })}`}
        </span>
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto px-0 text-primary hover:bg-transparent hover:text-primary/90"
        onClick={(e) => {
          e.stopPropagation();
          onOpenPlugin();
        }}
      >
        {t('common.open')} {t('nav.schedule')}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
