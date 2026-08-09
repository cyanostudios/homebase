import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type CupListViewMode = ListViewMode;

const api = createPluginListViewMode('cups:listViewMode');

export const CUPS_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;
export const isCupListViewMode = api.isListViewMode;
export const resolveCupListViewMode = api.resolveListViewMode;
export const getInitialCupListViewMode = api.getInitialListViewMode;
export const persistCupListViewModeSession = api.persistListViewModeSession;
