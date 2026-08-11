import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { exportItems } from '@/core/utils/exportUtils';
import { stripHtml } from '@/core/utils/textUtils';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
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
  taskMatchesListFilters,
  toggleTaskListFilter,
  type TaskListFilter,
  type TaskListFilterSelection,
} from '../utils/taskListFilter';
import { buildTaskListStatusSavePayload } from '../utils/taskListSave';
import {
  compareTasksByField,
  isTaskStringSortField,
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

import { TaskBulkStatusDialog } from './TaskBulkStatusDialog';
import { TaskListItem } from './TaskListItem';
import { TaskListTable } from './TaskListTable';
import { TaskQuickAdd } from './TaskQuickAdd';
import { TaskSettingsView, type TaskSettingsCategory } from './TaskSettingsView';

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
  const enabledPlugins = useEnabledPlugins();
  const hasTeamsPlugin = enabledPlugins.has('teams');
  const { teams } = useTeams();
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [primarySort, setPrimarySort] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<TaskColumnCount>(getInitialTaskColumnCount);
  const [listViewMode, setListViewModeState] = useState<TaskListViewMode>(
    getInitialTaskListViewMode,
  );
  const [activeFilters, setActiveFilters] =
    useState<TaskListFilterSelection>(TASK_LIST_FILTER_INITIAL);
  const [settingsCategory, setSettingsCategory] = useState<TaskSettingsCategory>('view');

  useEffect(() => {
    let cancelled = false;
    getSettings(TASKS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolveTaskColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(TASKS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        const nextView = resolveTaskListViewMode(settings);
        setListViewModeState(nextView);
        persistTaskListViewModeSession(nextView);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: TaskColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistTaskListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(TASKS_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(TASKS_SETTINGS_KEY, { columnCount: count, listViewMode: 'cards' }).catch(
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
    setSortOrder(isTaskStringSortField(field) ? 'asc' : 'desc');
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

  const isTableView = listViewMode === 'table';
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
  const stats = useMemo(
    () => ({
      total: tasks.length,
      open: tasks.filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
        .length,
      completed: tasks.filter((task) => task.status === 'completed').length,
      overdue: tasks.filter((task) => {
        if (!task.dueDate || task.status === 'completed' || task.status === 'cancelled') {
          return false;
        }
        return new Date(task.dueDate).getTime() < Date.now();
      }).length,
    }),
    [tasks],
  );

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

  const handleOpenForView = (task: any) => {
    attemptNavigation(() => openTaskForView(task));
  };

  const handleListStatusChange = useCallback(
    async (task: Task, newStatus: string) => {
      if (task.status === newStatus) {
        return;
      }
      const isCurrent = currentTask?.id === task.id;
      const draft = isCurrent ? quickEditDraft : null;
      await saveTask(buildTaskListStatusSavePayload(task, newStatus, draft), task.id);
    },
    [currentTask?.id, quickEditDraft, saveTask],
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
        <div className="px-6 py-4">
          <TaskSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            renderCategoryButtonsInline
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeTaskSettingsView}
              >
                {t('common.close')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-tasks min-h-full bg-background px-6 py-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.tasks')}</h2>
            <p className="text-sm text-muted-foreground">{t('tasks.listDescription')}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={() => openTaskSettings()}
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openTaskPanel(null))}
            >
              {t('tasks.addTask')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <ListFilterStatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilters.length === 0}
            onClick={() => setActiveFilters([])}
          />
          <ListFilterStatCard
            label="Open"
            value={stats.open}
            dotClassName="bg-amber-500"
            active={isFilterActive('open')}
            onClick={() => toggleFilter('open')}
          />
          <ListFilterStatCard
            label="Completed"
            value={stats.completed}
            dotClassName="bg-emerald-500"
            active={isFilterActive('completed')}
            onClick={() => toggleFilter('completed')}
          />
          <ListFilterStatCard
            label="Overdue"
            value={stats.overdue}
            dotClassName="bg-rose-500"
            active={isFilterActive('overdue')}
            onClick={() => toggleFilter('overdue')}
          />
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
          <ListToolbar
            selectedCount={selectedCount}
            showSelectAll={sortedTasks.length > 0}
            quickAddOpen={quickAddOpen}
            quickAddExpanded={
              quickAddOpen ? (
                <TaskQuickAdd
                  viewMode="grid"
                  layout="toolbar"
                  open={quickAddOpen}
                  onOpenChange={setQuickAddOpen}
                  onCreate={handleQuickCreate}
                />
              ) : null
            }
            selectAll={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                icon={CheckSquare}
                onClick={handleHeaderCheckboxChange}
              >
                Select all
              </Button>
            }
            leadingActions={
              quickAddOpen ? null : (
                <TaskQuickAdd
                  viewMode="grid"
                  layout="toolbar"
                  open={quickAddOpen}
                  onOpenChange={setQuickAddOpen}
                  onCreate={handleQuickCreate}
                />
              )
            }
            search={
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t('tasks.searchPlaceholder', { count: tasks.length })}
                  className="h-8 bg-background pl-9 text-xs"
                />
              </div>
            }
            trailing={
              <>
                {!isTableView ? (
                  <div className="mr-1 flex items-center gap-1">
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
                ) : null}
                <ListColumnLayoutToggle
                  columnCount={columnCount}
                  listViewMode={listViewMode}
                  onSelectColumns={setColumnCount}
                  onSelectTable={() => setListViewMode('table')}
                  columnAriaLabel={(count) => t(`tasks.columns${count}`)}
                  tableAriaLabel={t('common.tableView')}
                />
              </>
            }
            bulkActions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={XCircle}
                  className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                  onClick={clearTaskSelection}
                  type="button"
                >
                  {t('common.clearSelection')}
                </Button>
                <span className="inline-flex h-9 items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[10px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                  {t('bulk.selected', { count: selectedCount })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={SlidersHorizontal}
                  onClick={() => setShowBulkStatusDialog(true)}
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                >
                  {t('tasks.bulkStatusAction')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={FileSpreadsheet}
                  onClick={handleExportCSV}
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                >
                  Export CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={FileText}
                  onClick={handleExportPDF}
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                >
                  Export PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                >
                  {t('common.delete')}
                </Button>
              </>
            }
          />

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
              onRowClick={handleOpenForView}
              onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
              onCheckboxChange={onVisibleRowCheckboxChange}
              allVisibleSelected={allVisibleSelected}
              onHeaderCheckboxChange={handleHeaderCheckboxChange}
              recentlyDuplicatedTaskId={recentlyDuplicatedTaskId}
            />
          ) : (
            <div
              className={cn(
                'grid gap-3',
                columnCount === 1 && 'grid-cols-1',
                columnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                columnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
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
                    onClick={() => handleOpenForView(task)}
                    assignedNames={assignedContacts.map((c) => c.companyName)}
                    assignedTeamName={getAssignedTeamName(task)}
                    onStatusChange={(status) => handleListStatusChange(task, status)}
                    columnCount={columnCount}
                    checkbox={
                      <input
                        type="checkbox"
                        checked={taskIsSelected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(task.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={taskIsSelected ? 'Unselect task' : 'Select task'}
                      />
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
  );
}
