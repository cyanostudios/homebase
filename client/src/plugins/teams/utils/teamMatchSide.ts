import { matchHomeTeamEqualsDefault } from '@/plugins/matches/utils/matchDefaultHomeTeam';
import type { Match } from '@/plugins/matches/types/match';

export type TeamMatchesViewMode = 'bySide' | 'byDate' | 'byPlayed';

export type TeamMatchSideGroups<T extends Pick<Match, 'start_time' | 'home_team'>> = {
  upcomingHome: T[];
  upcomingAway: T[];
  pastHome: T[];
  pastAway: T[];
};

type MatchTimingFields = Pick<Match, 'start_time' | 'is_canceled' | 'is_finished'>;

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

/**
 * Played / passed: kickoff already passed, or match closed via canceled/finished
 * (so canceled future fixtures leave Upcoming and appear under Played).
 */
export function isPlayedOrPassedMatch(
  match: MatchTimingFields,
  nowMs: number = Date.now(),
): boolean {
  if (match.is_canceled || match.is_finished) {
    return true;
  }
  return !isUpcomingMatch(match, nowMs);
}

/** Still scheduled: future kickoff and not canceled/finished. */
export function isStillUpcomingMatch(
  match: MatchTimingFields,
  nowMs: number = Date.now(),
): boolean {
  return !isPlayedOrPassedMatch(match, nowMs);
}

/** Four-way home/away × upcoming/past split for Teams matches tab (bySide). */
export function groupTeamMatchesBySide<
  T extends Pick<Match, 'start_time' | 'home_team' | 'is_canceled' | 'is_finished'>,
>(matches: T[], defaultHomeTeam: string, nowMs: number = Date.now()): TeamMatchSideGroups<T> {
  const upcomingHome: T[] = [];
  const upcomingAway: T[] = [];
  const pastHome: T[] = [];
  const pastAway: T[] = [];

  for (const match of matches) {
    const upcoming = isStillUpcomingMatch(match, nowMs);
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
export function listUpcomingMatchesByDate<T extends MatchTimingFields>(
  matches: T[],
  nowMs: number = Date.now(),
): T[] {
  return matches
    .filter((match) => isStillUpcomingMatch(match, nowMs))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/** Played/passed list sorted descending by start_time (byPlayed view). */
export function listPlayedMatchesByDate<T extends MatchTimingFields>(
  matches: T[],
  nowMs: number = Date.now(),
): T[] {
  return matches
    .filter((match) => isPlayedOrPassedMatch(match, nowMs))
    .sort((a, b) => b.start_time.localeCompare(a.start_time));
}
