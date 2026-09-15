const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskListTable.tsx'), 'utf8');
const priceListSrc = fs.readFileSync(path.join(__dirname, '../PriceListList.tsx'), 'utf8');
const priceTableSrc = fs.readFileSync(path.join(__dirname, '../PriceListListTable.tsx'), 'utf8');

describe('ClubdeskList table view wiring', () => {
  test('list is table-only with always-visible sort row', () => {
    expect(listSrc).toMatch(/ClubdeskListTable/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/ClubdeskListItem/);
    expect(listSrc).not.toMatch(/setListViewMode/);
    expect(listSrc).not.toMatch(/isTableView/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).toMatch(/clubdesk\.sortBy/);
    expect(listSrc).not.toMatch(/!isTableView/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/field: 'title'/);
    expect(tableSrc).toMatch(/field: 'publicationStatus'/);
    expect(tableSrc).not.toMatch(/field: 'updatedAt'/);
    expect(tableSrc).not.toMatch(/field: 'createdAt'/);
  });

  test('settings view removed; list header has no layout toggle', () => {
    expect(fs.existsSync(path.join(__dirname, '../ClubdeskSettingsView.tsx'))).toBe(false);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/setListViewMode/);
  });
});

describe('PriceListList table view wiring', () => {
  test('list uses mail split layout with collapsible toolbar', () => {
    expect(priceListSrc).toMatch(/PriceListListTable/);
    expect(priceListSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(priceListSrc).not.toMatch(/PriceListListItem/);
    expect(priceListSrc).toMatch(/renderFilterChips/);
    expect(priceListSrc).toMatch(/renderSortDropdown/);
    expect(priceListSrc).toMatch(/showDesktopSplit/);
    expect(priceListSrc).toMatch(/toolbarCollapsed/);
  });

  test('table uses title column with currency and item count in meta', () => {
    expect(priceTableSrc).toMatch(/SortableListTable/);
    expect(priceTableSrc).toMatch(/field: 'title'/);
    expect(priceTableSrc).toMatch(/priceListIdentityMeta/);
    expect(priceTableSrc).not.toMatch(/field: 'publicationStatus'/);
    expect(priceTableSrc).not.toMatch(/field: 'currency'/);
    expect(priceTableSrc).not.toMatch(/field: 'itemCount'/);
    expect(priceTableSrc).toMatch(/itemCount/);
    expect(priceTableSrc).toMatch(/currency/);
  });
});
