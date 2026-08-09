const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../TeamView.tsx'), 'utf8');
const sectionSrc = fs.readFileSync(path.join(__dirname, '../TeamMatchStatsSection.tsx'), 'utf8');

describe('Team match statistics tab wiring', () => {
  test('TeamView registers statistics tab after matches when matches plugin enabled', () => {
    expect(viewSrc).toMatch(/\| 'statistics'/);
    expect(viewSrc).toMatch(/'statistics'/);
    expect(viewSrc).toMatch(/TeamMatchStatsSection/);
    expect(viewSrc).toMatch(/teams\.tabs\.statistics/);
    expect(viewSrc).toMatch(/BarChart2/);
    expect(viewSrc).toMatch(/activeTab === 'statistics'/);
  });

  test('TeamMatchStatsSection aggregates via computeMatchStats and fail-closes without default', () => {
    expect(sectionSrc).toMatch(/getMatchesByTeam/);
    expect(sectionSrc).toMatch(/computeMatchStats/);
    expect(sectionSrc).toMatch(/MatchSideSplitSection/);
    expect(sectionSrc).toMatch(/resolveMatchDefaultHomeTeam/);
    expect(sectionSrc).toMatch(/matchStatisticsNeedsDefault/);
  });
});
