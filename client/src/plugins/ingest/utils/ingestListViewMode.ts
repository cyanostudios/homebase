import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type IngestListViewMode = ListViewMode;

const api = createPluginListViewMode('ingest:listViewMode');

export const INGEST_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;
export const isIngestListViewMode = api.isListViewMode;
export const resolveIngestListViewMode = api.resolveListViewMode;
export const getInitialIngestListViewMode = api.getInitialListViewMode;
export const persistIngestListViewModeSession = api.persistListViewModeSession;
