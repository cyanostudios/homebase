export type SlotColumnCount = 1 | 2 | 3;

export const SLOTS_SETTINGS_KEY = 'slots';
export const SLOTS_COLUMN_COUNT_STORAGE_KEY = 'slots:columnCount';

export function isSlotColumnCount(value: unknown): value is SlotColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveSlotColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): SlotColumnCount {
  if (isSlotColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isSlotColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as SlotColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredSlotColumnCount(raw: string | null): SlotColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isSlotColumnCount(n) ? n : null;
}

export function getInitialSlotColumnCount(): SlotColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredSlotColumnCount(
    window.sessionStorage.getItem(SLOTS_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  // Legacy session key
  const legacy = window.sessionStorage.getItem('slots:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
