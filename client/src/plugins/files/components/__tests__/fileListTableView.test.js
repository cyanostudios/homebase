const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../FileList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../FileListTable.tsx'), 'utf8');

describe('FileList table view wiring', () => {
  test('toolbar includes table mode control and hides sort dropdown in table mode', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)|onSelectTable/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/!isTableView/);
    expect(listSrc).toMatch(/FileListTable/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/field: 'name'/);
    expect(tableSrc).toMatch(/field: 'mimeType'/);
    expect(tableSrc).toMatch(/field: 'size'/);
    expect(tableSrc).toMatch(/field: 'updatedAt'/);
  });
});
