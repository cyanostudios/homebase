import {
  getInitialListViewMode,
  persistListViewModeSession,
  resolveListViewMode,
  type ListViewMode,
} from '@/core/list/listViewMode';

export type AIProvidersListViewMode = ListViewMode;

export const AI_PROVIDERS_LIST_VIEW_MODE_STORAGE_KEY = 'ai-providers:listViewMode';

export function resolveAIProvidersListViewMode(
  settings:
    | {
        listViewMode?: unknown;
      }
    | null
    | undefined,
): AIProvidersListViewMode {
  return resolveListViewMode(settings);
}

export function getInitialAIProvidersListViewMode(): AIProvidersListViewMode {
  return getInitialListViewMode(AI_PROVIDERS_LIST_VIEW_MODE_STORAGE_KEY);
}

export function persistAIProvidersListViewModeSession(mode: AIProvidersListViewMode): void {
  persistListViewModeSession(AI_PROVIDERS_LIST_VIEW_MODE_STORAGE_KEY, mode);
}
