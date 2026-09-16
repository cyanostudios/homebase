import { CheckCircle2, Circle, Clock, Inbox, XCircle, type LucideIcon } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import type { Request, RequestStatus } from '../types/requests';
import {
  REQUEST_PRIORITY_COLORS,
  REQUEST_STATUS_COLORS,
  REQUEST_STATUS_ICON_SHELL_CLASS,
  REQUEST_TYPE_ICON_SHELL_CLASS,
  RESPONSE_DUE_URGENCY_COLORS,
  formatRequestStatusForDisplay,
  getDaysUntilResponseDue,
  getResponseDueUrgency,
  getTypeLabel,
} from '../types/requests';

import { RequestDetailHeaderMenus } from './RequestDetailHeaderMenus';

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

export function RequestQuickContextPanel({
  request,
  headerBelow = null,
}: {
  request: Request;
  headerBelow?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const updatedLabel = request.updated_at
    ? new Date(request.updated_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const responseDueBadge = useMemo(() => {
    if (request.status === 'completed' || request.status === 'cancelled') {
      return null;
    }
    const daysLeft = getDaysUntilResponseDue(request.responseDueAt);
    if (daysLeft === null) {
      return null;
    }
    const urgency = getResponseDueUrgency(daysLeft);
    const className = RESPONSE_DUE_URGENCY_COLORS[urgency];
    if (daysLeft < 0) {
      return {
        text: t('requests.responseDue.overdue', { count: Math.abs(daysLeft) }),
        className,
      };
    }
    if (daysLeft === 0) {
      return { text: t('requests.responseDue.today'), className };
    }
    if (daysLeft === 1) {
      return { text: t('requests.responseDue.oneDay'), className };
    }
    return { text: t('requests.responseDue.daysLeft', { count: daysLeft }), className };
  }, [request.responseDueAt, request.status, t]);

  const statusLabel = formatRequestStatusForDisplay(request.status, t);
  const typeLabel = getTypeLabel(request.requestType, t);
  const StatusIcon = requestStatusIcon(request.status);

  const titleLeading = (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <span title={statusLabel} className="inline-flex shrink-0">
          <SectionCategoryIcon
            icon={StatusIcon}
            className={cn(
              'h-8 w-8 [&_svg]:h-4 [&_svg]:w-4',
              REQUEST_STATUS_ICON_SHELL_CLASS[request.status],
            )}
          />
        </span>
        <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
          {request.title || '—'}
        </h3>
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <span title={typeLabel} className="inline-flex shrink-0">
          <SectionCategoryIcon
            icon={Inbox}
            className={cn('h-5 w-5 [&_svg]:h-3 [&_svg]:w-3', REQUEST_TYPE_ICON_SHELL_CLASS)}
          />
        </span>
        <span className="min-w-0 truncate text-sm font-normal leading-tight text-slate-400 dark:text-slate-500">
          {typeLabel}
        </span>
      </div>
    </div>
  );

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
      <div className="px-4 py-5">
        <RequestDetailHeaderMenus request={request} leading={titleLeading} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {updatedLabel ? (
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              {t('common.updated')} {updatedLabel}
            </p>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Badge
              className={cn('shrink-0', BADGE_CHIP_CLASS, REQUEST_STATUS_COLORS[request.status])}
            >
              {formatRequestStatusForDisplay(request.status, t)}
            </Badge>
            <Badge
              variant="outline"
              className={cn(BADGE_CHIP_CLASS, REQUEST_PRIORITY_COLORS[request.priority])}
            >
              {request.priority}
            </Badge>
            {responseDueBadge ? (
              <Badge variant="outline" className={cn(BADGE_CHIP_CLASS, responseDueBadge.className)}>
                {responseDueBadge.text}
              </Badge>
            ) : null}
          </div>
        </div>
        {headerBelow ? <div className="mt-4">{headerBelow}</div> : null}
      </div>
    </Card>
  );
}
