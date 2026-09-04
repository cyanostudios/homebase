// plugins/matches/services/__tests__/matchSeriesService.test.js

const { deriveStandingsFromMatches, mapFogisStandings } = require('../matchSeriesService');

describe('matchSeriesService', () => {
  test('deriveStandingsFromMatches builds W/D/L points and sorts by points', () => {
    const standings = deriveStandingsFromMatches(
      [
        {
          home_team: 'Sorgenfri FF',
          away_team: 'Opponent A',
          home_score: 2,
          away_score: 1,
          is_canceled: false,
          is_postponed: false,
        },
        {
          home_team: 'Opponent B',
          away_team: 'Sorgenfri FF',
          home_score: 0,
          away_score: 0,
          is_canceled: false,
          is_postponed: false,
        },
        {
          home_team: 'Opponent A',
          away_team: 'Opponent B',
          home_score: 3,
          away_score: 1,
          is_canceled: false,
          is_postponed: false,
        },
      ],
      { ownTeamNames: new Set(['Sorgenfri FF']) },
    );

    expect(standings).toHaveLength(3);
    expect(standings[0].teamName).toBe('Sorgenfri FF');
    expect(standings[0].points).toBe(4);
    expect(standings[0].position).toBe(1);
    expect(standings[0].isOwnClub).toBe(true);

    const opponentA = standings.find((r) => r.teamName === 'Opponent A');
    expect(opponentA.points).toBe(3);
    expect(opponentA.played).toBe(2);
  });

  test('deriveStandingsFromMatches skips canceled, postponed, and missing scores', () => {
    const standings = deriveStandingsFromMatches([
      {
        home_team: 'A',
        away_team: 'B',
        home_score: 1,
        away_score: 0,
        is_canceled: true,
      },
      {
        home_team: 'A',
        away_team: 'B',
        home_score: 1,
        away_score: 0,
        is_postponed: true,
      },
      {
        home_team: 'A',
        away_team: 'B',
        home_score: null,
        away_score: null,
      },
      {
        home_team: 'A',
        away_team: 'B',
        home_score: -1,
        away_score: -1,
      },
    ]);
    expect(standings).toEqual([]);
  });

  test('mapFogisStandings maps common FOGIS row shapes', () => {
    const rows = mapFogisStandings(
      {
        standings: [
          {
            position: 2,
            teamId: 99,
            teamName: 'Other',
            played: 4,
            won: 2,
            drawn: 1,
            lost: 1,
            goalsFor: 5,
            goalsAgainst: 3,
            points: 7,
          },
          {
            position: 1,
            teamId: 324323,
            teamName: 'Sorgenfri FF',
            played: 4,
            won: 3,
            drawn: 1,
            lost: 0,
            goalsFor: 8,
            goalsAgainst: 2,
            points: 10,
          },
        ],
      },
      new Set(['324323']),
      new Set(['Sorgenfri FF']),
    );

    expect(rows).toHaveLength(2);
    expect(rows[1].isOwnClub).toBe(true);
    expect(rows[1].goalDifference).toBe(6);
  });

  test('mapFogisStandings returns null when extended is empty', () => {
    expect(mapFogisStandings(null, new Set(), new Set())).toBeNull();
    expect(mapFogisStandings({ standings: [] }, new Set(), new Set())).toBeNull();
  });
});
