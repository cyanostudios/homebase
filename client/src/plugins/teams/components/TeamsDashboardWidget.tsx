import { ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { LIST_FILTER_CHIP_CLASS } from '@/core/ui/detailViewCardStyles';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { useTeams } from '../hooks/useTeams';

export function TeamsDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { teams } = useTeams();
  const activeCount = useMemo(
    () => teams.filter((team) => team.status === 'active').length,
    [teams],
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal lag i systemet: <strong>{teams.length}</strong>
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
        Öppna Teams
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
