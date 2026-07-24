export type NoteColumnCount = 1 | 2 | 3;

export const NOTES_SETTINGS_KEY = 'notes';
export const NOTES_COLUMN_COUNT_STORAGE_KEY = 'notes:columnCount';

export function isNoteColumnCount(value: unknown): value is NoteColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveNoteColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): NoteColumnCount {
  if (isNoteColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isNoteColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as NoteColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredNoteColumnCount(raw: string | null): NoteColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isNoteColumnCount(n) ? n : null;
}

export function getInitialNoteColumnCount(): NoteColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredNoteColumnCount(
    window.sessionStorage.getItem(NOTES_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  // Legacy session key
  const legacy = window.sessionStorage.getItem('notes:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
