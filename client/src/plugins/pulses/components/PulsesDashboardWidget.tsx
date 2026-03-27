import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { usePulses } from '@/plugins/pulses/hooks/usePulses';

export function PulsesDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { pulseHistory } = usePulses();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Skickade pulsar: <strong>{pulseHistory.length}</strong>
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
        Öppna Pulse
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
