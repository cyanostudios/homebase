import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { Match } from '../types/match';

import { matchHomeTeamEqualsDefault } from './matchDefaultHomeTeam';

/** Selectable filters (excluding "all", which clears the selection). */
export type MatchListFilter = 'upcoming' | 'upcoming7' | 'upcoming14' | 'homeTeam';

/** Empty array = show all matches. Multiple filters are AND-combined. */
export type MatchListFilterSelection = MatchListFilter[];

const TIME_FILTERS = [
  'upcoming',
  'upcoming7',
  'upcoming14',
] as const satisfies readonly MatchListFilter[];

export const MATCH_LIST_FILTER_EXCLUSIVE_GROUPS = [TIME_FILTERS] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function matchIsUpcoming(startTime: string, nowMs: number = Date.now()): boolean {
  const time = new Date(startTime).getTime();
  return Number.isFinite(time) && time > nowMs;
}

export function matchIsWithinUpcomingDays(
  startTime: string,
  days: number,
  nowMs: number = Date.now(),
): boolean {
  const time = new Date(startTime).getTime();
  if (!Number.isFinite(time) || time <= nowMs) {
    return false;
  }
  return time <= nowMs + days * DAY_MS;
}

export function matchMatchesSingleFilter(
  match: Pick<Match, 'start_time' | 'home_team'>,
  filter: MatchListFilter,
  nowMs: number = Date.now(),
  defaultHomeTeam: string = '',
): boolean {
  if (filter === 'homeTeam') {
    return matchHomeTeamEqualsDefault(match.home_team, defaultHomeTeam);
  }
  if (filter === 'upcoming') {
    return matchIsUpcoming(match.start_time, nowMs);
  }
  if (filter === 'upcoming7') {
    return matchIsWithinUpcomingDays(match.start_time, 7, nowMs);
  }
  if (filter === 'upcoming14') {
    return matchIsWithinUpcomingDays(match.start_time, 14, nowMs);
  }
  return true;
}

/** AND across selected filters. Empty selection = all matches. */
export function matchMatchesListFilters(
  match: Pick<Match, 'start_time' | 'home_team'>,
  filters: MatchListFilterSelection,
  nowMs: number = Date.now(),
  defaultHomeTeam: string = '',
): boolean {
  return itemMatchesListFilters(match, filters, (item, filter) =>
    matchMatchesSingleFilter(item, filter, nowMs, defaultHomeTeam),
  );
}

/** @deprecated Prefer matchMatchesListFilters; kept for single-filter call sites/tests. */
export function matchMatchesListFilter(
  match: Pick<Match, 'start_time' | 'home_team'>,
  filter: MatchListFilter | 'all',
  nowMs: number = Date.now(),
  defaultHomeTeam: string = '',
): boolean {
  if (filter === 'all') {
    return true;
  }
  return matchMatchesSingleFilter(match, filter, nowMs, defaultHomeTeam);
}

/**
 * Toggle a filter for multi-select.
 * Time windows replace each other; homeTeam toggles independently.
 */
export function toggleMatchListFilter(
  current: MatchListFilterSelection,
  filter: MatchListFilter,
): MatchListFilterSelection {
  return toggleListFilterSelection(current, filter, MATCH_LIST_FILTER_EXCLUSIVE_GROUPS);
}

export function withoutHomeTeamFilter(current: MatchListFilterSelection): MatchListFilterSelection {
  return current.filter((item) => item !== 'homeTeam');
}
