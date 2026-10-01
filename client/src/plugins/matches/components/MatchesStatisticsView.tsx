import { LayoutGrid } from 'lucide-react';
import { X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { isStatKpiListFilterPressed } from '@/core/ui/statKpiListFilterLink';
import { cn } from '@/lib/utils';

import { useMatches } from '../hooks/useMatches';
import { matchMatchesListFilter, type MatchListFilterSelection } from '../utils/matchListFilter';

import { MatchSeriesStats } from './stats/MatchSeriesStats';
import { MatchStats } from './stats/MatchStats';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

export type MatchesStatisticsFilter = 'total' | 'upcoming' | 'upcoming7' | 'upcoming14';

interface MatchesStatisticsViewProps {
  onClose?: () => void;
  activeFilters?: MatchListFilterSelection;
  onSelectFilter?: (filter: MatchesStatisticsFilter) => void;
}

type StatsTab = 'results' | 'series';

export function MatchesStatisticsView({
  onClose,
  activeFilters = [],
  onSelectFilter,
}: MatchesStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const { matches } = useMatches();
  const [tab, setTab] = useState<StatsTab>('results');
  const isEmbedded = onClose == null;

  useMobileBarOverride(onClose ? { onClose } : null);

  const stats = useMemo(() => {
    const nowMs = Date.now();
    return {
      total: matches.length,
      upcoming: matches.filter((m) => matchMatchesListFilter(m, 'upcoming', nowMs)).length,
      upcoming7: matches.filter((m) => matchMatchesListFilter(m, 'upcoming7', nowMs)).length,
      upcoming14: matches.filter((m) => matchMatchesListFilter(m, 'upcoming14', nowMs)).length,
    };
  }, [matches]);

  const tile = (filter: MatchesStatisticsFilter, label: string, value: number) => (
    <StatKpiTile
      label={label}
      value={value}
      className={STAT_KPI_SOFT_CLASS}
      labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
      valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
      pressed={isStatKpiListFilterPressed(activeFilters, filter)}
      onClick={onSelectFilter ? () => onSelectFilter(filter) : undefined}
    />
  );

  const overviewSection = (
    <DetailSection
      title={t('matches.statistics.overview', { defaultValue: 'Overview' })}
      icon={LayoutGrid}
      subtleTitle
    >
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
        {tile('total', t('matches.filterAll'), stats.total)}
        {tile('upcoming', t('matches.filterUpcoming'), stats.upcoming)}
        {tile('upcoming7', t('matches.filterUpcoming7'), stats.upcoming7)}
        {tile('upcoming14', t('matches.filterUpcoming14'), stats.upcoming14)}
      </div>
    </DetailSection>
  );

  if (isEmbedded) {
    return (
      <div className="space-y-6">
        <div className={PLUGIN_PAGE_HEADER_CLASS}>
          <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
            <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('matches.statistics.title')}</h2>
          </div>
        </div>
        <p className="hidden text-sm text-muted-foreground md:block">
          {t('matches.statistics.embeddedDescription', {
            defaultValue: 'Overview of upcoming fixtures and schedule.',
          })}
        </p>
        {overviewSection}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden flex-shrink-0 items-center justify-between md:flex">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('matches.statistics.title')}
          </h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={X}
            className="h-9 px-3 text-xs"
            onClick={onClose}
          >
            {t('common.close')}
          </Button>
        </div>
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {tab === 'series' ? t('matches.series.description') : t('matches.statistics.description')}
      </p>

      <div className={LIST_FILTER_CHIP_ROW_CLASS}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setTab('results')}
          className={cn(tab === 'results' ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
        >
          {t('matches.series.tabResults')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setTab('series')}
          className={cn(tab === 'series' ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
        >
          {t('matches.series.tabSeries')}
        </Button>
      </div>

      {tab === 'series' ? <MatchSeriesStats /> : <MatchStats />}
    </div>
  );
}
