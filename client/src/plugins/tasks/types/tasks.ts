import type { Mention } from '@/core/types/mention';

export type { Mention };

export interface Task {
  id: string;
  title: string;
  content: string;
  mentions: Mention[];
  status: 'not started' | 'in progress' | 'completed' | 'cancelled';
  priority: 'Low' | 'Medium' | 'High';
  dueDate: Date | null;
  assignedTo: string | null; // Contact ID
  createdFromNote: string | null; // Note ID
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Status color mapping
export const TASK_STATUS_COLORS = {
  'not started':
    'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700',
  'in progress':
    'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800',
  completed:
    'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
  cancelled:
    'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
} as const;

// Priority color mapping
export const TASK_PRIORITY_COLORS = {
  Low: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  Medium:
    'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
  High: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
} as const;

export const TASK_STATUS_OPTIONS = [
  'not started',
  'in progress',
  'completed',
  'cancelled',
] as const;

export const TASK_PRIORITY_OPTIONS = ['Low', 'Medium', 'High'] as const;

// Helper function to format status for display
export const formatStatusForDisplay = (status: string): string => {
  switch (status) {
    case 'not started':
      return 'Not started';
    case 'in progress':
      return 'In progress';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};
