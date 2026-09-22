import { CheckCircle2, Circle, Clock, XCircle, type LucideIcon } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

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

function requestStatusIcon(status: RequestStatus): LucideIcon {
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

export function RequestStatusSelect({
  request,
  onStatusChange,
  hideInlineLabel = false,
  compact = false,
}: RequestStatusSelectProps) {
  const { t } = useTranslation();
  const StatusIcon = requestStatusIcon(request.status);

  const selectEl = (
    <Select value={request.status} onValueChange={(v) => onStatusChange(v as RequestStatus)}>
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
            className={REQUEST_STATUS_COLORS[request.status]}
          >
            {formatRequestStatusForDisplay(request.status, t)}
          </StatusOutlineBadge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
        {REQUEST_STATUSES.map((status) => (
          <SelectItem key={status} value={status} className={BADGE_SELECT_ITEM_CLASS}>
            <StatusOutlineBadge
              icon={requestStatusIcon(status)}
              className={REQUEST_STATUS_COLORS[status]}
            >
              {formatRequestStatusForDisplay(status, t)}
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
      <div className="whitespace-nowrap text-sm font-medium text-foreground">
        {t('requests.form.status')}
      </div>
      {selectEl}
    </div>
  );
}
