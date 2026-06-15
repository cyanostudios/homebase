import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  REQUEST_PRIORITIES,
  REQUEST_PRIORITY_COLORS,
  type Request,
  type RequestPriority,
} from '../types/requests';

interface RequestPrioritySelectProps {
  request: Request;
  onPriorityChange: (priority: RequestPriority) => void;
  hideInlineLabel?: boolean;
  /** Smaller trigger for inline lists (e.g. team requests tab). */
  compact?: boolean;
}

export function RequestPrioritySelect({
  request,
  onPriorityChange,
  hideInlineLabel = false,
  compact = false,
}: RequestPrioritySelectProps) {
  const { t } = useTranslation();

  const selectEl = (
    <Select value={request.priority} onValueChange={(v) => onPriorityChange(v as RequestPriority)}>
      <SelectTrigger
        className={cn(
          'rounded-md border-border/50 bg-background px-2 text-xs shadow-none transition-colors hover:bg-accent/50',
          compact ? 'h-7 w-[100px]' : 'h-9 w-full sm:w-[180px]',
        )}
      >
        <SelectValue placeholder="Select priority">
          <Badge
            variant="outline"
            className={cn(
              'flex items-center border-transparent px-2 font-medium',
              compact ? 'h-5 text-[10px]' : 'h-5 text-xs',
              REQUEST_PRIORITY_COLORS[request.priority],
            )}
          >
            {request.priority}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
        {REQUEST_PRIORITIES.map((priority) => (
          <SelectItem
            key={priority}
            value={priority}
            className="rounded-md py-2 text-xs focus:bg-accent"
          >
            <Badge
              variant="outline"
              className={cn(
                'h-5 border-transparent px-2 text-xs font-medium',
                REQUEST_PRIORITY_COLORS[priority],
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
      <div className="whitespace-nowrap text-sm font-medium text-foreground">
        {t('requests.form.priority')}
      </div>
      {selectEl}
    </div>
  );
}
