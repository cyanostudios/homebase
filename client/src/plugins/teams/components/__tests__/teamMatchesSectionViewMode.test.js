const fs = require('fs');
const path = require('path');

const sectionSrc = fs.readFileSync(path.join(__dirname, '../TeamMatchesSection.tsx'), 'utf8');
const sideSrc = fs.readFileSync(path.join(__dirname, '../../utils/teamMatchSide.ts'), 'utf8');

describe('TeamMatchesSection view mode wiring', () => {
  test('loads defaultHomeTeam from matches settings', () => {
    expect(sectionSrc).toMatch(/MATCHES_SETTINGS_KEY/);
    expect(sectionSrc).toMatch(/resolveMatchDefaultHomeTeam/);
    expect(sectionSrc).toMatch(/settingsVersion/);
  });

  test('exposes bySide and byDate chips and uses shared grouping helpers', () => {
    expect(sectionSrc).toMatch(/TeamMatchesViewMode/);
    expect(sectionSrc).toMatch(/'bySide'/);
    expect(sectionSrc).toMatch(/'byDate'/);
    expect(sectionSrc).toMatch(/groupTeamMatchesBySide/);
    expect(sectionSrc).toMatch(/listUpcomingMatchesByDate/);
    expect(sectionSrc).toMatch(/teams\.matchViewBySide/);
    expect(sectionSrc).toMatch(/teams\.matchViewByDate/);
    expect(sectionSrc).toMatch(/teams\.upcomingMatchesByDate/);
  });

  test('helpers classify home via defaultHomeTeam and support byDate upcoming list', () => {
    expect(sideSrc).toMatch(/matchHomeTeamEqualsDefault/);
    expect(sideSrc).toMatch(/groupTeamMatchesBySide/);
    expect(sideSrc).toMatch(/listUpcomingMatchesByDate/);
  });
});
