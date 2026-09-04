import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Circle,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Plus,
  Settings,
  SlidersHorizontal,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableQuickAdd } from '@/components/ui/round-expandable-quick-add';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useQuickContextPreview } from '@/core/hooks/useQuickContextPreview';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { exportItems } from '@/core/utils/exportUtils';
import { stripHtml } from '@/core/utils/textUtils';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useTasks } from '../hooks/useTasks';
import { type Task } from '../types/tasks';
import {
  getInitialTaskColumnCount,
  resolveTaskColumnCount,
  TASKS_COLUMN_COUNT_STORAGE_KEY,
  TASKS_SETTINGS_KEY,
  type TaskColumnCount,
} from '../utils/taskColumnCount';
import { getTasksExportConfig } from '../utils/taskExportConfig';
import {
  TASK_LIST_FILTER_INITIAL,
  taskIsOpen,
  taskIsOverdue,
  taskMatchesListFilters,
  toggleTaskListFilter,
  type TaskListFilter,
  type TaskListFilterSelection,
} from '../utils/taskListFilter';
import { buildTaskListQuickFieldsSavePayload } from '../utils/taskListSave';
import {
  compareTasksByField,
  isTaskAscDefaultField,
  nextTaskTableSort,
  type TaskSortField,
  type TaskSortOrder,
} from '../utils/taskListSort';
import {
  getInitialTaskListViewMode,
  persistTaskListViewModeSession,
  resolveTaskListViewMode,
  type TaskListViewMode,
} from '../utils/taskListViewMode';
import { resolveVisibleTaskTableColumns, type TaskTableColumnId } from '../utils/taskTableColumns';

import { TaskBulkStatusDialog } from './TaskBulkStatusDialog';
import { TaskListItem } from './TaskListItem';
import { TaskListTable } from './TaskListTable';
import { TaskQuickContextPanel } from './TaskQuickContextPanel';
import { TaskSettingsView, type TaskSettingsCategory } from './TaskSettingsView';

import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';

type SortField = TaskSortField;
type SortOrder = TaskSortOrder;

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'Updated' },
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'createdAt', label: 'Created' },
];

export function TaskList() {
  const { t } = useTranslation();
  const {
    tasks,
    tasksContentView,
    openTaskForView,
    openTaskForEdit,
    openTaskPanel,
    openTaskSettings,
    closeTaskSettingsView,
    deleteTasks,
    selectedTaskIds,
    toggleTaskSelected,
    mergeIntoTaskSelection,
    selectAllTasks,
    clearTaskSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedTaskId,
    setRecentlyDuplicatedTaskId,
    createTask,
    saveTask,
    currentTask,
    quickEditDraft,
  } = useTasks();
  const { contacts, getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openTaskPanel(null)),
    onSettings: () => openTaskSettings(),
  });

  const enabledPlugins = useEnabledPlugins();
  const hasTeamsPlugin = enabledPlugins.has('teams');
  const { teams } = useTeams();
  const { searchTerm, setSearchTerm } = usePersistedListSearch('tasks');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('tasks.searchPlaceholder', { count: tasks.length }),
  });
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [primarySort, setPrimarySort] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<TaskColumnCount>(getInitialTaskColumnCount);
  const [listViewMode, setListViewModeState] = useState<TaskListViewMode>(
    getInitialTaskListViewMode,
  );
  const [visibleColumnIds, setVisibleColumnIds] = useState<TaskTableColumnId[]>(() =>
    resolveVisibleTaskTableColumns(null),
  );
  const [activeFilters, setActiveFilters] =
    useState<TaskListFilterSelection>(TASK_LIST_FILTER_INITIAL);
  const [settingsCategory, setSettingsCategory] = useState<TaskSettingsCategory>('columns');

  useEffect(() => {
    let cancelled = false;
    getSettings(TASKS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const resolved = resolveTaskColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as TaskColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(TASKS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(TASKS_SETTINGS_KEY, { columnCount: next }).catch(() => {});
        }
        const nextView = resolveTaskListViewMode(settings);
        setListViewModeState(nextView);
        persistTaskListViewModeSession(nextView);
        setVisibleColumnIds(resolveVisibleTaskTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (_count: TaskColumnCount) => {
      const next = 3 as TaskColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistTaskListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(TASKS_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(TASKS_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: TaskListViewMode) => {
      setListViewModeState(mode);
      persistTaskListViewModeSession(mode);
      updateSettings(TASKS_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isTaskAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextTaskTableSort(primarySort, sortOrder, field);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const getAssignedContacts = useCallback(
    (task: Task) => {
      const ids = Array.isArray(task.assignedToIds)
        ? task.assignedToIds
        : task.assignedTo
          ? [String(task.assignedTo)]
          : [];
      return ids
        .map((id) => contacts.find((c: any) => String(c.id) === String(id)))
        .filter(Boolean) as any[];
    },
    [contacts],
  );

  const getAssignedTeamName = useCallback(
    (task: Task): string | null => {
      if (!hasTeamsPlugin || !task.teamId) {
        return null;
      }
      const team = teams.find((item) => String(item.id) === String(task.teamId));
      if (team) {
        return formatTeamLabel(team) || team.name || null;
      }
      return t('tasks.assignedTeamOrphan', { id: task.teamId });
    },
    [hasTeamsPlugin, t, teams],
  );

  const sortedTasks = useMemo(() => {
    const now = Date.now();
    const byFilter = tasks.filter((task) => taskMatchesListFilters(task, activeFilters, now));

    const q = searchTerm.toLowerCase();
    const filtered = byFilter.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(q) ||
        stripHtml(task.content).toLowerCase().includes(q) ||
        task.status.toLowerCase().includes(q) ||
        task.priority.toLowerCase().includes(q);

      // Search in assigned contacts
      if (contacts.length > 0) {
        const assignedContacts = getAssignedContacts(task);
        if (
          assignedContacts.some((c) =>
            String(c.companyName || '')
              .toLowerCase()
              .includes(q),
          )
        ) {
          return true;
        }
      }

      if (hasTeamsPlugin) {
        const teamLabel = getAssignedTeamName(task);
        if (teamLabel && teamLabel.toLowerCase().includes(q)) {
          return true;
        }
      }

      return matchesSearch;
    });

    return [...filtered].sort((a, b) => compareTasksByField(a, b, primarySort, sortOrder));
  }, [
    tasks,
    searchTerm,
    primarySort,
    sortOrder,
    contacts,
    getAssignedContacts,
    getAssignedTeamName,
    hasTeamsPlugin,
    activeFilters,
  ]);

  const isFilterActive = (filter: TaskListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: TaskListFilter) => {
    setActiveFilters((prev) => toggleTaskListFilter(prev, filter));
  };

  const visibleTaskIds = useMemo(() => sortedTasks.map((task) => String(task.id)), [sortedTasks]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: tasks.length,
      open: tasks.filter((task) => taskIsOpen(task)).length,
      completed: tasks.filter((task) => task.status === 'completed').length,
      overdue: tasks.filter((task) => taskIsOverdue(task, now)).length,
    };
  }, [tasks]);

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleTaskIds,
      mergeIntoSelection: mergeIntoTaskSelection,
      toggleOne: toggleTaskSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleTaskIds.length > 0 && visibleTaskIds.every((id) => isSelected(id)),
    [visibleTaskIds, isSelected],
  );

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearTaskSelection();
    } else {
      selectAllTasks(visibleTaskIds);
    }
  };

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedTaskIds.includes(String(task.id))),
    [tasks, selectedTaskIds],
  );

  const handleBulkDelete = async () => {
    if (selectedTaskIds.length === 0) {
      return;
    }

    setDeleting(true);
    try {
      await deleteTasks(selectedTaskIds);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedTaskIds.length === 0) {
      alert('Please select tasks to export');
      return;
    }
    const selectedTasks = tasks.filter((task) => selectedTaskIds.includes(String(task.id)));
    const filename = `tasks-export-${new Date().toISOString().split('T')[0]}`;
    exportItems({
      items: selectedTasks,
      format: 'csv',
      config: getTasksExportConfig(contacts ?? []),
      filename,
      title: 'Tasks Export',
    });
  };

  const handleExportPDF = async () => {
    if (selectedTaskIds.length === 0) {
      alert('Please select tasks to export');
      return;
    }
    const selectedTasks = tasks.filter((task) => selectedTaskIds.includes(String(task.id)));
    const filename = `tasks-export-${new Date().toISOString().split('T')[0]}`;
    const result = exportItems({
      items: selectedTasks,
      format: 'pdf',
      config: getTasksExportConfig(contacts ?? []),
      filename,
      title: 'Tasks Export',
    });
    if (result && typeof (result as Promise<void>).then === 'function') {
      await (result as Promise<void>).catch((err) => {
        console.error('PDF export failed:', err);
        alert('Export failed. Please try again.');
      });
    }
  };

  const {
    previewItem: previewTask,
    setPreviewItem: setPreviewTask,
    showQuickContext,
    markPendingAndOpen,
    activateRow,
  } = useQuickContextPreview({
    storeKey: 'tasks',
    items: tasks,
    getItemId: (task) => String(task.id),
  });

  const quickContextOpen = Boolean(showQuickContext && previewTask);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount, { quickContextOpen });
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount, { quickContextOpen });

  const handleOpenForView = (task: Task) => {
    markPendingAndOpen(task, () => attemptNavigation(() => openTaskForView(task)));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearTaskSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (task: Task) => {
    if (selectionMode) {
      toggleTaskSelected(String(task.id));
      return;
    }
    activateRow(task, (item) => attemptNavigation(() => openTaskForView(item)));
  };

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    return [
      {
        key: 'status',
        label: t('tasks.bulkStatusAction'),
        icon: SlidersHorizontal,
        disabled,
        onClick: () => setShowBulkStatusDialog(true),
      },
      {
        key: 'csv',
        label: 'Export CSV',
        icon: FileSpreadsheet,
        disabled,
        onClick: handleExportCSV,
      },
      {
        key: 'pdf',
        label: 'Export PDF',
        icon: FileText,
        disabled,
        onClick: () => {
          void handleExportPDF();
        },
      },
      {
        key: 'delete',
        label: t('common.delete'),
        icon: Trash2,
        disabled,
        tone: 'destructive',
        onClick: () => setShowBulkDeleteModal(true),
      },
    ];
  }, [selectedCount, t, handleExportCSV, handleExportPDF]);

  const handleListQuickFieldChange = useCallback(
    async (
      task: Task,
      patch: Partial<{ status: string; priority: string; dueDate: Date | null }>,
    ) => {
      if (
        patch.status !== undefined &&
        task.status === patch.status &&
        patch.priority === undefined &&
        patch.dueDate === undefined
      ) {
        return;
      }
      if (
        patch.priority !== undefined &&
        task.priority === patch.priority &&
        patch.status === undefined &&
        patch.dueDate === undefined
      ) {
        return;
      }
      const isCurrent = currentTask?.id === task.id;
      const draft = isCurrent ? quickEditDraft : null;
      await saveTask(buildTaskListQuickFieldsSavePayload(task, patch, draft), task.id);
    },
    [currentTask?.id, quickEditDraft, saveTask],
  );

  const handleListStatusChange = useCallback(
    async (task: Task, newStatus: string) => {
      await handleListQuickFieldChange(task, { status: newStatus });
    },
    [handleListQuickFieldChange],
  );

  const handleQuickCreate = useCallback(
    async (title: string) => {
      const task = await createTask({ title, content: '' });
      setRecentlyDuplicatedTaskId(String(task.id));
    },
    [createTask, setRecentlyDuplicatedTaskId],
  );

  if (tasksContentView === 'settings') {
    return (
      <div className="plugin-tasks min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          <TaskSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            renderCategoryButtonsInline
            onClose={closeTaskSettingsView}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('plugin-tasks', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.tasks')}</h2>
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('common.settings')}
                    variant="soft"
                    onClick={() => openTaskSettings()}
                  />
                  {sortedTasks.length > 0 ? (
                    selectionMode ? (
                      <ExpandableIconButton
                        icon={XCircle}
                        label={t('common.clear')}
                        variant="danger"
                        alwaysExpanded
                        onClick={handleExitSelectionMode}
                      />
                    ) : (
                      <ExpandableIconButton
                        icon={CheckSquare}
                        label={t('common.select')}
                        variant="soft"
                        alwaysExpanded
                        onClick={handleEnterSelectionMode}
                      />
                    )
                  ) : null}
                  <RoundExpandableQuickAdd
                    label={t('tasks.quickAdd')}
                    placeholder={t('tasks.quickAddPlaceholder')}
                    onCreate={handleQuickCreate}
                    defaultExpanded
                    variant={quickContextOpen ? 'soft' : 'primary'}
                  />
                </div>
              </div>
              {selectionMode ? (
                <BulkActionRoundBar
                  selectedCount={selectedCount}
                  actions={bulkRoundActions}
                  className="gap-2"
                />
              ) : null}
            </div>
            <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
              <RoundExpandableSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('tasks.searchPlaceholder', { count: tasks.length })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`tasks.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('tasks.addTask')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openTaskPanel(null))}
              />
            </div>
          </div>
        </div>

        <div className={LIST_FILTER_AND_SORT_ROW_CLASS}>
          <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilters([])}
              className={cn(
                activeFilters.length === 0 ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>
                {t('tasks.filter.total')}{' '}
                <span className="tabular-nums font-semibold">({stats.total})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('open')}
              className={cn(
                isFilterActive('open') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Circle className="h-3.5 w-3.5" />
              <span>
                {t('tasks.filter.open')}{' '}
                <span className="tabular-nums font-semibold">({stats.open})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('completed')}
              className={cn(
                isFilterActive('completed')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {t('tasks.filter.completed')}{' '}
                <span className="tabular-nums font-semibold">({stats.completed})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('overdue')}
              className={cn(
                isFilterActive('overdue') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>
                {t('tasks.filter.overdue')}{' '}
                <span className="tabular-nums font-semibold">({stats.overdue})</span>
              </span>
            </Button>
          </div>
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
            <Select
              value={primarySort}
              onValueChange={(value) => handlePrimarySortChange(value as SortField)}
            >
              <SelectTrigger
                className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                aria-label="Sort by"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="item-aligned"
                className="rounded-xl border-border/50 shadow-xl"
              >
                {SORT_FIELD_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="rounded-md text-xs"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 px-0 text-xs"
              onClick={toggleSortOrder}
              aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="tasks"
          isLoading={deleting}
        />

        <TaskBulkStatusDialog
          isOpen={showBulkStatusDialog}
          onClose={() => setShowBulkStatusDialog(false)}
          selectedTasks={selectedTasks}
          saveTask={saveTask}
          onSuccess={clearTaskSelection}
        />

        <div className="flex flex-col gap-3">
          <div
            className={cn(
              'grid items-start gap-4',
              showQuickContext && previewTask ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
            )}
          >
            {showQuickContext && previewTask ? (
              <aside className="min-w-0 self-start lg:sticky lg:top-4 lg:z-10">
                <TaskQuickContextPanel
                  task={previewTask}
                  onClose={() => setPreviewTask(null)}
                  onOpenFullProfile={() => handleOpenForView(previewTask)}
                  onEdit={() => {
                    markPendingAndOpen(previewTask, () =>
                      attemptNavigation(() => openTaskForEdit(previewTask)),
                    );
                  }}
                  onStatusChange={(status) => handleListQuickFieldChange(previewTask, { status })}
                  onPriorityChange={(priority) =>
                    handleListQuickFieldChange(previewTask, { priority })
                  }
                  onDueDateChange={(dueDate) =>
                    handleListQuickFieldChange(previewTask, { dueDate })
                  }
                />
              </aside>
            ) : null}
            <div className="flex min-w-0 flex-col gap-3">
              {sortedTasks.length === 0 ? (
                <ListEmptyState
                  message={searchTerm ? t('tasks.noMatch') : t('tasks.noYet')}
                  createLabel={!searchTerm ? t('tasks.addTask') : undefined}
                  onCreate={
                    !searchTerm ? () => attemptNavigation(() => openTaskPanel(null)) : undefined
                  }
                />
              ) : isTableView ? (
                <TaskListTable
                  tasks={sortedTasks}
                  primarySort={primarySort}
                  sortOrder={sortOrder}
                  onSort={handleTableSort}
                  isSelected={isSelected}
                  onRowClick={handleRowActivate}
                  onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                  onCheckboxChange={onVisibleRowCheckboxChange}
                  allVisibleSelected={allVisibleSelected}
                  onHeaderCheckboxChange={handleHeaderCheckboxChange}
                  recentlyDuplicatedTaskId={recentlyDuplicatedTaskId}
                  selectionEnabled={selectionMode}
                  activeTaskId={previewTask?.id ?? null}
                  visibleColumnIds={visibleColumnIds}
                  getAssignedNames={(task) =>
                    getAssignedContacts(task).map((c) => c.companyName as string)
                  }
                  getAssignedTeamName={getAssignedTeamName}
                />
              ) : (
                <div
                  className={cn(
                    'grid gap-3',
                    effectiveColumnCount === 1 && 'grid-cols-1',
                    effectiveColumnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                    effectiveColumnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
                  )}
                >
                  {sortedTasks.map((task, index) => {
                    const taskIsSelected = isSelected(task.id);
                    const assignedContacts = getAssignedContacts(task);
                    return (
                      <TaskListItem
                        key={task.id}
                        task={task}
                        selected={taskIsSelected}
                        highlighted={recentlyDuplicatedTaskId === String(task.id)}
                        active={previewTask != null && String(previewTask.id) === String(task.id)}
                        onClick={() => handleRowActivate(task)}
                        assignedNames={assignedContacts.map((c) => c.companyName)}
                        assignedTeamName={getAssignedTeamName(task)}
                        onStatusChange={(status) => handleListStatusChange(task, status)}
                        columnCount={effectiveCardColumnCount}
                        checkbox={
                          selectionMode ? (
                            <input
                              type="checkbox"
                              checked={taskIsSelected}
                              onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                              onChange={() => onVisibleRowCheckboxChange(task.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 cursor-pointer"
                              aria-label={taskIsSelected ? 'Unselect task' : 'Select task'}
                            />
                          ) : undefined
                        }
                      />
                    );
                  })}
                </div>
              )}

              <ListFooterBar
                meta={
                  <>
                    Showing {sortedTasks.length} of {tasks.length} Tasks
                  </>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
