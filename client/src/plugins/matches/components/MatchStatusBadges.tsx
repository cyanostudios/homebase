import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { Match } from '../types/match';

export function MatchStatusBadges({
  match,
  showEmptyPlaceholder = false,
  emptyPlaceholderClassName,
}: {
  match: Pick<Match, 'is_canceled' | 'is_postponed' | 'is_finished'>;
  showEmptyPlaceholder?: boolean;
  emptyPlaceholderClassName?: string;
}) {
  const { t } = useTranslation();
  const hasStatus = match.is_canceled || match.is_postponed || match.is_finished;

  return (
    <div className="flex flex-wrap gap-1.5">
      {match.is_canceled ? (
        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {t('matches.statusCanceled')}
        </span>
      ) : null}
      {match.is_postponed ? (
        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          {t('matches.statusPostponed')}
        </span>
      ) : null}
      {match.is_finished ? (
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          {t('matches.statusFinished')}
        </span>
      ) : null}
      {showEmptyPlaceholder && !hasStatus ? (
        <span className={cn(emptyPlaceholderClassName)}>—</span>
      ) : null}
    </div>
  );
}
