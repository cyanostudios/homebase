import {
  getInitialListViewMode,
  isListViewMode,
  parseStoredListViewMode,
  persistListViewModeSession,
  resolveListViewMode,
  type ListViewMode,
} from '@/core/list/listViewMode';

export type SlotListViewMode = ListViewMode;

export const SLOTS_LIST_VIEW_MODE_STORAGE_KEY = 'slots:listViewMode';

export const isSlotListViewMode = isListViewMode;

export function resolveSlotListViewMode(
  settings:
    | {
        listViewMode?: unknown;
      }
    | null
    | undefined,
): SlotListViewMode {
  return resolveListViewMode(settings);
}

export function parseStoredSlotListViewMode(raw: string | null): SlotListViewMode | null {
  return parseStoredListViewMode(raw);
}

export function getInitialSlotListViewMode(): SlotListViewMode {
  return getInitialListViewMode(SLOTS_LIST_VIEW_MODE_STORAGE_KEY);
}

export function persistSlotListViewModeSession(mode: SlotListViewMode): void {
  persistListViewModeSession(SLOTS_LIST_VIEW_MODE_STORAGE_KEY, mode);
}
