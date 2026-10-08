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
import { isInventoryItemArchived } from '../utils/garmentListFilter';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

/** Garments catalog archive only (no Clubdesk publish/draft fields) — Active + Archived KPIs. */
export type GarmentsInventoryStatisticsFilter = 'total' | 'archived';

export function GarmentsInventoryStatisticsView({
  showArchivedOnly = false,
  tagFilterActive = false,
  onSelectFilter,
}: {
  showArchivedOnly?: boolean;
  /** When a tag chip is active, neither Active nor Archived is pressed. */
  tagFilterActive?: boolean;
  onSelectFilter?: (filter: GarmentsInventoryStatisticsFilter) => void;
} = {}) {
  const { t } = useTranslation();
  const { inventoryItems } = useGarments();

  const stats = useMemo(() => {
    let total = 0;
    let archived = 0;
    for (const item of inventoryItems) {
      if (isInventoryItemArchived(item)) {
        archived += 1;
        continue;
      }
      total += 1;
    }
    return { total, archived };
  }, [inventoryItems]);

  const activeKey: GarmentsInventoryStatisticsFilter | null = showArchivedOnly
    ? 'archived'
    : tagFilterActive
      ? null
      : 'total';

  const tile = (filter: GarmentsInventoryStatisticsFilter, label: string, value: number) => (
    <StatKpiTile
      label={label}
      value={value}
      className={STAT_KPI_SOFT_CLASS}
      labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
      valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
      pressed={activeKey === filter}
      onClick={onSelectFilter ? () => onSelectFilter(filter) : undefined}
    />
  );

  return (
    <div className="space-y-6">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
            {t('garments.inventoryStatistics.title', { defaultValue: 'Inventory statistics' })}
          </h2>
        </div>
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {t('garments.inventoryStatistics.description', {
          defaultValue: 'Overview of active and archived products.',
        })}
      </p>

      <DetailSection
        title={t('garments.inventoryStatistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
          {tile(
            'total',
            t('garments.inventoryStatistics.total', { defaultValue: 'Active products' }),
            stats.total,
          )}
          {tile(
            'archived',
            t('garments.inventoryStatistics.archived', { defaultValue: 'Archived' }),
            stats.archived,
          )}
        </div>
      </DetailSection>
    </div>
  );
}
