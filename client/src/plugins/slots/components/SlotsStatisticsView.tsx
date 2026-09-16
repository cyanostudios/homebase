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

import { useSlotsContext as useSlots } from '../context/SlotsContext';
import { slotHasCategory, slotIsUpcoming, slotIsVisible } from '../utils/slotListFilter';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

export function SlotsStatisticsView() {
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
          <StatKpiTile
            label={t('slots.stats.total', { defaultValue: 'Total' })}
            value={stats.total}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('slots.stats.visible', { defaultValue: 'Visible' })}
            value={stats.visible}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('slots.stats.upcoming', { defaultValue: 'Upcoming' })}
            value={stats.upcoming}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('slots.stats.withCategory', { defaultValue: 'With category' })}
            value={stats.withCategory}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
        </div>
      </DetailSection>
    </div>
  );
}
