export type MatchColumnCount = 1 | 2 | 3;

export const MATCHES_SETTINGS_KEY = 'matches';
export const MATCHES_COLUMN_COUNT_STORAGE_KEY = 'matches:columnCount';

export function isMatchColumnCount(value: unknown): value is MatchColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveMatchColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): MatchColumnCount {
  if (isMatchColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isMatchColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as MatchColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredMatchColumnCount(raw: string | null): MatchColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isMatchColumnCount(n) ? n : null;
}

export function getInitialMatchColumnCount(): MatchColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredMatchColumnCount(
    window.sessionStorage.getItem(MATCHES_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  // Legacy session key
  const legacy = window.sessionStorage.getItem('matches:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
