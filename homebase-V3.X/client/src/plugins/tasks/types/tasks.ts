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

export interface Mention {
  contactId: string;
  contactName: string;
  companyName: string;
  position: number;
  length: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Status color mapping
export const TASK_STATUS_COLORS = {
  'not started': 'bg-secondary/50 text-secondary-foreground border-transparent font-medium',
  'in progress': 'bg-blue-50/50 text-blue-700 dark:text-blue-300 border-blue-100/50 font-medium',
  completed: 'bg-green-50/50 text-green-700 dark:text-green-300 border-green-100/50 font-medium',
  cancelled: 'bg-rose-50/50 text-rose-700 dark:text-rose-300 border-rose-100/50 font-medium',
} as const;

// Priority color mapping
export const TASK_PRIORITY_COLORS = {
  Low: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-100 dark:border-blue-800 font-medium',
  Medium:
    'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-100 dark:border-yellow-800 font-medium',
  High: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-100 dark:border-red-800 font-medium',
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
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};
