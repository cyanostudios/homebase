const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../IngestSourceList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../IngestSourceListTable.tsx'), 'utf8');

describe('IngestSourceList table view wiring', () => {
  test('toolbar uses ListColumnLayoutToggle and always-visible sort row', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)|onSelectTable/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).toMatch(/IngestSourceListTable/);
    expect(listSrc).not.toMatch(/!isTableView/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/field: 'name'/);
    expect(tableSrc).toMatch(/field: 'sourceType'/);
    expect(tableSrc).toMatch(/field: 'isActive'/);
    expect(tableSrc).toMatch(/field: 'lastFetchStatus'/);
    expect(tableSrc).toMatch(/field: 'lastFetchedAt'/);
    expect(tableSrc).not.toMatch(/field: 'updatedAt'/);
  });
});
