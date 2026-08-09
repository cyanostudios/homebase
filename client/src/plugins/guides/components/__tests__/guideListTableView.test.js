const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../GuideList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../GuideListTable.tsx'), 'utf8');

describe('GuideList table view wiring', () => {
  test('toolbar includes table mode control and hides sort dropdown in table mode', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)|onSelectTable/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/!isTableView/);
    expect(listSrc).toMatch(/GuideListTable/);
    expect(listSrc).toMatch(/persistGuideListViewModeSession/);
    expect(listSrc).not.toMatch(/updateSettings/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/field: 'displayName'/);
    expect(tableSrc).toMatch(/field: 'lifecycleStatus'/);
    expect(tableSrc).toMatch(/field: 'languages'/);
    expect(tableSrc).toMatch(/field: 'updatedAt'/);
  });
});
