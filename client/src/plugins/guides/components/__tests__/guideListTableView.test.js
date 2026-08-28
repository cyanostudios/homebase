const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../GuideList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../GuideListTable.tsx'), 'utf8');

describe('GuideList table view wiring', () => {
  test('toolbar uses ListColumnLayoutToggle and always-visible sort row', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)|onSelectTable/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).toMatch(/GuideListTable/);
    expect(listSrc).toMatch(/persistGuideListViewModeSession/);
    expect(listSrc).not.toMatch(/updateSettings/);
    expect(listSrc).not.toMatch(/!isTableView/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/field: 'displayName'/);
    expect(tableSrc).toMatch(/field: 'lifecycleStatus'/);
    expect(tableSrc).toMatch(/field: 'languages'/);
    expect(tableSrc).not.toMatch(/field: 'updatedAt'/);
  });
});
