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

import { useClubdesk } from '../hooks/useClubdesk';
import {
  isInventoryItemArchived,
  type InventoryListFilterSelection,
} from '../utils/inventoryListFilter';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

export type ClubdeskInventoryStatisticsFilter = 'total' | 'published' | 'draft' | 'archived';

export function ClubdeskInventoryStatisticsView({
  activeFilters = [],
  showArchivedOnly = false,
  onSelectFilter,
}: {
  activeFilters?: InventoryListFilterSelection;
  showArchivedOnly?: boolean;
  onSelectFilter?: (filter: ClubdeskInventoryStatisticsFilter) => void;
} = {}) {
  const { t } = useTranslation();
  const { inventoryItems } = useClubdesk();

  const stats = useMemo(() => {
    let total = 0;
    let published = 0;
    let draft = 0;
    let archived = 0;
    for (const item of inventoryItems) {
      if (isInventoryItemArchived(item)) {
        archived += 1;
        continue;
      }
      total += 1;
      if (item.publicationStatus === 'published') {
        published += 1;
      } else if (item.publicationStatus === 'draft') {
        draft += 1;
      }
    }
    return { total, published, draft, archived };
  }, [inventoryItems]);

  const activeKey: ClubdeskInventoryStatisticsFilter = showArchivedOnly
    ? 'archived'
    : activeFilters.includes('published')
      ? 'published'
      : activeFilters.includes('draft')
        ? 'draft'
        : 'total';

  const tile = (filter: ClubdeskInventoryStatisticsFilter, label: string, value: number) => (
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
            {t('clubdesk.inventory.statistics.title', { defaultValue: 'Inventory statistics' })}
          </h2>
        </div>
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {t('clubdesk.inventory.statistics.description', {
          defaultValue: 'Overview of active, published, draft, and archived products.',
        })}
      </p>

      <DetailSection
        title={t('clubdesk.inventory.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
          {tile(
            'total',
            t('clubdesk.inventory.statistics.total', { defaultValue: 'Active products' }),
            stats.total,
          )}
          {tile(
            'published',
            t('clubdesk.inventory.statistics.published', { defaultValue: 'Published' }),
            stats.published,
          )}
          {tile(
            'draft',
            t('clubdesk.inventory.statistics.draft', { defaultValue: 'Draft' }),
            stats.draft,
          )}
          {tile(
            'archived',
            t('clubdesk.inventory.statistics.archived', { defaultValue: 'Archived' }),
            stats.archived,
          )}
        </div>
      </DetailSection>
    </div>
  );
}
