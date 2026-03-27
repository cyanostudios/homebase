import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useSlotsContext } from '@/plugins/slots/context/SlotsContext';

export function SlotsDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { slots } = useSlotsContext();

  const upcoming = slots.filter((s) => s.slot_time && new Date(s.slot_time) > new Date()).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal slots: <strong>{slots.length}</strong>
        {upcoming > 0 && (
          <>
            <br />
            <span className="text-muted-foreground">{upcoming} kommande</span>
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
        Öppna Slots
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
