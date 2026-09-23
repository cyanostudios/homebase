const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../NoteList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../NoteListTable.tsx'), 'utf8');
const quickContextActionsSrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/ui/QuickContextHeaderActions.tsx'),
  'utf8',
);

describe('NoteList table view wiring', () => {
  test('list supports table view with mail-style thin toolbar', () => {
    expect(listSrc).toMatch(/NoteListTable/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/NoteListItem/);
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky top-0 z-20/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/notes\.collapseToolbar/);
    expect(listSrc).toMatch(/notes\.expandToolbar/);
    expect(listSrc).not.toMatch(/useQuickContextPreview/);
    expect(listSrc).not.toMatch(/NoteQuickContextPanel/);
    expect(listSrc).toMatch(/renderFilterChips/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(listSrc).toMatch(/renderSortDropdown/);
    expect(listSrc).toMatch(/ListFilterChipsToggle/);
    expect(listSrc).toMatch(/filtersVisible/);
    expect(listSrc).toMatch(/RoundExpandableQuickAdd/);
    expect(listSrc).toMatch(/icon=\{StickyNote\}/);
    expect(listSrc).toMatch(/DropdownMenuRadioItem/);
    expect(listSrc).toMatch(/handlePrimarySortChange/);
    expect(listSrc).toMatch(/md:hidden/);
    expect(listSrc).toMatch(/useMobileActions/);
    expect(listSrc).toMatch(/useRegisterMobileSearch/);
  });

  test('table uses SortableListTable with sortable columns and selection', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/onSort=\{onSort\}/);
    expect(tableSrc).toMatch(/selection=\{/);
    expect(tableSrc).toMatch(/field: 'title'/);
    expect(tableSrc).toMatch(/field: 'mentions'/);
    expect(tableSrc).toMatch(/field: 'updatedAt'/);
    expect(tableSrc).toMatch(/field: 'createdAt'/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
    expect(tableSrc).toMatch(/headerBarClassName="bg-sky-50 dark:bg-sky-950\/40"/);
    expect(tableSrc).toMatch(
      /headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100\/80 dark:hover:bg-sky-900\/40"/,
    );
    expect(tableSrc).toMatch(/activeNoteId/);
    expect(tableSrc).toMatch(/selectionEnabled/);
  });

  test('list resolves and passes visible table columns from settings', () => {
    expect(listSrc).toMatch(/resolveVisibleNoteTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{tableColumnIds\}/);
  });

  test('list split view previews notes on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewNote/);
    expect(listSrc).toMatch(/NoteView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).not.toMatch(/NoteQuickContextPanel/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeListNoteId/);
    expect(listSrc).toMatch(/setPreviewNote\(\(current\) =>/);
    expect(listSrc).toMatch(/String\(current\.id\) === String\(note\.id\) \? null : note/);
    expect(listSrc).toMatch(/showDesktopSplit = isCompanion \? false : !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/grid-rows-\[minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/h-full min-h-0 overflow-y-auto overscroll-contain/);
    expect(listSrc).toMatch(
      /aside[\s\S]*h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain/,
    );
    expect(listSrc).toMatch(/NotesStatisticsView/);
    expect(tableSrc).toMatch(/activeNoteId/);
    expect(tableSrc).toMatch(/selectionEnabled/);
  });

  test('notes companion is view-only inside the flyout', () => {
    expect(listSrc).toMatch(/isCompanion\?: boolean/);
    expect(listSrc).toMatch(/COMPANION_VISIBLE_COLUMN_IDS/);
    expect(listSrc).toMatch(/tableColumnIds/);
    expect(listSrc).toMatch(/isCompanion && previewNote/);
    expect(listSrc).toMatch(/readOnly/);
    expect(listSrc).toMatch(/headerTrailing/);
    expect(listSrc).toMatch(/ExternalLink/);
    expect(listSrc).toMatch(/openNoteForView\(note\)/);
    expect(listSrc).toMatch(/closeCompanionPanel/);
    expect(listSrc).toMatch(/setPreviewNote\(null\)/);
    expect(listSrc).toMatch(/showDesktopSplit = isCompanion \? false : !isCompactViewport/);
    const viewSrc = fs.readFileSync(path.join(__dirname, '../NoteView.tsx'), 'utf8');
    expect(viewSrc).toMatch(/readOnly\?: boolean/);
    expect(viewSrc).toMatch(/NOTE_VIEW_READONLY_TABS/);
    expect(viewSrc).toMatch(/localTab/);
    const qcSrc = fs.readFileSync(path.join(__dirname, '../NoteQuickContextPanel.tsx'), 'utf8');
    expect(qcSrc).toMatch(/readOnly/);
    expect(qcSrc).toMatch(/headerTrailing/);
  });

  test('create/edit form is not legacy panel settings', () => {
    const formSrc = fs.readFileSync(path.join(__dirname, '../NoteForm.tsx'), 'utf8');
    expect(formSrc).not.toMatch(/NoteSettingsForm/);
    expect(formSrc).not.toMatch(/panelMode === 'settings'/);
    expect(listSrc).toMatch(/NotesSettingsView/);
    expect(listSrc).not.toMatch(/renderCategoryButtonsInline/);
  });

  test('desktop create/edit renders NoteForm in the detail column', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/NoteForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/headerTrailing/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isNotePanelOpen/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/saveNote/);
    expect(listSrc).toMatch(/closeNotePanel/);
    expect(listSrc).toMatch(/stacked/);
    const appContentSrc = fs.readFileSync(
      path.join(__dirname, '../../../../core/app/AppContent.tsx'),
      'utf8',
    );
    expect(appContentSrc).toMatch(/inlineDesktopPanel/);
    expect(appContentSrc).toMatch(/contentOwnsScroll/);
    expect(appContentSrc).toMatch(/isAnyPanelOpen && !inlineDesktopPanel/);
  });

  test('desktop detail card header shows NoteDetailHeaderMenus', () => {
    const quickContextSrc = fs.readFileSync(
      path.join(__dirname, '../NoteQuickContextPanel.tsx'),
      'utf8',
    );
    const viewSrc = fs.readFileSync(path.join(__dirname, '../NoteView.tsx'), 'utf8');
    expect(quickContextSrc).toMatch(/NoteDetailHeaderMenus/);
    expect(quickContextSrc).toMatch(/leading=\{titleLeading\}/);
    expect(quickContextSrc).toMatch(/afterActions=\{afterHeaderActions\}/);
    expect(quickContextSrc).toMatch(/headerBelow/);
    expect(viewSrc).toMatch(/NoteQuickContextPanel/);
    expect(viewSrc).toMatch(/headerBelow=\{tabChips\}/);
    expect(viewSrc).not.toMatch(/leftSidebar=/);
    expect(viewSrc).not.toMatch(/focusMode/);
    expect(listSrc).not.toMatch(/NoteDetailHeaderMenus/);
    expect(listSrc).toMatch(/stacked/);
  });

  test('full detail uses tab panels for content mentions files and activity', () => {
    const viewSrc = fs.readFileSync(path.join(__dirname, '../NoteView.tsx'), 'utf8');
    const quickContextSrc = fs.readFileSync(
      path.join(__dirname, '../NoteQuickContextPanel.tsx'),
      'utf8',
    );
    expect(viewSrc).toMatch(/NoteQuickContextPanel/);
    expect(viewSrc).toMatch(/RichTextContent/);
    expect(viewSrc).toMatch(/activeTab === 'information'/);
    expect(viewSrc).toMatch(/activeTab === 'linked'/);
    expect(viewSrc).toMatch(/activeTab === 'activity'/);
    expect(viewSrc).not.toMatch(/contentColumn/);
    expect(viewSrc).not.toMatch(/showTitleInContent/);
    expect(viewSrc).not.toMatch(/focusMode/);
    expect(quickContextSrc).toMatch(/headerBelow/);
    expect(quickContextSrc).not.toMatch(/children\?:/);
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
    expect(listSrc).toMatch(/showDesktopSplit = isCompanion \? false : !isCompactViewport/);
    expect(listSrc).toMatch(/bulkRoundActions/);
  });

  test('quick context header actions are shared round buttons', () => {
    expect(quickContextActionsSrc).toMatch(/RoundIconLabelButton/);
    expect(quickContextActionsSrc).toMatch(/QuickContextOpenFullFooter/);
    expect(quickContextActionsSrc).toMatch(/common\.openFullProfile/);
  });
});
