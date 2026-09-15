import React from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BADGE_CHIP_CLASS,
  BADGE_CHIP_COMPACT_CLASS,
  BADGE_SELECT_TRIGGER_CLASS,
} from '@/core/ui/badgeStyles';
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
          BADGE_SELECT_TRIGGER_CLASS,
          compact ? 'h-7 w-[100px]' : 'h-9 w-full sm:w-[180px]',
        )}
      >
        <SelectValue placeholder="Select priority">
          <Badge
            variant="outline"
            className={cn(
              'flex items-center',
              compact ? BADGE_CHIP_COMPACT_CLASS : BADGE_CHIP_CLASS,
              TASK_PRIORITY_COLORS[task.priority as keyof typeof TASK_PRIORITY_COLORS],
            )}
          >
            {task.priority}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
        {TASK_PRIORITY_OPTIONS.map((priority) => (
          <SelectItem
            key={priority}
            value={priority}
            className="rounded-md py-2 text-xs focus:bg-accent"
          >
            <Badge
              variant="outline"
              className={cn(
                BADGE_CHIP_CLASS,
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
      <div className="whitespace-nowrap text-sm font-medium text-foreground">Priority</div>
      {selectEl}
    </div>
  );
}
