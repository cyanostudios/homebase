import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { LIST_FILTER_CHIP_CLASS } from '@/core/ui/detailViewCardStyles';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useNotes } from '@/plugins/notes/hooks/useNotes';

export function NotesDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { notes } = useNotes();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal anteckningar i systemet: <strong>{notes.length}</strong>
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
        Öppna Notes
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
