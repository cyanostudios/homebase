const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../InstructionList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../InstructionListTable.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(__dirname, '../InstructionSettingsView.tsx'), 'utf8');

describe('InstructionList table view wiring', () => {
  test('toolbar includes table mode control and hides sort dropdown in table mode', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/!isTableView \? \(/);
    expect(listSrc).toMatch(/InstructionListTable/);
  });

  test('persists listViewMode with columnCount when selecting cards columns', () => {
    expect(listSrc).toMatch(/listViewMode: 'cards'/);
    expect(listSrc).toMatch(/persistInstructionListViewModeSession/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/field: 'title'/);
    expect(tableSrc).toMatch(/field: 'publicationStatus'/);
    expect(tableSrc).toMatch(/field: 'updatedAt'/);
    expect(tableSrc).toMatch(/field: 'createdAt'/);
  });

  test('settings expose cards/table default list view', () => {
    expect(settingsSrc).toMatch(/common\.defaultListView/);
    expect(settingsSrc).toMatch(/common\.cardsView/);
    expect(settingsSrc).toMatch(/common\.tableView/);
    expect(settingsSrc).toMatch(/listViewMode/);
  });
});
