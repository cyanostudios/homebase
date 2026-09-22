import { AlertCircle, Ban, CalendarClock, CheckCircle2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { DetailHeaderMetaDot } from '@/core/ui/DetailHeaderMenus';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import { cn } from '@/lib/utils';

import { isMatchStarted, type Match } from '../types/match';

export function matchHasStatusBadge(
  match: Pick<Match, 'is_canceled' | 'is_postponed' | 'is_finished' | 'start_time'>,
): boolean {
  if (match.is_canceled || match.is_postponed || match.is_finished) {
    return true;
  }
  return isMatchStarted(match) && !match.is_finished && !match.is_canceled && !match.is_postponed;
}

export function MatchStatusBadges({
  match,
  showEmptyPlaceholder = false,
  emptyPlaceholderClassName,
}: {
  match: Pick<Match, 'is_canceled' | 'is_postponed' | 'is_finished' | 'start_time'>;
  showEmptyPlaceholder?: boolean;
  emptyPlaceholderClassName?: string;
}) {
  const { t } = useTranslation();
  const datePassed =
    isMatchStarted(match) && !match.is_finished && !match.is_canceled && !match.is_postponed;

  const badges: React.ReactNode[] = [];

  if (match.is_canceled) {
    badges.push(
      <StatusOutlineBadge key="canceled" icon={Ban} className={QC_STATUS_BADGE_COLORS.danger}>
        {t('matches.statusCanceled')}
      </StatusOutlineBadge>,
    );
  }
  if (match.is_postponed) {
    badges.push(
      <StatusOutlineBadge
        key="postponed"
        icon={CalendarClock}
        className={QC_STATUS_BADGE_COLORS.warning}
      >
        {t('matches.statusPostponed')}
      </StatusOutlineBadge>,
    );
  }
  if (match.is_finished) {
    badges.push(
      <StatusOutlineBadge
        key="finished"
        icon={CheckCircle2}
        className={QC_STATUS_BADGE_COLORS.success}
      >
        {t('matches.statusFinished')}
      </StatusOutlineBadge>,
    );
  }
  if (datePassed) {
    badges.push(
      <StatusOutlineBadge
        key="date-passed"
        icon={AlertCircle}
        className={QC_STATUS_BADGE_COLORS.danger}
      >
        {t('matches.statusDatePassed')}
      </StatusOutlineBadge>,
    );
  }

  if (badges.length === 0) {
    if (showEmptyPlaceholder) {
      return <span className={cn(emptyPlaceholderClassName)}>—</span>;
    }
    return null;
  }

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
      {badges.map((badge, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <DetailHeaderMetaDot /> : null}
          {badge}
        </React.Fragment>
      ))}
    </span>
  );
}
