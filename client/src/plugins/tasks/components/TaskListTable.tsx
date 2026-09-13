import { Circle, CheckCircle2, Clock, Flag, XCircle } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';

import { Badge } from '@/components/ui/badge';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import type { Task } from '../types/tasks';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_COLORS,
  TASK_STATUS_OPTIONS,
  formatStatusForDisplay,
} from '../types/tasks';

type TaskStatus = (typeof TASK_STATUS_OPTIONS)[number];
type TaskPriority = (typeof TASK_PRIORITY_OPTIONS)[number];
import type { TaskSortField, TaskSortOrder } from '../utils/taskListSort';
import {
  DEFAULT_TASK_TABLE_COLUMNS,
  type TaskTableColumnId,
  resolveVisibleTaskTableColumns,
} from '../utils/taskTableColumns';

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

const TASK_STATUS_ICON_SHELL_CLASS: Record<TaskStatus, string> = {
  'not started': 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300',
  'in progress': 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
};

const TASK_PRIORITY_ICON_SHELL_CLASS: Record<TaskPriority, string> = {
  Low: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  Medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  High: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
};

function taskStatusIcon(status: TaskStatus) {
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
        cell: (task: Task) => {
          const status = (task.status as TaskStatus) || 'not started';
          const priority = (task.priority as TaskPriority) || 'Medium';
          const StatusIcon = taskStatusIcon(status);
          const statusLabel = formatStatusForDisplay(status);

          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={statusLabel} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={StatusIcon}
                    className={cn(
                      'h-5 w-5 [&_svg]:h-3 [&_svg]:w-3',
                      TASK_STATUS_ICON_SHELL_CLASS[status],
                    )}
                  />
                </span>
                <span
                  className="min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary"
                  title={task.title}
                >
                  {task.title}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 pl-6">
                <span title={priority} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={Flag}
                    className={cn(
                      'h-4 w-4 [&_svg]:h-2.5 [&_svg]:w-2.5',
                      TASK_PRIORITY_ICON_SHELL_CLASS[priority],
                    )}
                  />
                </span>
                <span className="min-w-0 truncate text-[10px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                  {statusLabel} · {priority}
                </span>
              </div>
            </div>
          );
        },
      },
      status: {
        field: 'status',
        header: t('tasks.propertyStatus'),
        cell: (task: Task) => (
          <Badge
            className={cn(
              BADGE_CHIP_CLASS,
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
          <Badge className={cn(BADGE_CHIP_CLASS, TASK_PRIORITY_COLORS[task.priority])}>
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
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
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
