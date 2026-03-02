import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { useAnalytics } from '../hooks/useAnalytics';

const moneyFmt = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
});

export function AnalyticsDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { overview, loading } = useAnalytics();

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {loading ? 'Laddar analytics…' : `Omsättning: ${moneyFmt.format(overview.revenue)}`}
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
