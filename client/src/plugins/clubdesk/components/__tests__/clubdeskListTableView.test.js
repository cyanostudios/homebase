const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskListTable.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskView.tsx'), 'utf8');
const formSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskForm.tsx'), 'utf8');
const providerSrc = fs.readFileSync(
  path.join(__dirname, '../../context/ClubdeskProvider.tsx'),
  'utf8',
);
const registrySrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/pluginRegistry.ts'),
  'utf8',
);

describe('ClubdeskGuidesList table view wiring', () => {
  test('list supports mail-style thin toolbar with collapsible portal toggle', () => {
    expect(listSrc).toMatch(/ClubdeskListTable/);
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky top-0 z-20/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/homebase\.clubdesk\.guides\.toolbar\.filtersVisible/);
    expect(listSrc).toMatch(/clubdesk\.collapseToolbar/);
    expect(listSrc).toMatch(/clubdesk\.expandToolbar/);
    expect(listSrc).toMatch(/clubdesk-guides-mail-toolbar/);
    expect(listSrc).toMatch(/nav\.clubdesk-guides/);
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
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/ClubdeskListItem/);
    expect(listSrc).not.toMatch(/setListViewMode/);
    expect(listSrc).not.toMatch(/isTableView/);
  });

  test('filter chips include draft/published and category filters', () => {
    expect(listSrc).toMatch(/toggleFilter\('draft'\)/);
    expect(listSrc).toMatch(/toggleFilter\('published'\)/);
    expect(listSrc).toMatch(/categoryFilter/);
    expect(listSrc).toMatch(/UNCATEGORIZED_FILTER/);
    expect(listSrc).toMatch(/Tag className/);
  });

  test('table uses SortableListTable with title + meta like price list', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/clubdeskIdentityMeta/);
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
    expect(tableSrc).toMatch(/ListOrdered/);
    expect(tableSrc).toMatch(/text-slate-400/);
    expect(tableSrc).toMatch(/pl-6/);
    expect(tableSrc).toMatch(/text-\[10px\]/);
    expect(tableSrc).toMatch(
      /flex min-w-0 items-center gap-1\.5 pl-6[\s\S]*font-extrabold leading-tight[\s\S]*text-\[10px\]/,
    );
    expect(tableSrc).toMatch(/headerBarClassName="bg-sky-50/);
    expect(tableSrc).toMatch(/subtleRowDividers/);
    expect(tableSrc).toMatch(/title/);
    expect(tableSrc).toMatch(/activeClubdeskId/);
    expect(tableSrc).toMatch(/isRowActive/);
    expect(tableSrc).toMatch(/selectionEnabled/);
    expect(tableSrc).not.toMatch(/field: 'publicationStatus'/);
    expect(tableSrc).toMatch(/stepCount/);
  });

  test('list split view previews guides on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewClubdesk/);
    expect(listSrc).toMatch(/ClubdeskView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeClubdeskId/);
    expect(listSrc).toMatch(/setPreviewClubdesk\(\(current\) =>/);
    expect(listSrc).toMatch(/String\(current\.id\) === String\(item\.id\) \? null : item/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/grid-rows-\[minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/h-full min-h-0 overflow-y-auto overscroll-contain/);
    expect(listSrc).toMatch(
      /aside[\s\S]*h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain/,
    );
    expect(listSrc).toMatch(/quickContext\.emptyTitle/);
    expect(listSrc).toMatch(/clubdeskApi/);
    expect(listSrc).toMatch(/getClubdesk\(/);
    expect(listSrc).toMatch(/Index rows omit `steps`/);
    expect(viewSrc).toMatch(/stacked\?: boolean/);
    expect(viewSrc).toMatch(/gridClassName=\{stacked \? 'grid-cols-1' : undefined\}/);
  });

  test('desktop create/edit renders ClubdeskForm in the detail column', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/ClubdeskForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isClubdeskPanelOpen/);
    expect(listSrc).toMatch(/activeDomain === 'guides'/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/closeClubdeskPanel/);
    expect(listSrc).toMatch(/stacked/);
    expect(formSrc).toMatch(/stacked\?: boolean/);
  });

  test('stacked ClubdeskForm hides bottom Cancel/Save footer', () => {
    expect(formSrc).toMatch(/!stacked \?/);
    expect(formSrc).toMatch(/h-9 px-3 text-xs/);
  });

  test('desktop detail card header shows ClubdeskDetailHeaderMenus when stacked', () => {
    expect(viewSrc).toMatch(/ClubdeskDetailHeaderMenus/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(listSrc).not.toMatch(/ClubdeskDetailHeaderMenus/);
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

  test('clubdesk plugin registry sets contentOwnsScroll', () => {
    expect(registrySrc).toMatch(/name: 'clubdesk'[\s\S]*contentOwnsScroll: true/);
  });

  test('router still switches price-list and info without breaking guides list', () => {
    expect(listSrc).toMatch(/clubdesk-price-list/);
    expect(listSrc).toMatch(/clubdesk-inventory/);
    expect(listSrc).toMatch(/PriceListList/);
    expect(listSrc).toMatch(/InventoryList/);
    expect(listSrc).toMatch(/clubdesk-info/);
    expect(listSrc).toMatch(/ClubdeskInfoView/);
    expect(listSrc).toMatch(/ClubdeskGuidesList/);
  });

  test('edit from soft preview does not bounce to view via deep-link sync', () => {
    const providerSrc = fs.readFileSync(
      path.join(__dirname, '../../context/ClubdeskProvider.tsx'),
      'utf8',
    );
    const routesSrc = fs.readFileSync(
      path.join(__dirname, '../../../../core/routing/clubdeskRoutes.ts'),
      'utf8',
    );
    expect(providerSrc).toMatch(
      /openClubdeskForEdit[\s\S]*deepLinkPathSyncedRef\.current = `\/clubdesk\/\$\{buildSlug/,
    );
    expect(providerSrc).toMatch(/Soft-preview often has no item slug/);
    expect(providerSrc).toMatch(/shouldKeepPendingGuideItemPath/);
    expect(providerSrc).toMatch(/guidePanelModeRef/);
    expect(routesSrc).toMatch(/shouldKeepPendingGuideItemPath/);
  });

  test('settings view and dead settings API are gone; list header has no layout toggle', () => {
    expect(fs.existsSync(path.join(__dirname, '../ClubdeskSettingsView.tsx'))).toBe(false);
    expect(providerSrc).not.toMatch(/openClubdeskSettings/);
    expect(providerSrc).not.toMatch(/clubdeskContentView/);
    expect(providerSrc).not.toMatch(/ClubdeskSettingsTab/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/setListViewMode/);
  });
});
