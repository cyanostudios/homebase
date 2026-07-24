// plugins/matches/services/__tests__/filterGamesForTeam.test.js

const { filterGamesForTeam } = require('../matchImportService');

describe('filterGamesForTeam', () => {
  const games = [
    { homeTeamId: 10, awayTeamId: 20 },
    { homeTeamId: 30, awayTeamId: 10 },
    { homeTeamId: 40, awayTeamId: 50 },
  ];

  test('keeps games where team is home or away', () => {
    expect(filterGamesForTeam(games, '10')).toHaveLength(2);
    expect(filterGamesForTeam(games, 40)).toHaveLength(1);
  });

  test('returns empty for invalid id', () => {
    expect(filterGamesForTeam(games, 'abc')).toEqual([]);
    expect(filterGamesForTeam(games, null)).toEqual([]);
  });
});
