import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type GuideListViewMode = ListViewMode;

const api = createPluginListViewMode('guides:listViewMode');

export const GUIDES_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;
export const isGuideListViewMode = api.isListViewMode;
export const resolveGuideListViewMode = api.resolveListViewMode;
export const getInitialGuideListViewMode = api.getInitialListViewMode;
export const persistGuideListViewModeSession = api.persistListViewModeSession;
