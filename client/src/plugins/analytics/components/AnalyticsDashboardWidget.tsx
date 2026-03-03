import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { useAnalytics } from '../hooks/useAnalytics';
import { moneyFmt, sortCurrenciesForDisplay } from '../utils/formatters';

export function AnalyticsDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { overview, loading } = useAnalytics();
  const revenueItems = sortCurrenciesForDisplay(
    (overview.byCurrency ?? []).filter((c) => c.revenue > 0),
  );
  const revenueText =
    revenueItems.length > 0
      ? revenueItems.map((c) => moneyFmt(c.revenue, c.currency)).join(' | ')
      : moneyFmt(0);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {loading ? 'Laddar analytics…' : `Omsättning: ${revenueText}`}
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
        Öppna Analytics
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
