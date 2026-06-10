import { Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { useTeams } from '../hooks/useTeams';

export function TeamsDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { t } = useTranslation();
  const { teams } = useTeams();
  const activeCount = teams.filter((team) => team.status === 'active').length;
  return (
    <Card
      padding="md"
      className="cursor-pointer border border-border/70 bg-card shadow-sm hover:shadow-md transition-shadow"
      onClick={onOpenPlugin}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{t('nav.teams')}</p>
          <p className="text-2xl font-semibold">{teams.length}</p>
          <p className="text-[11px] text-muted-foreground">
            {t('teams.dashboardActive', { count: activeCount })}
          </p>
        </div>
        <Users className="h-5 w-5 text-emerald-600" />
      </div>
    </Card>
  );
}
