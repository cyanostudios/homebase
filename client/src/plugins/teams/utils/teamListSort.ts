import type { Team } from '../types/teams';

export type TeamSortField =
  | 'name'
  | 'age_group'
  | 'gender'
  | 'status'
  | 'player_count'
  | 'updated_at'
  | 'created_at';

export type TeamSortOrder = 'asc' | 'desc';

const STRING_SORT_FIELDS: TeamSortField[] = ['name', 'age_group', 'gender', 'status'];
const DATE_SORT_FIELDS: TeamSortField[] = ['updated_at', 'created_at'];

export function isTeamStringSortField(field: TeamSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

export function isTeamDateSortField(field: TeamSortField): boolean {
  return DATE_SORT_FIELDS.includes(field);
}

type TeamSortable = Pick<
  Team,
  'name' | 'age_group' | 'gender' | 'status' | 'player_count' | 'updated_at' | 'created_at'
>;

export function getTeamSortValue(team: TeamSortable, field: TeamSortField): string | number | null {
  switch (field) {
    case 'name':
      return team.name.toLowerCase();
    case 'age_group':
      return (team.age_group ?? '').toLowerCase();
    case 'gender':
      return team.gender ?? '';
    case 'status':
      return team.status;
    case 'player_count':
      return team.player_count;
    case 'updated_at':
      return team.updated_at;
    case 'created_at':
      return team.created_at;
  }
}

function toSortTime(value: string): number {
  return new Date(value).getTime();
}

/** Calendar day in local time — lets secondary sort reorder same-day items. */
function toSortDay(value: string): number {
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function compareNullableStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  order: TeamSortOrder,
): number {
  if (!a && !b) return 0;
  if (!a) return order === 'asc' ? 1 : -1;
  if (!b) return order === 'asc' ? -1 : 1;
  return order === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
}

function compareNullableTimes(
  a: string | null | undefined,
  b: string | null | undefined,
  order: TeamSortOrder,
  toTime: (v: string) => number,
): number {
  if (!a && !b) return 0;
  if (!a) return order === 'asc' ? 1 : -1;
  if (!b) return order === 'asc' ? -1 : 1;
  const aTime = toTime(a);
  const bTime = toTime(b);
  return order === 'asc' ? aTime - bTime : bTime - aTime;
}

export function compareTeamsByField(
  a: TeamSortable,
  b: TeamSortable,
  field: TeamSortField,
  order: TeamSortOrder,
): number {
  if (field === 'player_count') {
    const diff = a.player_count - b.player_count;
    return order === 'asc' ? diff : -diff;
  }
  if (isTeamDateSortField(field)) {
    const aDate = field === 'updated_at' ? a.updated_at : a.created_at;
    const bDate = field === 'updated_at' ? b.updated_at : b.created_at;
    return compareNullableTimes(aDate, bDate, order, toSortTime);
  }
  const aVal = getTeamSortValue(a, field) as string | null;
  const bVal = getTeamSortValue(b, field) as string | null;
  return compareNullableStrings(aVal, bVal, order);
}

/**
 * Primary then optional secondary; shared order for both levels.
 * When primary is a date field and secondary is set, primary is compared by
 * calendar day so secondary can reorder same-day items.
 */
export function compareTeamsTwoLevel(
  a: TeamSortable,
  b: TeamSortable,
  primary: TeamSortField,
  secondary: TeamSortField | '',
  order: TeamSortOrder,
): number {
  if (secondary && isTeamDateSortField(primary)) {
    const aDate = primary === 'updated_at' ? a.updated_at : a.created_at;
    const bDate = primary === 'updated_at' ? b.updated_at : b.created_at;
    const dayResult = compareNullableTimes(aDate, bDate, order, toSortDay);
    if (dayResult !== 0) return dayResult;
    const secondaryResult = compareTeamsByField(a, b, secondary, order);
    if (secondaryResult !== 0) return secondaryResult;
    return compareNullableTimes(aDate, bDate, order, toSortTime);
  }

  const primaryResult = compareTeamsByField(a, b, primary, order);
  if (primaryResult !== 0) return primaryResult;
  if (secondary) {
    return compareTeamsByField(a, b, secondary, order);
  }
  return 0;
}
