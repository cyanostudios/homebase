const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../ContactList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../ContactListTable.tsx'), 'utf8');
const quickContextActionsSrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/ui/QuickContextHeaderActions.tsx'),
  'utf8',
);

describe('ContactList table view wiring', () => {
  test('list supports card grid and table via layout toggle with always-visible sort row', () => {
    expect(listSrc).toMatch(/ContactListTable/);
    expect(listSrc).toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/ContactListItem/);
    expect(listSrc).toMatch(/isTableView/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/handlePrimarySortChange/);
    expect(listSrc).not.toMatch(/!isTableView \? \(/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/contacts\.table\.name/);
    expect(tableSrc).toMatch(/contacts\.table\.type/);
    expect(tableSrc).toMatch(/contacts\.table\.tags/);
    expect(tableSrc).toMatch(/contacts\.table\.assignable/);
    expect(tableSrc).toMatch(/contacts\.table\.time/);
    expect(tableSrc).toMatch(/selectionEnabled/);
    expect(tableSrc).toMatch(/activeContactId/);
    expect(tableSrc).not.toMatch(/contacts\.table\.updated/);
  });

  test('list split view previews contacts on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewContact/);
    expect(listSrc).toMatch(/ContactQuickContextPanel/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeContactId/);
    expect(listSrc).not.toMatch(/bulkSelectionEnabled/);
    expect(tableSrc).toMatch(/activeContactId/);
    expect(tableSrc).toMatch(/selectionEnabled/);
  });

  test('bulk select mode uses BulkActionRoundBar and keeps quick context visible', () => {
    expect(listSrc).toMatch(/BulkActionRoundBar/);
    expect(listSrc).toMatch(/selectionMode/);
    expect(listSrc).toMatch(/handleEnterSelectionMode/);
    expect(listSrc).toMatch(/handleExitSelectionMode/);
    expect(listSrc).toMatch(/selectionEnabled=\{selectionMode\}/);
    expect(listSrc).toMatch(/showQuickContext = Boolean\(previewContact\) && !isCompactViewport/);
    expect(listSrc).not.toMatch(/!selectionMode/);
  });

  test('quick context header actions are shared round buttons', () => {
    expect(quickContextActionsSrc).toMatch(/RoundIconLabelButton/);
    expect(quickContextActionsSrc).toMatch(/QuickContextOpenFullFooter/);
    expect(quickContextActionsSrc).toMatch(/common\.openFullProfile/);
  });
});
