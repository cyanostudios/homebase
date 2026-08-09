import type { Match } from '../types/match';

export type MatchSortField =
  | 'start_time'
  | 'home_team'
  | 'away_team'
  | 'location'
  | 'competition_name'
  | 'team_id'
  | 'created_at'
  | 'updated_at';

export type MatchSortOrder = 'asc' | 'desc';

const STRING_SORT_FIELDS: MatchSortField[] = [
  'home_team',
  'away_team',
  'location',
  'competition_name',
  'team_id',
];
const DATE_SORT_FIELDS: MatchSortField[] = ['start_time', 'created_at', 'updated_at'];

export function isMatchStringSortField(field: MatchSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

export function isMatchDateSortField(field: MatchSortField): boolean {
  return DATE_SORT_FIELDS.includes(field);
}

type MatchSortable = Pick<
  Match,
  | 'home_team'
  | 'away_team'
  | 'location'
  | 'competition_name'
  | 'team_id'
  | 'start_time'
  | 'created_at'
  | 'updated_at'
>;

function resolveTeamSortName(
  teamNameById: ReadonlyMap<string, string> | Record<string, string> | undefined,
  teamId: string,
): string {
  if (!teamNameById) {
    return '';
  }
  if (teamNameById instanceof Map) {
    return teamNameById.get(teamId) ?? '';
  }
  const asRecord = teamNameById as Record<string, string>;
  return asRecord[teamId] ?? '';
}

export function getMatchSortValue(
  match: MatchSortable,
  field: MatchSortField,
  teamNameById?: ReadonlyMap<string, string> | Record<string, string>,
): string | Date | null {
  if (field === 'home_team') {
    return match.home_team.toLowerCase();
  }
  if (field === 'away_team') {
    return match.away_team.toLowerCase();
  }
  if (field === 'location') {
    return (match.location ?? '').toLowerCase();
  }
  if (field === 'competition_name') {
    return (match.competition_name ?? '').toLowerCase();
  }
  if (field === 'team_id') {
    const id = match.team_id != null ? String(match.team_id) : '';
    if (!id) {
      return '';
    }
    const name = resolveTeamSortName(teamNameById, id);
    return (name || id).toLowerCase();
  }
  if (field === 'start_time') {
    return match.start_time ? new Date(match.start_time) : null;
  }
  if (field === 'created_at') {
    return match.created_at ? new Date(match.created_at) : null;
  }
  // updated_at
  return match.updated_at ? new Date(match.updated_at) : null;
}

function toSortTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function compareNullableTimes(
  aValue: Date | string | null | undefined,
  bValue: Date | string | null | undefined,
  order: MatchSortOrder,
  toTime: (value: Date | string) => number,
): number {
  if (!aValue && !bValue) {
    return 0;
  }
  if (!aValue) {
    return order === 'asc' ? 1 : -1;
  }
  if (!bValue) {
    return order === 'asc' ? -1 : 1;
  }

  const aTime = toTime(aValue);
  const bTime = toTime(bValue);
  return order === 'asc' ? aTime - bTime : bTime - aTime;
}

export function compareMatchesByField(
  a: MatchSortable,
  b: MatchSortable,
  field: MatchSortField,
  order: MatchSortOrder,
  teamNameById?: ReadonlyMap<string, string> | Record<string, string>,
): number {
  const aValue = getMatchSortValue(a, field, teamNameById);
  const bValue = getMatchSortValue(b, field, teamNameById);

  if (isMatchStringSortField(field)) {
    if (order === 'asc') {
      return (aValue as string).localeCompare(bValue as string);
    }
    return (bValue as string).localeCompare(aValue as string);
  }

  return compareNullableTimes(aValue as Date | null, bValue as Date | null, order, toSortTime);
}
