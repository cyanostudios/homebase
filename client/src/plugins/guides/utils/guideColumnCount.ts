export type GuideColumnCount = 1 | 2 | 3;

export const GUIDES_COLUMN_COUNT_STORAGE_KEY = 'guides:columnCount';

export function isGuideColumnCount(value: unknown): value is GuideColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveGuideColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): GuideColumnCount {
  if (isGuideColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isGuideColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as GuideColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredGuideColumnCount(raw: string | null): GuideColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isGuideColumnCount(n) ? n : null;
}

export function getInitialGuideColumnCount(): GuideColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredGuideColumnCount(
    window.sessionStorage.getItem(GUIDES_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  // Legacy session key
  const legacy = window.sessionStorage.getItem('guides:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
