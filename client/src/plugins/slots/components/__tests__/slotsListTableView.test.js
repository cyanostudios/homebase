const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../SlotsList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../SlotListTable.tsx'), 'utf8');
const formSrc = fs.readFileSync(path.join(__dirname, '../SlotForm.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../SlotView.tsx'), 'utf8');
const registrySrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/pluginRegistry.ts'),
  'utf8',
);

describe('SlotsList table view wiring', () => {
  test('list supports table view with mail-style thin toolbar', () => {
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/SlotListItem/);
    expect(listSrc).not.toMatch(/setListViewMode\('table'\)/);
    expect(listSrc).not.toMatch(/aria-label="Sort by"/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(listSrc).toMatch(/SlotListTable/);
    expect(listSrc).toMatch(/selectionEnabled=\{selectionMode\}/);
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky lg:top-4/);
    expect(listSrc).not.toMatch(/SlotQuickContextPanel/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/slots\.collapseToolbar/);
    expect(listSrc).toMatch(/slots\.expandToolbar/);
    expect(listSrc).toMatch(/renderFilterChips/);
    expect(listSrc).toMatch(/renderSortDropdown/);
    expect(listSrc).toMatch(/ListFilterChipsToggle/);
    expect(listSrc).toMatch(/filtersVisible/);
    expect(listSrc).toMatch(/DropdownMenuRadioItem/);
    expect(listSrc).toMatch(/handlePrimarySortChange/);
    expect(listSrc).toMatch(/md:hidden/);
    expect(listSrc).toMatch(/useMobileActions/);
    expect(listSrc).toMatch(/useRegisterMobileSearch/);
  });

  test('table uses SortableListTable with sortable columns and selection', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/onSort=\{/);
    expect(tableSrc).toMatch(/selectionEnabled/);
    expect(tableSrc).toMatch(/field: 'name'/);
    expect(tableSrc).toMatch(/field: 'category'/);
    expect(tableSrc).toMatch(/field: 'location'/);
    expect(tableSrc).toMatch(/field: 'slot_time'/);
    expect(tableSrc).toMatch(/field: 'visible'/);
    expect(tableSrc).toMatch(/field: 'booked_count'/);
    expect(tableSrc).toMatch(/field: 'created_at'/);
    expect(tableSrc).toMatch(/field: 'updated_at'/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
    expect(tableSrc).toMatch(/subtleRowDividers/);
    expect(tableSrc).toMatch(/headerBarClassName="bg-sky-50 dark:bg-sky-950\/40"/);
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
    expect(tableSrc).toMatch(/slotIdentityMeta/);
  });

  test('list loads visible columns and passes them to the table', () => {
    expect(listSrc).toMatch(/resolveVisibleSlotTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
    expect(listSrc).toMatch(/SlotsSettingsView/);
  });

  test('list split view previews slots on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewSlot/);
    expect(listSrc).toMatch(/SlotView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeSlotId/);
    expect(listSrc).toMatch(/setPreviewSlot\(\(current\) =>/);
    expect(listSrc).toMatch(/String\(current\.id\) === String\(slot\.id\) \? null : slot/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/grid-rows-\[minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/h-full min-h-0 overflow-y-auto overscroll-contain/);
    expect(listSrc).toMatch(
      /aside[\s\S]*h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain/,
    );
    expect(listSrc).toMatch(/SlotsStatisticsView/);
    expect(viewSrc).toMatch(/stacked\?: boolean/);
    expect(viewSrc).toMatch(/gridClassName=\{stacked \? 'grid-cols-1'/);
  });

  test('desktop create/edit renders SlotForm in the detail column', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/SlotForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isSlotsPanelOpen/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/saveSlot/);
    expect(listSrc).toMatch(/closeSlotPanel/);
    expect(listSrc).toMatch(/stacked/);
    expect(formSrc).toMatch(/stacked\?: boolean/);
    expect(formSrc).toMatch(/gridClassName=\{stacked \? 'grid-cols-1'/);
    expect(formSrc).toMatch(/currentSlot && !stacked/);
    expect(formSrc).not.toMatch(/SlotsSettingsForm/);
    expect(formSrc).not.toMatch(/panelMode === 'settings'/);
  });

  test('bulk select mode shows BulkActionRoundBar under toolbar and keeps detail column visible', () => {
    expect(listSrc).toMatch(/renderSelectControls/);
    expect(listSrc).toMatch(/renderBulkActionBar/);
    expect(listSrc).toMatch(/selectionMode/);
    expect(listSrc).toMatch(/handleEnterSelectionMode/);
    expect(listSrc).toMatch(/handleExitSelectionMode/);
    expect(listSrc).toMatch(/BulkActionRoundBar/);
    expect(listSrc).toMatch(/size="xs"/);
    expect(listSrc).toMatch(/common\.clear/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/bulkRoundActions/);
  });

  test('slots plugin registry sets contentOwnsScroll', () => {
    expect(registrySrc).toMatch(/name: 'slots'[\s\S]*contentOwnsScroll: true/);
  });

  test('desktop detail card header shows SlotDetailHeaderMenus (Actions)', () => {
    expect(viewSrc).toMatch(/SlotDetailHeaderMenus/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(listSrc).not.toMatch(/SlotDetailHeaderMenus/);
  });
});
