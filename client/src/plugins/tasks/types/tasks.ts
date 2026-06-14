export interface Task {
  id: string;
  title: string;
  content: string;
  mentions: Mention[];
  status: 'not started' | 'in progress' | 'completed' | 'cancelled';
  priority: 'Low' | 'Medium' | 'High';
  dueDate: Date | null;
  assignedTo: string | null; // Legacy single contact ID (kept for compatibility)
  assignedToIds: string[]; // Multi-assignee contact IDs
  createdFromNote: string | null; // Note ID
  createdAt: Date;
  updatedAt: Date;
}

/** Active share link metadata (API: /api/tasks/:id/shares) */
export interface TaskShare {
  id: string;
  taskId: string;
  shareToken: string;
  validUntil: Date;
  createdAt: Date;
  accessedCount: number;
  lastAccessedAt?: Date;
}

export interface CreateTaskShareRequest {
  taskId: string;
  validUntil: Date;
}

/** Task loaded via public share token */
export interface PublicTask extends Task {
  shareValidUntil: Date;
  accessedCount: number;
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

/** Grid card avatar background by priority. */
export const TASK_PRIORITY_AVATAR_COLORS = {
  Low: 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800 dark:from-blue-900/60 dark:to-blue-950 dark:text-blue-200',
  Medium:
    'bg-gradient-to-br from-yellow-100 to-amber-200 text-amber-900 dark:from-yellow-900/60 dark:to-amber-950 dark:text-amber-200',
  High: 'bg-gradient-to-br from-red-100 to-red-200 text-red-800 dark:from-red-900/60 dark:to-red-950 dark:text-red-200',
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
