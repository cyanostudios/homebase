const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../CupsList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../CupListTable.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../CupView.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(__dirname, '../CupsSettingsView.tsx'), 'utf8');
const registrySrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/pluginRegistry.ts'),
  'utf8',
);

describe('CupsList table view wiring', () => {
  test('list supports table view with mail-style thin toolbar', () => {
    expect(listSrc).toMatch(/CupListTable/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/CupListItem/);
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky top-0 z-20/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/cups\.collapseToolbar/);
    expect(listSrc).toMatch(/cups\.expandToolbar/);
    expect(listSrc).toMatch(/renderFilterChips/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(listSrc).toMatch(/renderSortDropdown/);
    expect(listSrc).toMatch(/ListFilterChipsToggle/);
    expect(listSrc).toMatch(/filtersVisible/);
    expect(listSrc).toMatch(/DropdownMenuRadioItem/);
    expect(listSrc).toMatch(/handlePrimarySortChange/);
    expect(listSrc).toMatch(/md:hidden/);
    expect(listSrc).toMatch(/useMobileActions/);
    expect(listSrc).toMatch(/useRegisterMobileSearch/);
    expect(listSrc).not.toMatch(/aria-label="Sort by"/);
  });

  test('table uses SortableListTable with name + meta like other plugins', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/cupIdentityMeta/);
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
    expect(tableSrc).toMatch(/text-slate-400/);
    expect(tableSrc).toMatch(/pl-6 text-\[10px\]/);
    expect(tableSrc).toMatch(/headerBarClassName="bg-sky-50/);
    expect(tableSrc).toMatch(/subtleRowDividers/);
    expect(tableSrc).toMatch(/name/);
    expect(tableSrc).toMatch(/ingest/);
    expect(tableSrc).toMatch(/columnDistrict/);
    expect(tableSrc).toMatch(/start_date/);
    expect(tableSrc).toMatch(/featured/);
    expect(tableSrc).toMatch(/ratings_count/);
    expect(tableSrc).toMatch(/created_at/);
    expect(tableSrc).toMatch(/updated_at/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
    expect(tableSrc).toMatch(/activeCupId/);
    expect(tableSrc).toMatch(/isRowActive/);
    expect(tableSrc).toMatch(/selectionEnabled/);
  });

  test('list loads visible columns and passes them to the table', () => {
    expect(listSrc).toMatch(/resolveVisibleCupTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
  });

  test('settings do not expose table columns UI or list view mode toggle', () => {
    expect(settingsSrc).not.toMatch(/TableColumnsSettingsSection/);
    expect(settingsSrc).not.toMatch(/id: 'columns'/);
    expect(settingsSrc).not.toMatch(/SettingsListViewModeToggle/);
    expect(settingsSrc).not.toMatch(/common\.defaultListView/);
    expect(settingsSrc).not.toMatch(/CupsViewMode/);
    expect(settingsSrc).not.toMatch(/viewMode,/);
  });

  test('list split view previews cups on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewCup/);
    expect(listSrc).toMatch(/CupView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeCupId/);
    expect(listSrc).toMatch(/setPreviewCup\(\(current\) =>/);
    expect(listSrc).toMatch(/String\(current\.id\) === String\(cup\.id\) \? null : cup/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/grid-rows-\[minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/h-full min-h-0 overflow-y-auto overscroll-contain/);
    expect(listSrc).toMatch(
      /aside[\s\S]*h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain/,
    );
    expect(listSrc).toMatch(/CupsStatisticsView/);
    expect(viewSrc).toMatch(/stacked\?: boolean/);
    expect(viewSrc).toMatch(/gridClassName={stacked \? 'grid-cols-1'/);
  });

  test('desktop create/edit renders CupForm in the detail column', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/CupForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isCupPanelOpen/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/saveCup/);
    expect(listSrc).toMatch(/closeCupPanel/);
    expect(listSrc).toMatch(/stacked/);
  });

  test('desktop detail card header shows CupDetailHeaderMenus when stacked', () => {
    expect(viewSrc).toMatch(/CupDetailHeaderMenus/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(listSrc).not.toMatch(/CupDetailHeaderMenus/);
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

  test('cups plugin registry sets contentOwnsScroll', () => {
    expect(registrySrc).toMatch(/name: 'cups'[\s\S]*contentOwnsScroll: true/);
  });
});
