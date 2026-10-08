import { LayoutGrid } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import { isStatKpiListFilterPressed } from '@/core/ui/statKpiListFilterLink';

import { usePulses } from '../hooks/usePulses';
import type { PulseProvidersListFilterSelection } from '../utils/pulseProvidersListFilter';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

export type PulseProvidersStatisticsFilter = 'total' | 'enabled' | 'disabled' | 'configured';

export function PulseProvidersStatisticsView({
  activeFilters = [],
  onSelectFilter,
}: {
  activeFilters?: PulseProvidersListFilterSelection;
  onSelectFilter?: (filter: PulseProvidersStatisticsFilter) => void;
} = {}) {
  const { t } = useTranslation();
  const { providers } = usePulses();

  const stats = useMemo(
    () => ({
      total: providers.length,
      enabled: providers.filter((provider) => provider.enabled).length,
      disabled: providers.filter((provider) => !provider.enabled).length,
      configured: providers.filter((provider) => provider.configured).length,
    }),
    [providers],
  );

  const tile = (filter: PulseProvidersStatisticsFilter, label: string, value: number) => (
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
          {t('pulses.statistics.title', { defaultValue: 'SMS provider statistics' })}
        </h2>
        <p className="mt-1 hidden text-sm text-muted-foreground md:block">
          {t('pulses.statistics.description', {
            defaultValue: 'Overview of enabled, disabled, and configured providers.',
          })}
        </p>
      </div>

      <DetailSection
        title={t('pulses.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
          {tile('total', t('pulses.total', { defaultValue: 'Total' }), stats.total)}
          {tile('enabled', t('pulses.statusEnabled', { defaultValue: 'Enabled' }), stats.enabled)}
          {tile(
            'disabled',
            t('pulses.statusDisabled', { defaultValue: 'Disabled' }),
            stats.disabled,
          )}
          {tile(
            'configured',
            t('pulses.keyConfigured', { defaultValue: 'Configured' }),
            stats.configured,
          )}
        </div>
      </DetailSection>
    </div>
  );
}
