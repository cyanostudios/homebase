import { LayoutGrid } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';

import { useAIProviders } from '../hooks/useAIProviders';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

export function AIProvidersStatisticsView() {
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
          <StatKpiTile
            label={t('aiProviders.filterAll', { defaultValue: 'Total' })}
            value={stats.total}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('aiProviders.statusEnabled')}
            value={stats.enabled}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('aiProviders.statusDisabled')}
            value={stats.disabled}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('aiProviders.keyConfigured')}
            value={stats.configured}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
        </div>
      </DetailSection>
    </div>
  );
}
