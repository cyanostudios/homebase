import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Inbox,
  Minus,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DetailHeaderMetaRow } from '@/core/ui/DetailHeaderMenus';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
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

function requestPriorityIcon(priority: string): LucideIcon {
  switch (priority) {
    case 'High':
      return ArrowUp;
    case 'Low':
      return ArrowDown;
    default:
      return Minus;
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
        urgency,
      };
    }
    if (daysLeft === 0) {
      return { text: t('requests.responseDue.today'), className, urgency };
    }
    if (daysLeft === 1) {
      return { text: t('requests.responseDue.oneDay'), className, urgency };
    }
    return { text: t('requests.responseDue.daysLeft', { count: daysLeft }), className, urgency };
  }, [request.responseDueAt, request.status, t]);

  const statusLabel = formatRequestStatusForDisplay(request.status, t);
  const typeLabel = getTypeLabel(request.requestType, t);
  const StatusIcon = requestStatusIcon(request.status);
  const PriorityIcon = requestPriorityIcon(request.priority);
  const DueIcon = responseDueBadge?.urgency === 'red' ? AlertCircle : Calendar;

  const titleLeading = (
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
  );

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
      <div className="px-4 py-5">
        <RequestDetailHeaderMenus request={request} leading={titleLeading} />
        <DetailHeaderMetaRow>
          <div className="flex min-w-0 items-center gap-1.5">
            <span title={typeLabel} className="inline-flex shrink-0">
              <SectionCategoryIcon
                icon={Inbox}
                className={cn('h-5 w-5 [&_svg]:h-3 [&_svg]:w-3', REQUEST_TYPE_ICON_SHELL_CLASS)}
              />
            </span>
            <span className="min-w-0 truncate text-xs text-muted-foreground">{typeLabel}</span>
          </div>
          {updatedLabel ? (
            <p className="min-w-0 text-xs text-muted-foreground">
              {t('common.updated')} {updatedLabel}
            </p>
          ) : null}
          <StatusOutlineBadge icon={StatusIcon} className={REQUEST_STATUS_COLORS[request.status]}>
            {formatRequestStatusForDisplay(request.status, t)}
          </StatusOutlineBadge>
          <StatusOutlineBadge
            icon={PriorityIcon}
            className={REQUEST_PRIORITY_COLORS[request.priority]}
          >
            {request.priority}
          </StatusOutlineBadge>
          {responseDueBadge ? (
            <StatusOutlineBadge icon={DueIcon} className={responseDueBadge.className}>
              {responseDueBadge.text}
            </StatusOutlineBadge>
          ) : null}
        </DetailHeaderMetaRow>
        {headerBelow ? <div className="mt-4">{headerBelow}</div> : null}
      </div>
    </Card>
  );
}
