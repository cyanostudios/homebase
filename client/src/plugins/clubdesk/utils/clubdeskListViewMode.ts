import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type ClubdeskListViewMode = ListViewMode;

const api = createPluginListViewMode('clubdesk:listViewMode');

export const CLUBDESK_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;

export const isClubdeskListViewMode = api.isListViewMode;

export const resolveClubdeskListViewMode = api.resolveListViewMode;

export const getInitialClubdeskListViewMode = api.getInitialListViewMode;

export const persistClubdeskListViewModeSession = api.persistListViewModeSession;
