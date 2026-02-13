import { CheckSquare, User } from 'lucide-react';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useActionRegistry } from '@/core/api/ActionContext';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { cn } from '@/lib/utils';

import { tasksApi } from '../api/tasksApi';
import { Task, ValidationError, formatStatusForDisplay } from '../types/tasks';

interface TaskContextType {
  isTaskPanelOpen: boolean;
  currentTask: Task | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  tasks: Task[];

  openTaskPanel: (task: Task | null) => void;
  openTaskForEdit: (task: Task) => void;
  openTaskForView: (task: Task) => void;
  closeTaskPanel: () => void;
  saveTask: (taskData: any, taskId?: string) => Promise<boolean>;
  createTask: (taskData: {
    title: string;
    content?: string;
    status?: string;
    priority?: string;
    dueDate?: Date | null;
    assignedTo?: string | null;
    mentions?: any[];
  }) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  deleteTasks: (ids: string[]) => Promise<void>;
  duplicateTask: (task: Task) => Promise<void>;
  clearValidationErrors: () => void;
  // Bulk selection
  selectedTaskIds: string[];
  toggleTaskSelected: (id: string) => void;
  selectAllTasks: (ids: string[]) => void;
  clearTaskSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  // NEW: Panel Title Functions
  getPanelTitle: (mode: string, item: Task | null, isMobileView: boolean) => any;
  getPanelSubtitle: (mode: string, item: Task | null) => any;
  getDeleteMessage: (item: Task | null) => string;
  recentlyDuplicatedTaskId: string | null;
  setRecentlyDuplicatedTaskId: (id: string | null) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

interface TaskProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function TaskProvider({ children, isAuthenticated, onCloseOtherPanels }: TaskProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, contacts, refreshData } =
    useApp();
  const { registerAction } = useActionRegistry();

  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentlyDuplicatedTaskId, setRecentlyDuplicatedTaskId] = useState<string | null>(null);

  // Use core bulk selection hook
  const {
    selectedIds: selectedTaskIds,
    toggleSelection: toggleTaskSelectedCore,
    selectAll: selectAllTasksCore,
    clearSelection: clearTaskSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  useEffect(() => {
    if (isAuthenticated) {
      loadTasks();
    } else {
      setTasks([]);
    }
  }, [isAuthenticated]);

  const closeTaskPanel = useCallback(() => {
    setIsTaskPanelOpen(false);
    setCurrentTask(null);
    setPanelMode('create');
    setValidationErrors([]);
  }, []);

  useEffect(() => {
    registerPanelCloseFunction('tasks', closeTaskPanel);
    return () => {
      unregisterPanelCloseFunction('tasks');
    };
  }, [closeTaskPanel, registerPanelCloseFunction, unregisterPanelCloseFunction]);

  useEffect(() => {
    window.submitTasksForm = () => {
      const event = new CustomEvent('submitTaskForm');
      window.dispatchEvent(event);
    };

    window.cancelTasksForm = () => {
      const event = new CustomEvent('cancelTaskForm');
      window.dispatchEvent(event);
    };

    return () => {
      delete window.submitTasksForm;
      delete window.cancelTasksForm;
    };
  }, []);

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
      // V2: Handle standardized error format
      const errorMessage = error?.message || error?.error || 'Failed to load tasks';
      setValidationErrors([{ field: 'general', message: errorMessage }]);
    }
  }, []);

  const validateTask = useCallback((taskData: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!taskData.title?.trim()) {
      errors.push({
        field: 'title',
        message: 'Task title is required',
      });
    }

    // Content is optional - can be empty (e.g., when converting from notes)
    // Only validate if it exists and is not a string
    if (
      taskData.content !== undefined &&
      taskData.content !== null &&
      typeof taskData.content !== 'string'
    ) {
      errors.push({
        field: 'content',
        message: 'Task description must be a string',
      });
    }

    if (!taskData.status) {
      errors.push({
        field: 'status',
        message: 'Task status is required',
      });
    }

    if (!taskData.priority) {
      errors.push({
        field: 'priority',
        message: 'Task priority is required',
      });
    }

    return errors;
  }, []);

  const openTaskPanel = useCallback(
    (task: Task | null) => {
      setRecentlyDuplicatedTaskId(null);
      setCurrentTask(task);
      setPanelMode(task ? 'edit' : 'create');
      setIsTaskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openTaskForEdit = useCallback(
    (task: Task) => {
      setRecentlyDuplicatedTaskId(null);
      setCurrentTask(task);
      setPanelMode('edit');
      setIsTaskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openTaskForView = useCallback(
    (task: Task) => {
      setRecentlyDuplicatedTaskId(null);
      setCurrentTask(task);
      setPanelMode('view');
      setIsTaskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const clearValidationErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  const saveTask = useCallback(
    async (taskData: any, taskId?: string): Promise<boolean> => {
      console.log('TaskContext saveTask called with:', taskData, 'taskId:', taskId);

      const errors = validateTask(taskData);
      console.log('Validation errors:', errors);
      setValidationErrors(errors);

      const blockingErrors = errors.filter((error) => !error.message.includes('Warning'));
      if (blockingErrors.length > 0) {
        console.log('Validation failed:', blockingErrors);
        return false;
      }

      console.log('Validation passed, attempting to save...');

      try {
        let savedTask: Task;

        // Use provided taskId, or currentTask.id, or taskData.id
        const idToUpdate = taskId || currentTask?.id || taskData.id;

        if (idToUpdate) {
          console.log('Updating existing task:', idToUpdate);
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
          // Only update currentTask if it matches the updated task
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
          console.log('Creating new task...');
          savedTask = await tasksApi.createTask(taskData);
          console.log('Task created successfully:', savedTask);
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

        console.log('Task saved successfully');
        return true;
      } catch (error: any) {
        console.error('API Error when saving task:', error);

        // V2: Handle standardized error format from backend
        const validationErrors: ValidationError[] = [];

        // Check if backend returned validation errors in details array
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

        // If no validation errors from backend, use error message
        if (validationErrors.length === 0) {
          const errorMessage =
            error?.message || error?.error || 'Failed to save task. Please try again.';
          validationErrors.push({ field: 'general', message: errorMessage });
        }

        setValidationErrors(validationErrors);
        return false;
      }
    },
    [currentTask, closeTaskPanel, validateTask],
  );

  // Register cross-plugin actions - Moved here to avoid saveTask TDZ
  useEffect(() => {
    const unregister = registerAction('note', {
      id: 'create-task-from-note',
      label: 'To Task',
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

    return unregister;
  }, [registerAction, saveTask, refreshData]);

  const deleteTask = useCallback(async (id: string) => {
    console.log('Deleting task with id:', id);
    try {
      await tasksApi.deleteTask(id);
      setTasks((prev) => {
        const newTasks = prev.filter((task) => task.id !== id);
        console.log('Tasks after delete:', newTasks);
        return newTasks;
      });
    } catch (error: any) {
      console.error('Failed to delete task:', error);
      // V2: Handle standardized error format
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

        // If the currently open task was deleted, close the panel.
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

  const duplicateTask = useCallback(async (originalTask: Task) => {
    try {
      const duplicateData = {
        title: `${originalTask.title} (Copy)`,
        content: originalTask.content,
        status: 'not started' as const,
        priority: originalTask.priority,
        dueDate: originalTask.dueDate,
        assignedTo: originalTask.assignedTo,
        mentions: originalTask.mentions || [],
      };

      const newTask = await tasksApi.createTask(duplicateData);
      setTasks((prev) => [
        {
          ...newTask,
          createdAt: new Date(newTask.createdAt),
          updatedAt: new Date(newTask.updatedAt),
          dueDate: newTask.dueDate ? new Date(newTask.dueDate) : null,
        },
        ...prev,
      ]);

      console.log('Task duplicated successfully');
    } catch (error: any) {
      console.error('Failed to duplicate task:', error);
      // V2: Handle standardized error format
      const errorMessage =
        error?.message || error?.error || 'Failed to duplicate task. Please try again.';
      alert(errorMessage);
    }
  }, []);

  const createTask = useCallback(
    async (taskData: {
      title: string;
      content?: string;
      status?: string;
      priority?: string;
      dueDate?: Date | null;
      assignedTo?: string | null;
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

  // NEW: Panel Title Functions (moved from PanelTitles.tsx)
  const getPanelTitle = (mode: string, item: Task | null, isMobileView: boolean) => {
    // View mode with item
    if (mode === 'view' && item) {
      const title = item.title || `Task #${item.id}`;
      const dueDate = item.dueDate ? new Date(item.dueDate).toLocaleDateString() : null;

      if (isMobileView && dueDate) {
        return (
          <div>
            <div>{title}</div>
            <div className="text-sm font-normal text-gray-600 dark:text-gray-400 mt-1">
              Due: {dueDate}
            </div>
          </div>
        );
      }
      return `${title}${dueDate ? ` • Due: ${dueDate}` : ''}`;
    }

    // Non-view modes (create/edit)
    switch (mode) {
      case 'edit':
        return 'Edit Task';
      case 'create':
        return 'Create Task';
      default:
        return 'Task';
    }
  };

  const getPanelSubtitle = useCallback(
    (mode: string, item: Task | null) => {
      // View mode with item
      if (mode === 'view' && item) {
        const statusColors: Record<string, string> = {
          'not started': 'bg-secondary/50 text-secondary-foreground border-transparent font-medium',
          'in progress':
            'bg-blue-50/50 text-blue-700 dark:text-blue-300 border-blue-100/50 font-medium',
          completed:
            'bg-green-50/50 text-green-700 dark:text-green-300 border-green-100/50 font-medium',
          cancelled:
            'bg-rose-50/50 text-rose-700 dark:text-rose-300 border-rose-100/50 font-medium',
        };
        const priorityColors: Record<string, string> = {
          Low: 'bg-secondary/50 text-secondary-foreground border-transparent font-medium',
          Medium:
            'bg-amber-50/50 text-amber-700 dark:text-amber-300 border-amber-100/50 font-medium',
          High: 'bg-rose-50/50 text-rose-700 dark:text-rose-300 border-rose-100/50 font-medium',
        };

        const badges = [
          {
            text: item.status,
            color: statusColors[item.status] || statusColors['not started'],
          },
          {
            text: item.priority,
            color: priorityColors[item.priority] || priorityColors['Medium'],
          },
        ];

        // Get assigned contact if exists
        const assignedContact = item.assignedTo
          ? contacts.find((c: any) => {
              // Handle both string and number ID comparison
              const contactId = String(c.id);
              const assignedId = String(item.assignedTo);
              return contactId === assignedId;
            })
          : null;

        return (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
              {badges.map((badge) => (
                <Badge
                  key={`${badge.text}-${badge.color}`}
                  variant="outline"
                  className={cn('text-[10px] px-1.5 h-5 shrink-0 font-medium', badge.color)}
                >
                  {badge.text === item.status ? formatStatusForDisplay(badge.text) : badge.text}
                </Badge>
              ))}

              {assignedContact && (
                <div className="flex items-center gap-1 shrink-0">
                  <User className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                    {assignedContact.companyName}
                  </span>
                </div>
              )}

            </div>
          </div>
        );
      }

      // Non-view modes
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

  const getDeleteMessage = (item: Task | null) => {
    if (!item) {
      return 'Are you sure you want to delete this task?';
    }

    const itemName = item.title || 'this task';
    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  };

  const value: TaskContextType = {
    isTaskPanelOpen,
    currentTask,
    panelMode,
    validationErrors,

    tasks,

    openTaskPanel,
    openTaskForEdit,
    openTaskForView,
    closeTaskPanel,
    saveTask,
    createTask,
    deleteTask,
    deleteTasks,
    duplicateTask,
    clearValidationErrors,

    // Bulk selection
    selectedTaskIds,
    toggleTaskSelected: toggleTaskSelectedCore,
    selectAllTasks: selectAllTasksCore,
    clearTaskSelection: clearTaskSelectionCore,
    selectedCount,
    isSelected,

    // NEW: Panel Title Functions
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,

    recentlyDuplicatedTaskId,
    setRecentlyDuplicatedTaskId,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTaskContext() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
}
