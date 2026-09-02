const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../RequestList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../RequestListTable.tsx'), 'utf8');

describe('RequestList table view wiring', () => {
  test('toolbar uses ListColumnLayoutToggle and session-only listViewMode', () => {
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/persistRequestListViewModeSession/);
    expect(listSrc).toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).toMatch(/RequestListTable/);
    expect(listSrc).not.toMatch(/updateSettings\(.*listViewMode/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/title/);
    expect(tableSrc).toMatch(/priority/);
    expect(tableSrc).toMatch(/responseDueAt/);
    expect(tableSrc).toMatch(/field: 'source'/);
    expect(tableSrc).toMatch(/field: 'updated_at'/);
    expect(tableSrc).toMatch(/field: 'created_at'/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
  });

  test('list resolves and passes visible table columns from settings', () => {
    expect(listSrc).toMatch(/resolveVisibleRequestTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
  });
});
