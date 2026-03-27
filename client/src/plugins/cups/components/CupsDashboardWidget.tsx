import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useCups } from '@/plugins/cups/hooks/useCupsPlugin';

export function CupsDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { cups } = useCups();

  const visible = cups.filter((c) => c.visible).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal cuper: <strong>{cups.length}</strong>
        {cups.length > 0 && (
          <>
            <br />
            <span className="text-muted-foreground">{visible} synliga</span>
          </>
        )}
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
        Öppna Cups
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
