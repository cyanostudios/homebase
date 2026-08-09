const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskListTable.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskSettingsView.tsx'), 'utf8');
const priceListSrc = fs.readFileSync(path.join(__dirname, '../PriceListList.tsx'), 'utf8');
const priceTableSrc = fs.readFileSync(path.join(__dirname, '../PriceListListTable.tsx'), 'utf8');

describe('ClubdeskList table view wiring', () => {
  test('toolbar includes table mode control and hides sort dropdown in table mode', () => {
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/!isTableView \? \(/);
    expect(listSrc).toMatch(/ClubdeskListTable/);
  });

  test('persists listViewMode with columnCount when selecting cards columns', () => {
    expect(listSrc).toMatch(/listViewMode: 'cards'/);
    expect(listSrc).toMatch(/persistClubdeskListViewModeSession/);
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

describe('PriceListList table view wiring', () => {
  test('persists columnCount and listViewMode like ClubdeskList', () => {
    expect(priceListSrc).toMatch(/CLUBDESK_SETTINGS_KEY/);
    expect(priceListSrc).toMatch(
      /updateSettings\(CLUBDESK_SETTINGS_KEY, \{ columnCount: count, listViewMode: 'cards' \}/,
    );
    expect(priceListSrc).toMatch(/persistClubdeskListViewModeSession/);
    expect(priceListSrc).toMatch(/ListColumnLayoutToggle/);
    expect(priceListSrc).toMatch(/PriceListListTable/);
    expect(priceListSrc).toMatch(/!isTableView \? \(/);
  });

  test('table columns include currency and item count', () => {
    expect(priceTableSrc).toMatch(/SortableListTable/);
    expect(priceTableSrc).toMatch(/field: 'title'/);
    expect(priceTableSrc).toMatch(/field: 'publicationStatus'/);
    expect(priceTableSrc).toMatch(/field: 'currency'/);
    expect(priceTableSrc).toMatch(/field: 'itemCount'/);
    expect(priceTableSrc).toMatch(/field: 'updatedAt'/);
  });
});
