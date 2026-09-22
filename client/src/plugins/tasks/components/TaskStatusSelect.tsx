import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';
import React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BADGE_SELECT_ITEM_CLASS, BADGE_SELECT_TRIGGER_CLASS } from '@/core/ui/badgeStyles';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
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

function taskStatusIcon(status: string) {
  switch (status) {
    case 'in progress':
      return Clock;
    case 'completed':
      return CheckCircle2;
    case 'cancelled':
      return XCircle;
    default:
      return Circle;
  }
}

export function TaskStatusSelect({
  task,
  onStatusChange,
  hideInlineLabel = false,
  compact = false,
}: TaskStatusSelectProps) {
  const StatusIcon = taskStatusIcon(task.status);

  const selectEl = (
    <Select value={task.status} onValueChange={onStatusChange}>
      <SelectTrigger
        className={cn(
          BADGE_SELECT_TRIGGER_CLASS,
          compact ? 'h-7 w-[130px]' : 'h-9 w-full sm:w-[180px]',
        )}
      >
        <SelectValue placeholder="Select status">
          <StatusOutlineBadge
            icon={StatusIcon}
            compact={compact}
            className={
              TASK_STATUS_COLORS[task.status as keyof typeof TASK_STATUS_COLORS] ??
              TASK_STATUS_COLORS['not started']
            }
          >
            {formatStatusForDisplay(task.status)}
          </StatusOutlineBadge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
        {TASK_STATUS_OPTIONS.map((status) => (
          <SelectItem key={status} value={status} className={BADGE_SELECT_ITEM_CLASS}>
            <StatusOutlineBadge
              icon={taskStatusIcon(status)}
              className={TASK_STATUS_COLORS[status as keyof typeof TASK_STATUS_COLORS]}
            >
              {formatStatusForDisplay(status)}
            </StatusOutlineBadge>
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
      <div className="whitespace-nowrap text-sm font-medium text-foreground">Status</div>
      {selectEl}
    </div>
  );
}
