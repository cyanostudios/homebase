import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type EstimateListViewMode = ListViewMode;

const api = createPluginListViewMode('estimates:listViewMode');

export const ESTIMATES_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;
export const isEstimateListViewMode = api.isListViewMode;
export const resolveEstimateListViewMode = api.resolveListViewMode;
export const getInitialEstimateListViewMode = api.getInitialListViewMode;
export const persistEstimateListViewModeSession = api.persistListViewModeSession;
