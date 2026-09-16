const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../InvoicesList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../InvoiceListTable.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../InvoicesView.tsx'), 'utf8');

describe('InvoicesList table view wiring', () => {
  test('list supports mail-style thin toolbar with collapsible chrome', () => {
    expect(listSrc).toMatch(/InvoiceListTable/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/InvoiceListItem/);
    expect(listSrc).not.toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky top-0 z-20/);
    expect(listSrc).not.toMatch(/useQuickContextPreview/);
    expect(listSrc).not.toMatch(/InvoiceQuickContextPanel/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/invoices\.collapseToolbar/);
    expect(listSrc).toMatch(/invoices\.expandToolbar/);
    expect(listSrc).toMatch(/renderFilterChips/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(listSrc).toMatch(/renderSortDropdown/);
    expect(listSrc).toMatch(/ListFilterChipsToggle/);
    expect(listSrc).toMatch(/filtersVisible/);
    expect(listSrc).toMatch(/DropdownMenuRadioItem/);
    expect(listSrc).toMatch(/handlePrimarySortChange/);
    expect(listSrc).not.toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/md:hidden/);
    expect(listSrc).toMatch(/useMobileActions/);
    expect(listSrc).toMatch(/useRegisterMobileSearch/);
    expect(listSrc).not.toMatch(/alwaysExpanded/);
    expect(listSrc).toMatch(/BarChart2/);
    expect(listSrc).toMatch(/openInvoiceStatistics/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/invoiceNumber/);
    expect(tableSrc).toMatch(/contactName/);
    expect(tableSrc).toMatch(/text-\[10px\]/);
    expect(tableSrc).toMatch(/invoice\.contactName/);
    expect(tableSrc).toMatch(/status/);
    expect(tableSrc).toMatch(/dueDate/);
    expect(tableSrc).toMatch(/updatedAt/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
    expect(tableSrc).toMatch(/subtleRowDividers/);
  });

  test('settings view exists; list passes visibleColumnIds', () => {
    expect(fs.existsSync(path.join(__dirname, '../InvoiceSettingsView.tsx'))).toBe(true);
    expect(listSrc).toMatch(/InvoiceSettingsView/);
    expect(listSrc).toMatch(/openInvoiceSettings/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).toMatch(/resolveVisibleInvoiceTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
  });

  test('list split view previews invoices on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewInvoice/);
    expect(listSrc).toMatch(/InvoicesView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeInvoiceId/);
    expect(listSrc).toMatch(/setPreviewInvoice\(\(current\) =>/);
    expect(listSrc).toMatch(/String\(current\.id\) === String\(invoice\.id\) \? null : invoice/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/grid-rows-\[minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/h-full min-h-0 overflow-y-auto overscroll-contain/);
    expect(listSrc).toMatch(
      /aside[\s\S]*h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain/,
    );
    expect(listSrc).toMatch(/InvoicesStatisticsView/);
    expect(tableSrc).toMatch(/activeInvoiceId/);
    expect(tableSrc).toMatch(/selectionEnabled/);
    expect(viewSrc).toMatch(/stacked\?: boolean/);
    expect(viewSrc).toMatch(/gridClassName="grid-cols-1"/);
  });

  test('desktop detail card header shows InvoiceDetailHeaderMenus', () => {
    const quickContextSrc = fs.readFileSync(
      path.join(__dirname, '../InvoiceQuickContextPanel.tsx'),
      'utf8',
    );
    expect(quickContextSrc).toMatch(/InvoiceDetailHeaderMenus/);
    expect(quickContextSrc).toMatch(/leading=\{titleLeading\}/);
    expect(listSrc).not.toMatch(/InvoiceDetailHeaderMenus/);
  });

  test('desktop create/edit renders InvoicesForm in the detail column', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/InvoicesForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isInvoicesPanelOpen/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/saveInvoice/);
    expect(listSrc).toMatch(/closeInvoicesPanel/);
    expect(listSrc).toMatch(/showPreview/);
  });

  test('bulk select mode shows BulkActionRoundBar under toolbar and keeps detail column visible', () => {
    expect(listSrc).toMatch(/renderSelectControls/);
    expect(listSrc).toMatch(/renderBulkActionBar/);
    expect(listSrc).toMatch(/selectionMode/);
    expect(listSrc).toMatch(/handleEnterSelectionMode/);
    expect(listSrc).toMatch(/handleExitSelectionMode/);
    expect(listSrc).toMatch(/selectionEnabled=\{selectionMode\}/);
    expect(listSrc).toMatch(/BulkActionRoundBar/);
    expect(listSrc).toMatch(/size="xs"/);
    expect(listSrc).toMatch(/common\.clear/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/bulkRoundActions/);
  });
});
