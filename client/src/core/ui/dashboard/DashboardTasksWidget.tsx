import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TASK_STATUS_COLORS, formatStatusForDisplay } from '@/plugins/tasks/types/tasks';

import type { DashboardDataProps } from './dashboardTypes';
import { selectActiveTasksForDashboard } from './dashboardUtils';

export function DashboardTasksWidget({ has, tasks }: DashboardDataProps) {
  const { t } = useTranslation();

  const visible = selectActiveTasksForDashboard(tasks);

  if (!has('tasks')) {
    return null;
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {t('dashboard.openTasks')}
      </p>
      {visible.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">{t('dashboard.noOpenTasks')}</p>
      ) : (
        <div className="space-y-1">
          {visible.map((task) => (
            <div
              key={task.id}
              className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/40"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn('h-5 shrink-0 px-1.5 text-[10px]', TASK_STATUS_COLORS[task.status])}
                >
                  {formatStatusForDisplay(task.status)}
                </Badge>
                <span className="min-w-0 truncate font-medium text-foreground">{task.title}</span>
              </div>
              {task.priority && (
                <span className="shrink-0 text-muted-foreground">{task.priority}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
