const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../RequestList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../RequestListTable.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../RequestView.tsx'), 'utf8');
const quickContextActionsSrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/ui/QuickContextHeaderActions.tsx'),
  'utf8',
);

describe('RequestList table view wiring', () => {
  test('list supports mail-style thin toolbar with collapsible chrome', () => {
    expect(listSrc).toMatch(/RequestListTable/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/RequestListItem/);
    expect(listSrc).not.toMatch(/setListViewMode/);
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky top-0 z-20/);
    expect(listSrc).not.toMatch(/useQuickContextPreview/);
    expect(listSrc).not.toMatch(/RequestQuickContextPanel/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/requests\.collapseToolbar/);
    expect(listSrc).toMatch(/requests\.expandToolbar/);
    expect(listSrc).toMatch(/renderFilterChips/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(listSrc).toMatch(/renderSortDropdown/);
    expect(listSrc).toMatch(/ListFilterChipsToggle/);
    expect(listSrc).toMatch(/filtersVisible/);
    expect(listSrc).toMatch(/RoundExpandableQuickAdd/);
    expect(listSrc).toMatch(/icon=\{Inbox\}/);
    expect(listSrc).toMatch(/setRecentlyQuickAddedId\(String\(request\.id\)\)/);
    expect(listSrc).toMatch(/setRecentlyQuickAddedId\(null\)/);
    expect(tableSrc).toMatch(
      /isRequestHighlighted\(request\) \|\| recentlyQuickAddedId === String\(request\.id\)/,
    );
    expect(listSrc).toMatch(/DropdownMenuRadioItem/);
    expect(listSrc).toMatch(/handlePrimarySortChange/);
    expect(listSrc).not.toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/md:hidden/);
    expect(listSrc).toMatch(/useMobileActions/);
    expect(listSrc).toMatch(/useRegisterMobileSearch/);
  });

  test('table uses SortableListTable with expected columns', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/title/);
    expect(tableSrc).toMatch(/priority/);
    expect(tableSrc).toMatch(/responseDueAt/);
    expect(tableSrc).toMatch(/field: 'source'/);
    expect(tableSrc).toMatch(/field: 'updated_at'/);
    expect(tableSrc).toMatch(/field: 'created_at'/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
    expect(tableSrc).toMatch(/subtleRowDividers/);
    expect(tableSrc).toMatch(/headerBarClassName="bg-sky-50/);
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
    expect(tableSrc).toMatch(/activeRequestId/);
    expect(tableSrc).toMatch(/selectionEnabled/);
  });

  test('list resolves and passes visible table columns from settings', () => {
    expect(listSrc).toMatch(/resolveVisibleRequestTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
  });

  test('list split view previews requests on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewRequest/);
    expect(listSrc).toMatch(/RequestView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeListRequestId/);
    expect(listSrc).toMatch(/setPreviewRequest\(\(current\) =>/);
    expect(listSrc).toMatch(/String\(current\.id\) === String\(request\.id\) \? null : request/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/grid-rows-\[minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/h-full min-h-0 overflow-y-auto overscroll-contain/);
    expect(listSrc).toMatch(
      /aside[\s\S]*h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain/,
    );
    expect(listSrc).toMatch(/RequestsStatisticsView/);
    expect(listSrc).not.toMatch(/bulkSelectionEnabled/);
    expect(viewSrc).toMatch(/stacked\?: boolean/);
    expect(viewSrc).toMatch(/gridClassName="grid-cols-1"/);
  });

  test('requests plugin registry hides shell Add and wires content view', () => {
    const registrySrc = fs.readFileSync(
      path.join(__dirname, '../../../../core/pluginRegistry.ts'),
      'utf8',
    );
    expect(registrySrc).toMatch(
      /name: 'requests'[\s\S]*?contentOwnsScroll: true[\s\S]*?contentViewKey: 'requestsContentView'[\s\S]*?noPrimaryAction: true[\s\S]*?name: 'slots'/,
    );
  });

  test('desktop create/edit renders RequestForm in the detail column', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/RequestForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/headerTrailing/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isRequestPanelOpen/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/saveRequest/);
    expect(listSrc).toMatch(/closeRequestPanel/);
    expect(listSrc).toMatch(/stacked/);
    const appContentSrc = fs.readFileSync(
      path.join(__dirname, '../../../../core/app/AppContent.tsx'),
      'utf8',
    );
    expect(appContentSrc).toMatch(/inlineDesktopPanel/);
    expect(appContentSrc).toMatch(/contentOwnsScroll/);
    expect(appContentSrc).toMatch(/isAnyPanelOpen && !inlineDesktopPanel/);
  });

  test('desktop detail card header shows RequestDetailHeaderMenus', () => {
    const quickContextSrc = fs.readFileSync(
      path.join(__dirname, '../RequestQuickContextPanel.tsx'),
      'utf8',
    );
    expect(quickContextSrc).toMatch(/RequestDetailHeaderMenus/);
    expect(quickContextSrc).toMatch(/leading=\{titleLeading\}/);
    expect(listSrc).not.toMatch(/RequestDetailHeaderMenus/);
    expect(viewSrc).toMatch(/RequestQuickContextPanel/);
  });

  test('full detail merges title header and description into one card', () => {
    const quickContextSrc = fs.readFileSync(
      path.join(__dirname, '../RequestQuickContextPanel.tsx'),
      'utf8',
    );
    expect(viewSrc).toMatch(/RequestQuickContextPanel/);
    expect(viewSrc).not.toMatch(/requests\.form\.description/);
    expect(quickContextSrc).toMatch(/RequestDetailHeaderMenus/);
    expect(quickContextSrc).toMatch(/responseDueBadge/);
    expect(quickContextSrc).toMatch(/REQUEST_PRIORITY_COLORS\[request\.priority\]/);
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

  test('quick context header actions are shared round buttons', () => {
    expect(quickContextActionsSrc).toMatch(/RoundIconLabelButton/);
    expect(quickContextActionsSrc).toMatch(/QuickContextOpenFullFooter/);
    expect(quickContextActionsSrc).toMatch(/common\.openFullProfile/);
  });

  test('list and settings leave edit via attemptNavigation', () => {
    expect(listSrc).toMatch(/attemptNavigation\(\(\) => openRequestSettings\(\)\)/);
  });
});
