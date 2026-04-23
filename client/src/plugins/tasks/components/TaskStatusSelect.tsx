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
}

export function TaskStatusSelect({
  task,
  onStatusChange,
  hideInlineLabel = false,
}: TaskStatusSelectProps) {
  const selectEl = (
    <Select value={task.status} onValueChange={onStatusChange}>
      <SelectTrigger className="h-9 w-[180px] bg-background border-border/50 hover:bg-accent/50 transition-colors shadow-none rounded-md px-2 text-xs">
        <SelectValue placeholder="Select status">
          <Badge
            variant="outline"
            className={cn(
              'border-transparent font-medium text-xs px-2 h-5 flex items-center',
              TASK_STATUS_COLORS[task.status as keyof typeof TASK_STATUS_COLORS],
            )}
          >
            {formatStatusForDisplay(task.status)}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[180px]">
        {TASK_STATUS_OPTIONS.map((status) => (
          <SelectItem
            key={status}
            value={status}
            className="py-2 focus:bg-accent rounded-md text-xs"
          >
            <Badge
              variant="outline"
              className={cn(
                'border-transparent font-medium text-xs px-2 h-5',
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
