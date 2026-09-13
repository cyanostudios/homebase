const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../InstructionList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../InstructionListTable.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(__dirname, '../InstructionSettingsView.tsx'), 'utf8');

describe('InstructionList table view wiring', () => {
  test('toolbar uses table-only list without layout toggle', () => {
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/InstructionListItem/);
    expect(listSrc).not.toMatch(/setListViewMode/);
    expect(listSrc).not.toMatch(/useIsEffectiveTableView/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).toMatch(/instructions\.sortBy/);
    expect(listSrc).not.toMatch(/!isTableView \? \(/);
    expect(listSrc).toMatch(/InstructionListTable/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/field: 'title'/);
    expect(tableSrc).toMatch(/field: 'publicationStatus'/);
    expect(tableSrc).not.toMatch(/field: 'updatedAt'/);
    expect(tableSrc).not.toMatch(/field: 'createdAt'/);
  });

  test('settings do not expose cards/table default list view', () => {
    expect(settingsSrc).not.toMatch(/common\.defaultListView/);
    expect(settingsSrc).not.toMatch(/SettingsListViewModeToggle/);
  });
});
