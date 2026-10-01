import { LayoutGrid } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import { isStatKpiListFilterPressed } from '@/core/ui/statKpiListFilterLink';

import { useAIProviders } from '../hooks/useAIProviders';
import type { AIProvidersListFilterSelection } from '../utils/aiProvidersListFilter';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

export type AIProvidersStatisticsFilter = 'total' | 'enabled' | 'disabled' | 'configured';

export function AIProvidersStatisticsView({
  activeFilters = [],
  onSelectFilter,
}: {
  activeFilters?: AIProvidersListFilterSelection;
  onSelectFilter?: (filter: AIProvidersStatisticsFilter) => void;
} = {}) {
  const { t } = useTranslation();
  const { providers } = useAIProviders();

  const stats = useMemo(
    () => ({
      total: providers.length,
      enabled: providers.filter((provider) => provider.enabled).length,
      disabled: providers.filter((provider) => !provider.enabled).length,
      configured: providers.filter((provider) => provider.hasApiKey).length,
    }),
    [providers],
  );

  const tile = (filter: AIProvidersStatisticsFilter, label: string, value: number) => (
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
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-foreground">
          {t('aiProviders.statistics.title', { defaultValue: 'AI provider statistics' })}
        </h2>
        <p className="mt-1 hidden text-sm text-muted-foreground md:block">
          {t('aiProviders.statistics.description', {
            defaultValue: 'Overview of enabled, disabled, and configured providers.',
          })}
        </p>
      </div>

      <DetailSection
        title={t('aiProviders.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
          {tile('total', t('aiProviders.filterAll', { defaultValue: 'Total' }), stats.total)}
          {tile('enabled', t('aiProviders.statusEnabled'), stats.enabled)}
          {tile('disabled', t('aiProviders.statusDisabled'), stats.disabled)}
          {tile('configured', t('aiProviders.keyConfigured'), stats.configured)}
        </div>
      </DetailSection>
    </div>
  );
}
