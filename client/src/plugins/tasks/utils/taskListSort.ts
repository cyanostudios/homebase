import type { Task } from '../types/tasks';

export type TaskSortField = 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt';
export type TaskSortOrder = 'asc' | 'desc';

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

/** Calendar day in local time — used so secondary sort can break same-day ties. */
function toSortDay(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
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

/**
 * Primary then optional secondary; shared order for both levels.
 * When primary is a date field and secondary is set, primary is compared by
 * calendar day first so secondary can reorder items updated/created/due the same day
 * (full timestamps are almost always unique and would otherwise hide secondary).
 */
export function compareTasksTwoLevel(
  a: Pick<Task, 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt'>,
  b: Pick<Task, 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt'>,
  primary: TaskSortField,
  secondary: TaskSortField | '',
  order: TaskSortOrder,
): number {
  if (secondary && isTaskDateSortField(primary)) {
    const aPrimary = getTaskSortValue(a, primary) as Date | null;
    const bPrimary = getTaskSortValue(b, primary) as Date | null;
    const dayResult = compareNullableTimes(aPrimary, bPrimary, order, toSortDay);
    if (dayResult !== 0) {
      return dayResult;
    }
    const secondaryResult = compareTasksByField(a, b, secondary, order);
    if (secondaryResult !== 0) {
      return secondaryResult;
    }
    return compareNullableTimes(aPrimary, bPrimary, order, toSortTime);
  }

  const primaryResult = compareTasksByField(a, b, primary, order);
  if (primaryResult !== 0) {
    return primaryResult;
  }
  if (secondary) {
    return compareTasksByField(a, b, secondary, order);
  }
  return 0;
}
