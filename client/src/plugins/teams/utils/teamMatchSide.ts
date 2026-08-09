import { matchHomeTeamEqualsDefault } from '@/plugins/matches/utils/matchDefaultHomeTeam';
import type { Match } from '@/plugins/matches/types/match';

export type TeamMatchesViewMode = 'bySide' | 'byDate';

export type TeamMatchSideGroups<T extends Pick<Match, 'start_time' | 'home_team'>> = {
  upcomingHome: T[];
  upcomingAway: T[];
  pastHome: T[];
  pastAway: T[];
};

/**
 * Home when match.home_team equals or continues after Matches settings
 * defaultHomeTeam (trim + case-insensitive prefix, space-separated).
 * Empty default → never home.
 */
export function isTeamHomeMatch(match: Pick<Match, 'home_team'>, defaultHomeTeam: string): boolean {
  return matchHomeTeamEqualsDefault(match.home_team, defaultHomeTeam);
}

/** Away when not classified as home against defaultHomeTeam. */
export function isTeamAwayMatch(match: Pick<Match, 'home_team'>, defaultHomeTeam: string): boolean {
  return !isTeamHomeMatch(match, defaultHomeTeam);
}

export function isUpcomingMatch(
  match: Pick<Match, 'start_time'>,
  nowMs: number = Date.now(),
): boolean {
  const date = new Date(match.start_time);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.getTime() >= nowMs;
}

/** Four-way home/away × upcoming/past split for Teams matches tab (bySide). */
export function groupTeamMatchesBySide<T extends Pick<Match, 'start_time' | 'home_team'>>(
  matches: T[],
  defaultHomeTeam: string,
  nowMs: number = Date.now(),
): TeamMatchSideGroups<T> {
  const upcomingHome: T[] = [];
  const upcomingAway: T[] = [];
  const pastHome: T[] = [];
  const pastAway: T[] = [];

  for (const match of matches) {
    const upcoming = isUpcomingMatch(match, nowMs);
    const home = isTeamHomeMatch(match, defaultHomeTeam);
    if (upcoming && home) {
      upcomingHome.push(match);
    } else if (upcoming) {
      upcomingAway.push(match);
    } else if (home) {
      pastHome.push(match);
    } else {
      pastAway.push(match);
    }
  }

  upcomingHome.sort((a, b) => a.start_time.localeCompare(b.start_time));
  upcomingAway.sort((a, b) => a.start_time.localeCompare(b.start_time));
  pastHome.sort((a, b) => b.start_time.localeCompare(a.start_time));
  pastAway.sort((a, b) => b.start_time.localeCompare(a.start_time));

  return { upcomingHome, upcomingAway, pastHome, pastAway };
}

/** Upcoming-only list sorted ascending by start_time (byDate view). */
export function listUpcomingMatchesByDate<T extends Pick<Match, 'start_time'>>(
  matches: T[],
  nowMs: number = Date.now(),
): T[] {
  return matches
    .filter((match) => isUpcomingMatch(match, nowMs))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}
