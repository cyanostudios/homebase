const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../IngestSourceList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../IngestSourceListTable.tsx'), 'utf8');

describe('IngestSourceList table view wiring', () => {
  test('toolbar includes table mode control and hides sort dropdown in table mode', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)|onSelectTable/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/!isTableView/);
    expect(listSrc).toMatch(/IngestSourceListTable/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/field: 'name'/);
    expect(tableSrc).toMatch(/field: 'sourceType'/);
    expect(tableSrc).toMatch(/field: 'isActive'/);
    expect(tableSrc).toMatch(/field: 'lastFetchStatus'/);
    expect(tableSrc).toMatch(/field: 'lastFetchedAt'/);
    expect(tableSrc).toMatch(/field: 'updatedAt'/);
  });
});
