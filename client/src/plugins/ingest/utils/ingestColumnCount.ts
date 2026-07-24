export type IngestColumnCount = 1 | 2 | 3;

export const INGEST_SETTINGS_KEY = 'ingest';
export const INGEST_COLUMN_COUNT_STORAGE_KEY = 'ingest:columnCount';

export function isIngestColumnCount(value: unknown): value is IngestColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveIngestColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): IngestColumnCount {
  if (isIngestColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isIngestColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as IngestColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredIngestColumnCount(raw: string | null): IngestColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isIngestColumnCount(n) ? n : null;
}

export function getInitialIngestColumnCount(): IngestColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredIngestColumnCount(
    window.sessionStorage.getItem(INGEST_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  // Legacy session key
  const legacy = window.sessionStorage.getItem('ingest:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
