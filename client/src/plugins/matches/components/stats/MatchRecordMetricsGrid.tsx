import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { StatCompactPanel } from '@/core/ui/charts/StatCharts';

import type { MatchRecordMetrics } from '../../types/matchStats';

export function MatchRecordMetricsGrid({
  metrics,
  title,
}: {
  metrics: MatchRecordMetrics;
  /** Card title (e.g. Total / Home / Away) — dashboard invoices pattern. */
  title?: string;
}) {
  const { t } = useTranslation();

  const resultSegments = useMemo(
    () => [
      {
        key: 'won',
        label: t('matches.statistics.won'),
        value: metrics.won,
        color: '#10b981',
      },
      {
        key: 'drawn',
        label: t('matches.statistics.drawn'),
        value: metrics.drawn,
        color: '#f59e0b',
      },
      {
        key: 'lost',
        label: t('matches.statistics.lost'),
        value: metrics.lost,
        color: '#f43f5e',
      },
    ],
    [metrics.drawn, metrics.lost, metrics.won, t],
  );

  const kpis = useMemo(
    () => [
      { key: 'played', label: t('matches.statistics.played'), value: metrics.played },
      { key: 'points', label: t('matches.statistics.points'), value: metrics.points },
      { key: 'winPercent', label: t('matches.statistics.winPercent'), value: metrics.winPercent },
      {
        key: 'goalDifference',
        label: t('matches.statistics.goalDifference'),
        value: metrics.goalDifference,
      },
      { key: 'goalsFor', label: t('matches.statistics.goalsFor'), value: metrics.goalsFor },
      {
        key: 'goalsAgainst',
        label: t('matches.statistics.goalsAgainst'),
        value: metrics.goalsAgainst,
      },
    ],
    [
      metrics.goalDifference,
      metrics.goalsAgainst,
      metrics.goalsFor,
      metrics.played,
      metrics.points,
      metrics.winPercent,
      t,
    ],
  );

  return (
    <StatCompactPanel
      title={title}
      segments={resultSegments}
      kpis={kpis}
      className="bg-muted/40 shadow-none dark:bg-slate-900/40"
    />
  );
}
