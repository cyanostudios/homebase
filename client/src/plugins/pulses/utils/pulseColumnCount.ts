export type PulseColumnCount = 1 | 2 | 3;

export const PULSES_SETTINGS_KEY = 'pulses';
export const PULSES_COLUMN_COUNT_STORAGE_KEY = 'pulses:columnCount';

export function isPulseColumnCount(value: unknown): value is PulseColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolvePulseColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): PulseColumnCount {
  if (isPulseColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isPulseColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as PulseColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredPulseColumnCount(raw: string | null): PulseColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isPulseColumnCount(n) ? n : null;
}

export function getInitialPulseColumnCount(): PulseColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredPulseColumnCount(
    window.sessionStorage.getItem(PULSES_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  const legacy = window.sessionStorage.getItem('pulses:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
