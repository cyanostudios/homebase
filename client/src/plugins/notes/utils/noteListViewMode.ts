import {
  getInitialListViewMode,
  isListViewMode,
  parseStoredListViewMode,
  persistListViewModeSession,
  resolveListViewMode,
  type ListViewMode,
} from '@/core/list/listViewMode';

export type NoteListViewMode = ListViewMode;

export const NOTES_LIST_VIEW_MODE_STORAGE_KEY = 'notes:listViewMode';

export const isNoteListViewMode = isListViewMode;

export function resolveNoteListViewMode(
  settings:
    | {
        listViewMode?: unknown;
      }
    | null
    | undefined,
): NoteListViewMode {
  return resolveListViewMode(settings);
}

export function parseStoredNoteListViewMode(raw: string | null): NoteListViewMode | null {
  return parseStoredListViewMode(raw);
}

export function getInitialNoteListViewMode(): NoteListViewMode {
  return getInitialListViewMode(NOTES_LIST_VIEW_MODE_STORAGE_KEY);
}

export function persistNoteListViewModeSession(mode: NoteListViewMode): void {
  persistListViewModeSession(NOTES_LIST_VIEW_MODE_STORAGE_KEY, mode);
}
