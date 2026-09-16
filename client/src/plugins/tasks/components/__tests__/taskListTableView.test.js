const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../TaskList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../TaskListTable.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../TaskView.tsx'), 'utf8');
const quickContextActionsSrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/ui/QuickContextHeaderActions.tsx'),
  'utf8',
);

describe('TaskList table view wiring', () => {
  test('list supports table view with mail-style thin toolbar', () => {
    expect(listSrc).toMatch(/TaskListTable/);
    expect(listSrc).not.toMatch(/ListColumnLayoutToggle/);
    expect(listSrc).not.toMatch(/TaskListItem/);
    expect(listSrc).toMatch(/createPortal/);
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/left-sidebar-nav/);
    expect(listSrc).toMatch(/md:pt-3/);
    expect(listSrc).toMatch(/toolbarCollapsed/);
    expect(listSrc).toMatch(/toggleToolbarCollapsed/);
    expect(listSrc).not.toMatch(/sticky top-0 z-20/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/tasks\.collapseToolbar/);
    expect(listSrc).toMatch(/tasks\.expandToolbar/);
    expect(listSrc).not.toMatch(/rounded-xl border border-border\/40 bg-white/);
    expect(listSrc).toMatch(/renderFilterChips/);
    expect(listSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(listSrc).toMatch(/renderSortDropdown/);
    expect(listSrc).toMatch(/ListFilterChipsToggle/);
    expect(listSrc).toMatch(/filtersVisible/);
    expect(listSrc).toMatch(/RoundExpandableQuickAdd/);
    expect(listSrc).toMatch(/icon=\{CheckSquare\}/);
    expect(listSrc).toMatch(/useState<SortField>\('createdAt'\)/);
    expect(listSrc).toMatch(/useState<SortOrder>\('desc'\)/);
    expect(listSrc).toMatch(/DropdownMenuRadioItem/);
    expect(listSrc).toMatch(/handlePrimarySortChange/);
    expect(listSrc).toMatch(/md:hidden/);
    expect(listSrc).toMatch(/useMobileActions/);
    expect(listSrc).toMatch(/useRegisterMobileSearch/);
    expect(listSrc).not.toMatch(/useQuickContextPreview/);
    expect(listSrc).not.toMatch(/TaskQuickContextPanel/);
    expect(listSrc).not.toMatch(/aria-label="Sort by"/);
  });

  test('table uses SortableListTable with sortable columns and selection', () => {
    expect(tableSrc).toMatch(/SortableListTable/);
    expect(tableSrc).toMatch(/onSort=\{/);
    expect(tableSrc).toMatch(/selection=\{/);
    expect(tableSrc).toMatch(/field: 'title'/);
    expect(tableSrc).toMatch(/field: 'status'/);
    expect(tableSrc).toMatch(/field: 'priority'/);
    expect(tableSrc).toMatch(/field: 'dueDate'/);
    expect(tableSrc).toMatch(/field: 'assignedTo'/);
    expect(tableSrc).toMatch(/field: 'assignedTeam'/);
    expect(tableSrc).toMatch(/field: 'updatedAt'/);
    expect(tableSrc).toMatch(/field: 'createdAt'/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
    expect(tableSrc).toMatch(/getAssignedNames/);
    expect(tableSrc).toMatch(/getAssignedTeamName/);
    expect(tableSrc).toMatch(/subtleRowDividers/);
    expect(tableSrc).toMatch(/headerBarClassName="bg-sky-50/);
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
  });

  test('list resolves and passes visible table columns from settings', () => {
    expect(listSrc).toMatch(/resolveVisibleTaskTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
  });

  test('list split view previews tasks on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/previewTask/);
    expect(listSrc).toMatch(/TaskView/);
    expect(listSrc).toMatch(/stacked/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/activeListTaskId/);
    expect(listSrc).toMatch(/setPreviewTask\(\(current\) =>/);
    expect(listSrc).toMatch(/String\(current\.id\) === String\(task\.id\) \? null : task/);
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/grid-rows-\[minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/h-full min-h-0 overflow-y-auto overscroll-contain/);
    expect(listSrc).toMatch(
      /aside[\s\S]*h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain/,
    );
    expect(listSrc).toMatch(/TasksStatisticsView/);
    expect(tableSrc).toMatch(/activeTaskId/);
    expect(tableSrc).toMatch(/selectionEnabled/);
    expect(viewSrc).toMatch(/stacked\?: boolean/);
    expect(viewSrc).toMatch(/gridClassName="grid-cols-1"/);
  });

  test('create/edit form is not legacy panel settings', () => {
    const formSrc = fs.readFileSync(path.join(__dirname, '../TaskForm.tsx'), 'utf8');
    expect(formSrc).not.toMatch(/TaskSettingsForm/);
    expect(formSrc).not.toMatch(/panelMode === 'settings'/);
    expect(listSrc).toMatch(/TaskSettingsView/);
    expect(listSrc).not.toMatch(/renderCategoryButtonsInline/);
  });

  test('desktop create/edit renders TaskForm in the detail column', () => {
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/TaskForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/inlineFormRef/);
    expect(listSrc).toMatch(/isTaskPanelOpen/);
    expect(listSrc).toMatch(/panelMode === 'create' \|\| panelMode === 'edit'/);
    expect(listSrc).toMatch(/saveTask/);
    expect(listSrc).toMatch(/closeTaskPanel/);
    expect(listSrc).toMatch(/stacked/);
    const appContentSrc = fs.readFileSync(
      path.join(__dirname, '../../../../core/app/AppContent.tsx'),
      'utf8',
    );
    expect(appContentSrc).toMatch(/inlineDesktopPanel/);
    expect(appContentSrc).toMatch(/contentOwnsScroll/);
    expect(appContentSrc).toMatch(/isAnyPanelOpen && !inlineDesktopPanel/);
  });

  test('desktop detail card header shows TaskDetailHeaderMenus', () => {
    const quickContextSrc = fs.readFileSync(
      path.join(__dirname, '../TaskQuickContextPanel.tsx'),
      'utf8',
    );
    expect(quickContextSrc).toMatch(/TaskDetailHeaderMenus/);
    expect(quickContextSrc).toMatch(/leading=\{titleLeading\}/);
    expect(listSrc).not.toMatch(/TaskDetailHeaderMenus/);
    expect(viewSrc).toMatch(/TaskQuickContextPanel/);
    expect(viewSrc).toMatch(/RichTextContent/);
    expect(viewSrc).toMatch(/tasks\.taskContent/);
  });

  test('full detail shows header card plus tab content', () => {
    const quickContextSrc = fs.readFileSync(
      path.join(__dirname, '../TaskQuickContextPanel.tsx'),
      'utf8',
    );
    expect(viewSrc).toMatch(/TaskQuickContextPanel/);
    expect(viewSrc).toMatch(/RichTextContent/);
    expect(viewSrc).toMatch(/tasks\.taskContent/);
    expect(quickContextSrc).toMatch(/TaskDetailHeaderMenus/);
  });

  test('full view persists status priority and due date immediately', () => {
    expect(viewSrc).toMatch(/buildTaskListQuickFieldsSavePayload\(task, \{ status: newStatus \}/);
    expect(viewSrc).toMatch(
      /buildTaskListQuickFieldsSavePayload\(task, \{ priority: newPriority \}/,
    );
    expect(viewSrc).toMatch(/buildTaskListQuickFieldsSavePayload\(task, \{ dueDate: newDate \}/);
    expect(viewSrc).toMatch(/await saveTask\(/);
  });

  test('full view shows status priority and due badges together', () => {
    const quickContextSrc = fs.readFileSync(
      path.join(__dirname, '../TaskQuickContextPanel.tsx'),
      'utf8',
    );
    expect(quickContextSrc).toMatch(/TASK_STATUS_COLORS/);
    expect(quickContextSrc).toMatch(/TASK_PRIORITY_COLORS\[task\.priority\]/);
    expect(quickContextSrc).toMatch(/dueBadge/);
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
