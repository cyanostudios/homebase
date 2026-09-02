const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../SlotsList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../SlotListTable.tsx'), 'utf8');

describe('SlotsList table view wiring', () => {
  test('toolbar uses ListColumnLayoutToggle and always-visible sort row', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).not.toMatch(/!isTableView \?/);
    expect(listSrc).toMatch(/SlotListTable/);
    expect(listSrc).toMatch(/selectionEnabled=\{selectionMode\}/);
  });

  test('table uses SortableListTable with sortable columns and selection', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/onSort=\{/);
    expect(tableSrc).toMatch(/selectionEnabled/);
    expect(tableSrc).toMatch(/field: 'name'/);
    expect(tableSrc).toMatch(/field: 'category'/);
    expect(tableSrc).toMatch(/field: 'location'/);
    expect(tableSrc).toMatch(/field: 'slot_time'/);
    expect(tableSrc).toMatch(/field: 'visible'/);
    expect(tableSrc).toMatch(/field: 'booked_count'/);
    expect(tableSrc).toMatch(/field: 'created_at'/);
    expect(tableSrc).toMatch(/field: 'updated_at'/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
  });

  test('list loads visible columns and passes them to the table', () => {
    expect(listSrc).toMatch(/resolveVisibleSlotTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
    expect(listSrc).toMatch(/SlotsSettingsView/);
  });
});
