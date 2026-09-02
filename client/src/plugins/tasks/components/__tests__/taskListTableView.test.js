const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../TaskList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../TaskListTable.tsx'), 'utf8');

describe('TaskList table view wiring', () => {
  test('toolbar includes table mode control and always-visible sort row', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).toMatch(/TASK_LIST_FILTER_INITIAL/);
    expect(listSrc).toMatch(/toggleFilter\('open'\)/);
    expect(listSrc).not.toMatch(/ListFilterStatCard/);
    expect(listSrc).toMatch(/TaskListTable/);
  });

  test('table uses SortableListTable with sortable columns and selection', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/onSort=\{/);
    expect(tableSrc).toMatch(/selection=\{/);
    expect(tableSrc).toMatch(/field: 'title'/);
    expect(tableSrc).toMatch(/field: 'status'/);
    expect(tableSrc).toMatch(/field: 'priority'/);
    expect(tableSrc).toMatch(/field: 'dueDate'/);
    expect(tableSrc).toMatch(/field: 'assignedTo'/);
    expect(tableSrc).toMatch(/field: 'assignedTeam'/);
    expect(tableSrc).toMatch(/field: 'updatedAt'/);
    expect(tableSrc).toMatch(/field: 'createdAt'/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
    expect(tableSrc).toMatch(/getAssignedNames/);
    expect(tableSrc).toMatch(/getAssignedTeamName/);
  });

  test('list resolves and passes visible table columns from settings', () => {
    expect(listSrc).toMatch(/resolveVisibleTaskTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
  });
});
