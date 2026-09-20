const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../PriceListList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../PriceListListTable.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../PriceListView.tsx'), 'utf8');
const formSrc = fs.readFileSync(path.join(__dirname, '../PriceListForm.tsx'), 'utf8');
const registrySrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/pluginRegistry.ts'),
  'utf8',
);

describe('PriceListList table view wiring', () => {
  test('list supports table view with mail-style thin toolbar', () => {
    expect(listSrc).toMatch(/PriceListListTable/);
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky top-0 z-20/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/clubdesk\.priceList\.collapseToolbar/);
    expect(listSrc).toMatch(/clubdesk\.priceList\.expandToolbar/);
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
  });

  test('table uses SortableListTable with title + meta like other plugins', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/priceListIdentityMeta/);
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
    expect(tableSrc).toMatch(/text-slate-400/);
    expect(tableSrc).toMatch(/pl-6/);
    expect(tableSrc).toMatch(/text-\[10px\]/);
    expect(tableSrc).toMatch(
      /flex min-w-0 items-center gap-1\.5 pl-6[\s\S]*StatusOutlineBadge[\s\S]*text-\[10px\]/,
    );
    expect(tableSrc).toMatch(/headerBarClassName="bg-sky-50/);
    expect(tableSrc).toMatch(/subtleRowDividers/);
    expect(tableSrc).toMatch(/title/);
    expect(tableSrc).toMatch(/activePriceListId/);
    expect(tableSrc).toMatch(/isRowActive/);
    expect(tableSrc).toMatch(/selectionEnabled/);
  });

  test('list split view previews price lists on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewPriceList/);
    expect(listSrc).toMatch(/PriceListView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activePriceListId/);
    expect(listSrc).toMatch(/setPreviewPriceList\(\(current\) =>/);
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
    expect(listSrc).toMatch(/getPriceList\(listId\)/);
    expect(listSrc).toMatch(/Index rows omit `items`/);
    expect(viewSrc).toMatch(/stacked\?: boolean/);
    expect(viewSrc).toMatch(/gridClassName="grid-cols-1"/);
  });

  test('desktop create/edit renders PriceListForm in the detail column', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/PriceListForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isClubdeskPanelOpen/);
    expect(listSrc).toMatch(/activeDomain === 'priceLists'/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/closeClubdeskPanel/);
    expect(listSrc).toMatch(/stacked/);
    expect(formSrc).toMatch(/stacked\?: boolean/);
  });

  test('desktop detail card header shows PriceListDetailHeaderMenus when stacked', () => {
    expect(viewSrc).toMatch(/PriceListDetailHeaderMenus/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(listSrc).not.toMatch(/PriceListDetailHeaderMenus/);
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

  test('edit from soft preview does not bounce to view via deep-link sync', () => {
    const providerSrc = fs.readFileSync(
      path.join(__dirname, '../../context/ClubdeskProvider.tsx'),
      'utf8',
    );
    expect(providerSrc).toMatch(
      /openPriceListForEdit[\s\S]*deepLinkPathSyncedRef\.current = `\/clubdesk\/price-list\/\$\{buildSlug/,
    );
    expect(providerSrc).toMatch(/Soft-preview often has no item slug/);
    expect(providerSrc).toMatch(/Treat empty `items` with itemCount > 0 as incomplete/);
    expect(providerSrc).toMatch(/shouldKeepPendingPriceListItemPath/);
  });
});
