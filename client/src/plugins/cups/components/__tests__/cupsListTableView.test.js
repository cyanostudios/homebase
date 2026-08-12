const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../CupsList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../CupListTable.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(__dirname, '../CupsSettingsView.tsx'), 'utf8');

describe('CupsList table view wiring', () => {
  test('toolbar uses ListColumnLayoutToggle and table mode', () => {
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/!isTableView \?/);
    expect(listSrc).toMatch(/CupListTable/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/name/);
    expect(tableSrc).toMatch(/ingest/);
    expect(tableSrc).toMatch(/columnDistrict/);
    expect(tableSrc).toMatch(/start_date/);
    expect(tableSrc).toMatch(/featured/);
    expect(tableSrc).toMatch(/ratings_count/);
    expect(tableSrc).toMatch(/updatedAt/);
  });

  test('settings persist listViewMode and columnCount, not legacy viewMode for table', () => {
    expect(settingsSrc).toMatch(/listViewMode/);
    expect(settingsSrc).toMatch(/columnCount/);
    expect(settingsSrc).not.toMatch(/CupsViewMode/);
    expect(settingsSrc).not.toMatch(/viewMode,/);
    expect(settingsSrc).toMatch(/common\.tableView/);
  });
});
