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

import { useGarments } from '../hooks/useGarments';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

export function GarmentsStatisticsView() {
  const { t } = useTranslation();
  const { garmentLists, inventoryItems } = useGarments();

  const stats = useMemo(
    () => ({
      listCount: garmentLists.length,
      inventoryCount: inventoryItems.length,
      assignedInventory: inventoryItems.filter((item) => (item.assignedListIds?.length ?? 0) > 0)
        .length,
      totalPersons: garmentLists.reduce(
        (sum, list) => sum + (list.personCount ?? list.persons?.length ?? 0),
        0,
      ),
    }),
    [garmentLists, inventoryItems],
  );

  return (
    <div className="space-y-6">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
            {t('garments.statistics.title', { defaultValue: 'Garment statistics' })}
          </h2>
        </div>
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {t('garments.statistics.description', {
          defaultValue: 'Overview of lists, inventory, and assignments.',
        })}
      </p>

      <DetailSection
        title={t('garments.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
          <StatKpiTile
            label={t('garments.statistics.listCount', { defaultValue: 'Lists' })}
            value={stats.listCount}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('garments.statistics.inventoryCount', { defaultValue: 'Inventory items' })}
            value={stats.inventoryCount}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('garments.statistics.assignedInventory', {
              defaultValue: 'Assigned to lists',
            })}
            value={stats.assignedInventory}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('garments.statistics.totalPersons', { defaultValue: 'Total persons' })}
            value={stats.totalPersons}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
        </div>
      </DetailSection>
    </div>
  );
}
