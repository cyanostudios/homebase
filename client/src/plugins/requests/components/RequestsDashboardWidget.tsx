import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { LIST_FILTER_CHIP_CLASS } from '@/core/ui/detailViewCardStyles';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { useRequests } from '../hooks/useRequests';

export function RequestsDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { requests } = useRequests();
  const openCount = requests.filter(
    (r) => r.status === 'not started' || r.status === 'in progress',
  ).length;
  const externalCount = requests.filter((r) => r.source === 'external').length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal förfrågningar: <strong>{requests.length}</strong>
        <br />
        <span className="text-muted-foreground">
          {openCount} öppna
          {externalCount > 0 && `, ${externalCount} externa`}
        </span>
      </p>
      <Button
        variant="ghost"
        size="sm"
        className={LIST_FILTER_CHIP_CLASS}
        onClick={(e) => {
          e.stopPropagation();
          onOpenPlugin();
        }}
      >
        Öppna Requests
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
