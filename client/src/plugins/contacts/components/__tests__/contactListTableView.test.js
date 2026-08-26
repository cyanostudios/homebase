const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../ContactList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../ContactListTable.tsx'), 'utf8');
const quickContextActionsSrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/ui/QuickContextHeaderActions.tsx'),
  'utf8',
);

describe('ContactList table view wiring', () => {
  test('list always renders ContactListTable (no card grid or layout toggle)', () => {
    expect(listSrc).toMatch(/ContactListTable/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/ContactListItem/);
    expect(listSrc).not.toMatch(/isTableView/);
  });

  test('table renders sortable headers and checkbox column', () => {
    expect(tableSrc).toMatch(/rowBorders=\{false\}/);
    expect(tableSrc).toMatch(/onSort\(col\.field\)/);
    expect(tableSrc).toMatch(/w-8/);
    expect(tableSrc).toMatch(/SORTABLE_COLUMNS/);
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
