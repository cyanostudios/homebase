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
import { useApp } from '@/core/api/AppContext';

import { tasksApi } from '../api/tasksApi';
import { Task, ValidationError } from '../types/tasks';

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
  deleteTask: (id: string) => Promise<void>;
  duplicateTask: (task: Task) => Promise<void>;
  clearValidationErrors: () => void;

  // NEW: Panel Title Functions
  getPanelTitle: (mode: string, item: Task | null, isMobileView: boolean) => any;
  getPanelSubtitle: (mode: string, item: Task | null) => any;
  getDeleteMessage: (item: Task | null) => string;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

interface TaskProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function TaskProvider({ children, isAuthenticated, onCloseOtherPanels }: TaskProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, contacts, tasks, refreshData } = useApp();

  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

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

  const validateTask = (taskData: any): ValidationError[] => {
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
  };

  const openTaskPanel = (task: Task | null) => {
    setCurrentTask(task);
    setPanelMode(task ? 'edit' : 'create');
    setIsTaskPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openTaskForEdit = (task: Task) => {
    setCurrentTask(task);
    setPanelMode('edit');
    setIsTaskPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openTaskForView = (task: Task) => {
    setCurrentTask(task);
    setPanelMode('view');
    setIsTaskPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const clearValidationErrors = () => {
    setValidationErrors([]);
  };

  const saveTask = async (taskData: any, taskId?: string): Promise<boolean> => {
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
        await refreshData();
      } else {
        console.log('Creating new task...');
        savedTask = await tasksApi.createTask(taskData);
        console.log('Task created successfully:', savedTask);
        closeTaskPanel();
        await refreshData();
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
  };

  const deleteTask = async (id: string) => {
    console.log('Deleting task with id:', id);
    try {
      await tasksApi.deleteTask(id);
      await refreshData();
    } catch (error: any) {
      console.error('Failed to delete task:', error);
      // V2: Handle standardized error format
      const errorMessage = error?.message || error?.error || 'Failed to delete task';
      alert(errorMessage);
    }
  };

  const duplicateTask = async (originalTask: Task) => {
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

      await tasksApi.createTask(duplicateData);
      await refreshData();
      console.log('Task duplicated successfully');
    } catch (error: any) {
      console.error('Failed to duplicate task:', error);
      // V2: Handle standardized error format
      const errorMessage =
        error?.message || error?.error || 'Failed to duplicate task. Please try again.';
      alert(errorMessage);
    }
  };

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
          'not started': 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
          'in progress': 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
          completed: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
          cancelled: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
        };
        const priorityColors: Record<string, string> = {
          Low: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
          Medium: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200',
          High: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
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
          <div className="flex items-center gap-2 flex-wrap">
            <CheckSquare className="w-4 h-4" style={{ color: '#2563eb' }} />
            {badges.map((badge) => (
              <Badge key={`${badge.text}-${badge.color}`} className={badge.color}>
                {badge.text}
              </Badge>
            ))}
            {assignedContact && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {assignedContact.companyName}
                </span>
              </div>
            )}
            <span className="text-xs text-gray-600 dark:text-gray-400">
              • Created {new Date(item.createdAt).toLocaleDateString()}
            </span>
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
    deleteTask,
    duplicateTask,
    clearValidationErrors,

    // NEW: Panel Title Functions
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
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
