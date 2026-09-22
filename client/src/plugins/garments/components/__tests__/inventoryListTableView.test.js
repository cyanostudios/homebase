const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../GarmentList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../InventoryListTable.tsx'), 'utf8');
const listTableSrc = fs.readFileSync(path.join(__dirname, '../GarmentListTable.tsx'), 'utf8');
const panelSrc = fs.readFileSync(path.join(__dirname, '../InventoryQuickContextPanel.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../GarmentView.tsx'), 'utf8');
const formSrc = fs.readFileSync(path.join(__dirname, '../GarmentForm.tsx'), 'utf8');

describe('Garment inventory list split view wiring', () => {
  test('garment list is table-only without layout toggle', () => {
    expect(listSrc).toMatch(/GarmentListTable/);
    expect(listSrc).toMatch(/InventoryListTable/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/GarmentListItem/);
    expect(listSrc).not.toMatch(/InventoryListItem/);
    expect(listSrc).not.toMatch(/setListViewMode/);
    expect(listSrc).not.toMatch(/isTableView/);
  });

  test('list supports mail-style thin toolbar with collapsible chrome', () => {
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky top-0 z-20/);
    expect(listSrc).not.toMatch(/useQuickContextPreview/);
    expect(listSrc).not.toMatch(/InventoryQuickContextPanel/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/garments\.collapseToolbar/);
    expect(listSrc).toMatch(/garments\.expandToolbar/);
    expect(listSrc).toMatch(/renderSortDropdown/);
    expect(listSrc).toMatch(/ListFilterChipsToggle/);
    expect(listSrc).toMatch(/filtersVisible/);
    expect(listSrc).toMatch(/DropdownMenuRadioItem/);
    expect(listSrc).not.toMatch(/aria-label="Sort by"/);
  });

  test('inventory list previews items on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewInventory/);
    expect(listSrc).toMatch(/previewList/);
    expect(listSrc).toMatch(/GarmentView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).toMatch(/handleInventoryRowActivate/);
    expect(listSrc).toMatch(/handleListRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/grid-rows-\[minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/h-full min-h-0 overflow-y-auto overscroll-contain/);
    expect(listSrc).toMatch(
      /aside[\s\S]*h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain/,
    );
    expect(listSrc).toMatch(/GarmentsStatisticsView/);
    // Soft-selected lists hydrate via refreshGarmentList so PersonMatrix is not empty
    // (index omits persons) and person PATCH/optimistic updates reach the preview.
    expect(listSrc).toMatch(/refreshGarmentList/);
    expect(listSrc).toMatch(/Array\.isArray\(previewList\.persons\)/);
    expect(listSrc).toMatch(/persons: undefined/);
    expect(listSrc).toMatch(/persons: current\.persons/);
    expect(viewSrc).toMatch(/PersonMatrix key=\{list\.id\}/);
    expect(tableSrc).toMatch(/activeInventoryId/);
    expect(tableSrc).toMatch(/selectionEnabled/);
    expect(listTableSrc).toMatch(/activeListId/);
    expect(listSrc).toMatch(/recentlyDuplicatedInventoryId/);
    expect(tableSrc).toMatch(/recentlyDuplicatedInventoryId/);
  });

  test('tables use soft sky headers and category icons', () => {
    expect(tableSrc).toMatch(/headerBarClassName="bg-sky-50 dark:bg-sky-950\/40"/);
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
    expect(listTableSrc).toMatch(/headerBarClassName="bg-sky-50 dark:bg-sky-950\/40"/);
    expect(listTableSrc).toMatch(/SectionCategoryIcon/);
  });

  test('garment lists table shows team and person count as identity meta', () => {
    expect(listTableSrc).toMatch(/garmentListIdentityMeta/);
    expect(listTableSrc).toMatch(/personCount/);
    expect(listTableSrc).toMatch(/teamId/);
    expect(listTableSrc).not.toMatch(/field: 'teamId'/);
    expect(listTableSrc).not.toMatch(/field: 'personCount'/);
    expect(listSrc).toMatch(/teamId.*garments\.team|garments\.team[\s\S]*teamId/);
  });

  test('inventory table shows brand, qty, and recommended price as identity meta', () => {
    expect(tableSrc).toMatch(/inventoryIdentityMeta/);
    expect(tableSrc).toMatch(/garments\.qty/);
    expect(tableSrc).toMatch(/recommendedPrice/);
    expect(tableSrc).toMatch(/item\.brand/);
    expect(tableSrc).toMatch(/pl-7 text-\[10px\]/);
    expect(tableSrc).not.toMatch(/recommendedPriceShort/);
  });

  test('person matrix shows created under name and sorts by createdAt', () => {
    const matrixSrc = fs.readFileSync(path.join(__dirname, '../PersonMatrix.tsx'), 'utf8');
    expect(matrixSrc).toMatch(/formatDate\(person\.createdAt\)/);
    expect(matrixSrc).toMatch(/'createdAt'/);
    expect(matrixSrc).toMatch(/handleHeaderSort\('createdAt'\)/);
  });

  test('desktop detail uses stacked view with header menus on inventory full variant', () => {
    expect(viewSrc).toMatch(/stacked\?: boolean/);
    expect(viewSrc).toMatch(/InventoryQuickContextPanel/);
    expect(panelSrc).toMatch(/InventoryDetailHeaderMenus/);
    expect(panelSrc).toMatch(/leading=\{titleLeading\}/);
    expect(panelSrc).toMatch(/useSearchParams/);
    expect(panelSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(panelSrc).toMatch(/'information'/);
    expect(panelSrc).toMatch(/value === 'properties'/);
    expect(panelSrc).not.toMatch(/id: 'properties'/);
    expect(panelSrc).toMatch(/'variants'/);
    expect(panelSrc).toMatch(/'lists'/);
    expect(panelSrc).toMatch(/'activity'/);
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/GarmentForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/headerTrailing/);
    expect(listSrc).toMatch(/isGarmentPanelOpen/);
    expect(formSrc).toMatch(/stacked\?: boolean/);
    expect(formSrc).toMatch(/headerTrailing\?:/);
    expect(formSrc).toMatch(/gridClassName="grid-cols-1"/);
    expect(formSrc).toMatch(/INVENTORY_FORM_EDIT_DISABLED_TABS/);
    expect(formSrc).toMatch(/inventoryFormHeader/);
    expect(formSrc).toMatch(/listFormHeader/);
    expect(formSrc).not.toMatch(/leftSidebar/);
    expect(formSrc).not.toMatch(/inventoryLeftSidebar/);
  });

  test('inventory quick context can assign item to lists', () => {
    expect(panelSrc).toMatch(/InventoryListAssignmentCheckboxes/);
    expect(panelSrc).toMatch(/embedded/);
  });

  test('quick context and form support variants with editable quantity', () => {
    expect(panelSrc).toMatch(/onVariantQuantityChange/);
    expect(formSrc).toMatch(/addVariant/);
    expect(tableSrc).toMatch(/totalQuantity/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
    expect(listSrc).toMatch(/resolveVisibleInventoryTableColumns/);
  });

  test('inventory bulk select supports list visibility like contacts assignable', () => {
    expect(listSrc).toMatch(/BulkActionRoundBar/);
    expect(listSrc).toMatch(/InventoryBulkListsDialog/);
    expect(listSrc).toMatch(/bulkListsAction/);
    expect(listSrc).toMatch(/assignInventoryItemToList/);
    expect(listSrc).toMatch(/unassignInventoryItemFromList/);
  });

  test('provider clears duplicate highlight on all open helpers and uses shared validation', () => {
    const providerSrc = fs.readFileSync(
      path.join(__dirname, '../../context/GarmentProvider.tsx'),
      'utf8',
    );
    expect(providerSrc).toMatch(/validateInventoryPayload/);
    expect(providerSrc).toMatch(/buildDuplicatedItemVariantPayloads/);
    expect(providerSrc).toMatch(/usePluginNavigation/);
    const openHelperClears = providerSrc.match(/setRecentlyDuplicatedInventoryId\(null\)/g);
    expect(openHelperClears && openHelperClears.length).toBeGreaterThanOrEqual(6);
  });

  test('updatePerson syncs person patches into garmentLists for soft preview', () => {
    const providerSrc = fs.readFileSync(
      path.join(__dirname, '../../context/GarmentProvider.tsx'),
      'utf8',
    );
    const matrixSrc = fs.readFileSync(path.join(__dirname, '../PersonMatrix.tsx'), 'utf8');
    const updatePersonBlock = providerSrc.slice(
      providerSrc.indexOf('const updatePerson = useCallback'),
      providerSrc.indexOf('const patchPersonLocal = useCallback'),
    );
    expect(updatePersonBlock).toMatch(/setGarmentLists/);
    expect(updatePersonBlock).toMatch(/setCurrentGarment/);
    expect(matrixSrc).toMatch(/patchPersonLocal\(list\.id, person\.id, \{ teamId: next \}\)/);
  });
});
