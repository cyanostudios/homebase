import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type RequestListViewMode = ListViewMode;

const api = createPluginListViewMode('requests:listViewMode');

export const REQUESTS_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;
export const isRequestListViewMode = api.isListViewMode;
export const resolveRequestListViewMode = api.resolveListViewMode;
export const getInitialRequestListViewMode = api.getInitialListViewMode;
export const persistRequestListViewModeSession = api.persistListViewModeSession;
