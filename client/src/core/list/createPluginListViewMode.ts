import {
  getInitialListViewMode,
  isListViewMode,
  persistListViewModeSession,
  resolveListViewMode,
  type ListViewMode,
} from '@/core/list/listViewMode';

export type { ListViewMode };

export function createPluginListViewMode(storageKey: string) {
  return {
    STORAGE_KEY: storageKey,
    isListViewMode,
    resolveListViewMode,
    getInitialListViewMode: (): ListViewMode => getInitialListViewMode(storageKey),
    persistListViewModeSession: (mode: ListViewMode): void =>
      persistListViewModeSession(storageKey, mode),
  };
}
