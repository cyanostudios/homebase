import type { ViewportTier } from '@/hooks/useMediaQuery';

/** Persisted cards preference; display density is tier-based (see getEffectiveFileGridColumns). */
export type FileColumnCount = 1 | 2 | 3 | 6;

/** Desktop cards grid density (pad/phone use getEffectiveFileGridColumns). */
export const FILES_CARDS_COLUMN_COUNT: FileColumnCount = 6;

export const FILES_SETTINGS_KEY = 'files';
export const FILES_COLUMN_COUNT_STORAGE_KEY = 'files:columnCount';

export function isFileColumnCount(value: unknown): value is FileColumnCount {
  return value === 1 || value === 2 || value === 3 || value === 6;
}

type FileColumnSettings =
  | {
      columnCount?: unknown;
      viewMode?: unknown;
    }
  | null
  | undefined;

/** True when settings carry an explicit column preference (not just empty {}). */
export function settingsHasFileColumnPreference(settings: FileColumnSettings): boolean {
  if (settings == null) {
    return false;
  }
  if (settings.columnCount != null && settings.columnCount !== '') {
    return true;
  }
  return settings.viewMode === 'grid' || settings.viewMode === 'list';
}

/**
 * Prefer columnCount; migrate legacy viewMode (grid→6, list→1).
 * Older cards prefs 1|2|3 normalize to 6 via normalizeFileCardsColumnCount.
 */
export function resolveFileColumnCount(settings: FileColumnSettings): FileColumnCount {
  if (isFileColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isFileColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as FileColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return FILES_CARDS_COLUMN_COUNT;
  }
  return 1;
}

/** Cards mode always stores dense desktop preference (6). */
export function normalizeFileCardsColumnCount(_count: FileColumnCount): FileColumnCount {
  return FILES_CARDS_COLUMN_COUNT;
}

/**
 * Display-only grid columns for files cards (does not change shared list ADR clamps):
 * phone → 2, pad → 4, desktop → 6 (→ 2 while list quick context is open).
 */
export function getEffectiveFileGridColumns(
  tier: ViewportTier,
  options?: { quickContextOpen?: boolean },
): 2 | 4 | 6 {
  if (tier === 'phone') {
    return 2;
  }
  if (tier === 'pad') {
    return 4;
  }
  if (options?.quickContextOpen) {
    return 2;
  }
  return 6;
}

export function parseStoredFileColumnCount(raw: string | null): FileColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isFileColumnCount(n) ? n : null;
}

export function getInitialFileColumnCount(): FileColumnCount {
  if (typeof window === 'undefined') {
    return FILES_CARDS_COLUMN_COUNT;
  }
  const fromColumn = parseStoredFileColumnCount(
    window.sessionStorage.getItem(FILES_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return normalizeFileCardsColumnCount(fromColumn);
  }
  // Legacy session key
  const legacy = window.sessionStorage.getItem('files:viewMode');
  if (legacy === 'grid') {
    return FILES_CARDS_COLUMN_COUNT;
  }
  if (legacy === 'list') {
    return 1;
  }
  return FILES_CARDS_COLUMN_COUNT;
}
