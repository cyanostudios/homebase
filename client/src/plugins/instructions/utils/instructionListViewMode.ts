import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type InstructionListViewMode = ListViewMode;

const api = createPluginListViewMode('instructions:listViewMode');

export const INSTRUCTIONS_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;

export const isInstructionListViewMode = api.isListViewMode;

export const resolveInstructionListViewMode = api.resolveListViewMode;

export const getInitialInstructionListViewMode = api.getInitialListViewMode;

export const persistInstructionListViewModeSession = api.persistListViewModeSession;
