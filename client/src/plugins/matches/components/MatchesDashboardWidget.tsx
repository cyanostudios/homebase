import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useMatches } from '@/plugins/matches/hooks/useMatches';

export function MatchesDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { matches } = useMatches();

  const upcoming = matches.filter((m) => m.match_time && new Date(m.match_time) > new Date()).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal matcher: <strong>{matches.length}</strong>
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
        Öppna Matches
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
