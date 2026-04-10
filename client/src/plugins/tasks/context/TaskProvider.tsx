import { CheckSquare, ExternalLink, Share, User } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { useActionRegistry } from '@/core/api/ActionContext';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginDuplicate } from '@/core/hooks/usePluginDuplicate';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';
import { exportItems, type ExportFormat } from '@/core/utils/exportUtils';
import { resolveSlug } from '@/core/utils/slugUtils';
import { cn } from '@/lib/utils';

import { taskShareApi, tasksApi } from '../api/tasksApi';
import {
  Task,
  TASK_PRIORITY_COLORS,
  TASK_STATUS_COLORS,
  TaskShare,
  ValidationError,
  formatStatusForDisplay,
} from '../types/tasks';
import { getTaskExportBaseFilename, getTasksExportConfig } from '../utils/taskExportConfig';

import { TaskContext } from './TaskContext';
import type { TaskContextType } from './TaskContext';

interface TaskProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function TaskProvider({ children, isAuthenticated, onCloseOtherPanels }: TaskProviderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const {
    registerPanelCloseFunction,
    unregisterPanelCloseFunction,
    contacts,
    refreshData,
    registerTasksNavigation,
  } = useApp();
  const { registerAction } = useActionRegistry();
  const { navigateToItem, navigateToBase } = useItemUrl('/tasks');

  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksContentView, setTasksContentView] = useState<'list' | 'settings'>('list');
  const [recentlyDuplicatedTaskId, setRecentlyDuplicatedTaskId] = useState<string | null>(null);
  const [quickEditDraft, setQuickEditDraft] = useState<Partial<{
    status: string;
    priority: string;
    dueDate: Date | null;
    assignedToIds: string[];
  }> | null>(null);
  const [showDiscardQuickEditDialog, setShowDiscardQuickEditDialog] = useState(false);

  const {
    selectedIds: selectedTaskIds,
    toggleSelection: toggleTaskSelectedCore,
    selectAll: selectAllTasksCore,
    mergeIntoSelection: mergeIntoTaskSelectionCore,
    clearSelection: clearTaskSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  const closeTaskPanel = useCallback(() => {
    setIsTaskPanelOpen(false);
    setCurrentTask(null);
    setPanelMode('create');
    setValidationErrors([]);
    setQuickEditDraft(null);
    navigateToBase();
  }, [navigateToBase, setValidationErrors]);

  useEffect(() => {
    registerPanelCloseFunction('tasks', closeTaskPanel);
    return () => {
      unregisterPanelCloseFunction('tasks');
    };
  }, [closeTaskPanel, registerPanelCloseFunction, unregisterPanelCloseFunction]);

  const loadTasks = useCallback(async () => {
    try {
      const tasksData = await tasksApi.getTasks();
      const transformedTasks = tasksData.map((task: any) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
      }));
      setTasks(transformedTasks);
    } catch (error: any) {
      console.error('Failed to load tasks:', error);
      const errorMessage = error?.message || error?.error || 'Failed to load tasks';
      setValidationErrors([{ field: 'general', message: errorMessage }]);
    }
  }, [setValidationErrors]);

  useEffect(() => {
    if (isAuthenticated) {
      loadTasks();
    } else {
      setTasks([]);
    }
  }, [isAuthenticated, loadTasks]);

  const validateTask = useCallback((taskData: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!taskData.title?.trim()) {
      errors.push({ field: 'title', message: 'Task title is required' });
    }

    if (
      taskData.content !== undefined &&
      taskData.content !== null &&
      typeof taskData.content !== 'string'
    ) {
      errors.push({ field: 'content', message: 'Task description must be a string' });
    }

    if (!taskData.status) {
      errors.push({ field: 'status', message: 'Task status is required' });
    }

    if (!taskData.priority) {
      errors.push({ field: 'priority', message: 'Task priority is required' });
    }

    return errors;
  }, []);

  const openTaskPanel = useCallback(
    (task: Task | null) => {
      clearTaskSelectionCore();
      setRecentlyDuplicatedTaskId(null);
      setCurrentTask(task);
      setPanelMode(task ? 'edit' : 'create');
      setIsTaskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      if (task) {
        navigateToItem(task, tasks, 'title');
      }
    },
    [onCloseOtherPanels, clearTaskSelectionCore, navigateToItem, tasks, setValidationErrors],
  );

  const openTaskForEdit = useCallback(
    (task: Task) => {
      clearTaskSelectionCore();
      setRecentlyDuplicatedTaskId(null);
      setCurrentTask(task);
      setPanelMode('edit');
      setIsTaskPanelOpen(true);
      setValidationErrors([]);
      setQuickEditDraft(null);
      onCloseOtherPanels();
      navigateToItem(task, tasks, 'title');
    },
    [onCloseOtherPanels, clearTaskSelectionCore, navigateToItem, tasks, setValidationErrors],
  );

  const openTaskForView = useCallback(
    (task: Task) => {
      setRecentlyDuplicatedTaskId(null);
      setCurrentTask(task);
      setPanelMode('view');
      setIsTaskPanelOpen(true);
      setValidationErrors([]);
      setQuickEditDraft(null);
      onCloseOtherPanels();
      navigateToItem(task, tasks, 'title');
    },
    [onCloseOtherPanels, navigateToItem, tasks, setValidationErrors],
  );

  const openTaskSettings = useCallback(() => {
    clearTaskSelectionCore();
    setRecentlyDuplicatedTaskId(null);
    setTasksContentView('settings');
    onCloseOtherPanels();
  }, [onCloseOtherPanels, clearTaskSelectionCore]);

  const closeTaskSettingsView = useCallback(() => {
    setTasksContentView('list');
  }, []);

  const openTaskForViewRef = useRef(openTaskForView);
  useEffect(() => {
    openTaskForViewRef.current = openTaskForView;
  }, [openTaskForView]);

  const tasksDeepLinkPathSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (tasks.length === 0) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'tasks') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      tasksDeepLinkPathSyncedRef.current = location.pathname;
      return;
    }
    const pathKey = location.pathname;
    if (tasksDeepLinkPathSyncedRef.current === pathKey) {
      return;
    }
    const item = resolveSlug(slug, tasks, 'title');
    tasksDeepLinkPathSyncedRef.current = pathKey;
    if (item) {
      openTaskForViewRef.current(item as Task);
    }
  }, [location.pathname, tasks]);

  const openTaskForViewBridge = useCallback((task: Task) => {
    openTaskForViewRef.current(task);
  }, []);

  useEffect(() => {
    registerTasksNavigation(openTaskForViewBridge);
    return () => registerTasksNavigation(null);
  }, [registerTasksNavigation, openTaskForViewBridge]);

  const {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  } = usePluginNavigation(tasks, currentTask, openTaskForView);

  const saveTask = useCallback(
    async (taskData: any, taskId?: string): Promise<boolean> => {
      const errors = validateTask(taskData);
      setValidationErrors(errors);

      const blockingErrors = errors.filter((error) => !error.message.includes('Warning'));
      if (blockingErrors.length > 0) {
        return false;
      }

      try {
        let savedTask: Task;
        const idToUpdate = taskId || currentTask?.id || taskData.id;

        if (idToUpdate) {
          savedTask = await tasksApi.updateTask(idToUpdate, taskData);
          setTasks((prev) =>
            prev.map((task) =>
              task.id === idToUpdate
                ? {
                    ...savedTask,
                    createdAt: new Date(savedTask.createdAt),
                    updatedAt: new Date(savedTask.updatedAt),
                    dueDate: savedTask.dueDate ? new Date(savedTask.dueDate) : null,
                  }
                : task,
            ),
          );
          if (currentTask && currentTask.id === idToUpdate) {
            setCurrentTask({
              ...savedTask,
              createdAt: new Date(savedTask.createdAt),
              updatedAt: new Date(savedTask.updatedAt),
              dueDate: savedTask.dueDate ? new Date(savedTask.dueDate) : null,
            });
          }
          setPanelMode('view');
          setValidationErrors([]);
        } else {
          savedTask = await tasksApi.createTask(taskData);
          setTasks((prev) => [
            ...prev,
            {
              ...savedTask,
              createdAt: new Date(savedTask.createdAt),
              updatedAt: new Date(savedTask.updatedAt),
              dueDate: savedTask.dueDate ? new Date(savedTask.dueDate) : null,
            },
          ]);
          closeTaskPanel();
        }

        return true;
      } catch (error: any) {
        console.error('API Error when saving task:', error);
        const validationErrors: ValidationError[] = [];

        if (error?.details && Array.isArray(error.details)) {
          error.details.forEach((detail: any) => {
            if (typeof detail === 'string') {
              validationErrors.push({ field: 'general', message: detail });
            } else if (detail?.field && detail?.message) {
              validationErrors.push({ field: detail.field, message: detail.message });
            } else if (detail?.msg) {
              validationErrors.push({ field: detail.param || 'general', message: detail.msg });
            }
          });
        }

        if (validationErrors.length === 0) {
          const errorMessage =
            error?.message || error?.error || 'Failed to save task. Please try again.';
          validationErrors.push({ field: 'general', message: errorMessage });
        }

        setValidationErrors(validationErrors);
        return false;
      }
    },
    [currentTask, closeTaskPanel, validateTask, setValidationErrors],
  );

  const setQuickEditField = useCallback(
    (
      field: 'status' | 'priority' | 'dueDate' | 'assignedToIds',
      value: string | Date | null | string[],
    ) => {
      setQuickEditDraft((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  const hasQuickEditChanges = Boolean(
    currentTask &&
      quickEditDraft &&
      Object.keys(quickEditDraft).length > 0 &&
      (() => {
        const merged = {
          status: (quickEditDraft.status ?? currentTask.status) as string,
          priority: (quickEditDraft.priority ?? currentTask.priority) as string,
          dueDate:
            quickEditDraft.dueDate !== undefined ? quickEditDraft.dueDate : currentTask.dueDate,
          assignedToIds:
            quickEditDraft.assignedToIds !== undefined
              ? quickEditDraft.assignedToIds
              : (currentTask.assignedToIds ??
                (currentTask.assignedTo ? [String(currentTask.assignedTo)] : [])),
        };
        const sameStatus = merged.status === currentTask.status;
        const samePriority = merged.priority === currentTask.priority;
        const sameDue =
          ((merged.dueDate === null || merged.dueDate === undefined) &&
            (currentTask.dueDate === null || currentTask.dueDate === undefined)) ||
          (merged.dueDate !== null &&
            merged.dueDate !== undefined &&
            currentTask.dueDate !== null &&
            currentTask.dueDate !== undefined &&
            new Date(merged.dueDate).getTime() === new Date(currentTask.dueDate).getTime());
        const currentAssignedToIds = currentTask.assignedToIds ?? [];
        const sameAssignee =
          JSON.stringify((merged.assignedToIds ?? []).map(String).sort()) ===
          JSON.stringify(currentAssignedToIds.map(String).sort());
        return !sameStatus || !samePriority || !sameDue || !sameAssignee;
      })(),
  );

  const onApplyQuickEdit = useCallback(async () => {
    if (!currentTask || !quickEditDraft || Object.keys(quickEditDraft).length === 0) {
      return;
    }
    const merged = {
      title: currentTask.title,
      content: currentTask.content,
      mentions: currentTask.mentions ?? [],
      status: quickEditDraft.status ?? currentTask.status,
      priority: quickEditDraft.priority ?? currentTask.priority,
      dueDate: quickEditDraft.dueDate !== undefined ? quickEditDraft.dueDate : currentTask.dueDate,
      assignedToIds:
        quickEditDraft.assignedToIds !== undefined
          ? quickEditDraft.assignedToIds
          : (currentTask.assignedToIds ??
            (currentTask.assignedTo ? [String(currentTask.assignedTo)] : [])),
    };
    const success = await saveTask(merged, currentTask.id);
    if (success) {
      setQuickEditDraft(null);
    }
  }, [currentTask, quickEditDraft, saveTask]);

  const getCloseHandler = useCallback(
    (defaultClose: () => void) => {
      return () => {
        if (hasQuickEditChanges) {
          setShowDiscardQuickEditDialog(true);
        } else {
          defaultClose();
        }
      };
    },
    [hasQuickEditChanges],
  );

  const onDiscardQuickEditAndClose = useCallback(() => {
    setQuickEditDraft(null);
    setShowDiscardQuickEditDialog(false);
  }, []);

  useEffect(() => {
    const unregisterToTask = registerAction('note', {
      id: 'create-task-from-note',
      label: t('tasks.toTask'),
      icon: CheckSquare,
      variant: 'primary',
      className: 'bg-green-600 hover:bg-green-700 text-white border-none',
      onClick: async (note: any) => {
        try {
          const taskData = {
            title: note.title || '',
            content: note.content || '',
            mentions: note.mentions || [],
            status: 'not started',
            priority: 'Medium',
            dueDate: null,
            assignedTo: null,
            assignedToIds: [],
            createdFromNote: note.id,
          };

          const success = await saveTask(taskData);
          if (success) {
            alert('Task created successfully!');
            await refreshData();
          }
        } catch (error) {
          console.error('Failed to convert note to task:', error);
          alert('Failed to convert note to task. Please try again.');
        }
      },
    });

    return () => {
      unregisterToTask();
    };
  }, [registerAction, saveTask, refreshData, t]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      await tasksApi.deleteTask(id);
      setTasks((prev) => prev.filter((task) => task.id !== id));
    } catch (error: any) {
      console.error('Failed to delete task:', error);
      const errorMessage = error?.message || error?.error || 'Failed to delete task';
      alert(errorMessage);
    }
  }, []);

  const deleteTasks = useCallback(
    async (ids: string[]) => {
      const uniqueIds = Array.from(new Set((ids || []).map(String).filter(Boolean)));
      if (uniqueIds.length === 0) {
        return;
      }

      try {
        await bulkApi.bulkDelete('tasks', uniqueIds);

        const idSet = new Set(uniqueIds);
        setTasks((prev) => prev.filter((task) => !idSet.has(String(task.id))));

        if (currentTask && idSet.has(String(currentTask.id))) {
          closeTaskPanel();
        }

        clearTaskSelectionCore();
      } catch (error: any) {
        console.error('Failed to bulk delete tasks:', error);
        const errorMessage = error?.message || error?.error || 'Failed to delete tasks';
        alert(errorMessage);
      }
    },
    [currentTask, closeTaskPanel, clearTaskSelectionCore],
  );

  const createTask = useCallback(
    async (taskData: {
      title: string;
      content?: string;
      status?: string;
      priority?: string;
      dueDate?: Date | null;
      assignedTo?: string | null;
      assignedToIds?: string[];
      mentions?: any[];
    }): Promise<Task> => {
      const newTask = await tasksApi.createTask(taskData);
      const taskWithDates = {
        ...newTask,
        createdAt: new Date(newTask.createdAt),
        updatedAt: new Date(newTask.updatedAt),
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : null,
      };
      setTasks((prev) => [taskWithDates, ...prev]);
      return taskWithDates;
    },
    [],
  );

  const createTaskDuplicate = useCallback(
    async (item: Task, newName: string): Promise<Task> => {
      const nextName = (newName ?? '').trim();
      return createTask({
        title: nextName || item.title?.trim() || 'Untitled',
        content: item.content ?? '',
        status: item.status ?? 'not started',
        priority: item.priority ?? 'Medium',
        dueDate: item.dueDate ?? null,
        assignedTo: item.assignedTo ?? null,
        assignedToIds: item.assignedToIds ?? (item.assignedTo ? [String(item.assignedTo)] : []),
        mentions: item.mentions ?? [],
      });
    },
    [createTask],
  );

  const { getDuplicateConfig, executeDuplicate } = usePluginDuplicate({
    getDefaultName: (item: Task) => `Copy of ${item.title?.trim() || 'Item'}`,
    nameLabel: t('tasks.title'),
    confirmOnly: false,
    createDuplicate: createTaskDuplicate,
    closePanel: closeTaskPanel,
  });

  const [taskShareExistingShare, setTaskShareExistingShare] = useState<TaskShare | null>(null);
  const [taskShareShowDialog, setTaskShareShowDialog] = useState(false);
  const [taskShareIsCreatingShare, setTaskShareIsCreatingShare] = useState(false);

  useEffect(() => {
    if (panelMode === 'view' && currentTask?.id) {
      let cancelled = false;
      taskShareApi
        .getShares(currentTask.id)
        .then((shares) => {
          if (cancelled) {
            return;
          }
          const active = shares.find((s) => new Date(s.validUntil) > new Date());
          setTaskShareExistingShare(active || null);
        })
        .catch(() => {
          if (!cancelled) {
            setTaskShareExistingShare(null);
          }
        });
      return () => {
        cancelled = true;
      };
    }
    setTaskShareExistingShare(null);
  }, [panelMode, currentTask?.id]);

  const defaultTaskShareValidUntil = useCallback((): Date => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const handleTaskShareClick = useCallback(
    async (taskItem: Task) => {
      if (taskShareExistingShare) {
        setTaskShareShowDialog(true);
        return;
      }
      setTaskShareIsCreatingShare(true);
      try {
        const share = await taskShareApi.createShare({
          taskId: taskItem.id,
          validUntil: defaultTaskShareValidUntil(),
        });
        setTaskShareExistingShare(share);
        setTaskShareShowDialog(true);
      } catch (error) {
        console.error('Failed to create task share:', error);
        alert(error instanceof Error ? error.message : 'Failed to create share link');
      } finally {
        setTaskShareIsCreatingShare(false);
      }
    },
    [taskShareExistingShare, defaultTaskShareValidUntil],
  );

  const handleTaskCopyShareUrl = useCallback(() => {
    if (!taskShareExistingShare) {
      return;
    }
    const url = taskShareApi.generateShareUrl(taskShareExistingShare.shareToken);
    navigator.clipboard.writeText(url).catch(() => {});
  }, [taskShareExistingShare]);

  const handleTaskRevokeShare = useCallback(async () => {
    if (!taskShareExistingShare) {
      return;
    }
    try {
      await taskShareApi.revokeShare(taskShareExistingShare.id);
      setTaskShareExistingShare(null);
    } catch (error) {
      console.error('Failed to revoke task share:', error);
      alert('Failed to revoke share link');
    }
  }, [taskShareExistingShare]);

  const shareDetailActions = useMemo(() => {
    if (panelMode !== 'view' || !currentTask) {
      return [];
    }
    const hasActiveShare =
      taskShareExistingShare && new Date(taskShareExistingShare.validUntil) > new Date();
    if (hasActiveShare && taskShareExistingShare) {
      const shareUrl = taskShareApi.generateShareUrl(taskShareExistingShare.shareToken);
      return [
        {
          id: 'view-share',
          label: t('tasks.viewShareLink'),
          icon: ExternalLink,
          onClick: (_item: Task) => {
            window.open(shareUrl, '_blank', 'noopener,noreferrer');
          },
          className: 'h-9 text-xs px-3',
          disabled: false,
        },
      ];
    }
    return [
      {
        id: 'share',
        label: taskShareIsCreatingShare ? t('tasks.creatingShare') : t('tasks.shareTask'),
        icon: Share,
        onClick: (taskItem: Task) => {
          void handleTaskShareClick(taskItem);
        },
        className: 'h-9 text-xs px-3',
        disabled: taskShareIsCreatingShare,
      },
    ];
  }, [
    panelMode,
    currentTask,
    taskShareExistingShare,
    taskShareIsCreatingShare,
    handleTaskShareClick,
    t,
  ]);

  const getPanelSubtitle = useCallback(
    (mode: string, item: Task | null) => {
      if (mode === 'settings') {
        return null;
      }
      if (mode === 'view' && item) {
        const badges = [
          {
            text: item.status,
            color: TASK_STATUS_COLORS[item.status as keyof typeof TASK_STATUS_COLORS],
          },
          {
            text: item.priority,
            color: TASK_PRIORITY_COLORS[item.priority as keyof typeof TASK_PRIORITY_COLORS],
          },
        ];

        const formatDueDateForHeader = (due: Date | string | null) => {
          if (!due) {
            return null;
          }
          const today = new Date();
          const dueDate = new Date(due);
          const diffTime = dueDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays < 0) {
            return {
              text: `${Math.abs(diffDays)} days overdue`,
              className: 'text-destructive font-medium',
            };
          }
          if (diffDays === 0) {
            return {
              text: 'Due today',
              className: 'text-orange-600 dark:text-orange-400 font-medium',
            };
          }
          if (diffDays === 1) {
            return { text: 'Due tomorrow', className: 'text-yellow-600 dark:text-yellow-400' };
          }
          return {
            text: dueDate.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
            className: 'text-muted-foreground',
          };
        };
        const dueDateInfo = formatDueDateForHeader(item.dueDate);

        const assignedToIds =
          item.assignedToIds ?? (item.assignedTo ? [String(item.assignedTo)] : []);
        const assignedContacts = assignedToIds
          .map((id) => contacts.find((c: any) => String(c.id) === String(id)))
          .filter(Boolean) as any[];

        return (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
              {dueDateInfo && (
                <span className={cn('text-[10px] font-medium shrink-0', dueDateInfo.className)}>
                  {dueDateInfo.text}
                </span>
              )}
              {badges.map((badge) => (
                <Badge
                  key={`${badge.text}-${badge.color}`}
                  variant="outline"
                  className={cn('text-[10px] px-1.5 h-5 shrink-0 font-medium', badge.color)}
                >
                  {badge.text === item.status ? formatStatusForDisplay(badge.text) : badge.text}
                </Badge>
              ))}

              {assignedContacts.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <User className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                    {assignedContacts.map((c) => c.companyName).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      }

      switch (mode) {
        case 'edit':
          return 'Update task information';
        case 'create':
          return 'Enter new task details';
        default:
          return '';
      }
    },
    [contacts],
  );

  const getDeleteMessage = (item: Task | null) =>
    buildDeleteMessage(t, 'tasks', item?.title || undefined);

  const exportFormats: ExportFormat[] = ['txt', 'csv', 'pdf'];
  const tasksExportConfig = React.useMemo(() => getTasksExportConfig(contacts ?? []), [contacts]);

  const onExportItem = useCallback(
    (format: ExportFormat, item: Task) => {
      const result = exportItems({
        items: [item],
        format,
        config: tasksExportConfig,
        filename: getTaskExportBaseFilename(item),
        title: 'Tasks Export',
      });
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).catch((err) => {
          console.error('Export failed:', err);
          alert('Export failed. Please try again.');
        });
      }
    },
    [tasksExportConfig],
  );

  const importTasks = useCallback(
    async (data: any[]) => {
      let successCount = 0;
      for (const row of data) {
        try {
          const payload = {
            title: row.title ?? '',
            content: row.content ?? '',
            status: row.status ?? 'not started',
            priority: row.priority ?? 'Medium',
          };
          await tasksApi.createTask(payload);
          successCount++;
        } catch (error) {
          console.error('Failed to import task', row, error);
        }
      }
      if (successCount > 0) {
        await loadTasks();
      }
    },
    [loadTasks],
  );

  const value: TaskContextType = {
    isTaskPanelOpen,
    currentTask,
    panelMode,
    validationErrors,
    tasks,
    openTaskPanel,
    openTaskForEdit,
    openTaskForView,
    openTaskSettings,
    closeTaskSettingsView,
    closeTaskPanel,
    tasksContentView,
    saveTask,
    createTask,
    deleteTask,
    deleteTasks,
    getDuplicateConfig,
    executeDuplicate,
    clearValidationErrors,
    selectedTaskIds,
    toggleTaskSelected: toggleTaskSelectedCore,
    selectAllTasks: selectAllTasksCore,
    mergeIntoTaskSelection: mergeIntoTaskSelectionCore,
    clearTaskSelection: clearTaskSelectionCore,
    selectedCount,
    isSelected,
    getPanelSubtitle,
    getDeleteMessage,
    recentlyDuplicatedTaskId,
    setRecentlyDuplicatedTaskId,
    exportFormats,
    onExportItem,
    importTasks,
    quickEditDraft,
    setQuickEditField,
    hasQuickEditChanges,
    onApplyQuickEdit,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    getCloseHandler,
    onDiscardQuickEditAndClose,
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
    detailFooterActions: [],
    exportShareActions: shareDetailActions,
    taskShareExistingShare,
    taskShareShowDialog,
    setTaskShareShowDialog,
    taskShareIsCreatingShare,
    handleTaskCopyShareUrl,
    handleTaskRevokeShare,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}
