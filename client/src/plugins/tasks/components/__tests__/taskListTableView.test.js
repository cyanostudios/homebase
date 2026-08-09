const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../TaskList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../TaskListTable.tsx'), 'utf8');

describe('TaskList table view wiring', () => {
  test('toolbar includes table mode control and hides sort dropdown in table mode', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/!isTableView \? \(/);
    expect(listSrc).toMatch(/TaskListTable/);
  });

  test('table uses SortableListTable with sortable columns and selection', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/onSort=\{onSort\}/);
    expect(tableSrc).toMatch(/selection=\{\{/);
    expect(tableSrc).toMatch(/field: 'title'/);
    expect(tableSrc).toMatch(/field: 'status'/);
    expect(tableSrc).toMatch(/field: 'priority'/);
    expect(tableSrc).toMatch(/field: 'dueDate'/);
    expect(tableSrc).toMatch(/field: 'updatedAt'/);
  });
});
