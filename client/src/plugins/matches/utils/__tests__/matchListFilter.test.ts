import {
  matchIsUpcoming,
  matchIsWithinUpcomingDays,
  matchMatchesListFilter,
} from '../matchListFilter';

const NOW = Date.parse('2026-08-07T12:00:00.000Z');

describe('matchIsUpcoming', () => {
  it('returns true for future start times', () => {
    expect(matchIsUpcoming('2026-08-07T12:00:01.000Z', NOW)).toBe(true);
    expect(matchIsUpcoming('2026-08-20T10:00:00.000Z', NOW)).toBe(true);
  });

  it('returns false for past or equal start times', () => {
    expect(matchIsUpcoming('2026-08-07T12:00:00.000Z', NOW)).toBe(false);
    expect(matchIsUpcoming('2026-08-01T10:00:00.000Z', NOW)).toBe(false);
  });
});

describe('matchIsWithinUpcomingDays', () => {
  it('includes matches within the window', () => {
    expect(matchIsWithinUpcomingDays('2026-08-10T12:00:00.000Z', 7, NOW)).toBe(true);
    expect(matchIsWithinUpcomingDays('2026-08-14T12:00:00.000Z', 7, NOW)).toBe(true);
    expect(matchIsWithinUpcomingDays('2026-08-21T12:00:00.000Z', 14, NOW)).toBe(true);
  });

  it('excludes past and beyond-window matches', () => {
    expect(matchIsWithinUpcomingDays('2026-08-01T12:00:00.000Z', 7, NOW)).toBe(false);
    expect(matchIsWithinUpcomingDays('2026-08-15T12:00:01.000Z', 7, NOW)).toBe(false);
    expect(matchIsWithinUpcomingDays('2026-08-22T12:00:00.000Z', 14, NOW)).toBe(false);
  });
});

describe('matchMatchesListFilter', () => {
  const match = { start_time: '2026-08-12T15:00:00.000Z', home_team: 'AIK P16' };

  it('matches all filters for a match 5 days out', () => {
    expect(matchMatchesListFilter(match, 'all', NOW)).toBe(true);
    expect(matchMatchesListFilter(match, 'upcoming', NOW)).toBe(true);
    expect(matchMatchesListFilter(match, 'upcoming7', NOW)).toBe(true);
    expect(matchMatchesListFilter(match, 'upcoming14', NOW)).toBe(true);
  });

  it('excludes far-future matches from 7-day filter', () => {
    const far = { start_time: '2026-09-01T15:00:00.000Z', home_team: 'AIK P16' };
    expect(matchMatchesListFilter(far, 'upcoming', NOW)).toBe(true);
    expect(matchMatchesListFilter(far, 'upcoming7', NOW)).toBe(false);
    expect(matchMatchesListFilter(far, 'upcoming14', NOW)).toBe(false);
  });

  it('filters by default home team with trim and case-insensitive equality', () => {
    expect(matchMatchesListFilter(match, 'homeTeam', NOW, 'aik p16')).toBe(true);
    expect(matchMatchesListFilter(match, 'homeTeam', NOW, '  AIK P16  ')).toBe(true);
    expect(matchMatchesListFilter(match, 'homeTeam', NOW, 'Other')).toBe(false);
    expect(matchMatchesListFilter(match, 'homeTeam', NOW, '')).toBe(false);
  });
});
