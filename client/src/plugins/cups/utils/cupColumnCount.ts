export type CupColumnCount = 1 | 2 | 3;

export const CUPS_SETTINGS_KEY = 'cups';
export const CUPS_COLUMN_COUNT_STORAGE_KEY = 'cups:columnCount';

export function isCupColumnCount(value: unknown): value is CupColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveCupColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): CupColumnCount {
  if (isCupColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (typeof settings?.columnCount === 'string' && isCupColumnCount(Number(settings.columnCount))) {
    return Number(settings.columnCount) as CupColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredCupColumnCount(raw: string | null): CupColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isCupColumnCount(n) ? n : null;
}

export function getInitialCupColumnCount(): CupColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredCupColumnCount(
    window.sessionStorage.getItem(CUPS_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  // Legacy session key
  const legacy = window.sessionStorage.getItem('cups:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
