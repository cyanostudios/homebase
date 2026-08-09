const fs = require('fs');
const path = require('path');

const sectionSrc = fs.readFileSync(path.join(__dirname, '../SeriesTeamsSection.tsx'), 'utf8');

describe('SeriesTeamsSection whole-team responsibles', () => {
  test('includes whole-team responsibles (empty seriesTeam) on each series-team row', () => {
    expect(sectionSrc).toMatch(/wholeTeamResponsibles/);
    expect(sectionSrc).toMatch(/wholeTeam\.push\(responsible\)/);
    expect(sectionSrc).toMatch(/\[\.\.\.wholeTeamResponsibles, \.\.\.seriesResponsibles\]/);
    expect(sectionSrc).toMatch(/seriesTeamAll/);
  });
});
