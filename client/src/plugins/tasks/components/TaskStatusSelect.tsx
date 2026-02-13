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
}

export function TaskStatusSelect({ task, onStatusChange }: TaskStatusSelectProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
        Status
      </div>
      <Select value={task.status} onValueChange={onStatusChange}>
        <SelectTrigger className="h-7 w-[120px] bg-background border-border/50 hover:bg-accent/50 transition-colors shadow-none rounded-md px-2">
          <SelectValue placeholder="Select status">
            <Badge
              variant="outline"
              className={cn(
                'border-transparent font-medium text-[10px] px-2 h-5 flex items-center',
                TASK_STATUS_COLORS[task.status as keyof typeof TASK_STATUS_COLORS],
              )}
            >
              {formatStatusForDisplay(task.status)}
            </Badge>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[180px]">
          {TASK_STATUS_OPTIONS.map((status) => (
            <SelectItem key={status} value={status} className="py-2 focus:bg-accent rounded-md">
              <Badge
                variant="outline"
                className={cn(
                  'border-transparent font-medium text-[10px] px-2 h-5',
                  TASK_STATUS_COLORS[status as keyof typeof TASK_STATUS_COLORS],
                )}
              >
                {formatStatusForDisplay(status)}
              </Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
