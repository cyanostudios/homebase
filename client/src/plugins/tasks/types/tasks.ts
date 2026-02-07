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
  'not started':
    'bg-secondary/50 text-secondary-foreground border-transparent font-medium',
  'in progress':
    'bg-blue-50/50 text-blue-700 dark:text-blue-300 border-blue-100/50 font-medium',
  completed:
    'bg-green-50/50 text-green-700 dark:text-green-300 border-green-100/50 font-medium',
  cancelled:
    'bg-rose-50/50 text-rose-700 dark:text-rose-300 border-rose-100/50 font-medium',
} as const;

// Priority color mapping
export const TASK_PRIORITY_COLORS = {
  Low: 'bg-secondary/50 text-secondary-foreground border-transparent font-medium',
  Medium:
    'bg-amber-50/50 text-amber-700 dark:text-amber-300 border-amber-100/50 font-medium',
  High: 'bg-rose-50/50 text-rose-700 dark:text-rose-300 border-rose-100/50 font-medium',
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
