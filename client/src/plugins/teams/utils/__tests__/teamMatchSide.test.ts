import {
  groupTeamMatchesBySide,
  isTeamAwayMatch,
  isTeamHomeMatch,
  isUpcomingMatch,
  listUpcomingMatchesByDate,
} from '../teamMatchSide';

const NOW = Date.parse('2026-08-09T12:00:00.000Z');

const homeUpcoming = {
  id: '1',
  home_team: 'AIK P16',
  away_team: 'Other',
  start_time: '2026-08-12T15:00:00.000Z',
};
const awayUpcoming = {
  id: '2',
  home_team: 'Other',
  away_team: 'AIK P16',
  start_time: '2026-08-11T15:00:00.000Z',
};
const homePast = {
  id: '3',
  home_team: 'AIK P16',
  away_team: 'Other',
  start_time: '2026-08-01T15:00:00.000Z',
};
const awayPast = {
  id: '4',
  home_team: 'Other',
  away_team: 'AIK P16',
  start_time: '2026-08-02T15:00:00.000Z',
};

describe('isUpcomingMatch', () => {
  it('treats future and now as upcoming', () => {
    expect(isUpcomingMatch({ start_time: '2026-08-09T12:00:00.000Z' }, NOW)).toBe(true);
    expect(isUpcomingMatch({ start_time: '2026-08-10T12:00:00.000Z' }, NOW)).toBe(true);
  });

  it('treats past as not upcoming', () => {
    expect(isUpcomingMatch({ start_time: '2026-08-09T11:59:59.000Z' }, NOW)).toBe(false);
  });
});

describe('isTeamHomeMatch / isTeamAwayMatch', () => {
  it('classifies by Matches defaultHomeTeam (trim, case-insensitive)', () => {
    const match = { home_team: '  AIK P16  ', away_team: 'Other FC' };
    expect(isTeamHomeMatch(match, 'aik p16')).toBe(true);
    expect(isTeamAwayMatch(match, 'aik p16')).toBe(false);
    expect(isTeamHomeMatch(match, 'Other FC')).toBe(false);
    expect(isTeamAwayMatch(match, 'Other FC')).toBe(true);
  });

  it('treats empty default as away for all matches', () => {
    const match = { home_team: 'AIK P16', away_team: 'Other FC' };
    expect(isTeamHomeMatch(match, '')).toBe(false);
    expect(isTeamAwayMatch(match, '')).toBe(true);
    expect(isTeamHomeMatch(match, '   ')).toBe(false);
  });
});

describe('groupTeamMatchesBySide', () => {
  it('splits into four buckets using defaultHomeTeam', () => {
    const groups = groupTeamMatchesBySide(
      [homeUpcoming, awayUpcoming, homePast, awayPast],
      'AIK P16',
      NOW,
    );
    expect(groups.upcomingHome.map((m) => m.id)).toEqual(['1']);
    expect(groups.upcomingAway.map((m) => m.id)).toEqual(['2']);
    expect(groups.pastHome.map((m) => m.id)).toEqual(['3']);
    expect(groups.pastAway.map((m) => m.id)).toEqual(['4']);
  });

  it('sorts upcoming ascending and past descending', () => {
    const laterHome = { ...homeUpcoming, id: '5', start_time: '2026-08-20T15:00:00.000Z' };
    const earlierPast = { ...homePast, id: '6', start_time: '2026-07-01T15:00:00.000Z' };
    const groups = groupTeamMatchesBySide(
      [laterHome, homeUpcoming, homePast, earlierPast],
      'AIK P16',
      NOW,
    );
    expect(groups.upcomingHome.map((m) => m.id)).toEqual(['1', '5']);
    expect(groups.pastHome.map((m) => m.id)).toEqual(['3', '6']);
  });
});

describe('listUpcomingMatchesByDate', () => {
  it('returns only upcoming matches sorted by start_time ascending', () => {
    const listed = listUpcomingMatchesByDate([homePast, homeUpcoming, awayUpcoming, awayPast], NOW);
    expect(listed.map((m) => m.id)).toEqual(['2', '1']);
  });

  it('returns empty when no upcoming matches', () => {
    expect(listUpcomingMatchesByDate([homePast, awayPast], NOW)).toEqual([]);
  });
});
