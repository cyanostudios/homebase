import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type FileListViewMode = ListViewMode;

const api = createPluginListViewMode('files:listViewMode');

export const FILES_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;
export const isFileListViewMode = api.isListViewMode;
export const resolveFileListViewMode = api.resolveListViewMode;
export const getInitialFileListViewMode = api.getInitialListViewMode;
export const persistFileListViewModeSession = api.persistListViewModeSession;
