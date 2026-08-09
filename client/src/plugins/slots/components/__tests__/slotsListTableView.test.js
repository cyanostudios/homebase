const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../SlotsList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../SlotListTable.tsx'), 'utf8');

describe('SlotsList table view wiring', () => {
  test('toolbar includes table mode control and hides sort dropdown in table mode', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/!isTableView \? \(/);
    expect(listSrc).toMatch(/SlotListTable/);
  });

  test('table uses SortableListTable with sortable columns and selection', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/onSort=\{onSort\}/);
    expect(tableSrc).toMatch(/selection=\{\{/);
    expect(tableSrc).toMatch(/field: 'name'/);
    expect(tableSrc).toMatch(/field: 'category'/);
    expect(tableSrc).toMatch(/field: 'location'/);
    expect(tableSrc).toMatch(/field: 'slot_time'/);
    expect(tableSrc).toMatch(/field: 'visible'/);
    expect(tableSrc).toMatch(/field: 'booked_count'/);
    expect(tableSrc).toMatch(/field: 'updatedAt'/);
  });
});
