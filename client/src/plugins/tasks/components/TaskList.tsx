import {
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  List as ListIcon,
  Plus,
  Search,
  Settings,
  X,
} from 'lucide-react';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { exportItems } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useTasks } from '../hooks/useTasks';
import { TASK_STATUS_COLORS, TASK_PRIORITY_COLORS, formatStatusForDisplay } from '../types/tasks';
import { getTasksExportConfig } from '../utils/taskExportConfig';

import { TaskSettingsView, type TaskSettingsCategory } from './TaskSettingsView';

type SortField = 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';
const TASKS_VIEW_MODE_STORAGE_KEY = 'tasks:viewMode';

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  return window.sessionStorage.getItem(TASKS_VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

const TASKS_SETTINGS_KEY = 'tasks';
const HIGHLIGHT_CLASS = 'bg-green-50 dark:bg-green-950/30';

function StatCard({
  label,
  value,
  dotClassName,
}: {
  label: string;
  value: number;
  dotClassName: string;
}) {
  return (
    <Card className="rounded-xl border-0 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} aria-hidden />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
    </Card>
  );
}

export const TaskList: React.FC = () => {
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
  } = useTasks();
  const { contacts, getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);
  const [settingsCategory, setSettingsCategory] = useState<TaskSettingsCategory>('view');

  useEffect(() => {
    let cancelled = false;
    getSettings(TASKS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const nextMode: ViewMode = settings?.viewMode === 'grid' ? 'grid' : 'list';
        setViewModeState(nextMode);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(TASKS_VIEW_MODE_STORAGE_KEY, nextMode);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(TASKS_VIEW_MODE_STORAGE_KEY, mode);
      }
      updateSettings(TASKS_SETTINGS_KEY, { viewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const stripHtml = (html: string): string => {
    if (!html) {
      return '';
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent ?? tmp.innerText ?? '';
  };

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

  const sortedTasks = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const filtered = tasks.filter((task) => {
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

      return matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      let aValue: string | Date | null;
      let bValue: string | Date | null;

      if (sortField === 'title') {
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
      } else if (sortField === 'status') {
        aValue = a.status;
        bValue = b.status;
      } else if (sortField === 'priority') {
        const priorityOrder = { High: 3, Medium: 2, Low: 1 };
        aValue = priorityOrder[a.priority].toString();
        bValue = priorityOrder[b.priority].toString();
      } else if (sortField === 'dueDate') {
        aValue = a.dueDate;
        bValue = b.dueDate;
      } else if (sortField === 'createdAt') {
        aValue = a.createdAt;
        bValue = b.createdAt;
      } else {
        aValue = a.updatedAt;
        bValue = b.updatedAt;
      }

      if (sortField === 'title' || sortField === 'status' || sortField === 'priority') {
        if (sortOrder === 'asc') {
          return (aValue as string).localeCompare(bValue as string);
        } else {
          return (bValue as string).localeCompare(aValue as string);
        }
      } else {
        if (!aValue && !bValue) {
          return 0;
        }
        if (!aValue) {
          return sortOrder === 'asc' ? 1 : -1;
        }
        if (!bValue) {
          return sortOrder === 'asc' ? -1 : 1;
        }

        if (sortOrder === 'asc') {
          return (aValue as Date).getTime() - (bValue as Date).getTime();
        } else {
          return (bValue as Date).getTime() - (aValue as Date).getTime();
        }
      }
    });
  }, [tasks, searchTerm, sortField, sortOrder, contacts, getAssignedContacts]);

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

  const someVisibleSelected = useMemo(
    () => visibleTaskIds.some((id) => isSelected(id)),
    [visibleTaskIds, isSelected],
  );

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearTaskSelection();
    } else {
      selectAllTasks(visibleTaskIds);
    }
  };

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

  const formatDueDate = (dueDate: Date | null) => {
    if (!dueDate) {
      return null;
    }
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: `${Math.abs(diffDays)} days overdue`,
        className: 'text-destructive font-medium',
      };
    } else if (diffDays === 0) {
      return { text: 'Due today', className: 'text-orange-600 dark:text-orange-400 font-medium' };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', className: 'text-yellow-600 dark:text-yellow-400' };
    } else {
      return { text: due.toLocaleDateString(), className: 'text-muted-foreground' };
    }
  };

  const handleOpenForView = (task: any) => {
    attemptNavigation(() => openTaskForView(task));
  };

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
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.tasks')}</h2>
            <p className="text-sm text-muted-foreground">{t('tasks.listDescription')}</p>
          </div>
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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total" value={stats.total} dotClassName="bg-blue-500" />
          <StatCard label="Open" value={stats.open} dotClassName="bg-amber-500" />
          <StatCard label="Completed" value={stats.completed} dotClassName="bg-emerald-500" />
          <StatCard label="Overdue" value={stats.overdue} dotClassName="bg-rose-500" />
        </div>

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearTaskSelection}
            actions={[
              {
                label: 'Export CSV',
                icon: FileSpreadsheet,
                onClick: handleExportCSV,
                variant: 'default',
              },
              { label: 'Export PDF', icon: FileText, onClick: handleExportPDF, variant: 'default' },
              {
                label: t('common.delete'),
                icon: Trash2,
                onClick: () => setShowBulkDeleteModal(true),
                variant: 'destructive',
              },
            ]}
          />
        )}

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="tasks"
          isLoading={deleting}
        />

        <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950">
          <div className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3">
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('tasks.searchPlaceholder', { count: tasks.length })}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                icon={Settings}
                className="h-8 px-2.5 text-xs"
                onClick={() => openTaskSettings()}
                title={t('common.settings')}
              >
                {t('common.settings')}
              </Button>
              <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Grid3x3}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'grid'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setViewMode('grid')}
                >
                  {t('slots.grid')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={ListIcon}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'list'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setViewMode('list')}
                >
                  {t('slots.list')}
                </Button>
              </div>
            </div>
          </div>
          {sortedTasks.length === 0 ? (
            <Card className="border-0 shadow-none">
              <div className="p-6 text-center text-muted-foreground">
                {searchTerm ? t('tasks.noMatch') : t('tasks.noYet')}
              </div>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedTasks.map((task, index) => {
                const taskIsSelected = isSelected(task.id);
                const assignedContacts = getAssignedContacts(task);
                return (
                  <Card
                    key={task.id}
                    className={cn(
                      'relative flex h-full min-h-[160px] cursor-pointer flex-col gap-3 rounded-xl border-0 bg-card p-5 shadow-sm transition-all',
                      taskIsSelected
                        ? 'plugin-tasks bg-plugin-subtle ring-1 border-plugin-subtle ring-plugin-subtle/50'
                        : 'hover:border-plugin-subtle hover:plugin-tasks hover:shadow-md',
                      recentlyDuplicatedTaskId === String(task.id) && HIGHLIGHT_CLASS,
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        return;
                      }
                      e.preventDefault();
                      handleOpenForView(task);
                    }}
                    data-list-item={JSON.stringify(task)}
                    data-plugin-name="tasks"
                    role="button"
                    aria-label={`Open task ${task.title}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="checkbox"
                        checked={taskIsSelected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(task.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer h-4 w-4"
                        aria-label={taskIsSelected ? 'Unselect task' : 'Select task'}
                      />
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Badge className={TASK_STATUS_COLORS[task.status]}>
                          {formatStatusForDisplay(task.status)}
                        </Badge>
                        <Badge className={TASK_PRIORITY_COLORS[task.priority]}>
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                    <h3 className="line-clamp-1 text-base font-semibold leading-snug">
                      {task.title}
                    </h3>
                    <div className="flex min-h-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                      {assignedContacts.length > 0 && (
                        <div className="plugin-contacts truncate font-medium text-plugin">
                          Assigned: {assignedContacts.map((c) => c.companyName).join(', ')}
                        </div>
                      )}
                      {task.dueDate && (
                        <div className={formatDueDate(task.dueDate)?.className || ''}>
                          {formatDueDate(task.dueDate)?.text}
                        </div>
                      )}
                    </div>
                    <div className="mt-auto flex flex-col gap-1 text-[10px] leading-snug text-muted-foreground">
                      <div>Updated: {new Date(task.updatedAt).toLocaleDateString()}</div>
                      <div>Created: {new Date(task.createdAt).toLocaleDateString()}</div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : isMobile ? (
            <Card className="border-0 shadow-none">
              <div className="space-y-2 p-4">
                {sortedTasks.map((task, index) => {
                  const taskIsSelected = isSelected(task.id);
                  const assignedContacts = getAssignedContacts(task);
                  return (
                    <Card
                      key={task.id}
                      className={cn(
                        'p-4 cursor-pointer hover:bg-accent transition-colors',
                        recentlyDuplicatedTaskId === String(task.id) && HIGHLIGHT_CLASS,
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                          return;
                        }
                        e.preventDefault();
                        handleOpenForView(task);
                      }}
                      data-list-item={JSON.stringify(task)}
                      data-plugin-name="tasks"
                      role="button"
                      aria-label={`Open task ${task.title}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={taskIsSelected}
                              onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                              onChange={() => onVisibleRowCheckboxChange(task.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="cursor-pointer h-5 w-5 flex-shrink-0 mt-0.5"
                              aria-label={taskIsSelected ? 'Unselect task' : 'Select task'}
                            />
                            <h3 className="font-semibold text-base truncate">{task.title}</h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge className={TASK_STATUS_COLORS[task.status]}>
                              {formatStatusForDisplay(task.status)}
                            </Badge>
                            <Badge className={TASK_PRIORITY_COLORS[task.priority]}>
                              {task.priority}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-1 text-sm">
                            {task.dueDate && (
                              <div className={formatDueDate(task.dueDate)?.className || ''}>
                                {formatDueDate(task.dueDate)?.text}
                              </div>
                            )}
                            {assignedContacts.length > 0 && (
                              <div className="plugin-contacts text-plugin">
                                Assigned: {assignedContacts.map((c) => c.companyName).join(', ')}
                              </div>
                            )}
                            <div className="text-muted-foreground">
                              Updated {new Date(task.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card className="border-0 shadow-none">
              <Table rowBorders={false}>
                <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-12 text-xs">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={handleHeaderCheckboxChange}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={allVisibleSelected ? 'Deselect all tasks' : 'Select all tasks'}
                      />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Title</span>
                        {sortField === 'title' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDown className="h-3 w-3 inline" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Status</span>
                        {sortField === 'status' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDown className="h-3 w-3 inline" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
                      onClick={() => handleSort('priority')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Priority</span>
                        {sortField === 'priority' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDown className="h-3 w-3 inline" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
                      onClick={() => handleSort('dueDate')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Due Date</span>
                        {sortField === 'dueDate' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDown className="h-3 w-3 inline" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">Assigned</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
                      onClick={() => handleSort('updatedAt')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Updated</span>
                        {sortField === 'updatedAt' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDown className="h-3 w-3 inline" />
                          ))}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTasks.map((task, index) => {
                    const taskIsSelected = isSelected(task.id);
                    return (
                      <TableRow
                        key={task.id}
                        className={cn(
                          'cursor-pointer bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80',
                          taskIsSelected && 'bg-plugin-subtle',
                          recentlyDuplicatedTaskId === String(task.id) && HIGHLIGHT_CLASS,
                        )}
                        tabIndex={0}
                        data-list-item={JSON.stringify(task)}
                        data-plugin-name="tasks"
                        role="button"
                        aria-label={`Open task ${task.title}`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                            return;
                          }
                          e.preventDefault();
                          handleOpenForView(task);
                        }}
                      >
                        <TableCell className="w-12 text-xs" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={taskIsSelected}
                            onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                            onChange={() => onVisibleRowCheckboxChange(task.id)}
                            className="h-4 w-4 cursor-pointer"
                            aria-label={taskIsSelected ? 'Unselect task' : 'Select task'}
                          />
                        </TableCell>
                        <TableCell className="font-semibold">{task.title}</TableCell>
                        <TableCell>
                          <Badge className={TASK_STATUS_COLORS[task.status]}>
                            {formatStatusForDisplay(task.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={TASK_PRIORITY_COLORS[task.priority]}>
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {task.dueDate ? (
                            <div className={formatDueDate(task.dueDate)?.className || ''}>
                              {formatDueDate(task.dueDate)?.text}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const assignedContacts = getAssignedContacts(task);
                            if (assignedContacts.length === 0) {
                              return <span className="text-muted-foreground text-sm">—</span>;
                            }
                            return (
                              <div className="text-sm plugin-contacts text-plugin">
                                {assignedContacts.map((c) => c.companyName).join(', ')}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(task.updatedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </Card>
      </div>
    </div>
  );
};
