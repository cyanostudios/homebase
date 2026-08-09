/** Settings key for free-text default home team (matches category). */
export const MATCHES_DEFAULT_HOME_TEAM_KEY = 'defaultHomeTeam' as const;

/** Normalize for equality: trim + lowercase. Empty after trim → ''. */
export function normalizeMatchHomeTeamName(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

/** Resolve trimmed default from settings; empty/invalid → ''. */
export function resolveMatchDefaultHomeTeam(
  settings: { defaultHomeTeam?: unknown } | null | undefined,
): string {
  if (typeof settings?.defaultHomeTeam !== 'string') {
    return '';
  }
  return settings.defaultHomeTeam.trim();
}

/**
 * True when home_team equals default, or continues after it with a space
 * (e.g. default "Sorgenfri FF" matches "Sorgenfri FF svart").
 * Comparison is trim + case-insensitive.
 */
export function matchHomeTeamEqualsDefault(
  homeTeam: string | null | undefined,
  defaultHomeTeam: string,
): boolean {
  const expected = normalizeMatchHomeTeamName(defaultHomeTeam);
  if (!expected) {
    return false;
  }
  const actual = normalizeMatchHomeTeamName(homeTeam);
  if (!actual) {
    return false;
  }
  return actual === expected || actual.startsWith(`${expected} `);
}
