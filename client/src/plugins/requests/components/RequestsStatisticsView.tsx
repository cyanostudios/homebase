import { LayoutGrid, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { StatDonutChart, StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';

import { useRequests } from '../hooks/useRequests';
import { isOpenRequestStatus } from '../types/requests';

const STATUS_CHART_COLORS = {
  active: '#60a5fa',
  completed: '#22c55e',
  cancelled: '#f87171',
  other: '#94a3b8',
} as const;

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

interface RequestsStatisticsViewProps {
  onClose?: () => void;
}

export function RequestsStatisticsView({ onClose }: RequestsStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const { requests } = useRequests();

  useMobileBarOverride(onClose ? { onClose } : null);

  const stats = useMemo(() => {
    const active = requests.filter((request) => isOpenRequestStatus(request.status)).length;
    const completed = requests.filter((request) => request.status === 'completed').length;
    const cancelled = requests.filter((request) => request.status === 'cancelled').length;
    const unlinked = requests.filter((request) => request.teamId == null).length;
    const external = requests.filter((request) => request.source === 'external').length;
    return {
      total: requests.length,
      active,
      completed,
      cancelled,
      unlinked,
      external,
    };
  }, [requests]);

  const statusSegments = useMemo(
    () =>
      [
        {
          key: 'active',
          label: t('requests.statActive'),
          value: stats.active,
          color: STATUS_CHART_COLORS.active,
        },
        {
          key: 'completed',
          label: t('requests.statCompleted'),
          value: stats.completed,
          color: STATUS_CHART_COLORS.completed,
        },
        {
          key: 'cancelled',
          label: t('requests.status.cancelled'),
          value: stats.cancelled,
          color: STATUS_CHART_COLORS.cancelled,
        },
      ].filter((segment) => segment.value > 0),
    [stats.active, stats.completed, stats.cancelled, t],
  );

  return (
    <div className="space-y-6">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
            {t('requests.statistics.title', { defaultValue: 'Request statistics' })}
          </h2>
        </div>
        {onClose ? (
          <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
            <RoundIconLabelButton
              type="button"
              icon={X}
              label={t('common.close')}
              variant="secondary"
              alwaysExpanded
              onClick={onClose}
            />
          </div>
        ) : null}
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {t('requests.statistics.description', {
          defaultValue: 'Overview of open, completed, unlinked, and external requests.',
        })}
      </p>

      <DetailSection
        title={t('requests.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          <StatKpiTile
            label={t('requests.filterAll')}
            value={stats.total}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('requests.statActive')}
            value={stats.active}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('requests.statCompleted')}
            value={stats.completed}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('requests.status.cancelled')}
            value={stats.cancelled}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('requests.statNotRelated')}
            value={stats.unlinked}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('requests.statExternal')}
            value={stats.external}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
        </div>
      </DetailSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatDonutChart
          title={t('requests.statistics.statusMix', { defaultValue: 'Status mix' })}
          ariaLabel={t('requests.statistics.statusMixAria', {
            defaultValue: 'Share of active, completed, and cancelled requests',
          })}
          segments={statusSegments}
        />
      </div>
    </div>
  );
}
