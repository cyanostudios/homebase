import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import type { Request } from '../types/requests';
import {
  RESPONSE_DUE_URGENCY_COLORS,
  formatSubmittedDate,
  getDaysUntilResponseDue,
  getResponseDueSlaDays,
  getResponseDueUrgency,
  responseDueAtFromDays,
} from '../types/requests';

interface RequestResponseDueControlProps {
  request: Pick<Request, 'responseDueAt' | 'created_at'>;
  onDaysChange: (slaDays: number, responseDueAt: string) => void;
  hideInlineLabel?: boolean;
  compact?: boolean;
}

export function RequestResponseDueControl({
  request,
  onDaysChange,
  hideInlineLabel = false,
  compact = false,
}: RequestResponseDueControlProps) {
  const { t } = useTranslation();
  const daysLeft = getDaysUntilResponseDue(request.responseDueAt);
  const slaDays = getResponseDueSlaDays(request.created_at, request.responseDueAt);
  const urgency = getResponseDueUrgency(daysLeft);
  const [draftDays, setDraftDays] = useState(String(slaDays !== null ? Math.max(0, slaDays) : 7));

  useEffect(() => {
    const next = getResponseDueSlaDays(request.created_at, request.responseDueAt);
    setDraftDays(String(next !== null ? Math.max(0, next) : 7));
  }, [request.created_at, request.responseDueAt]);

  const commitDays = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraftDays(String(slaDays !== null ? Math.max(0, slaDays) : 7));
      return;
    }
    const days = Math.min(3650, parsed);
    setDraftDays(String(days));
    if (slaDays !== null && days === slaDays) {
      return;
    }
    onDaysChange(days, responseDueAtFromDays(days, request.created_at));
  };

  const dueLabel = formatSubmittedDate(request.responseDueAt ?? undefined) ?? '—';
  const statusLabel =
    daysLeft === null
      ? t('requests.responseDue.unknown')
      : daysLeft < 0
        ? t('requests.responseDue.overdue', { count: Math.abs(daysLeft) })
        : daysLeft === 0
          ? t('requests.responseDue.today')
          : daysLeft === 1
            ? t('requests.responseDue.oneDay')
            : t('requests.responseDue.daysLeft', { count: daysLeft });

  const control = (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', compact && 'gap-1.5')}>
      <Badge
        variant="outline"
        className={cn(
          'border-transparent font-medium',
          compact ? 'h-5 px-1.5 text-[10px] font-extrabold' : 'h-5 px-2 text-xs font-extrabold',
          RESPONSE_DUE_URGENCY_COLORS[urgency],
        )}
      >
        {statusLabel}
      </Badge>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          max={3650}
          value={draftDays}
          onChange={(event) => setDraftDays(event.target.value)}
          onBlur={() => commitDays(draftDays)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
          className={cn(
            'bg-background px-2 text-center text-xs shadow-none',
            compact ? 'h-7 w-14' : 'h-9 w-16',
          )}
          aria-label={t('requests.responseDue.daysAria')}
        />
        <span className={cn('text-muted-foreground', compact ? 'text-[10px]' : 'text-xs')}>
          {t('requests.responseDue.daysUnit')}
        </span>
      </div>
      {!compact ? (
        <span className="text-xs text-muted-foreground" title={dueLabel}>
          {dueLabel}
        </span>
      ) : null}
    </div>
  );

  if (hideInlineLabel) {
    return <div className="flex shrink-0 justify-end">{control}</div>;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="whitespace-nowrap text-sm font-medium text-foreground">
        {t('requests.responseDue.label')}
      </div>
      {control}
    </div>
  );
}
