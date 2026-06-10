import {
  CalendarDays,
  ChevronRight,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { Task } from '../types/tasks';

const TASK_PRIORITY_ICONS: Record<Task['priority'], LucideIcon> = {
  Low: SignalLow,
  Medium: SignalMedium,
  High: SignalHigh,
};
import {
  TASK_PRIORITY_AVATAR_COLORS,
  TASK_PRIORITY_COLORS,
  TASK_STATUS_COLORS,
  formatStatusForDisplay,
} from '../types/tasks';

function formatDueDate(dueDate: Date | null) {
  if (!dueDate) {
    return null;
  }
  const today = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `${Math.abs(diffDays)} days overdue`,
      className: 'text-destructive font-medium',
    };
  }
  if (diffDays === 0) {
    return { text: 'Due today', className: 'text-orange-600 dark:text-orange-400 font-medium' };
  }
  if (diffDays === 1) {
    return { text: 'Due tomorrow', className: 'text-yellow-600 dark:text-yellow-400' };
  }
  return { text: due.toLocaleDateString(), className: 'text-muted-foreground' };
}

export function TaskCard({
  task,
  selected,
  highlighted,
  onClick,
  checkbox,
  assignedNames = [],
}: {
  task: Task;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  assignedNames?: string[];
}) {
  const dueDate =
    task.dueDate && task.status !== 'completed' ? formatDueDate(new Date(task.dueDate)) : null;
  const updatedLabel = task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : null;
  const PriorityIcon = TASK_PRIORITY_ICONS[task.priority];

  return (
    <Card
      className={cn(
        'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border-0 bg-white p-0 shadow-sm transition-all dark:bg-slate-950',
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : 'hover:shadow-md',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
          return;
        }
        onClick();
      }}
      data-list-item={JSON.stringify(task)}
      data-plugin-name="tasks"
      role="button"
      aria-label={`Open task ${task.title}`}
    >
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {checkbox}
            <div
              className={cn(
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                TASK_PRIORITY_AVATAR_COLORS[task.priority],
              )}
              aria-hidden
            >
              <PriorityIcon className="h-4 w-4" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{task.title}</h3>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                TASK_STATUS_COLORS[task.status],
              )}
            >
              {formatStatusForDisplay(task.status)}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <Badge
            variant="outline"
            className={cn(
              'h-5 border-transparent px-2 text-[10px] font-medium',
              TASK_PRIORITY_COLORS[task.priority],
            )}
          >
            {task.priority}
          </Badge>
          {assignedNames.length > 0 ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{assignedNames.join(', ')}</span>
            </span>
          ) : null}
        </div>

        {dueDate ? (
          <div className="flex min-w-0 items-center gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <span className={cn('truncate', dueDate.className)}>{dueDate.text}</span>
          </div>
        ) : null}

        {updatedLabel ? (
          <div className="mt-auto border-t border-border/60 pt-2.5">
            <span className="text-xs text-muted-foreground">Updated: {updatedLabel}</span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
