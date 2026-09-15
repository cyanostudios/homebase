import { LayoutGrid } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';

import { useMail } from '../hooks/useMail';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

export function MailProvidersStatisticsView() {
  const { t } = useTranslation();
  const { providers } = useMail();

  const stats = useMemo(
    () => ({
      total: providers.length,
      enabled: providers.filter((provider) => provider.enabled).length,
      disabled: providers.filter((provider) => !provider.enabled).length,
      configured: providers.filter((provider) => provider.configured).length,
    }),
    [providers],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-foreground">
          {t('mail.statistics.title', { defaultValue: 'Email provider statistics' })}
        </h2>
        <p className="mt-1 hidden text-sm text-muted-foreground md:block">
          {t('mail.statistics.description', {
            defaultValue: 'Overview of enabled, disabled, and configured providers.',
          })}
        </p>
      </div>

      <DetailSection
        title={t('mail.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
          <StatKpiTile
            label={t('mail.total', { defaultValue: 'Total' })}
            value={stats.total}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('mail.statusEnabled', { defaultValue: 'Enabled' })}
            value={stats.enabled}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('mail.statusDisabled', { defaultValue: 'Disabled' })}
            value={stats.disabled}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('mail.keyConfigured', { defaultValue: 'Configured' })}
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
