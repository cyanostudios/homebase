import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Task, ValidationError } from '../types/tasks';
import { tasksApi } from '../api/tasksApi';
import { useApp } from '@/core/api/AppContext';

interface TaskContextType {
  // Panel State
  isTaskPanelOpen: boolean;
  currentTask: Task | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];
  
  // Data State
  tasks: Task[];
  
  // Actions
  openTaskPanel: (task: Task | null) => void;
  openTaskForEdit: (task: Task) => void;
  openTaskForView: (task: Task) => void;
  closeTaskPanel: () => void;
  saveTask: (taskData: any) => Promise<boolean>;
  deleteTask: (id: string) => Promise<void>;
  duplicateTask: (task: Task) => Promise<void>;
  clearValidationErrors: () => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

interface TaskProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function TaskProvider({ children, isAuthenticated, onCloseOtherPanels }: TaskProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  
  // Panel states
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  
  // Data state
  const [tasks, setTasks] = useState<Task[]>([]);

  // Load data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadTasks();
    } else {
      setTasks([]);
    }
  }, [isAuthenticated]);

  // Panel registration
  useEffect(() => {
    registerPanelCloseFunction('tasks', closeTaskPanel);
    return () => {
      unregisterPanelCloseFunction('tasks');
    };
  }, []);

  // Global functions for form submission
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

  const loadTasks = async () => {
    try {
      const tasksData = await tasksApi.getTasks();
      console.log('First task from API:', tasksData[0]);
      const transformedTasks = tasksData.map((task: any) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
      }));
      setTasks(transformedTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const validateTask = (taskData: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    if (!taskData.title?.trim()) {
      errors.push({
        field: 'title',
        message: 'Task title is required'
      });
    }
    
    if (!taskData.content?.trim()) {
      errors.push({
        field: 'content',
        message: 'Task description is required'
      });
    }
    
    if (!taskData.status) {
      errors.push({
        field: 'status',
        message: 'Task status is required'
      });
    }
    
    if (!taskData.priority) {
      errors.push({
        field: 'priority',
        message: 'Task priority is required'
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

  const closeTaskPanel = () => {
    setIsTaskPanelOpen(false);
    setCurrentTask(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  const clearValidationErrors = () => {
    setValidationErrors([]);
  };

  const saveTask = async (taskData: any): Promise<boolean> => {
    console.log('TaskContext saveTask called with:', taskData);
    
    const errors = validateTask(taskData);
    console.log('Validation errors:', errors);
    setValidationErrors(errors);
    
    const blockingErrors = errors.filter(error => !error.message.includes('Warning'));
    if (blockingErrors.length > 0) {
      console.log('Validation failed:', blockingErrors);
      return false;
    }
    
    console.log('Validation passed, attempting to save...');
    
    try {
      let savedTask: Task;
      
      if (currentTask) {
        console.log('Updating existing task:', currentTask.id);
        savedTask = await tasksApi.updateTask(currentTask.id, taskData);
        setTasks(prev => prev.map(task => 
          task.id === currentTask.id ? {
            ...savedTask,
            createdAt: new Date(savedTask.createdAt),
            updatedAt: new Date(savedTask.updatedAt),
            dueDate: savedTask.dueDate ? new Date(savedTask.dueDate) : null,
          } : task
        ));
        setCurrentTask({
          ...savedTask,
          createdAt: new Date(savedTask.createdAt),
          updatedAt: new Date(savedTask.updatedAt),
          dueDate: savedTask.dueDate ? new Date(savedTask.dueDate) : null,
        });
        setPanelMode('view');
        setValidationErrors([]);
      } else {
        console.log('Creating new task...');
        savedTask = await tasksApi.createTask(taskData);
        console.log('Task created successfully:', savedTask);
        setTasks(prev => [...prev, {
          ...savedTask,
          createdAt: new Date(savedTask.createdAt),
          updatedAt: new Date(savedTask.updatedAt),
          dueDate: savedTask.dueDate ? new Date(savedTask.dueDate) : null,
        }]);
        closeTaskPanel();
      }
      
      console.log('Task saved successfully');
      return true;
    } catch (error) {
      console.error('API Error when saving task:', error);
      setValidationErrors([{ field: 'general', message: 'Failed to save task. Please try again.' }]);
      return false;
    }
  };

  const deleteTask = async (id: string) => {
    console.log("Deleting task with id:", id);
    try {
      await tasksApi.deleteTask(id);
      setTasks(prev => {
        const newTasks = prev.filter(task => task.id !== id);
        console.log("Tasks after delete:", newTasks);
        return newTasks;
      });
    } catch (error) {
      console.error('Failed to delete task:', error);
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
        mentions: originalTask.mentions || []
      };
      
      const newTask = await tasksApi.createTask(duplicateData);
      setTasks(prev => [{
        ...newTask,
        createdAt: new Date(newTask.createdAt),
        updatedAt: new Date(newTask.updatedAt),
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : null,
      }, ...prev]);
      
      console.log('Task duplicated successfully');
    } catch (error) {
      console.error('Failed to duplicate task:', error);
      alert('Failed to duplicate task. Please try again.');
    }
  };

  const value: TaskContextType = {
    // Panel State
    isTaskPanelOpen,
    currentTask,
    panelMode,
    validationErrors,
    
    // Data State
    tasks,
    
    // Actions
    openTaskPanel,
    openTaskForEdit,
    openTaskForView,
    closeTaskPanel,
    saveTask,
    deleteTask,
    duplicateTask,
    clearValidationErrors,
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTaskContext() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
}