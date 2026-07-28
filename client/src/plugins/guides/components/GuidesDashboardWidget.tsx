import { ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { LIST_FILTER_CHIP_CLASS } from '@/core/ui/detailViewCardStyles';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { useGuides } from '../hooks/useGuides';

export function GuidesDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { guides } = useGuides();

  const activeCount = useMemo(
    () => guides.filter((guide) => guide.lifecycleStatus === 'active').length,
    [guides],
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal platser i systemet: <strong>{guides.length}</strong>
        <br />
        <span className="text-muted-foreground">{activeCount} aktiva</span>
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
        Öppna Guides
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
