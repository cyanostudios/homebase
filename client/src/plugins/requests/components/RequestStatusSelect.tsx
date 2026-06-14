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
  REQUEST_STATUSES,
  REQUEST_STATUS_COLORS,
  formatRequestStatusForDisplay,
  type Request,
  type RequestStatus,
} from '../types/requests';

interface RequestStatusSelectProps {
  request: Request;
  onStatusChange: (status: RequestStatus) => void;
  hideInlineLabel?: boolean;
  /** Smaller trigger for inline lists (e.g. team requests tab). */
  compact?: boolean;
}

export function RequestStatusSelect({
  request,
  onStatusChange,
  hideInlineLabel = false,
  compact = false,
}: RequestStatusSelectProps) {
  const { t } = useTranslation();

  const selectEl = (
    <Select value={request.status} onValueChange={(v) => onStatusChange(v as RequestStatus)}>
      <SelectTrigger
        className={cn(
          'rounded-md border-border/50 bg-background px-2 text-xs shadow-none transition-colors hover:bg-accent/50',
          compact ? 'h-7 w-[130px]' : 'h-9 w-[180px]',
        )}
      >
        <SelectValue placeholder="Select status">
          <Badge
            variant="outline"
            className={cn(
              'flex items-center border-transparent px-2 font-medium',
              compact ? 'h-5 text-[10px]' : 'h-5 text-xs',
              REQUEST_STATUS_COLORS[request.status],
            )}
          >
            {formatRequestStatusForDisplay(request.status, t)}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
        {REQUEST_STATUSES.map((status) => (
          <SelectItem
            key={status}
            value={status}
            className="rounded-md py-2 text-xs focus:bg-accent"
          >
            <Badge
              variant="outline"
              className={cn(
                'h-5 border-transparent px-2 text-xs font-medium',
                REQUEST_STATUS_COLORS[status],
              )}
            >
              {formatRequestStatusForDisplay(status, t)}
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
        {t('requests.form.status')}
      </div>
      {selectEl}
    </div>
  );
}
