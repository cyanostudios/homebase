export type ContactColumnCount = 1 | 2 | 3;

export const CONTACTS_SETTINGS_KEY = 'contacts';
export const CONTACTS_COLUMN_COUNT_STORAGE_KEY = 'contacts:columnCount';

export function isContactColumnCount(value: unknown): value is ContactColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 3. */
export function resolveContactColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): ContactColumnCount {
  if (isContactColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isContactColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as ContactColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  if (settings?.viewMode === 'list') {
    return 1;
  }
  return 3;
}

export function parseStoredContactColumnCount(raw: string | null): ContactColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isContactColumnCount(n) ? n : null;
}

export function getInitialContactColumnCount(): ContactColumnCount {
  if (typeof window === 'undefined') {
    return 3;
  }
  const fromColumn = parseStoredContactColumnCount(
    window.sessionStorage.getItem(CONTACTS_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  const legacy = window.sessionStorage.getItem('contacts:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  if (legacy === 'list') {
    return 1;
  }
  return 3;
}
