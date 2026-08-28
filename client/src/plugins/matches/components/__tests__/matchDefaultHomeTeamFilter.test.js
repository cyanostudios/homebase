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

  test('list wires homeTeam filter chips when defaultHomeTeam is set', () => {
    expect(listSrc).toMatch(/showHomeTeamFilter/);
    expect(listSrc).toMatch(/isFilterActive\('homeTeam'\)/);
    expect(listSrc).toMatch(/toggleFilter\('homeTeam'\)/);
    expect(listSrc).toMatch(/matchMatchesListFilters/);
    expect(listSrc).toMatch(/resolveMatchDefaultHomeTeam/);
    expect(listSrc).toMatch(/withoutHomeTeamFilter/);
    expect(listSrc).not.toMatch(/ListFilterStatCard/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).not.toMatch(/filterAllTeams|teamFilter/);
  });

  test('filter type includes homeTeam and uses matchHomeTeamEqualsDefault', () => {
    expect(filterSrc).toMatch(/'homeTeam'/);
    expect(defaultHomeSrc).toMatch(/matchHomeTeamEqualsDefault/);
    expect(defaultHomeSrc).toMatch(/defaultHomeTeam/);
  });
});
