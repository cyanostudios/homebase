export type TeamColumnCount = 1 | 2 | 3;

export const TEAMS_SETTINGS_KEY = 'teams';
export const TEAMS_COLUMN_COUNT_STORAGE_KEY = 'teams:columnCount';

export function isTeamColumnCount(value: unknown): value is TeamColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount. Default 3 (matches legacy responsive 3-column desktop layout). */
export function resolveTeamColumnCount(
  settings: { columnCount?: unknown } | null | undefined,
): TeamColumnCount {
  if (isTeamColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isTeamColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as TeamColumnCount;
  }
  return 3;
}

export function parseStoredTeamColumnCount(raw: string | null): TeamColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isTeamColumnCount(n) ? n : null;
}

export function getInitialTeamColumnCount(): TeamColumnCount {
  if (typeof window === 'undefined') {
    return 3;
  }
  const stored = parseStoredTeamColumnCount(
    window.sessionStorage.getItem(TEAMS_COLUMN_COUNT_STORAGE_KEY),
  );
  return stored ?? 3;
}
