const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

describe('Cups statistics content view wiring', () => {
  test('list opens statistics view and context exposes open/close', () => {
    const listSrc = fs.readFileSync(path.join(root, 'CupsList.tsx'), 'utf8');
    const contextSrc = fs.readFileSync(path.join(root, '../context/CupsContext.tsx'), 'utf8');
    const providerSrc = fs.readFileSync(path.join(root, '../context/CupsProvider.tsx'), 'utf8');
    const statsSrc = fs.readFileSync(path.join(root, 'CupsStatisticsView.tsx'), 'utf8');
    const pageviewSrc = fs.readFileSync(path.join(root, 'stats/CupPageviewStats.tsx'), 'utf8');
    const apiSrc = fs.readFileSync(path.join(root, '../api/cupsApi.ts'), 'utf8');

    expect(listSrc).toMatch(/CupsStatisticsView/);
    expect(listSrc).toMatch(/openCupStatistics/);
    expect(listSrc).toMatch(/cupsContentView === 'statistics'/);
    expect(listSrc).toMatch(/BarChart2/);

    expect(contextSrc).toMatch(/'list' \| 'settings' \| 'statistics'/);
    expect(contextSrc).toMatch(/openCupStatistics/);
    expect(contextSrc).toMatch(/closeCupStatisticsView/);

    expect(providerSrc).toMatch(/setCupsContentView\('statistics'\)/);
    expect(statsSrc).toMatch(/cups\.statistics\.title/);
    expect(statsSrc).toMatch(/periodDays/);
    expect(statsSrc).toMatch(/PERIOD_OPTIONS/);
    expect(statsSrc).toMatch(/CupPageviewStats days=\{days\}/);

    expect(pageviewSrc).toMatch(/PageviewTimeSeriesChart/);
    expect(pageviewSrc).toMatch(/RankedBarList/);
    expect(pageviewSrc).toMatch(/metricPageviews/);

    expect(apiSrc).toMatch(/getPageviewStats/);
    expect(apiSrc).toMatch(/\/cups\/stats\/pageviews/);
    expect(apiSrc).toMatch(/series:/);
    expect(apiSrc).toMatch(/cups:/);
  });
});
