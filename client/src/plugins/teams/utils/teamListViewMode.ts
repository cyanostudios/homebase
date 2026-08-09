import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type TeamListViewMode = ListViewMode;

const api = createPluginListViewMode('teams:listViewMode');

export const TEAMS_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;
export const isTeamListViewMode = api.isListViewMode;
export const resolveTeamListViewMode = api.resolveListViewMode;
export const getInitialTeamListViewMode = api.getInitialListViewMode;
export const persistTeamListViewModeSession = api.persistListViewModeSession;
