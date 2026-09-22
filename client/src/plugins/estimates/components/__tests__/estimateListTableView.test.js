const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../EstimateList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../EstimateListTable.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../EstimateView.tsx'), 'utf8');
const formSrc = fs.readFileSync(path.join(__dirname, '../EstimateForm.tsx'), 'utf8');

describe('EstimateList table view wiring', () => {
  test('list supports mail-style thin toolbar with collapsible chrome', () => {
    expect(listSrc).toMatch(/EstimateListTable/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/EstimateListItem/);
    expect(listSrc).not.toMatch(/isTableView/);
    expect(listSrc).not.toMatch(/setListViewMode|listViewModeState|resolveEstimateListViewMode/);
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky top-0 z-20/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/estimates\.collapseToolbar/);
    expect(listSrc).toMatch(/estimates\.expandToolbar/);
    expect(listSrc).toMatch(/renderFilterChips/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(listSrc).toMatch(/renderSortDropdown/);
    expect(listSrc).toMatch(/ListFilterChipsToggle/);
    expect(listSrc).toMatch(/filtersVisible/);
    expect(listSrc).toMatch(/DropdownMenuRadioItem/);
    expect(listSrc).not.toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/md:hidden/);
    expect(listSrc).toMatch(/useMobileActions/);
    expect(listSrc).toMatch(/useRegisterMobileSearch/);
  });

  test('table uses SortableListTable with expected columns and soft sky header', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/estimateNumber/);
    expect(tableSrc).toMatch(/contactName/);
    expect(tableSrc).toMatch(/status/);
    expect(tableSrc).toMatch(/validTo/);
    expect(tableSrc).toMatch(/updatedAt/);
    expect(tableSrc).toMatch(/common\.updated/);
    expect(tableSrc).toMatch(/formatDateTimeShort\(estimate\.updatedAt\)/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
    expect(tableSrc).toMatch(/headerBarClassName="bg-sky-50/);
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
    expect(tableSrc).toMatch(/text-slate-400/);
    expect(tableSrc).toMatch(/formatInvoiceMoney/);
    expect(tableSrc).toMatch(/activeEstimateId/);
    expect(tableSrc).toMatch(/selectionEnabled/);
  });

  test('list resolves and passes visible table columns from settings', () => {
    expect(fs.existsSync(path.join(__dirname, '../EstimateSettingsView.tsx'))).toBe(true);
    expect(listSrc).toMatch(/EstimateSettingsView/);
    expect(listSrc).toMatch(/openEstimateSettings/);
    expect(listSrc).not.toMatch(/renderCategoryButtonsInline/);
    expect(listSrc).toMatch(/resolveVisibleEstimateTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
  });

  test('list split view previews estimates on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewEstimate/);
    expect(listSrc).toMatch(/EstimateView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeListEstimateId/);
    expect(listSrc).toMatch(/setPreviewEstimate\(\(current\) =>/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/grid-rows-\[minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/EstimatesStatisticsView/);
    expect(viewSrc).toMatch(/stacked\?: boolean/);
    expect(viewSrc).toMatch(/EstimateQuickContextPanel/);
    expect(viewSrc).toMatch(/headerBelow=\{tabChips\}/);
  });

  test('desktop create/edit renders EstimateForm in the detail column', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/EstimateForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isEstimatePanelOpen/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/saveEstimate/);
    expect(listSrc).toMatch(/closeEstimatePanel/);
    expect(listSrc).toMatch(/stacked/);
    expect(formSrc).toMatch(/stacked\?: boolean/);
    expect(formSrc).toMatch(/grid-cols-1/);
  });

  test('bulk select mode shows BulkActionRoundBar under toolbar and keeps detail column visible', () => {
    expect(listSrc).toMatch(/renderSelectControls/);
    expect(listSrc).toMatch(/renderBulkActionBar/);
    expect(listSrc).toMatch(/selectionMode/);
    expect(listSrc).toMatch(/selectionEnabled=\{selectionMode\}/);
    expect(listSrc).toMatch(/BulkActionRoundBar/);
    expect(listSrc).toMatch(/size="xs"/);
    expect(listSrc).toMatch(/common\.clear/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/bulkRoundActions/);
  });
});
