const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../NoteList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../NoteListTable.tsx'), 'utf8');

describe('NoteList table view wiring', () => {
  test('toolbar includes table mode control and hides sort dropdown in table mode', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/!isTableView \? \(/);
    expect(listSrc).toMatch(/NoteListTable/);
  });

  test('table uses SortableListTable with sortable columns and selection', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/onSort=\{onSort\}/);
    expect(tableSrc).toMatch(/selection=\{/);
    expect(tableSrc).toMatch(/field: 'title'/);
    expect(tableSrc).toMatch(/field: 'mentions'/);
    expect(tableSrc).toMatch(/field: 'updatedAt'/);
    expect(tableSrc).toMatch(/field: 'createdAt'/);
  });
});
