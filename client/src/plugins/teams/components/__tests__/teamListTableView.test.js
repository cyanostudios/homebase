const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../TeamList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../TeamListTable.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../TeamView.tsx'), 'utf8');
const quickContextActionsSrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/ui/QuickContextHeaderActions.tsx'),
  'utf8',
);

describe('TeamList table view wiring', () => {
  test('list supports table view with mail-style thin toolbar', () => {
    expect(listSrc).toMatch(/TeamListTable/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/TeamCard/);
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky top-0 z-20/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/teams\.collapseToolbar/);
    expect(listSrc).toMatch(/teams\.expandToolbar/);
    expect(listSrc).not.toMatch(/useQuickContextPreview/);
    expect(listSrc).not.toMatch(/TeamQuickContextPanel/);
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

  test('table uses SortableListTable with sortable columns and selection', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/onSort=\{/);
    expect(tableSrc).toMatch(/selection=\{/);
    expect(tableSrc).toMatch(/field: 'name'/);
    expect(tableSrc).toMatch(/field: 'age_group'/);
    expect(tableSrc).toMatch(/field: 'gender'/);
    expect(tableSrc).toMatch(/field: 'status'/);
    expect(tableSrc).toMatch(/field: 'series_teams'/);
    expect(tableSrc).toMatch(/sortable: false/);
    expect(tableSrc).toMatch(/field: 'player_count'/);
    expect(tableSrc).toMatch(/field: 'playing_format'/);
    expect(tableSrc).toMatch(/field: 'created_at'/);
    expect(tableSrc).toMatch(/field: 'updated_at'/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
    expect(tableSrc).toMatch(/headerBarClassName="bg-sky-50 dark:bg-sky-950\/40"/);
    expect(tableSrc).toMatch(
      /headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100\/80 dark:hover:bg-sky-900\/40"/,
    );
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
    expect(tableSrc).toMatch(/activeTeamId/);
    expect(tableSrc).toMatch(/selectionEnabled/);
  });

  test('list resolves and passes visible table columns from settings', () => {
    expect(listSrc).toMatch(/resolveVisibleTeamTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
  });

  test('list split view previews teams on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewTeam/);
    expect(listSrc).toMatch(/TeamView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).not.toMatch(/TeamQuickContextPanel/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeListTeamId/);
    expect(listSrc).toMatch(/setPreviewTeam\(\(current\) =>/);
    expect(listSrc).toMatch(/String\(current\.id\) === String\(team\.id\) \? null : team/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/grid-rows-\[minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/h-full min-h-0 overflow-y-auto overscroll-contain/);
    expect(listSrc).toMatch(
      /aside[\s\S]*h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain/,
    );
    expect(listSrc).toMatch(/TeamsStatisticsView/);
    expect(viewSrc).toMatch(/stacked\?: boolean/);
    expect(viewSrc).toMatch(/gridClassName="grid-cols-1"/);
  });

  test('desktop create/edit renders TeamForm in the detail column', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/TeamForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/headerTrailing/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isTeamPanelOpen/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/saveTeam/);
    expect(listSrc).toMatch(/closeTeamPanel/);
    expect(listSrc).toMatch(/stacked/);
  });

  test('desktop detail card header shows TeamDetailHeaderMenus', () => {
    const quickContextSrc = fs.readFileSync(
      path.join(__dirname, '../TeamQuickContextPanel.tsx'),
      'utf8',
    );
    expect(quickContextSrc).toMatch(/TeamDetailHeaderMenus/);
    expect(quickContextSrc).toMatch(/leading=\{titleLeading\}/);
    expect(listSrc).not.toMatch(/TeamDetailHeaderMenus/);
    expect(viewSrc).toMatch(/TeamQuickContextPanel/);
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
});
