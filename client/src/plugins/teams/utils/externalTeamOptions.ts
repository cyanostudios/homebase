import type { ApiRequestError } from '@/core/api/createApiClient';

import type { ExternalTeamOption, OccupiedExternalTeam } from '../types/teams';

export const EXTERNAL_TEAM_NONE_VALUE = '__none__';

export type ExternalOptionsUiStatus = 'loading' | 'ready' | 'empty' | 'missing_api_key' | 'error';

export function classifyExternalOptionsError(error: unknown): 'missing_api_key' | 'error' {
  const err = error as ApiRequestError | undefined;
  const message = String(err?.message || '').toLowerCase();
  if (
    err?.status === 400 ||
    err?.code === 'VALIDATION_ERROR' ||
    message.includes('api key') ||
    message.includes('api-nyckel')
  ) {
    return 'missing_api_key';
  }
  return 'error';
}

export function findOccupiedByOther(
  occupiedBy: OccupiedExternalTeam[],
  externalTeamId: string,
  currentTeamId: string | null | undefined,
): OccupiedExternalTeam | null {
  const id = String(externalTeamId || '').trim();
  if (!id) {
    return null;
  }
  const match = occupiedBy.find((row) => row.externalTeamId === id);
  if (!match) {
    return null;
  }
  if (
    currentTeamId !== null &&
    currentTeamId !== undefined &&
    String(currentTeamId) === String(match.teamId)
  ) {
    return null;
  }
  return match;
}

export function isOrphanExternalTeamId(
  externalTeamId: string,
  knownIds: Iterable<string>,
): boolean {
  const id = String(externalTeamId || '').trim();
  if (!id) {
    return false;
  }
  const set = knownIds instanceof Set ? knownIds : new Set(knownIds);
  return !set.has(id);
}

/** Display: "Sorgenfri FF (324323) F16" — no match count. */
export function formatExternalTeamLabel(team: {
  name: string;
  externalTeamId: string;
  ageHints?: string[];
}): string {
  const name = String(team.name || '').trim() || team.externalTeamId;
  const id = String(team.externalTeamId || '').trim();
  const age = (team.ageHints || []).filter(Boolean).join(', ');
  if (age) {
    return `${name} (${id}) ${age}`;
  }
  return `${name} (${id})`;
}

/** Filter FOGIS options by team name (case-insensitive substring). */
export function filterExternalTeamsByName(
  teams: ExternalTeamOption[],
  query: string,
): ExternalTeamOption[] {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) {
    return teams;
  }
  return teams.filter((team) =>
    String(team.name || '')
      .toLowerCase()
      .includes(q),
  );
}
