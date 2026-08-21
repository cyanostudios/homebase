import React from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { TASK_PRIORITY_COLORS, TASK_PRIORITY_OPTIONS } from '../types/tasks';

interface TaskPrioritySelectProps {
  task: any;
  onPriorityChange: (priority: string) => void;
  hideInlineLabel?: boolean;
  /** Smaller trigger for inline lists / quick context. */
  compact?: boolean;
}

export function TaskPrioritySelect({
  task,
  onPriorityChange,
  hideInlineLabel = false,
  compact = false,
}: TaskPrioritySelectProps) {
  const selectEl = (
    <Select value={task.priority} onValueChange={onPriorityChange}>
      <SelectTrigger
        className={cn(
          'rounded-md border-border/50 bg-background px-2 text-xs shadow-none transition-colors hover:bg-accent/50',
          compact ? 'h-8 min-h-8 w-[130px] sm:h-7' : 'h-9 w-[180px]',
        )}
      >
        <SelectValue placeholder="Select priority">
          <Badge
            variant="outline"
            className={cn(
              'flex items-center border-transparent px-2 font-medium',
              compact ? 'h-5 text-[10px]' : 'h-5 text-xs',
              TASK_PRIORITY_COLORS[task.priority as keyof typeof TASK_PRIORITY_COLORS],
            )}
          >
            {task.priority}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[180px]">
        {TASK_PRIORITY_OPTIONS.map((priority) => (
          <SelectItem
            key={priority}
            value={priority}
            className="py-2 focus:bg-accent rounded-md text-xs"
          >
            <Badge
              variant="outline"
              className={cn(
                'border-transparent font-medium text-xs px-2 h-5',
                TASK_PRIORITY_COLORS[priority as keyof typeof TASK_PRIORITY_COLORS],
              )}
            >
              {priority}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (hideInlineLabel) {
    return <div className="flex shrink-0 justify-end">{selectEl}</div>;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm font-medium text-foreground whitespace-nowrap">Priority</div>
      {selectEl}
    </div>
  );
}
