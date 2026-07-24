export type FileColumnCount = 1 | 2 | 3;

export const FILES_SETTINGS_KEY = 'files';
export const FILES_COLUMN_COUNT_STORAGE_KEY = 'files:columnCount';

export function isFileColumnCount(value: unknown): value is FileColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveFileColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): FileColumnCount {
  if (isFileColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isFileColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as FileColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredFileColumnCount(raw: string | null): FileColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isFileColumnCount(n) ? n : null;
}

export function getInitialFileColumnCount(): FileColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredFileColumnCount(
    window.sessionStorage.getItem(FILES_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  // Legacy session key
  const legacy = window.sessionStorage.getItem('files:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
