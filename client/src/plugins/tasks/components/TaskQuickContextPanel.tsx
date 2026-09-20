import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Minus,
  XCircle,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DetailHeaderMetaRow } from '@/core/ui/DetailHeaderMenus';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import { cn } from '@/lib/utils';

import type { Task } from '../types/tasks';
import {
  TASK_PRIORITY_COLORS,
  TASK_STATUS_COLORS,
  formatStatusForDisplay,
  formatTaskDueDisplay,
} from '../types/tasks';

import { TaskDetailHeaderMenus } from './TaskDetailHeaderMenus';

function taskStatusIcon(status: string) {
  switch (status) {
    case 'in progress':
      return Clock;
    case 'completed':
      return CheckCircle2;
    case 'cancelled':
      return XCircle;
    default:
      return Circle;
  }
}

function taskPriorityIcon(priority: string) {
  switch (priority) {
    case 'High':
      return ArrowUp;
    case 'Low':
      return ArrowDown;
    default:
      return Minus;
  }
}

function taskStatusIconShellClass(status: string): string {
  switch (status) {
    case 'in progress':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
    case 'completed':
      return 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300';
    case 'cancelled':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300';
  }
}

export function TaskQuickContextPanel({
  task,
  headerBelow = null,
}: {
  task: Task;
  headerBelow?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const dueBadge = useMemo(() => {
    const display = formatTaskDueDisplay(task.dueDate, task.status);
    if (!display) {
      return null;
    }
    return {
      text: display.text,
      className: display.badgeClassName,
      urgency: display.urgency,
    };
  }, [task.dueDate, task.status]);

  const updatedLabel = task.updatedAt
    ? new Date(task.updatedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const statusLabel = formatStatusForDisplay(task.status);
  const StatusIcon = taskStatusIcon(task.status);
  const PriorityIcon = taskPriorityIcon(task.priority);
  const DueIcon =
    dueBadge?.urgency === 'overdue' || dueBadge?.urgency === 'today' ? AlertCircle : Calendar;

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={statusLabel} className="inline-flex shrink-0">
        <SectionCategoryIcon icon={StatusIcon} className={taskStatusIconShellClass(task.status)} />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {task.title || '—'}
      </h3>
    </div>
  );

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
      <div className="px-4 py-5">
        <TaskDetailHeaderMenus task={task} leading={titleLeading} />
        <DetailHeaderMetaRow>
          {updatedLabel ? (
            <p className="min-w-0 text-xs text-muted-foreground">
              {t('common.updated')} {updatedLabel}
            </p>
          ) : null}
          <StatusOutlineBadge
            icon={StatusIcon}
            className={
              TASK_STATUS_COLORS[task.status as keyof typeof TASK_STATUS_COLORS] ??
              TASK_STATUS_COLORS['not started']
            }
          >
            {formatStatusForDisplay(task.status)}
          </StatusOutlineBadge>
          <StatusOutlineBadge icon={PriorityIcon} className={TASK_PRIORITY_COLORS[task.priority]}>
            {task.priority}
          </StatusOutlineBadge>
          {dueBadge ? (
            <StatusOutlineBadge icon={DueIcon} className={dueBadge.className}>
              {dueBadge.text}
            </StatusOutlineBadge>
          ) : null}
        </DetailHeaderMetaRow>
        {headerBelow ? <div className="mt-4">{headerBelow}</div> : null}
      </div>
    </Card>
  );
}
