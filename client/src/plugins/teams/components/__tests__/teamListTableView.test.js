const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../TeamList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../TeamListTable.tsx'), 'utf8');

describe('TeamList table view wiring', () => {
  test('toolbar includes table mode control and hides sort dropdown in table mode', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)|onSelectTable/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/!isTableView/);
    expect(listSrc).toMatch(/TeamListTable/);
    expect(listSrc).toMatch(/TeamCard/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/field: 'name'/);
    expect(tableSrc).toMatch(/field: 'age_group'/);
    expect(tableSrc).toMatch(/field: 'gender'/);
    expect(tableSrc).toMatch(/field: 'status'/);
    expect(tableSrc).toMatch(/field: 'player_count'/);
    expect(tableSrc).toMatch(/field: 'updated_at'/);
  });
});
