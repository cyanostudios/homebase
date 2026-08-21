const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../TeamList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../TeamListTable.tsx'), 'utf8');
const cardSrc = fs.readFileSync(path.join(__dirname, '../TeamCard.tsx'), 'utf8');
const badgesSrc = fs.readFileSync(path.join(__dirname, '../TeamSeriesTeamBadges.tsx'), 'utf8');

describe('TeamList table view wiring', () => {
  test('toolbar includes table mode control and hides sort dropdown in table mode', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)|onSelectTable/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/!isTableView/);
    expect(listSrc).toMatch(/TeamListTable/);
    expect(listSrc).toMatch(/TeamCard/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/field: 'name'/);
    expect(tableSrc).toMatch(/field: 'age_group'/);
    expect(tableSrc).toMatch(/field: 'gender'/);
    expect(tableSrc).toMatch(/field: 'status'/);
    expect(tableSrc).toMatch(/field: 'series_teams'/);
    expect(tableSrc).toMatch(/sortable: false/);
    expect(tableSrc).toMatch(/TeamSeriesTeamBadges/);
    expect(tableSrc).toMatch(/field: 'player_count'/);
    expect(tableSrc).not.toMatch(/field: 'updated_at'/);
  });

  test('card and table show all series teams via shared badges helper', () => {
    expect(badgesSrc).toMatch(/getDisplaySeriesTeams/);
    expect(badgesSrc).toMatch(/formatSeriesTeamLabel/);
    expect(badgesSrc).toMatch(/SeriesTeamBadge/);
    expect(cardSrc).toMatch(/TeamSeriesTeamBadges/);
    expect(cardSrc).not.toMatch(/teams\.seriesTeamCount/);
  });

  test('list split view previews teams on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewTeam/);
    expect(listSrc).toMatch(/TeamQuickContextPanel/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeTeamId/);
    expect(tableSrc).toMatch(/activeTeamId/);
    expect(cardSrc).toMatch(/active/);
  });
});
