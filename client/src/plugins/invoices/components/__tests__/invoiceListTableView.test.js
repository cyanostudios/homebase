const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../InvoicesList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../InvoiceListTable.tsx'), 'utf8');

describe('InvoicesList table view wiring', () => {
  test('toolbar uses ListColumnLayoutToggle and always-visible sort row', () => {
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).toMatch(/InvoiceListTable/);
    expect(listSrc).toMatch(/listViewMode: 'cards'/);
    expect(listSrc).not.toMatch(/!isTableView \?/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/invoiceNumber/);
    expect(tableSrc).toMatch(/contactName/);
    expect(tableSrc).toMatch(/status/);
    expect(tableSrc).toMatch(/dueDate/);
    expect(tableSrc).toMatch(/updatedAt/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
  });

  test('settings view exists; list header owns listViewMode and passes visibleColumnIds', () => {
    expect(fs.existsSync(path.join(__dirname, '../InvoiceSettingsView.tsx'))).toBe(true);
    expect(listSrc).toMatch(/InvoiceSettingsView/);
    expect(listSrc).toMatch(/openInvoiceSettings/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/listViewMode/);
    expect(listSrc).toMatch(/resolveVisibleInvoiceTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
  });
});
