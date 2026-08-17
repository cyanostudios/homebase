export type GarmentColumnCount = 1 | 2 | 3;

export const GARMENTS_SETTINGS_KEY = 'garments';
export const GARMENTS_COLUMN_COUNT_STORAGE_KEY = 'garments:columnCount';

export function isGarmentColumnCount(value: unknown): value is GarmentColumnCount {
  return value === 1 || value === 2 || value === 3;
}

type GarmentColumnSettings =
  | {
      columnCount?: unknown;
    }
  | null
  | undefined;

export function settingsHasGarmentColumnPreference(settings: GarmentColumnSettings): boolean {
  if (settings == null) {
    return false;
  }
  return settings.columnCount != null && settings.columnCount !== '';
}

export function resolveGarmentColumnCount(settings: GarmentColumnSettings): GarmentColumnCount {
  if (isGarmentColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isGarmentColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as GarmentColumnCount;
  }
  return 1;
}

export function parseStoredGarmentColumnCount(raw: string | null): GarmentColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isGarmentColumnCount(n) ? n : null;
}

export function getInitialGarmentColumnCount(): GarmentColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  return (
    parseStoredGarmentColumnCount(
      window.sessionStorage.getItem(GARMENTS_COLUMN_COUNT_STORAGE_KEY),
    ) ?? 1
  );
}
