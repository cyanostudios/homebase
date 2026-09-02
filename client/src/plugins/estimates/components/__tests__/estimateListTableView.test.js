const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../EstimateList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../EstimateListTable.tsx'), 'utf8');

describe('EstimateList table view wiring', () => {
  test('toolbar uses ListColumnLayoutToggle and always-visible sort row', () => {
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).toMatch(/EstimateListTable/);
    expect(listSrc).toMatch(/listViewMode: 'cards'/);
    expect(listSrc).not.toMatch(/!isTableView \?/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/estimateNumber/);
    expect(tableSrc).toMatch(/contactName/);
    expect(tableSrc).toMatch(/status/);
    expect(tableSrc).toMatch(/validTo/);
    expect(tableSrc).toMatch(/updatedAt/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
  });

  test('settings view exists; list header owns listViewMode and passes visibleColumnIds', () => {
    expect(fs.existsSync(path.join(__dirname, '../EstimateSettingsView.tsx'))).toBe(true);
    expect(listSrc).toMatch(/EstimateSettingsView/);
    expect(listSrc).toMatch(/openEstimateSettings/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/listViewMode/);
    expect(listSrc).toMatch(/resolveVisibleEstimateTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
  });
});
