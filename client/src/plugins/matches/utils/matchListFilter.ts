import type { Match } from '../types/match';

export type MatchListFilter = 'all' | 'upcoming' | 'upcoming7' | 'upcoming14';

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

export function matchMatchesListFilter(
  match: Pick<Match, 'start_time'>,
  filter: MatchListFilter,
  nowMs: number = Date.now(),
): boolean {
  if (filter === 'all') {
    return true;
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
