import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type YourItemListViewMode = ListViewMode;

const api = createPluginListViewMode('your-items:listViewMode');

export const YOUR_ITEMS_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;
export const isYourItemListViewMode = api.isListViewMode;
export const resolveYourItemListViewMode = api.resolveListViewMode;
export const getInitialYourItemListViewMode = api.getInitialListViewMode;
export const persistYourItemListViewModeSession = api.persistListViewModeSession;
