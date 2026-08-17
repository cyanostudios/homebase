export type YourItemColumnCount = 1 | 2 | 3;

export const YOUR_ITEMS_SETTINGS_KEY = 'your-items';
export const YOUR_ITEMS_COLUMN_COUNT_STORAGE_KEY = 'your-items:columnCount';

export function isYourItemColumnCount(value: unknown): value is YourItemColumnCount {
  return value === 1 || value === 2 || value === 3;
}

type YourItemColumnSettings =
  | {
      columnCount?: unknown;
      viewMode?: unknown;
    }
  | null
  | undefined;

/** True when settings carry an explicit column preference (not just empty {}). */
export function settingsHasYourItemColumnPreference(settings: YourItemColumnSettings): boolean {
  if (settings == null) {
    return false;
  }
  if (settings.columnCount != null && settings.columnCount !== '') {
    return true;
  }
  return settings.viewMode === 'grid' || settings.viewMode === 'list';
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveYourItemColumnCount(settings: YourItemColumnSettings): YourItemColumnCount {
  if (isYourItemColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isYourItemColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as YourItemColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredYourItemColumnCount(raw: string | null): YourItemColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isYourItemColumnCount(n) ? n : null;
}

export function getInitialYourItemColumnCount(): YourItemColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredYourItemColumnCount(
    window.sessionStorage.getItem(YOUR_ITEMS_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  const legacy = window.sessionStorage.getItem('your-items:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
