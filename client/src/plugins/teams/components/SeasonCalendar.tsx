import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { SeasonBreak, SeasonBreakTiming } from '../types/teams';
import { getSeasonBreakTiming, parseDateOnly, SEASON_BREAK_TIMING_STYLES } from '../types/teams';

const TIMING_SORT_ORDER: Record<SeasonBreakTiming, number> = {
  past: 0,
  ongoing: 1,
  upcoming: 2,
};

function sortSeasonBreaks(breaks: SeasonBreak[]): SeasonBreak[] {
  return [...breaks].sort((a, b) => {
    const timingA = getSeasonBreakTiming(a.startDate, a.endDate);
    const timingB = getSeasonBreakTiming(b.startDate, b.endDate);
    const orderDiff = TIMING_SORT_ORDER[timingA] - TIMING_SORT_ORDER[timingB];
    if (orderDiff !== 0) {
      return orderDiff;
    }
    const startA = parseDateOnly(a.startDate)?.getTime() ?? 0;
    const startB = parseDateOnly(b.startDate)?.getTime() ?? 0;
    if (timingA === 'past') {
      return startB - startA;
    }
    return startA - startB;
  });
}

function daysBetween(startDate: string, endDate: string): number | null {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

export function SeasonCalendar({ seasonBreaks }: { seasonBreaks: SeasonBreak[] }) {
  const { t } = useTranslation();

  if (!seasonBreaks.length) {
    return <p className="text-sm text-muted-foreground">{t('teams.view.noBreaks')}</p>;
  }

  const sortedBreaks = sortSeasonBreaks(seasonBreaks);

  return (
    <div className="space-y-2">
      {sortedBreaks.map((seasonBreak, index) => {
        const days = daysBetween(seasonBreak.startDate, seasonBreak.endDate);
        const timing = getSeasonBreakTiming(seasonBreak.startDate, seasonBreak.endDate);
        return (
          <div
            key={`${seasonBreak.name}-${index}`}
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg border px-3 py-2',
              SEASON_BREAK_TIMING_STYLES[timing],
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {seasonBreak.name || t('teams.view.unnamedBreak')}
              </p>
              <p className="text-xs opacity-80">
                {seasonBreak.startDate} – {seasonBreak.endDate}
              </p>
            </div>
            {days !== null && (
              <span className="flex-shrink-0 text-xs font-medium">
                {t('teams.view.breakDays', { count: days })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
