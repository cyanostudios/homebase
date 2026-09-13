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

import { useTasks } from '../hooks/useTasks';
import { taskIsOpen, taskIsOverdue } from '../utils/taskListFilter';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

const WORKLOAD_CHART_COLORS = {
  open: '#60a5fa',
  completed: '#22c55e',
  overdue: '#f43f5e',
} as const;

interface TasksStatisticsViewProps {
  onClose?: () => void;
}

export function TasksStatisticsView({ onClose }: TasksStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const { tasks } = useTasks();

  useMobileBarOverride(onClose ? { onClose } : null);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: tasks.length,
      open: tasks.filter((task) => taskIsOpen(task)).length,
      completed: tasks.filter((task) => task.status === 'completed').length,
      overdue: tasks.filter((task) => taskIsOverdue(task, now)).length,
    };
  }, [tasks]);

  const workloadSegments = useMemo(
    () =>
      [
        {
          key: 'open',
          label: t('tasks.filter.open'),
          value: stats.open,
          color: WORKLOAD_CHART_COLORS.open,
        },
        {
          key: 'completed',
          label: t('tasks.filter.completed'),
          value: stats.completed,
          color: WORKLOAD_CHART_COLORS.completed,
        },
        {
          key: 'overdue',
          label: t('tasks.filter.overdue'),
          value: stats.overdue,
          color: WORKLOAD_CHART_COLORS.overdue,
        },
      ].filter((segment) => segment.value > 0),
    [stats.completed, stats.open, stats.overdue, t],
  );

  return (
    <div className="space-y-6">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
            {t('tasks.statistics.title', { defaultValue: 'Task statistics' })}
          </h2>
        </div>
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {t('tasks.statistics.description', {
          defaultValue: 'Overview of open, completed, and overdue tasks.',
        })}
      </p>

      <DetailSection
        title={t('tasks.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatKpiTile
            label={t('tasks.filter.total')}
            value={stats.total}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('tasks.filter.open')}
            value={stats.open}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('tasks.filter.completed')}
            value={stats.completed}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('tasks.filter.overdue')}
            value={stats.overdue}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
        </div>
      </DetailSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatDonutChart
          title={t('tasks.statistics.workloadMix', { defaultValue: 'Open vs completed' })}
          ariaLabel={t('tasks.statistics.workloadMixAria', {
            defaultValue: 'Share of open, completed, and overdue tasks',
          })}
          segments={workloadSegments}
        />
      </div>
    </div>
  );
}
