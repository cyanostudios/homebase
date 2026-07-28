import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { LIST_FILTER_CHIP_CLASS } from '@/core/ui/detailViewCardStyles';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useFiles } from '@/plugins/files/hooks/useFiles';

export function FilesDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { files } = useFiles();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal filer i systemet: <strong>{files.length}</strong>
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
        Öppna Files
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
