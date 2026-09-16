const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../FileList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../FileListTable.tsx'), 'utf8');
const quickContextSrc = fs.readFileSync(
  path.join(__dirname, '../FileQuickContextPanel.tsx'),
  'utf8',
);

describe('FileList table view wiring', () => {
  test('list supports table view with mail-style thin toolbar', () => {
    expect(listSrc).toMatch(/FileListTable/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/FileListItem/);
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky top-0 z-20/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/files\.collapseToolbar/);
    expect(listSrc).toMatch(/files\.expandToolbar/);
    expect(listSrc).not.toMatch(/useQuickContextPreview/);
    expect(listSrc).not.toMatch(/FileQuickContextPanel/);
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

  test('table uses SortableListTable with name + type/size meta and selection', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/onSort=\{onSort\}/);
    expect(tableSrc).toMatch(/selection=\{/);
    expect(tableSrc).toMatch(/field: 'name'/);
    expect(tableSrc).not.toMatch(/field: 'mimeType'/);
    expect(tableSrc).not.toMatch(/field: 'size'/);
    expect(tableSrc).toMatch(/FileIdentityCell/);
    expect(tableSrc).toMatch(/headerBarClassName="bg-sky-50 dark:bg-sky-950\/40"/);
    expect(tableSrc).toMatch(
      /headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100\/80 dark:hover:bg-sky-900\/40"/,
    );
    expect(tableSrc).toMatch(/activeFileId/);
    expect(tableSrc).toMatch(/selectionEnabled/);
  });

  test('attachments list reuses Files list identity cell', () => {
    const attachmentsSrc = fs.readFileSync(
      path.join(__dirname, '../FileAttachmentsSection.tsx'),
      'utf8',
    );
    const identitySrc = fs.readFileSync(path.join(__dirname, '../FileIdentityCell.tsx'), 'utf8');
    expect(attachmentsSrc).toMatch(/FileIdentityCell/);
    expect(attachmentsSrc).toMatch(/QuickContextLinkTileGrid/);
    expect(attachmentsSrc).toMatch(/QUICK_CONTEXT_LINK_TILE_CLASS/);
    expect(attachmentsSrc).toMatch(/DetailSection/);
    expect(attachmentsSrc).toMatch(/subtleTitle/);
    expect(attachmentsSrc).toMatch(/Paperclip/);
    expect(attachmentsSrc).not.toMatch(/SlidersHorizontal/);
    expect(identitySrc).toMatch(/fileIdentityMeta/);
    expect(identitySrc).toMatch(/getMimeLabel/);
    expect(identitySrc).toMatch(/humanSize/);
    expect(identitySrc).toMatch(/SectionCategoryIcon/);
    expect(identitySrc).toMatch(/getFileDownloadUrl/);
  });

  test('list split view previews files on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewFile/);
    expect(listSrc).toMatch(/FileView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).not.toMatch(/FileQuickContextPanel/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeListFileId/);
    expect(listSrc).toMatch(/setPreviewFile\(\(current\) =>/);
    expect(listSrc).toMatch(/String\(current\.id\) === String\(item\.id\) \? null : item/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/grid-rows-\[minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/h-full min-h-0 overflow-y-auto overscroll-contain/);
    expect(listSrc).toMatch(
      /aside[\s\S]*h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain/,
    );
    expect(listSrc).toMatch(/FilesStatisticsView/);
  });

  test('desktop create/edit renders FileForm in the detail column', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/FileForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isFilesPanelOpen/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/saveFile/);
    expect(listSrc).toMatch(/closeFilePanel/);
    expect(listSrc).toMatch(/stacked/);
    const appContentSrc = fs.readFileSync(
      path.join(__dirname, '../../../../core/app/AppContent.tsx'),
      'utf8',
    );
    expect(appContentSrc).toMatch(/inlineDesktopPanel/);
    expect(appContentSrc).toMatch(/contentOwnsScroll/);
    expect(appContentSrc).toMatch(/isAnyPanelOpen && !inlineDesktopPanel/);
  });

  test('desktop detail card header shows FileDetailHeaderMenus', () => {
    expect(quickContextSrc).toMatch(/FileDetailHeaderMenus/);
    expect(quickContextSrc).toMatch(/leading=\{titleLeading\}/);
    expect(listSrc).not.toMatch(/FileDetailHeaderMenus/);
    expect(listSrc).toMatch(/stacked/);
  });

  test('bulk select mode shows BulkActionRoundBar under toolbar and keeps detail column visible', () => {
    expect(listSrc).toMatch(/renderSelectControls/);
    expect(listSrc).toMatch(/renderBulkActionBar/);
    expect(listSrc).toMatch(/selectionMode/);
    expect(listSrc).toMatch(/handleEnterSelectionMode/);
    expect(listSrc).toMatch(/handleExitSelectionMode/);
    expect(listSrc).toMatch(/selectionEnabled=\{selectionMode\}/);
    expect(listSrc).toMatch(/BulkActionRoundBar/);
    expect(listSrc).toMatch(/common\.clear/);
    expect(listSrc).not.toMatch(/common\.headerActions/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/bulkRoundActions/);
  });
});
