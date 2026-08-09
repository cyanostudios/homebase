import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type MatchListViewMode = ListViewMode;

const api = createPluginListViewMode('matches:listViewMode');

export const MATCHES_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;
export const isMatchListViewMode = api.isListViewMode;
export const resolveMatchListViewMode = api.resolveListViewMode;
export const getInitialMatchListViewMode = api.getInitialListViewMode;
export const persistMatchListViewModeSession = api.persistListViewModeSession;
