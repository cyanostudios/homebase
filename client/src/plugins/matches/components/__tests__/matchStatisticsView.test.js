const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

describe('Matches statistics content view wiring', () => {
  test('list opens statistics view and context exposes open/close', () => {
    const listSrc = fs.readFileSync(path.join(root, 'MatchList.tsx'), 'utf8');
    const contextSrc = fs.readFileSync(path.join(root, '../context/MatchContext.tsx'), 'utf8');
    const providerSrc = fs.readFileSync(path.join(root, '../context/MatchProvider.tsx'), 'utf8');
    const statsSrc = fs.readFileSync(path.join(root, 'MatchesStatisticsView.tsx'), 'utf8');

    expect(listSrc).toMatch(/MatchesStatisticsView/);
    expect(listSrc).toMatch(/openMatchStatistics/);
    expect(listSrc).toMatch(/matchesContentView === 'statistics'/);
    expect(listSrc).toMatch(/BarChart2/);

    expect(contextSrc).toMatch(/'list' \| 'settings' \| 'statistics'/);
    expect(contextSrc).toMatch(/openMatchStatistics/);
    expect(contextSrc).toMatch(/closeMatchStatisticsView/);

    expect(providerSrc).toMatch(/setMatchesContentView\('statistics'\)/);
    expect(statsSrc).toMatch(/matches\.statistics\.title/);
  });
});
