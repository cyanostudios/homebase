const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../EstimateList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../EstimateListTable.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(__dirname, '../EstimateSettingsView.tsx'), 'utf8');

describe('EstimateList table view wiring', () => {
  test('toolbar uses ListColumnLayoutToggle and table mode', () => {
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/!isTableView \?/);
    expect(listSrc).toMatch(/EstimateListTable/);
    expect(listSrc).toMatch(/listViewMode: 'cards'/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/estimateNumber/);
    expect(tableSrc).toMatch(/contactName/);
    expect(tableSrc).toMatch(/status/);
    expect(tableSrc).toMatch(/validTo/);
    expect(tableSrc).toMatch(/updatedAt/);
  });

  test('settings persist listViewMode and columnCount, not legacy viewMode for table', () => {
    expect(settingsSrc).toMatch(/listViewMode/);
    expect(settingsSrc).toMatch(/columnCount/);
    expect(settingsSrc).not.toMatch(/viewMode === 'list'/);
    expect(settingsSrc).toMatch(/common\.tableView/);
  });
});
