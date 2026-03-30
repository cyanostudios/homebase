import { Trophy } from 'lucide-react';
import React from 'react';

import { Card } from '@/components/ui/card';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { useCups } from '../hooks/useCups';

export function CupsDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { cups } = useCups();
  return (
    <Card
      padding="md"
      className="cursor-pointer border border-border/70 bg-card shadow-sm hover:shadow-md transition-shadow"
      onClick={onOpenPlugin}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Cups</p>
          <p className="text-2xl font-semibold">{cups.length}</p>
        </div>
        <Trophy className="h-5 w-5 text-amber-500" />
      </div>
    </Card>
  );
}
