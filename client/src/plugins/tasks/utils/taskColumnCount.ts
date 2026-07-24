export type TaskColumnCount = 1 | 2 | 3;

export const TASKS_SETTINGS_KEY = 'tasks';
export const TASKS_COLUMN_COUNT_STORAGE_KEY = 'tasks:columnCount';

export function isTaskColumnCount(value: unknown): value is TaskColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveTaskColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): TaskColumnCount {
  if (isTaskColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isTaskColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as TaskColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredTaskColumnCount(raw: string | null): TaskColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isTaskColumnCount(n) ? n : null;
}

export function getInitialTaskColumnCount(): TaskColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredTaskColumnCount(
    window.sessionStorage.getItem(TASKS_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  // Legacy session key
  const legacy = window.sessionStorage.getItem('tasks:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
