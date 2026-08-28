const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../MatchList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../MatchListTable.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(__dirname, '../MatchSettingsView.tsx'), 'utf8');

describe('MatchList table view wiring', () => {
  test('toolbar uses ListColumnLayoutToggle and always-visible sort row', () => {
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).not.toMatch(/!isTableView \?/);
    expect(listSrc).toMatch(/MatchListTable/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/start_time/);
    expect(tableSrc).toMatch(/home_team/);
    expect(tableSrc).toMatch(/away_team/);
    expect(tableSrc).toMatch(/competition_name/);
    expect(tableSrc).toMatch(/team_id/);
    expect(tableSrc).toMatch(/MatchTeamBadge/);
    expect(tableSrc).not.toMatch(/updated_at/);
  });

  test('settings do not expose list view mode toggle', () => {
    expect(settingsSrc).not.toMatch(/SettingsListViewModeToggle/);
    expect(settingsSrc).not.toMatch(/common\.defaultListView/);
    expect(settingsSrc).not.toMatch(/MatchViewMode/);
  });
});
