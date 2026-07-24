// plugins/teams/services/__tests__/externalTeamOptionsService.test.js

const { aggregateExternalTeams, extractAgeHints } = require('../externalTeamOptionsService');

describe('extractAgeHints', () => {
  test('extracts F/P/U codes from competition text', () => {
    expect(extractAgeHints('Damjuniorer F16 Div 1 Skåne')).toEqual(['F16']);
    expect(extractAgeHints('P17 Division 2', 'friendly U15 cup')).toEqual(['P17', 'U15']);
    expect(extractAgeHints('Senior herr')).toEqual([]);
  });
});

describe('aggregateExternalTeams', () => {
  test('collects unique teams with per-game matchCount', () => {
    const games = [
      {
        homeTeamId: 10,
        homeTeamName: 'Alpha',
        awayTeamId: 20,
        awayTeamName: 'Beta',
      },
      {
        homeTeamId: 20,
        homeTeamName: 'Beta',
        awayTeamId: 30,
        awayTeamName: 'Gamma',
      },
      {
        homeTeamId: 10,
        homeTeamName: 'Alpha',
        awayTeamId: 30,
        awayTeamName: 'Gamma',
      },
    ];

    const result = aggregateExternalTeams(games);
    expect(result).toEqual([
      { externalTeamId: '10', name: 'Alpha', matchCount: 2, ageHints: [] },
      { externalTeamId: '20', name: 'Beta', matchCount: 2, ageHints: [] },
      { externalTeamId: '30', name: 'Gamma', matchCount: 2, ageHints: [] },
    ]);
  });

  test('collects ageHints from competitionCategoryName', () => {
    const games = [
      {
        homeTeamId: 324323,
        homeTeamName: 'Sorgenfri FF',
        awayTeamId: 99,
        awayTeamName: 'Other',
        competitionCategoryName: 'F16 Div 1 Skåne',
      },
      {
        homeTeamId: 324323,
        homeTeamName: 'Sorgenfri FF',
        awayTeamId: 100,
        awayTeamName: 'Another',
        competitionName: 'Cup F16',
      },
    ];

    const result = aggregateExternalTeams(games);
    const sorgenfri = result.find((row) => row.externalTeamId === '324323');
    expect(sorgenfri).toEqual({
      externalTeamId: '324323',
      name: 'Sorgenfri FF',
      matchCount: 2,
      ageHints: ['F16'],
    });
  });

  test('counts a team once per game even if duplicated on both sides', () => {
    const games = [
      {
        homeTeamId: 5,
        homeTeamName: 'Solo',
        awayTeamId: 5,
        awayTeamName: 'Solo',
      },
    ];
    expect(aggregateExternalTeams(games)).toEqual([
      { externalTeamId: '5', name: 'Solo', matchCount: 1, ageHints: [] },
    ]);
  });

  test('skips missing ids and sorts by name', () => {
    const games = [
      { homeTeamId: null, homeTeamName: 'X', awayTeamId: 2, awayTeamName: 'Zulu' },
      { homeTeamId: 1, homeTeamName: 'Alpha', awayTeamId: '', awayTeamName: 'Nope' },
    ];
    expect(aggregateExternalTeams(games)).toEqual([
      { externalTeamId: '1', name: 'Alpha', matchCount: 1, ageHints: [] },
      { externalTeamId: '2', name: 'Zulu', matchCount: 1, ageHints: [] },
    ]);
  });

  test('handles empty input', () => {
    expect(aggregateExternalTeams([])).toEqual([]);
    expect(aggregateExternalTeams(null)).toEqual([]);
  });
});
