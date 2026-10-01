import { LayoutGrid } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { isStatKpiListFilterPressed } from '@/core/ui/statKpiListFilterLink';

import { useSlotsContext as useSlots } from '../context/SlotsContext';
import {
  slotHasCategory,
  slotIsUpcoming,
  slotIsVisible,
  type SlotListFilterSelection,
} from '../utils/slotListFilter';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

export type SlotsStatisticsFilter = 'total' | 'visible' | 'upcoming' | 'withCategory';

export function SlotsStatisticsView({
  activeFilters = [],
  onSelectFilter,
}: {
  activeFilters?: SlotListFilterSelection;
  onSelectFilter?: (filter: SlotsStatisticsFilter) => void;
} = {}) {
  const { t } = useTranslation();
  const { slots } = useSlots();

  const stats = useMemo(
    () => ({
      total: slots.length,
      visible: slots.filter((s) => slotIsVisible(s)).length,
      upcoming: slots.filter((s) => slotIsUpcoming(s)).length,
      withCategory: slots.filter((s) => slotHasCategory(s)).length,
    }),
    [slots],
  );

  const tile = (filter: SlotsStatisticsFilter, label: string, value: number) => (
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

  return (
    <div className="space-y-6">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
            {t('slots.statistics.title', { defaultValue: 'Slots overview' })}
          </h2>
        </div>
      </div>
      <p className="hidden text-sm text-muted-foreground md:block">
        {t('slots.statistics.embeddedDescription', {
          defaultValue: 'Overview of slots by visibility, upcoming times, and category assignment.',
        })}
      </p>
      <DetailSection
        title={t('slots.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
          {tile('total', t('slots.stats.total', { defaultValue: 'Total' }), stats.total)}
          {tile('visible', t('slots.stats.visible', { defaultValue: 'Visible' }), stats.visible)}
          {tile(
            'upcoming',
            t('slots.stats.upcoming', { defaultValue: 'Upcoming' }),
            stats.upcoming,
          )}
          {tile(
            'withCategory',
            t('slots.stats.withCategory', { defaultValue: 'With category' }),
            stats.withCategory,
          )}
        </div>
      </DetailSection>
    </div>
  );
}
