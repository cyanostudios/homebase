import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SortableListTable } from '@/core/ui/SortableListTable';
import { cn } from '@/lib/utils';

import type { Task } from '../types/tasks';
import { TASK_PRIORITY_COLORS, TASK_STATUS_COLORS, formatStatusForDisplay } from '../types/tasks';
import type { TaskSortField, TaskSortOrder } from '../utils/taskListSort';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

export type TaskListTableProps = {
  tasks: Task[];
  primarySort: TaskSortField;
  sortOrder: TaskSortOrder;
  onSort: (field: TaskSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (task: Task) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  recentlyDuplicatedTaskId: string | null;
  /** When false, the selection checkbox column is hidden (e.g. quick context open). */
  selectionEnabled?: boolean;
  activeTaskId?: string | number | null;
};

export function TaskListTable({
  tasks,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  recentlyDuplicatedTaskId,
  selectionEnabled = true,
  activeTaskId = null,
}: TaskListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      {
        field: 'title' as const,
        header: t('tasks.title'),
        cell: (task: Task) => (
          <span className="font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary">
            {task.title}
          </span>
        ),
      },
      {
        field: 'status' as const,
        header: t('tasks.propertyStatus'),
        cell: (task: Task) => (
          <Badge
            className={cn(
              BADGE_CLASS,
              TASK_STATUS_COLORS[task.status as keyof typeof TASK_STATUS_COLORS],
            )}
          >
            {formatStatusForDisplay(task.status)}
          </Badge>
        ),
      },
      {
        field: 'priority' as const,
        header: t('tasks.propertyPriority'),
        cell: (task: Task) => (
          <Badge className={cn(BADGE_CLASS, TASK_PRIORITY_COLORS[task.priority])}>
            {task.priority}
          </Badge>
        ),
      },
      {
        field: 'dueDate' as const,
        header: t('tasks.propertyDueDate'),
        className: 'hidden sm:table-cell',
        cell: (task: Task) => (
          <span className="text-xs text-muted-foreground">
            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <SortableListTable
      rows={tasks}
      columns={columns}
      getRowId={(task) => String(task.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(task) => task.title}
      rowClassName={(task) =>
        recentlyDuplicatedTaskId === String(task.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      isRowActive={(task) => activeTaskId != null && String(task.id) === String(activeTaskId)}
      selection={
        selectionEnabled
          ? {
              isSelected,
              onCheckboxMouseDown,
              onCheckboxChange,
              allVisibleSelected,
              onHeaderCheckboxChange,
              selectAllAriaLabel: t('common.selectAllVisible'),
              selectRowAriaLabel: (selected) =>
                selected ? t('common.unselectRow') : t('common.selectRow'),
            }
          : undefined
      }
      pluginName="tasks"
      dataListItem={(task) => task}
    />
  );
}
