export type RequestColumnCount = 1 | 2 | 3;

export const REQUESTS_COLUMN_COUNT_STORAGE_KEY = 'requests:columnCount';

export function isRequestColumnCount(value: unknown): value is RequestColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/**
 * Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1.
 * Session-only — Requests has no columnCount in plugin settings.
 */
export function resolveRequestColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): RequestColumnCount {
  if (isRequestColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isRequestColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as RequestColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredRequestColumnCount(raw: string | null): RequestColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isRequestColumnCount(n) ? n : null;
}

export function getInitialRequestColumnCount(): RequestColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredRequestColumnCount(
    window.sessionStorage.getItem(REQUESTS_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  // Legacy session key
  const legacy = window.sessionStorage.getItem('requests:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
