export interface Task {
  id: string;
  title: string;
  content: string;
  mentions: Mention[];
  status: 'not started' | 'in progress' | 'Done' | 'Canceled';
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
  'not started': 'bg-gray-100 text-gray-800 border-gray-200',
  'in progress': 'bg-blue-100 text-blue-800 border-blue-200',
  Done: 'bg-green-100 text-green-800 border-green-200',
  Canceled: 'bg-red-100 text-red-800 border-red-200',
} as const;

// Priority color mapping
export const TASK_PRIORITY_COLORS = {
  Low: 'bg-gray-100 text-gray-700 border-gray-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  High: 'bg-red-100 text-red-800 border-red-200',
} as const;

export const TASK_STATUS_OPTIONS = ['not started', 'in progress', 'Done', 'Canceled'] as const;

export const TASK_PRIORITY_OPTIONS = ['Low', 'Medium', 'High'] as const;

// Helper function to format status for display
export const formatStatusForDisplay = (status: string): string => {
  switch (status) {
    case 'not started':
      return 'Not started';
    case 'in progress':
      return 'In progress';
    default:
      return status;
  }
};
