import { LayoutGrid } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { StatDonutChart, StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';

import { useIngest } from '../hooks/useIngest';

const ACTIVE_CHART_COLORS = {
  active: '#22c55e',
  inactive: '#94a3b8',
} as const;

const TYPE_CHART_COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#64748b', '#94a3b8'] as const;

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

interface IngestStatisticsViewProps {
  onClose?: () => void;
}

export function IngestStatisticsView({ onClose }: IngestStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const { ingest } = useIngest();

  useMobileBarOverride(onClose ? { onClose } : null);

  const stats = useMemo(() => {
    const byType = new Map<string, number>();
    for (const source of ingest) {
      const type = source.sourceType || 'other';
      byType.set(type, (byType.get(type) ?? 0) + 1);
    }
    return {
      total: ingest.length,
      active: ingest.filter((s) => Boolean(s.isActive)).length,
      inactive: ingest.filter((s) => !s.isActive).length,
      byType,
    };
  }, [ingest]);

  const activeSegments = useMemo(
    () =>
      [
        {
          key: 'active',
          label: t('ingest.active'),
          value: stats.active,
          color: ACTIVE_CHART_COLORS.active,
        },
        {
          key: 'inactive',
          label: t('ingest.inactive'),
          value: stats.inactive,
          color: ACTIVE_CHART_COLORS.inactive,
        },
      ].filter((segment) => segment.value > 0),
    [stats.active, stats.inactive, t],
  );

  const typeSegments = useMemo(
    () =>
      Array.from(stats.byType.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([type, count], index) => ({
          key: type,
          label: type,
          value: count,
          color: TYPE_CHART_COLORS[index % TYPE_CHART_COLORS.length],
        }))
        .filter((segment) => segment.value > 0),
    [stats.byType],
  );

  return (
    <div className="space-y-6">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
            {t('ingest.statistics.title', { defaultValue: 'Ingest statistics' })}
          </h2>
        </div>
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {t('ingest.statistics.description', {
          defaultValue: 'Overview of sources, active status, and content types.',
        })}
      </p>

      <DetailSection
        title={t('ingest.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
          <StatKpiTile
            label={t('ingest.stats.total', { defaultValue: 'Total' })}
            value={stats.total}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('ingest.active')}
            value={stats.active}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('ingest.inactive')}
            value={stats.inactive}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('ingest.statistics.types', { defaultValue: 'Source types' })}
            value={stats.byType.size}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
        </div>
      </DetailSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatDonutChart
          title={t('ingest.statistics.activeMix', { defaultValue: 'Active vs inactive' })}
          ariaLabel={t('ingest.statistics.activeMixAria', {
            defaultValue: 'Share of active and inactive ingest sources',
          })}
          segments={activeSegments}
        />
        <StatDonutChart
          title={t('ingest.statistics.typeMix', { defaultValue: 'Sources by type' })}
          ariaLabel={t('ingest.statistics.typeMixAria', {
            defaultValue: 'Distribution of ingest sources by content type',
          })}
          segments={typeSegments}
        />
      </div>
    </div>
  );
}
