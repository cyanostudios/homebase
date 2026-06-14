import { Inbox } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { useRequests } from '../hooks/useRequests';

export function RequestsDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { t } = useTranslation();
  const { requests } = useRequests();
  const openCount = requests.filter(
    (r) => r.status === 'not started' || r.status === 'in progress',
  ).length;
  const externalCount = requests.filter((r) => r.source === 'external').length;
  return (
    <Card
      padding="md"
      className="cursor-pointer border border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md"
      onClick={onOpenPlugin}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{t('nav.requests')}</p>
          <p className="text-2xl font-semibold">{requests.length}</p>
          <p className="text-[11px] text-muted-foreground">
            {t('requests.dashboardOpen', { count: openCount })}
            {externalCount > 0 && ` · ${t('requests.dashboardExternal', { count: externalCount })}`}
          </p>
        </div>
        <Inbox className="h-5 w-5 text-violet-500" />
      </div>
    </Card>
  );
}
