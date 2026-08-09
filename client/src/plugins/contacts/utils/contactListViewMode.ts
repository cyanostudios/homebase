import {
  getInitialListViewMode,
  isListViewMode,
  parseStoredListViewMode,
  persistListViewModeSession,
  resolveListViewMode,
  type ListViewMode,
} from '@/core/list/listViewMode';

export type ContactListViewMode = ListViewMode;

export const CONTACTS_LIST_VIEW_MODE_STORAGE_KEY = 'contacts:listViewMode';

export const isContactListViewMode = isListViewMode;

export function resolveContactListViewMode(
  settings:
    | {
        listViewMode?: unknown;
      }
    | null
    | undefined,
): ContactListViewMode {
  return resolveListViewMode(settings);
}

export function parseStoredContactListViewMode(raw: string | null): ContactListViewMode | null {
  return parseStoredListViewMode(raw);
}

export function getInitialContactListViewMode(): ContactListViewMode {
  return getInitialListViewMode(CONTACTS_LIST_VIEW_MODE_STORAGE_KEY);
}

export function persistContactListViewModeSession(mode: ContactListViewMode): void {
  persistListViewModeSession(CONTACTS_LIST_VIEW_MODE_STORAGE_KEY, mode);
}
