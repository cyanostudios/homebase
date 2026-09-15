const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../IngestSourceList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../IngestSourceListTable.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../IngestSourceView.tsx'), 'utf8');

describe('IngestSourceList table view wiring', () => {
  test('list supports table view with mail-style thin toolbar', () => {
    expect(listSrc).toMatch(/IngestSourceListTable/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/IngestSourceListItem/);
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky top-0 z-20/);
    expect(listSrc).toMatch(/INGEST_TOOLBAR_COLLAPSED_STORAGE_KEY/);
    expect(listSrc).toMatch(/ingest\.collapseToolbar/);
    expect(listSrc).toMatch(/ingest\.expandToolbar/);
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

  test('table uses SortableListTable with name-only default (meta under name)', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/resolveVisibleIngestTableColumns/);
    expect(tableSrc).toMatch(/DEFAULT_INGEST_TABLE_COLUMNS/);
    expect(tableSrc).toMatch(/field: 'name'/);
    expect(tableSrc).toMatch(/field: 'sourceType'/);
    expect(tableSrc).toMatch(/field: 'isActive'/);
    expect(tableSrc).toMatch(/field: 'lastFetchStatus'/);
    expect(tableSrc).toMatch(/field: 'lastFetchedAt'/);
    expect(tableSrc).toMatch(/ingestIdentityMeta/);
    expect(tableSrc).not.toMatch(/field: 'updatedAt'/);
    expect(tableSrc).toMatch(/headerBarClassName="bg-sky-50 dark:bg-sky-950\/40"/);
    expect(tableSrc).toMatch(
      /headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100\/80 dark:hover:bg-sky-900\/40"/,
    );
    expect(tableSrc).toMatch(/activeSourceId/);
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
  });

  test('list split view previews sources on wide screens', () => {
    expect(listSrc).toMatch(/previewSource/);
    expect(listSrc).toMatch(/IngestSourceView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeListSourceId/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/IngestStatisticsView/);
  });

  test('desktop create/edit renders IngestSourceForm in the detail column', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/IngestSourceForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isIngestPanelOpen/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/saveIngest/);
    expect(listSrc).toMatch(/closeIngestPanel/);
    expect(listSrc).toMatch(/stacked/);
  });

  test('detail view embeds IngestSourceDetailHeaderMenus with leading identity and tabs', () => {
    expect(viewSrc).toMatch(/IngestSourceDetailHeaderMenus/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(viewSrc).toMatch(/gridClassName="grid-cols-1"/);
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(listSrc).not.toMatch(/IngestSourceDetailHeaderMenus/);
  });
});
