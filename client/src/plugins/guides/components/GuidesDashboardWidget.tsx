import { ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { useGuides } from '../hooks/useGuides';

export function GuidesDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { t } = useTranslation();
  const { guides } = useGuides();

  const activeCount = useMemo(
    () => guides.filter((guide) => guide.lifecycleStatus === 'active').length,
    [guides],
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t('guides.dashboardTotal', { count: guides.length })}
        <br />
        <span className="text-muted-foreground">
          {t('guides.dashboardActive', { count: activeCount })}
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
        {t('common.open')} {t('nav.guides')}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
