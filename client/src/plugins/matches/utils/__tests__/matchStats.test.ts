import type { Match } from '../../types/match';
import {
  computeMatchStats,
  isMatchStatsEligible,
  resolveClubMatchSide,
  resolveMatchScores,
  resolveTeamMatchSide,
} from '../matchStats';

function baseMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: '1',
    name: null,
    match_number: null,
    match_type: 'series',
    referee_count: 0,
    map_link: null,
    home_team: 'Sorgenfri FF',
    away_team: 'Opponent FC',
    location: null,
    start_time: '2026-03-15T12:00:00.000Z',
    sport_type: 'football',
    format: '11vs11',
    total_minutes: 90,
    contact_id: null,
    team_id: '10',
    external_id: null,
    is_external: false,
    external_source: null,
    home_score: 2,
    away_score: 1,
    result: null,
    competition_name: null,
    is_canceled: false,
    is_finished: true,
    is_postponed: false,
    mentions: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveMatchScores', () => {
  it('prefers numeric scores', () => {
    expect(resolveMatchScores({ home_score: 3, away_score: 0, result: '1-1' })).toEqual({
      home: 3,
      away: 0,
    });
  });

  it('parses result text when scores missing', () => {
    expect(resolveMatchScores({ home_score: null, away_score: null, result: '2-2' })).toEqual({
      home: 2,
      away: 2,
    });
  });
});

describe('isMatchStatsEligible', () => {
  it('rejects canceled, postponed, and unscored', () => {
    expect(isMatchStatsEligible(baseMatch({ is_canceled: true }))).toBe(false);
    expect(isMatchStatsEligible(baseMatch({ is_postponed: true }))).toBe(false);
    expect(
      isMatchStatsEligible(baseMatch({ home_score: null, away_score: null, result: null })),
    ).toBe(false);
  });

  it('accepts finished scored matches', () => {
    expect(isMatchStatsEligible(baseMatch())).toBe(true);
  });
});

describe('resolveClubMatchSide', () => {
  it('classifies home and away via defaultHomeTeam prefix', () => {
    expect(
      resolveClubMatchSide({ home_team: 'Sorgenfri FF svart', away_team: 'Other' }, 'Sorgenfri FF'),
    ).toBe('home');
    expect(
      resolveClubMatchSide(
        { home_team: 'Other', away_team: 'Sorgenfri FF orange' },
        'Sorgenfri FF',
      ),
    ).toBe('away');
    expect(resolveClubMatchSide({ home_team: 'A', away_team: 'B' }, 'Sorgenfri FF')).toBeNull();
  });
});

describe('resolveTeamMatchSide', () => {
  it('uses defaultHomeTeam for home vs away', () => {
    expect(resolveTeamMatchSide({ home_team: 'Sorgenfri FF' }, 'Sorgenfri FF')).toBe('home');
    expect(resolveTeamMatchSide({ home_team: 'Opponent' }, 'Sorgenfri FF')).toBe('away');
  });
});

describe('computeMatchStats', () => {
  it('aggregates club W/D/L, goals, points by year and side', () => {
    const matches = [
      baseMatch({
        id: 'h1',
        start_time: '2026-02-01T12:00:00.000Z',
        home_team: 'Sorgenfri FF',
        away_team: 'A',
        home_score: 2,
        away_score: 0,
        team_id: '10',
      }),
      baseMatch({
        id: 'a1',
        start_time: '2026-04-01T12:00:00.000Z',
        home_team: 'B',
        away_team: 'Sorgenfri FF',
        home_score: 1,
        away_score: 1,
        team_id: '10',
      }),
      baseMatch({
        id: 'h2',
        start_time: '2025-08-01T12:00:00.000Z',
        home_team: 'Sorgenfri FF',
        away_team: 'C',
        home_score: 0,
        away_score: 3,
        team_id: '10',
      }),
      baseMatch({
        id: 'skip',
        home_team: 'X',
        away_team: 'Y',
        home_score: 5,
        away_score: 5,
        team_id: null,
      }),
    ];

    const stats = computeMatchStats(matches, 'Sorgenfri FF', new Map([['10', 'P15']]));

    expect(stats.hasDefaultHomeTeam).toBe(true);
    expect(stats.club.overall.total).toMatchObject({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      goalsFor: 3,
      goalsAgainst: 4,
      goalDifference: -1,
      points: 4,
      winPercent: 33,
    });
    expect(stats.club.overall.home).toMatchObject({ played: 2, won: 1, lost: 1, points: 3 });
    expect(stats.club.overall.away).toMatchObject({ played: 1, drawn: 1, points: 1 });

    expect(stats.club.years.map((y) => y.year)).toEqual([2026, 2025]);
    expect(stats.club.years[0].sides.total.played).toBe(2);
    expect(stats.club.years[1].sides.total.played).toBe(1);

    expect(stats.teams).toHaveLength(1);
    expect(stats.teams[0].teamName).toBe('P15');
    expect(stats.teams[0].overall.total.played).toBe(3);
  });

  it('omits club and per-team aggregates when defaultHomeTeam is empty', () => {
    const homeWin = baseMatch({
      home_team: 'Sorgenfri FF',
      away_team: 'Opponent FC',
      home_score: 2,
      away_score: 1,
      team_id: '10',
    });
    const stats = computeMatchStats([homeWin], '', new Map([['10', 'P15']]));
    expect(stats.hasDefaultHomeTeam).toBe(false);
    expect(stats.club.overall.total.played).toBe(0);
    expect(stats.teams).toEqual([]);
  });

  it('does not count a home win as a loss when defaultHomeTeam is empty', () => {
    const homeWin = baseMatch({
      home_team: 'Sorgenfri FF',
      away_team: 'Opponent FC',
      home_score: 2,
      away_score: 1,
      team_id: '10',
    });
    const stats = computeMatchStats([homeWin], '', new Map([['10', 'P15']]));
    expect(stats.teams).toHaveLength(0);
    // Guard: if aggregation regresses to empty-default → away, a 2–1 home win
    // would appear as a loss (GF=1, GA=2). Empty teams means no silent wrong W/D/L.
    const anyLoss = stats.teams.some((t) => t.overall.total.lost > 0);
    expect(anyLoss).toBe(false);
  });
});
