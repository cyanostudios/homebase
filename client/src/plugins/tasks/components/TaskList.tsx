import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Circle,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Menu,
  Plus,
  Settings,
  SlidersHorizontal,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableQuickAdd } from '@/components/ui/round-expandable-quick-add';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useApp } from '@/core/api/AppContext';
import { useRegisterBrowseOrder } from '@/core/hooks/useRegisterBrowseOrder';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { InlinePanelFormActions } from '@/core/ui/InlinePanelFormActions';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { ListFilterChipsToggle } from '@/core/ui/ListFilterChipsToggle';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { exportItems } from '@/core/utils/exportUtils';
import { stripHtml } from '@/core/utils/textUtils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useTasks } from '../hooks/useTasks';
import { type Task } from '../types/tasks';
import { TASKS_SETTINGS_KEY } from '../utils/taskColumnCount';
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
import {
  compareTasksByField,
  isTaskAscDefaultField,
  nextTaskTableSort,
  type TaskSortField,
  type TaskSortOrder,
} from '../utils/taskListSort';
import { resolveVisibleTaskTableColumns, type TaskTableColumnId } from '../utils/taskTableColumns';

import { TaskBulkStatusDialog } from './TaskBulkStatusDialog';
import { TaskForm } from './TaskForm';
import { TaskListTable } from './TaskListTable';
import { TaskSettingsView, type TaskSettingsCategory } from './TaskSettingsView';
import { TasksStatisticsView } from './TasksStatisticsView';
import { TaskView } from './TaskView';

type SortField = TaskSortField;
type SortOrder = TaskSortOrder;

const TASKS_TOOLBAR_COLLAPSED_STORAGE_KEY = 'homebase.tasks.toolbar.collapsed';
const TASKS_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.tasks.toolbar.filtersVisible';

function readTasksToolbarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(TASKS_TOOLBAR_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeTasksToolbarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(TASKS_TOOLBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'updatedAt', labelKey: 'common.updated' },
  { value: 'title', labelKey: 'tasks.title' },
  { value: 'status', labelKey: 'tasks.propertyStatus' },
  { value: 'priority', labelKey: 'tasks.propertyPriority' },
  { value: 'dueDate', labelKey: 'tasks.propertyDueDate' },
  { value: 'createdAt', labelKey: 'common.created' },
];

let pendingQuickContextTaskId: string | null = null;

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
    setBrowseOrderIds,
    isTaskPanelOpen,
    panelMode,
    currentTask,
    saveTask,
    closeTaskPanel,
    validationErrors,
  } = useTasks();
  const { contacts, getSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openTaskPanel(null)),
    onSettings: () => openTaskSettings(),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;
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
  const [primarySort, setPrimarySort] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [visibleColumnIds, setVisibleColumnIds] = useState<TaskTableColumnId[]>(() =>
    resolveVisibleTaskTableColumns(null),
  );
  const [activeFilters, setActiveFilters] =
    useState<TaskListFilterSelection>(TASK_LIST_FILTER_INITIAL);
  const [settingsCategory, setSettingsCategory] = useState<TaskSettingsCategory>('import');
  const [previewTask, setPreviewTask] = useState<Task | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(readTasksToolbarCollapsed);
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    TASKS_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const restoredPendingTaskRef = useRef(false);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inlineForm =
    showDesktopSplit && isTaskPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isTaskPanelOpen && panelMode === 'view' && currentTask != null;
  const detailTask = inlinePanelView ? currentTask : previewTask;
  const activeListTaskId =
    (inlineForm || inlinePanelView) && currentTask != null
      ? currentTask.id
      : (previewTask?.id ?? null);

  const toggleToolbarCollapsed = useCallback(() => {
    setToolbarCollapsed((prev) => {
      const next = !prev;
      writeTasksToolbarCollapsed(next);
      return next;
    });
  }, []);

  const updateToolbarToggleBox = useCallback(() => {
    const el = pageShellRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const sidebarToggle = document.querySelector<HTMLElement>('[aria-controls="left-sidebar-nav"]');
    const sidebarTop = sidebarToggle?.getBoundingClientRect().top;
    setToolbarToggleBox({
      top: typeof sidebarTop === 'number' ? sidebarTop : rect.top + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    updateToolbarToggleBox();
    window.addEventListener('resize', updateToolbarToggleBox);
    const scrollParent = pageShellRef.current?.closest('.overflow-y-auto, .overflow-auto');
    scrollParent?.addEventListener('scroll', updateToolbarToggleBox, { passive: true });
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateToolbarToggleBox) : null;
    if (pageShellRef.current && ro) {
      ro.observe(pageShellRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateToolbarToggleBox);
      scrollParent?.removeEventListener('scroll', updateToolbarToggleBox);
      ro?.disconnect();
    };
  }, [updateToolbarToggleBox]);

  useEffect(() => {
    if (restoredPendingTaskRef.current || !pendingQuickContextTaskId) {
      return;
    }
    const restored = tasks.find((task) => String(task.id) === pendingQuickContextTaskId);
    if (restored) {
      setPreviewTask(restored);
      restoredPendingTaskRef.current = true;
      pendingQuickContextTaskId = null;
    }
  }, [tasks]);

  useEffect(() => {
    let cancelled = false;
    getSettings(TASKS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setVisibleColumnIds(resolveVisibleTaskTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isTaskAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextTaskTableSort(primarySort, sortOrder, field);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

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

  useEffect(() => {
    if (!previewTask) {
      return;
    }
    const next = tasks.find((task) => String(task.id) === String(previewTask.id));
    if (!next) {
      setPreviewTask(null);
      return;
    }
    if (next !== previewTask) {
      setPreviewTask(next);
    }
  }, [tasks, previewTask]);

  useEffect(() => {
    if (!showDesktopSplit || !isTaskPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentTask) {
      setPreviewTask(currentTask);
    }
  }, [showDesktopSplit, isTaskPanelOpen, panelMode, currentTask]);

  const isFilterActive = (filter: TaskListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: TaskListFilter) => {
    setActiveFilters((prev) => toggleTaskListFilter(prev, filter));
  };

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: tasks.length,
      open: tasks.filter((task) => taskIsOpen(task)).length,
      completed: tasks.filter((task) => task.status === 'completed').length,
      overdue: tasks.filter((task) => taskIsOverdue(task, now)).length,
    };
  }, [tasks]);

  const visibleTaskIds = useMemo(() => sortedTasks.map((task) => String(task.id)), [sortedTasks]);

  useRegisterBrowseOrder(setBrowseOrderIds, visibleTaskIds);

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
    } catch (err: unknown) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = useCallback(() => {
    if (selectedTaskIds.length === 0) {
      alert('Please select tasks to export');
      return;
    }
    const exportTasks = tasks.filter((task) => selectedTaskIds.includes(String(task.id)));
    const filename = `tasks-export-${new Date().toISOString().split('T')[0]}`;
    exportItems({
      items: exportTasks,
      format: 'csv',
      config: getTasksExportConfig(contacts ?? []),
      filename,
      title: 'Tasks Export',
    });
  }, [contacts, selectedTaskIds, tasks]);

  const handleExportPDF = useCallback(async () => {
    if (selectedTaskIds.length === 0) {
      alert('Please select tasks to export');
      return;
    }
    const exportTasks = tasks.filter((task) => selectedTaskIds.includes(String(task.id)));
    const filename = `tasks-export-${new Date().toISOString().split('T')[0]}`;
    const result = exportItems({
      items: exportTasks,
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
  }, [contacts, selectedTaskIds, tasks]);

  const handleOpenForView = (task: Task) => {
    pendingQuickContextTaskId = String(task.id);
    attemptNavigation(() => openTaskForView(task));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearTaskSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (task: Task) => {
    if (isCompactViewport) {
      handleOpenForView(task);
      return;
    }
    if (selectionMode) {
      toggleTaskSelected(String(task.id));
      return;
    }
    if (
      isTaskPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeTaskPanel();
        setPreviewTask(task);
      });
      return;
    }
    setPreviewTask((current) => (current && String(current.id) === String(task.id) ? null : task));
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    closeTaskPanel();
  }, [closeTaskPanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: any) => {
      const ok = await saveTask(data, currentTask?.id);
      return ok;
    },
    [currentTask?.id, saveTask],
  );

  const inlineFormHasBlockingErrors = validationErrors.some(
    (e) => !String(e?.message || '').includes('Warning'),
  );

  const handleQuickCreate = useCallback(
    async (title: string) => {
      const task = await createTask({ title, content: '' });
      setRecentlyDuplicatedTaskId(String(task.id));
    },
    [createTask, setRecentlyDuplicatedTaskId],
  );

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
        label: t('common.exportCsv', { defaultValue: 'Export CSV' }),
        icon: FileSpreadsheet,
        disabled,
        onClick: handleExportCSV,
      },
      {
        key: 'pdf',
        label: t('common.exportPdf', { defaultValue: 'Export PDF' }),
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

  const headerDropdownTriggerClass =
    'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

  const headerDropdownTriggerDangerClass =
    'gap-1.5 border-0 bg-red-600/10 px-3.5 text-sm font-extrabold text-red-700 shadow-none hover:bg-red-600 hover:text-white dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white';

  const renderFilterChips = () => {
    const chips: Array<{
      key: string;
      active: boolean;
      icon: typeof LayoutGrid;
      label: string;
      count: number;
      onClick: () => void;
    }> = [
      {
        key: 'all',
        active: activeFilters.length === 0,
        icon: LayoutGrid,
        label: t('tasks.filter.total'),
        count: stats.total,
        onClick: () => setActiveFilters([]),
      },
      {
        key: 'open',
        active: isFilterActive('open'),
        icon: Circle,
        label: t('tasks.filter.open'),
        count: stats.open,
        onClick: () => toggleFilter('open'),
      },
      {
        key: 'completed',
        active: isFilterActive('completed'),
        icon: CheckCircle2,
        label: t('tasks.filter.completed'),
        count: stats.completed,
        onClick: () => toggleFilter('completed'),
      },
      {
        key: 'overdue',
        active: isFilterActive('overdue'),
        icon: AlertCircle,
        label: t('tasks.filter.overdue'),
        count: stats.overdue,
        onClick: () => toggleFilter('overdue'),
      },
    ];

    return (
      <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <Button
              key={chip.key}
              type="button"
              variant="ghost"
              size="sm"
              onClick={chip.onClick}
              className={cn(chip.active ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>
                {chip.label} <span className="tabular-nums font-semibold">({chip.count})</span>
              </span>
            </Button>
          );
        })}
      </div>
    );
  };

  const primarySortLabel =
    SORT_FIELD_OPTIONS.find((option) => option.value === primarySort)?.labelKey ??
    SORT_FIELD_OPTIONS[0].labelKey;

  const renderSortDropdown = (triggerClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('tasks.sort', { defaultValue: 'Sort' })}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('tasks.sort', { defaultValue: 'Sort' })}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[14rem] rounded-xl border-border/50 shadow-xl"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {t(primarySortLabel)}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={primarySort}
          onValueChange={(value) => handlePrimarySortChange(value as SortField)}
        >
          {SORT_FIELD_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="rounded-md text-xs"
              onSelect={(event) => event.preventDefault()}
            >
              {t(option.labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {sortOrder === 'asc' ? t('tasks.sortAsc') : t('tasks.sortDesc')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as SortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('tasks.sortAsc')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('tasks.sortDesc')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderBulkActionBar = (className?: string) =>
    selectionMode ? (
      <BulkActionRoundBar
        selectedCount={selectedCount}
        actions={bulkRoundActions}
        size="xs"
        className={cn('gap-1.5', className)}
      />
    ) : null;

  const renderSelectControls = (triggerClassName: string) => {
    if (sortedTasks.length === 0) {
      return null;
    }

    if (!selectionMode) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('common.select')}
          aria-pressed={false}
          onClick={handleEnterSelectionMode}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>{t('common.select')}</span>
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(headerDropdownTriggerDangerClass, triggerClassName)}
        aria-label={t('common.clear')}
        aria-pressed={true}
        onClick={handleExitSelectionMode}
      >
        <XCircle className="h-3.5 w-3.5" />
        <span>{t('common.clear')}</span>
      </Button>
    );
  };

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

  const toolbarEdgeToggle =
    typeof document !== 'undefined' && toolbarToggleBox
      ? createPortal(
          <div
            className="pointer-events-none fixed z-40 hidden justify-center md:flex"
            style={{
              top: toolbarToggleBox.top,
              left: toolbarToggleBox.left,
              width: toolbarToggleBox.width,
            }}
          >
            <div className="pointer-events-auto">
              <RoundIconLabelButton
                icon={Menu}
                label={toolbarCollapsed ? t('tasks.expandToolbar') : t('tasks.collapseToolbar')}
                variant={toolbarCollapsed ? 'primary' : 'secondary'}
                size="xs"
                expandOnHover={false}
                className={
                  toolbarCollapsed
                    ? undefined
                    : 'bg-white text-primary shadow-sm hover:bg-primary hover:text-primary-foreground dark:bg-white dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground'
                }
                aria-expanded={!toolbarCollapsed}
                aria-controls="tasks-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  const detailColumnOpen = Boolean(detailTask || inlineForm);

  return (
    <>
      {toolbarEdgeToggle}
      <div
        ref={pageShellRef}
        className={cn(
          'plugin-tasks flex min-h-0 flex-1 flex-col',
          PLUGIN_PAGE_LIST_SHELL_CLASS,
          showDesktopSplit
            ? 'overflow-hidden px-3 pb-3 pt-3 md:px-3 md:pb-3 md:pt-3'
            : 'overflow-y-auto md:pt-3',
        )}
      >
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            showDesktopSplit && toolbarCollapsed ? 'gap-0' : 'gap-3',
          )}
        >
          <div className="relative hidden shrink-0 md:block">
            <div
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                toolbarCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
              )}
              aria-hidden={toolbarCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  id="tasks-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.tasks')}</h2>
                    <ExpandableIconButton
                      icon={Settings}
                      label={t('common.settings')}
                      variant="soft"
                      onClick={() => openTaskSettings()}
                    />
                    {renderSortDropdown('h-11 rounded-full')}
                    <ListFilterChipsToggle
                      visible={filtersVisible}
                      onVisibleChange={setFiltersVisible}
                      className="h-11 rounded-full"
                    />
                    {renderSelectControls('h-11 rounded-full')}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RoundExpandableQuickAdd
                      icon={CheckSquare}
                      label={t('tasks.quickAdd')}
                      placeholder={t('tasks.quickAddPlaceholder')}
                      onCreate={handleQuickCreate}
                      defaultExpanded
                      variant={detailColumnOpen ? 'soft' : 'primary'}
                    />
                    <RoundExpandableSearch
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder={t('tasks.searchPlaceholder', { count: tasks.length })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('tasks.addTask')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openTaskPanel(null))}
                    />
                  </div>
                </div>
                {filtersVisible ? (
                  <div
                    className={cn(
                      LIST_FILTER_AND_SORT_ROW_CLASS,
                      'pt-2',
                      toolbarCollapsed && 'pointer-events-none',
                    )}
                  >
                    {renderFilterChips()}
                  </div>
                ) : null}
                {renderBulkActionBar('py-3')}
              </div>
            </div>
          </div>

          <div className={cn(LIST_FILTER_AND_SORT_ROW_CLASS, 'shrink-0 md:hidden')}>
            {filtersVisible ? renderFilterChips() : null}
            <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
              <ListFilterChipsToggle
                visible={filtersVisible}
                onVisibleChange={setFiltersVisible}
                className="h-7 rounded-md"
              />
              {renderSortDropdown('h-7 rounded-md')}
            </div>
          </div>

          {selectionMode ? (
            <div className="shrink-0 py-3 md:hidden">{renderBulkActionBar()}</div>
          ) : null}

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

          <div
            className={cn(
              'grid min-h-0 min-w-0 gap-2',
              showDesktopSplit
                ? 'flex-1 grid-cols-[minmax(220px,20%)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch'
                : 'grid-cols-1 items-start',
            )}
          >
            <div
              className={cn(
                'min-w-0',
                showDesktopSplit && 'h-full min-h-0 overflow-y-auto overscroll-contain',
              )}
            >
              <div className="flex min-w-0 flex-col gap-3">
                {sortedTasks.length === 0 ? (
                  <ListEmptyState
                    message={searchTerm ? t('tasks.noMatch') : t('tasks.noYet')}
                    createLabel={!searchTerm ? t('tasks.addTask') : undefined}
                    onCreate={
                      !searchTerm ? () => attemptNavigation(() => openTaskPanel(null)) : undefined
                    }
                  />
                ) : (
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
                    activeTaskId={activeListTaskId}
                    visibleColumnIds={visibleColumnIds}
                    getAssignedNames={(task) =>
                      getAssignedContacts(task).map((c) => c.companyName as string)
                    }
                    getAssignedTeamName={getAssignedTeamName}
                  />
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

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('tasks.quickContext.title')}
                aria-live="polite"
              >
                {inlineForm ? (
                  <div className="flex min-h-0 flex-col gap-3">
                    <div className="flex shrink-0 justify-end">
                      <InlinePanelFormActions
                        mode={panelMode === 'edit' ? 'edit' : 'create'}
                        hasBlockingErrors={inlineFormHasBlockingErrors}
                        onClose={handleInlineFormClose}
                        onSave={() => {
                          void handleInlineFormSave();
                        }}
                        t={t}
                      />
                    </div>
                    <TaskForm
                      ref={inlineFormRef}
                      currentTask={currentTask}
                      onSave={handleInlineFormOnSave}
                      onCancel={closeTaskPanel}
                      stacked
                    />
                  </div>
                ) : detailTask ? (
                  <TaskView task={detailTask} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <TasksStatisticsView />
                  </Card>
                )}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
