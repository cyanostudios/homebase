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

  test('exposes bySide, byDate and byPlayed chips and uses shared grouping helpers', () => {
    expect(sectionSrc).toMatch(/TeamMatchesViewMode/);
    expect(sectionSrc).toMatch(/useState<TeamMatchesViewMode>\('byDate'\)/);
    expect(sectionSrc).toMatch(/'bySide'/);
    expect(sectionSrc).toMatch(/'byDate'/);
    expect(sectionSrc).toMatch(/'byPlayed'/);
    expect(sectionSrc).toMatch(/groupTeamMatchesBySide/);
    expect(sectionSrc).toMatch(/listUpcomingMatchesByDate/);
    expect(sectionSrc).toMatch(/listPlayedMatchesByDate/);
    expect(sectionSrc).toMatch(
      /teams\.matchViewByDate[\s\S]*teams\.matchViewByPlayed[\s\S]*teams\.matchViewBySide/,
    );
    expect(sectionSrc).toMatch(/teams\.upcomingMatchesByDate/);
    expect(sectionSrc).toMatch(/teams\.playedMatchesByDate/);
    expect(sectionSrc).toMatch(/MatchStatusBadges/);
  });

  test('helpers classify home via defaultHomeTeam and support byDate/byPlayed lists', () => {
    expect(sideSrc).toMatch(/matchHomeTeamEqualsDefault/);
    expect(sideSrc).toMatch(/groupTeamMatchesBySide/);
    expect(sideSrc).toMatch(/listUpcomingMatchesByDate/);
    expect(sideSrc).toMatch(/listPlayedMatchesByDate/);
    expect(sideSrc).toMatch(/isPlayedOrPassedMatch/);
  });
});
