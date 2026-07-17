import { ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { useAIProviders } from '../hooks/useAIProviders';

export function AIProvidersDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { t } = useTranslation();
  const { providers } = useAIProviders();

  const enabledCount = useMemo(
    () => providers.filter((provider) => provider.enabled).length,
    [providers],
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t('aiProviders.dashboardTotal', { count: providers.length })}
        <br />
        <span className="text-muted-foreground">
          {t('aiProviders.dashboardEnabled', { count: enabledCount })}
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
        {t('common.open')} {t('nav.ai-providers')}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
