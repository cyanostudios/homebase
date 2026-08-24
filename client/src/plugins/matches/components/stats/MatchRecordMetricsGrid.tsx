import React from 'react';
import { useTranslation } from 'react-i18next';

import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';

import type { MatchRecordMetrics } from '../../types/matchStats';

const STAT_GRID = 'mt-3 grid grid-cols-1 gap-2 md:grid-cols-4 lg:grid-cols-5';

export function MatchRecordMetricsGrid({ metrics }: { metrics: MatchRecordMetrics }) {
  const { t } = useTranslation();

  return (
    <div className={STAT_GRID}>
      <ListFilterStatCard
        label={t('matches.statistics.played')}
        value={metrics.played}
        dotClassName="bg-slate-500"
      />
      <ListFilterStatCard
        label={t('matches.statistics.won')}
        value={metrics.won}
        dotClassName="bg-emerald-500"
      />
      <ListFilterStatCard
        label={t('matches.statistics.drawn')}
        value={metrics.drawn}
        dotClassName="bg-amber-500"
      />
      <ListFilterStatCard
        label={t('matches.statistics.lost')}
        value={metrics.lost}
        dotClassName="bg-rose-500"
      />
      <ListFilterStatCard
        label={t('matches.statistics.points')}
        value={metrics.points}
        dotClassName="bg-indigo-500"
      />
      <ListFilterStatCard
        label={t('matches.statistics.winPercent')}
        value={metrics.winPercent}
        dotClassName="bg-violet-500"
      />
      <ListFilterStatCard
        label={t('matches.statistics.goalsFor')}
        value={metrics.goalsFor}
        dotClassName="bg-blue-500"
      />
      <ListFilterStatCard
        label={t('matches.statistics.goalsAgainst')}
        value={metrics.goalsAgainst}
        dotClassName="bg-orange-500"
      />
      <ListFilterStatCard
        label={t('matches.statistics.goalDifference')}
        value={metrics.goalDifference}
        dotClassName="bg-teal-500"
      />
    </div>
  );
}
