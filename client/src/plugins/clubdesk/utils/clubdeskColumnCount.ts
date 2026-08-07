export type ClubdeskColumnCount = 1 | 2 | 3;

export const CLUBDESK_COLUMN_COUNT_STORAGE_KEY = 'clubdesk:columnCount';
export const CLUBDESK_SETTINGS_KEY = 'clubdesk';

export function resolveClubdeskColumnCount(settings: unknown): ClubdeskColumnCount {
  const raw =
    settings && typeof settings === 'object'
      ? (settings as { columnCount?: unknown }).columnCount
      : undefined;
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 3) {
    return n;
  }
  return 2;
}

export function getInitialClubdeskColumnCount(): ClubdeskColumnCount {
  if (typeof window === 'undefined') {
    return 2;
  }
  const stored = window.sessionStorage.getItem(CLUBDESK_COLUMN_COUNT_STORAGE_KEY);
  const n = Number(stored);
  if (n === 1 || n === 2 || n === 3) {
    return n;
  }
  return 2;
}
