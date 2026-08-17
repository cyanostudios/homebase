import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type GarmentListViewMode = ListViewMode;

const api = createPluginListViewMode('garments:listViewMode');

export const GARMENTS_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;
export const isGarmentListViewMode = api.isListViewMode;
export const resolveGarmentListViewMode = api.resolveListViewMode;
export const getInitialGarmentListViewMode = api.getInitialListViewMode;
export const persistGarmentListViewModeSession = api.persistListViewModeSession;
