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

import { TASK_STATUS_COLORS, TASK_STATUS_OPTIONS, formatStatusForDisplay } from '../types/tasks';

interface TaskStatusSelectProps {
  task: any;
  onStatusChange: (status: string) => void;
  /** Parent supplies label (Contacts-style property row). */
  hideInlineLabel?: boolean;
  /** Smaller trigger for inline lists. */
  compact?: boolean;
}

export function TaskStatusSelect({
  task,
  onStatusChange,
  hideInlineLabel = false,
  compact = false,
}: TaskStatusSelectProps) {
  const selectEl = (
    <Select value={task.status} onValueChange={onStatusChange}>
      <SelectTrigger
        className={cn(
          'rounded-md border-border/50 bg-background px-2 text-xs shadow-none transition-colors hover:bg-accent/50',
          compact ? 'h-8 min-h-8 w-[130px] sm:h-7' : 'h-9 w-[180px]',
        )}
      >
        <SelectValue placeholder="Select status">
          <Badge
            variant="outline"
            className={cn(
              'flex items-center border-transparent px-2 font-medium',
              compact ? 'h-5 text-[10px]' : 'h-5 text-xs',
              TASK_STATUS_COLORS[task.status as keyof typeof TASK_STATUS_COLORS],
            )}
          >
            {formatStatusForDisplay(task.status)}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
        {TASK_STATUS_OPTIONS.map((status) => (
          <SelectItem
            key={status}
            value={status}
            className="rounded-md py-2 text-xs focus:bg-accent"
          >
            <Badge
              variant="outline"
              className={cn(
                'h-5 border-transparent px-2 text-xs font-medium',
                TASK_STATUS_COLORS[status as keyof typeof TASK_STATUS_COLORS],
              )}
            >
              {formatStatusForDisplay(status)}
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
      <div className="text-sm font-medium text-foreground whitespace-nowrap">Status</div>
      {selectEl}
    </div>
  );
}
