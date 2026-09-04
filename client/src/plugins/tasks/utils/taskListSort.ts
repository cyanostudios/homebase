import { nextListTableSort } from '@/core/list/listViewMode';

import type { Task } from '../types/tasks';

export type TaskSortField = 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt';
export type TaskSortOrder = 'asc' | 'desc';

/** Asc default for string fields (not priority rank); desc for dates and priority. */
export function isTaskAscDefaultField(field: TaskSortField): boolean {
  return field === 'title' || field === 'status';
}

/** Header-click sort: toggle order on same field, else switch field with default order. */
export function nextTaskTableSort(
  currentField: TaskSortField,
  currentOrder: TaskSortOrder,
  nextField: TaskSortField,
): { field: TaskSortField; order: TaskSortOrder } {
  return nextListTableSort(currentField, currentOrder, nextField, isTaskAscDefaultField);
}

const STRING_SORT_FIELDS: TaskSortField[] = ['title', 'status', 'priority'];
const DATE_SORT_FIELDS: TaskSortField[] = ['dueDate', 'createdAt', 'updatedAt'];

const PRIORITY_ORDER: Record<Task['priority'], number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

export function isTaskStringSortField(field: TaskSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

export function isTaskDateSortField(field: TaskSortField): boolean {
  return DATE_SORT_FIELDS.includes(field);
}

export function getTaskSortValue(
  task: Pick<Task, 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt'>,
  field: TaskSortField,
): string | Date | null {
  if (field === 'title') {
    return task.title.toLowerCase();
  }
  if (field === 'status') {
    return task.status;
  }
  if (field === 'priority') {
    return PRIORITY_ORDER[task.priority].toString();
  }
  if (field === 'dueDate') {
    return task.dueDate;
  }
  if (field === 'createdAt') {
    return task.createdAt;
  }
  return task.updatedAt;
}

function toSortTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function compareNullableTimes(
  aValue: Date | string | null | undefined,
  bValue: Date | string | null | undefined,
  order: TaskSortOrder,
  toTime: (value: Date | string) => number,
): number {
  if (!aValue && !bValue) {
    return 0;
  }
  if (!aValue) {
    return order === 'asc' ? 1 : -1;
  }
  if (!bValue) {
    return order === 'asc' ? -1 : 1;
  }

  const aTime = toTime(aValue);
  const bTime = toTime(bValue);
  return order === 'asc' ? aTime - bTime : bTime - aTime;
}

export function compareTasksByField(
  a: Pick<Task, 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt'>,
  b: Pick<Task, 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt'>,
  field: TaskSortField,
  order: TaskSortOrder,
): number {
  const aValue = getTaskSortValue(a, field);
  const bValue = getTaskSortValue(b, field);

  if (isTaskStringSortField(field)) {
    if (order === 'asc') {
      return (aValue as string).localeCompare(bValue as string);
    }
    return (bValue as string).localeCompare(aValue as string);
  }

  return compareNullableTimes(aValue as Date | null, bValue as Date | null, order, toSortTime);
}
