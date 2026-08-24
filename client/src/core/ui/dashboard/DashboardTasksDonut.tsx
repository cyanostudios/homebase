import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Task } from '@/plugins/tasks/types/tasks';

import { DONUT_CIRCUMFERENCE } from './dashboardUtils';

interface DashboardTasksDonutProps {
  tasks: Task[];
}

export function DashboardTasksDonut({ tasks }: DashboardTasksDonutProps) {
  const { t } = useTranslation();

  const { notStarted, inProgress, completed } = useMemo(() => {
    let notStartedCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    for (const task of tasks) {
      if (task.status === 'not started') {
        notStartedCount += 1;
      } else if (task.status === 'in progress') {
        inProgressCount += 1;
      } else if (task.status === 'completed') {
        completedCount += 1;
      }
    }
    return {
      notStarted: notStartedCount,
      inProgress: inProgressCount,
      completed: completedCount,
    };
  }, [tasks]);

  const total = tasks.length || 1;
  const circ = DONUT_CIRCUMFERENCE;
  const notStartedArc = (notStarted / total) * circ;
  const inProgressArc = (inProgress / total) * circ;
  const completedArc = (completed / total) * circ;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {t('dashboard.taskStatus')}
      </p>
      <div className="flex items-center gap-4">
        <svg
          viewBox="0 0 80 80"
          className="h-20 w-20 shrink-0"
          role="img"
          aria-label={t('dashboard.aria.taskStatusChart')}
        >
          <g transform="rotate(-90 40 40)">
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="8"
              strokeDasharray={`${circ}`}
            />
            {notStartedArc > 0 && (
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="8"
                strokeDasharray={`${notStartedArc} ${circ}`}
                strokeDashoffset="0"
              />
            )}
            {inProgressArc > 0 && (
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="8"
                strokeDasharray={`${inProgressArc} ${circ}`}
                strokeDashoffset={`${-notStartedArc}`}
              />
            )}
            {completedArc > 0 && (
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="#10b981"
                strokeWidth="8"
                strokeDasharray={`${completedArc} ${circ}`}
                strokeDashoffset={`${-(notStartedArc + inProgressArc)}`}
              />
            )}
          </g>
        </svg>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span>{t('dashboard.legend.notStarted', { count: notStarted })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span>{t('dashboard.legend.inProgress', { count: inProgress })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>{t('dashboard.legend.completed', { count: completed })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
