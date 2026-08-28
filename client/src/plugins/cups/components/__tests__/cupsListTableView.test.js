const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../CupsList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../CupListTable.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(__dirname, '../CupsSettingsView.tsx'), 'utf8');

describe('CupsList table view wiring', () => {
  test('toolbar uses ListColumnLayoutToggle and always-visible sort row', () => {
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).not.toMatch(/!isTableView \?/);
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
    expect(tableSrc).not.toMatch(/updatedAt/);
  });

  test('settings do not expose list view mode toggle', () => {
    expect(settingsSrc).not.toMatch(/SettingsListViewModeToggle/);
    expect(settingsSrc).not.toMatch(/common\.defaultListView/);
    expect(settingsSrc).not.toMatch(/CupsViewMode/);
    expect(settingsSrc).not.toMatch(/viewMode,/);
  });
});
