import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';

export function TasksDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { tasks } = useTasks();

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in progress').length;
  const notStarted = tasks.filter((t) => t.status === 'not started').length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal uppgifter: <strong>{tasks.length}</strong>
        <br />
        <span className="text-muted-foreground">
          {completed} klara, {inProgress} på gång, {notStarted} ej påbörjade
        </span>
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
        Öppna Tasks
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
