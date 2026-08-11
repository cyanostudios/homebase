const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../MatchList.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(__dirname, '../MatchSettingsView.tsx'), 'utf8');
const filterSrc = fs.readFileSync(path.join(__dirname, '../../utils/matchListFilter.ts'), 'utf8');
const defaultHomeSrc = fs.readFileSync(
  path.join(__dirname, '../../utils/matchDefaultHomeTeam.ts'),
  'utf8',
);

describe('MatchList default home team filter wiring', () => {
  test('settings persist defaultHomeTeam with view settings', () => {
    expect(settingsSrc).toMatch(/defaultHomeTeam/);
    expect(settingsSrc).toMatch(/resolveMatchDefaultHomeTeam/);
    expect(settingsSrc).toMatch(/matches\.defaultHomeTeam/);
  });

  test('list loads defaultHomeTeam and shows conditional homeTeam filter card', () => {
    expect(listSrc).toMatch(/resolveMatchDefaultHomeTeam/);
    expect(listSrc).toMatch(/showHomeTeamFilter/);
    expect(listSrc).toMatch(/isFilterActive\('homeTeam'\)/);
    expect(listSrc).toMatch(/md:grid-cols-5/);
    expect(listSrc).toMatch(/toggleFilter\('homeTeam'\)/);
    expect(listSrc).toMatch(/toggleMatchListFilter/);
    expect(listSrc).toMatch(/matchMatchesListFilters/);
    expect(listSrc).not.toMatch(/filterAllTeams|teamFilter/);
  });

  test('filter type includes homeTeam and uses matchHomeTeamEqualsDefault', () => {
    expect(filterSrc).toMatch(/'homeTeam'/);
    expect(defaultHomeSrc).toMatch(/matchHomeTeamEqualsDefault/);
    expect(defaultHomeSrc).toMatch(/defaultHomeTeam/);
  });
});
