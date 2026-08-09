const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../MatchList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../MatchListTable.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(__dirname, '../MatchSettingsView.tsx'), 'utf8');

describe('MatchList table view wiring', () => {
  test('toolbar uses ListColumnLayoutToggle and table mode', () => {
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/!isTableView \?/);
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

  test('settings persist listViewMode and columnCount, not legacy grid/list for table', () => {
    expect(settingsSrc).toMatch(/listViewMode/);
    expect(settingsSrc).toMatch(/columnCount/);
    expect(settingsSrc).not.toMatch(/MatchViewMode/);
    expect(settingsSrc).toMatch(/common\.tableView/);
  });
});
