import {
  getInitialListViewMode,
  isListViewMode,
  parseStoredListViewMode,
  persistListViewModeSession,
  resolveListViewMode,
  type ListViewMode,
} from '@/core/list/listViewMode';

export type TaskListViewMode = ListViewMode;

export const TASKS_LIST_VIEW_MODE_STORAGE_KEY = 'tasks:listViewMode';

export const isTaskListViewMode = isListViewMode;

export function resolveTaskListViewMode(
  settings:
    | {
        listViewMode?: unknown;
      }
    | null
    | undefined,
): TaskListViewMode {
  return resolveListViewMode(settings);
}

export function parseStoredTaskListViewMode(raw: string | null): TaskListViewMode | null {
  return parseStoredListViewMode(raw);
}

export function getInitialTaskListViewMode(): TaskListViewMode {
  return getInitialListViewMode(TASKS_LIST_VIEW_MODE_STORAGE_KEY);
}

export function persistTaskListViewModeSession(mode: TaskListViewMode): void {
  persistListViewModeSession(TASKS_LIST_VIEW_MODE_STORAGE_KEY, mode);
}
