import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import { isTeamOnBreak, type SeasonBreak, type TeamStatus } from '../types/teams';

/** Selectable status filters (no All card; empty selection = all). */
export type TeamListFilter = 'active' | 'break' | 'dormant';

/** Empty array = show all teams. Status filters are exclusive. */
export type TeamListFilterSelection = TeamListFilter[];

const STATUS_FILTERS = ['active', 'break', 'dormant'] as const satisfies readonly TeamListFilter[];

export const TEAM_LIST_FILTER_EXCLUSIVE_GROUPS = [STATUS_FILTERS] as const;

export function teamMatchesSingleFilter(
  team: { status?: TeamStatus | string; season_breaks?: SeasonBreak[] },
  filter: TeamListFilter,
): boolean {
  if (filter === 'break') {
    return isTeamOnBreak(team);
  }
  return team.status === filter;
}

/** AND across selected filters. Empty selection = all teams. */
export function teamMatchesListFilters(
  team: { status?: TeamStatus | string; season_breaks?: SeasonBreak[] },
  filters: TeamListFilterSelection,
): boolean {
  return itemMatchesListFilters(team, filters, teamMatchesSingleFilter);
}

export function toggleTeamListFilter(
  current: TeamListFilterSelection,
  filter: TeamListFilter,
): TeamListFilterSelection {
  return toggleListFilterSelection(current, filter, TEAM_LIST_FILTER_EXCLUSIVE_GROUPS);
}
