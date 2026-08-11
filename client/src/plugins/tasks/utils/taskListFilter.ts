import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { Task } from '../types/tasks';

/** Selectable filters (excluding "all", which clears the selection). */
export type TaskListFilter = 'open' | 'completed' | 'overdue';

/** Empty array = show all. Default list selection is `['open']`. */
export type TaskListFilterSelection = TaskListFilter[];

const STATUS_FILTERS = ['open', 'completed'] as const satisfies readonly TaskListFilter[];

export const TASK_LIST_FILTER_EXCLUSIVE_GROUPS = [STATUS_FILTERS] as const;

export const TASK_LIST_FILTER_INITIAL: TaskListFilterSelection = ['open'];

export function taskIsOpen(task: Pick<Task, 'status'>): boolean {
  return task.status !== 'completed' && task.status !== 'cancelled';
}

export function taskIsOverdue(
  task: Pick<Task, 'status' | 'dueDate'>,
  nowMs: number = Date.now(),
): boolean {
  if (!task.dueDate || task.status === 'completed' || task.status === 'cancelled') {
    return false;
  }
  return new Date(task.dueDate).getTime() < nowMs;
}

export function taskMatchesSingleFilter(
  task: Pick<Task, 'status' | 'dueDate'>,
  filter: TaskListFilter,
  nowMs: number = Date.now(),
): boolean {
  if (filter === 'open') {
    return taskIsOpen(task);
  }
  if (filter === 'completed') {
    return task.status === 'completed';
  }
  if (filter === 'overdue') {
    return taskIsOverdue(task, nowMs);
  }
  return true;
}

/** AND across selected filters. Empty selection = all tasks. */
export function taskMatchesListFilters(
  task: Pick<Task, 'status' | 'dueDate'>,
  filters: TaskListFilterSelection,
  nowMs: number = Date.now(),
): boolean {
  return itemMatchesListFilters(task, filters, (item, filter) =>
    taskMatchesSingleFilter(item, filter, nowMs),
  );
}

/**
 * Toggle a task list filter.
 * open/completed replace each other; overdue toggles independently.
 */
export function toggleTaskListFilter(
  current: TaskListFilterSelection,
  filter: TaskListFilter,
): TaskListFilterSelection {
  return toggleListFilterSelection(current, filter, TASK_LIST_FILTER_EXCLUSIVE_GROUPS);
}
