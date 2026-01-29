import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useEstimates } from '@/plugins/estimates/hooks/useEstimates';

export function EstimatesDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { estimates } = useEstimates();

  const draft = estimates.filter((e) => e.status === 'draft').length;
  const sent = estimates.filter((e) => e.status === 'sent').length;
  const accepted = estimates.filter((e) => e.status === 'accepted').length;
  const rejected = estimates.filter((e) => e.status === 'rejected').length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal offerter: <strong>{estimates.length}</strong>
        <br />
        <span className="text-muted-foreground">
          {draft} utkast, {sent} skickade, {accepted} accepterade, {rejected} avslagna
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
        Öppna Estimates
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
