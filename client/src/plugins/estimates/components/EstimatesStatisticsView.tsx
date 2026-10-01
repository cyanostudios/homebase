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

import { useEstimates } from '../hooks/useEstimates';
import type { EstimateListFilterSelection } from '../utils/estimateListFilter';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

export type EstimatesStatisticsFilter = 'total' | 'draft' | 'sent' | 'accepted' | 'invoiced';

export function EstimatesStatisticsView({
  activeFilters = [],
  onSelectFilter,
}: {
  activeFilters?: EstimateListFilterSelection;
  onSelectFilter?: (filter: EstimatesStatisticsFilter) => void;
} = {}) {
  const { t } = useTranslation();
  const { estimates } = useEstimates();

  const stats = useMemo(
    () => ({
      total: estimates.length,
      draft: estimates.filter((estimate) => estimate.status === 'draft').length,
      sent: estimates.filter((estimate) => estimate.status === 'sent').length,
      accepted: estimates.filter((estimate) => estimate.status === 'accepted').length,
      invoiced: estimates.filter((estimate) => estimate.status === 'invoiced').length,
    }),
    [estimates],
  );

  const tile = (filter: EstimatesStatisticsFilter, label: string, value: number) => (
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
            {t('estimates.statistics.title', { defaultValue: 'Estimate statistics' })}
          </h2>
        </div>
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {t('estimates.statistics.description', {
          defaultValue: 'Overview of draft, sent, and accepted estimates.',
        })}
      </p>

      <DetailSection
        title={t('estimates.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
          {tile('total', t('estimates.statistics.total', { defaultValue: 'Total' }), stats.total)}
          {tile('draft', t('estimates.statistics.draft', { defaultValue: 'Draft' }), stats.draft)}
          {tile('sent', t('estimates.statistics.sent', { defaultValue: 'Sent' }), stats.sent)}
          {tile(
            'accepted',
            t('estimates.statistics.accepted', { defaultValue: 'Accepted' }),
            stats.accepted,
          )}
          {tile(
            'invoiced',
            t('estimates.statistics.invoiced', { defaultValue: 'Invoiced' }),
            stats.invoiced,
          )}
        </div>
      </DetailSection>
    </div>
  );
}
