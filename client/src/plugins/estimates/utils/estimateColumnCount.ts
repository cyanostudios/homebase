export type EstimateColumnCount = 1 | 2 | 3;

export const ESTIMATES_SETTINGS_KEY = 'estimates';
export const ESTIMATES_COLUMN_COUNT_STORAGE_KEY = 'estimates:columnCount';

export function isEstimateColumnCount(value: unknown): value is EstimateColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveEstimateColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): EstimateColumnCount {
  if (isEstimateColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isEstimateColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as EstimateColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredEstimateColumnCount(raw: string | null): EstimateColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isEstimateColumnCount(n) ? n : null;
}

export function getInitialEstimateColumnCount(): EstimateColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredEstimateColumnCount(
    window.sessionStorage.getItem(ESTIMATES_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  // Legacy session key
  const legacy = window.sessionStorage.getItem('estimates:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
