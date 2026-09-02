import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import type { Task } from '../types/tasks';
import { TASK_PRIORITY_COLORS, TASK_STATUS_COLORS, formatStatusForDisplay } from '../types/tasks';
import type { TaskSortField, TaskSortOrder } from '../utils/taskListSort';
import {
  DEFAULT_TASK_TABLE_COLUMNS,
  type TaskTableColumnId,
  resolveVisibleTaskTableColumns,
} from '../utils/taskTableColumns';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

/** SortableListTable field union — assignee/team are display-only (not sortable). */
type TaskTableField = TaskSortField | 'assignedTo' | 'assignedTeam';

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
  visibleColumnIds?: TaskTableColumnId[];
  getAssignedNames: (task: Task) => string[];
  getAssignedTeamName: (task: Task) => string | null;
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
  visibleColumnIds,
  getAssignedNames,
  getAssignedTeamName,
}: TaskListTableProps) {
  const { t } = useTranslation();

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleTaskTableColumns({ tableColumns: DEFAULT_TASK_TABLE_COLUMNS });
  }, [visibleColumnIds]);

  const columnDefs = useMemo(() => {
    const defs: Record<TaskTableColumnId, SortableListTableColumn<Task, TaskTableField>> = {
      title: {
        field: 'title',
        header: t('tasks.title'),
        cell: (task: Task) => (
          <span className="font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary">
            {task.title}
          </span>
        ),
      },
      status: {
        field: 'status',
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
      priority: {
        field: 'priority',
        header: t('tasks.propertyPriority'),
        cell: (task: Task) => (
          <Badge className={cn(BADGE_CLASS, TASK_PRIORITY_COLORS[task.priority])}>
            {task.priority}
          </Badge>
        ),
      },
      dueDate: {
        field: 'dueDate',
        header: t('tasks.propertyDueDate'),
        className: 'hidden sm:table-cell',
        cell: (task: Task) => (
          <span className="text-xs text-muted-foreground">
            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
          </span>
        ),
      },
      assignedTo: {
        field: 'assignedTo',
        header: t('tasks.assignee'),
        className: 'hidden md:table-cell',
        sortable: false,
        cell: (task: Task) => {
          const names = getAssignedNames(task);
          if (names.length === 0) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <span className="truncate text-xs text-muted-foreground" title={names.join(', ')}>
              {names.slice(0, 2).join(', ')}
              {names.length > 2 ? ` +${names.length - 2}` : ''}
            </span>
          );
        },
      },
      assignedTeam: {
        field: 'assignedTeam',
        header: t('tasks.assignedTeam'),
        className: 'hidden md:table-cell',
        sortable: false,
        cell: (task: Task) => {
          const teamName = getAssignedTeamName(task);
          return teamName ? (
            <span className="truncate text-xs text-muted-foreground" title={teamName}>
              {teamName}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
      createdAt: {
        field: 'createdAt',
        header: t('common.created'),
        className: 'hidden lg:table-cell',
        cell: (task: Task) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(task.createdAt) || '—'}
          </span>
        ),
      },
      updatedAt: {
        field: 'updatedAt',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (task: Task) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(task.updatedAt) || '—'}
          </span>
        ),
      },
    };
    return defs;
  }, [t, getAssignedNames, getAssignedTeamName]);

  const columns = useMemo(
    () =>
      orderedVisibleIds
        .map((id) => columnDefs[id])
        .filter((col): col is SortableListTableColumn<Task, TaskTableField> => Boolean(col)),
    [orderedVisibleIds, columnDefs],
  );

  return (
    <SortableListTable
      rows={tasks}
      columns={columns}
      getRowId={(task) => String(task.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={(field) => {
        if (field === 'assignedTo' || field === 'assignedTeam') {
          return;
        }
        onSort(field);
      }}
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
