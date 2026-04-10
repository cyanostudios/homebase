import React, { createContext, useContext } from 'react';

import type { ExportFormat } from '@/core/utils/exportUtils';

import type { Task, TaskShare, ValidationError } from '../types/tasks';

export interface TaskContextType {
  isTaskPanelOpen: boolean;
  currentTask: Task | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: ValidationError[];
  tasks: Task[];
  openTaskPanel: (task: Task | null) => void;
  openTaskForEdit: (task: Task) => void;
  openTaskForView: (task: Task) => void;
  openTaskSettings: () => void;
  closeTaskSettingsView: () => void;
  closeTaskPanel: () => void;
  tasksContentView: 'list' | 'settings';
  saveTask: (taskData: any, taskId?: string) => Promise<boolean>;
  createTask: (taskData: {
    title: string;
    content?: string;
    status?: string;
    priority?: string;
    dueDate?: Date | null;
    assignedTo?: string | null;
    assignedToIds?: string[];
    mentions?: any[];
  }) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  deleteTasks: (ids: string[]) => Promise<void>;
  getDuplicateConfig: (
    item: Task | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly: boolean } | null;
  executeDuplicate: (
    item: Task,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  clearValidationErrors: () => void;
  selectedTaskIds: string[];
  toggleTaskSelected: (id: string) => void;
  selectAllTasks: (ids: string[]) => void;
  mergeIntoTaskSelection: (ids: string[]) => void;
  clearTaskSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  getPanelSubtitle: (mode: string, item: Task | null) => any;
  getDeleteMessage: (item: Task | null) => string;
  recentlyDuplicatedTaskId: string | null;
  setRecentlyDuplicatedTaskId: (id: string | null) => void;
  exportFormats: ExportFormat[];
  onExportItem: (format: ExportFormat, item: Task) => void;
  importTasks: (data: any[]) => Promise<void>;
  quickEditDraft: Partial<{
    status: string;
    priority: string;
    dueDate: Date | null;
    assignedToIds: string[];
  }> | null;
  setQuickEditField: (
    field: 'status' | 'priority' | 'dueDate' | 'assignedToIds',
    value: string | Date | null | string[],
  ) => void;
  hasQuickEditChanges: boolean;
  onApplyQuickEdit: () => Promise<void>;
  showDiscardQuickEditDialog: boolean;
  setShowDiscardQuickEditDialog: (show: boolean) => void;
  getCloseHandler: (defaultClose: () => void) => () => void;
  onDiscardQuickEditAndClose: () => void;
  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Task) => void;
    className?: string;
    disabled?: boolean;
  }>;
  /** Share / view public link — shown under Export options in task detail */
  exportShareActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Task) => void;
    className?: string;
    disabled?: boolean;
  }>;
  taskShareExistingShare: TaskShare | null;
  taskShareShowDialog: boolean;
  setTaskShareShowDialog: (show: boolean) => void;
  taskShareIsCreatingShare: boolean;
  handleTaskCopyShareUrl: () => void;
  handleTaskRevokeShare: () => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function useTaskContext() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
}

const EMPTY_TASK_CONTEXT: TaskContextType = {
  isTaskPanelOpen: false,
  currentTask: null,
  panelMode: 'create',
  validationErrors: [],
  tasks: [],
  openTaskPanel: () => {},
  openTaskForEdit: () => {},
  openTaskForView: () => {},
  openTaskSettings: () => {},
  closeTaskSettingsView: () => {},
  closeTaskPanel: () => {},
  tasksContentView: 'list',
  saveTask: async () => false,
  createTask: async () => ({}) as Task,
  deleteTask: async () => {},
  deleteTasks: async () => {},
  getDuplicateConfig: () => null,
  executeDuplicate: async () => ({ closePanel: () => {} }),
  clearValidationErrors: () => {},
  selectedTaskIds: [],
  toggleTaskSelected: () => {},
  selectAllTasks: () => {},
  mergeIntoTaskSelection: () => {},
  clearTaskSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  getPanelSubtitle: () => '',
  getDeleteMessage: () => '',
  recentlyDuplicatedTaskId: null,
  setRecentlyDuplicatedTaskId: () => {},
  exportFormats: [],
  onExportItem: () => {},
  importTasks: async () => {},
  quickEditDraft: null,
  setQuickEditField: () => {},
  hasQuickEditChanges: false,
  onApplyQuickEdit: async () => {},
  showDiscardQuickEditDialog: false,
  setShowDiscardQuickEditDialog: () => {},
  getCloseHandler: (fn) => fn,
  onDiscardQuickEditAndClose: () => {},
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
  detailFooterActions: [],
  exportShareActions: [],
  taskShareExistingShare: null,
  taskShareShowDialog: false,
  setTaskShareShowDialog: () => {},
  taskShareIsCreatingShare: false,
  handleTaskCopyShareUrl: () => {},
  handleTaskRevokeShare: () => {},
};

export function TaskNullProvider({ children }: { children: React.ReactNode }) {
  return <TaskContext.Provider value={EMPTY_TASK_CONTEXT}>{children}</TaskContext.Provider>;
}

export { TaskContext };
