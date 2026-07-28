import { ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { LIST_FILTER_CHIP_CLASS } from '@/core/ui/detailViewCardStyles';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { useIngest } from '../hooks/useIngest';

export function IngestDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { ingestSources } = useIngest();

  const activeCount = useMemo(
    () => ingestSources.filter((source) => source.isActive).length,
    [ingestSources],
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal källor i systemet: <strong>{ingestSources.length}</strong>
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
        Öppna Ingest
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
