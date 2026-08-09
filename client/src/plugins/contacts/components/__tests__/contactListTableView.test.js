const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../ContactList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../ContactListTable.tsx'), 'utf8');

describe('ContactList table view wiring', () => {
  test('toolbar includes table mode control and hides sort dropdown in table mode', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)|onSelectTable/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle|Table2/);
    expect(listSrc).toMatch(/!isTableView/);
    expect(listSrc).toMatch(/ContactListTable/);
  });

  test('table renders sortable headers and checkbox column', () => {
    expect(tableSrc).toMatch(/rowBorders=\{false\}/);
    expect(tableSrc).toMatch(/onSort\(col\.field\)/);
    expect(tableSrc).toMatch(/className="w-12"/);
    expect(tableSrc).toMatch(/SORTABLE_COLUMNS/);
  });
});
