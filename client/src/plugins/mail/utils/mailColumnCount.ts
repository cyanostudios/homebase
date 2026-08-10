export type MailColumnCount = 1 | 2 | 3;

export const MAIL_SETTINGS_KEY = 'mail';
export const MAIL_COLUMN_COUNT_STORAGE_KEY = 'mail:columnCount';

export function isMailColumnCount(value: unknown): value is MailColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveMailColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): MailColumnCount {
  if (isMailColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isMailColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as MailColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredMailColumnCount(raw: string | null): MailColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isMailColumnCount(n) ? n : null;
}

export function getInitialMailColumnCount(): MailColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredMailColumnCount(
    window.sessionStorage.getItem(MAIL_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  const legacy = window.sessionStorage.getItem('mail:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
