import { DUE_DATE_BADGE_COLORS, DUE_DATE_TEXT_COLORS } from '@/core/ui/badgeStyles';

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
  /** Assigned team when teams plugin is used; null if none. */
  teamId: string | null;
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

// Status color mapping — solid QC fills (pair with BADGE_CHIP_*; no baked font-medium)
export const TASK_STATUS_COLORS = {
  'not started': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'in progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
} as const;

// Priority color mapping — same solid palette as Requests
export const TASK_PRIORITY_COLORS = {
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  High: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
} as const;

/** Grid card avatar background by priority. */
export const TASK_PRIORITY_AVATAR_COLORS = {
  Low: 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 dark:from-slate-800 dark:to-slate-900 dark:text-slate-200',
  Medium:
    'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-900 dark:from-amber-900/60 dark:to-amber-950 dark:text-amber-200',
  High: 'bg-gradient-to-br from-red-100 to-red-200 text-red-800 dark:from-red-900/60 dark:to-red-950 dark:text-red-200',
} as const;

export const TASK_STATUS_OPTIONS = [
  'not started',
  'in progress',
  'completed',
  'cancelled',
] as const;

export const TASK_PRIORITY_OPTIONS = ['Low', 'Medium', 'High'] as const;

export type TaskDueUrgency = 'overdue' | 'today' | 'soon' | 'later';

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function resolveNow(nowMs?: number): Date {
  return typeof nowMs === 'number' && Number.isFinite(nowMs) ? new Date(nowMs) : new Date();
}

/** Calendar-day delta until due (negative = overdue). Uses local midnight. */
export function getTaskDueDiffDays(
  dueDate: Date | string | null | undefined,
  nowMs?: number,
): number | null {
  if (!dueDate) {
    return null;
  }
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return null;
  }
  const today = startOfLocalDay(resolveNow(nowMs));
  const dueDay = startOfLocalDay(due);
  return Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Calendar-day urgency for task due chips (local midnight). */
export function getTaskDueUrgency(
  dueDate: Date | string | null | undefined,
  status?: string,
  nowMs?: number,
): TaskDueUrgency | null {
  if (!dueDate || status === 'completed' || status === 'cancelled') {
    return null;
  }
  const diffDays = getTaskDueDiffDays(dueDate, nowMs);
  if (diffDays === null) {
    return null;
  }
  if (diffDays < 0) {
    return 'overdue';
  }
  if (diffDays === 0) {
    return 'today';
  }
  if (diffDays === 1) {
    return 'soon';
  }
  if (diffDays >= 7) {
    return 'later';
  }
  return 'soon';
}

export type TaskDueDisplay = {
  urgency: TaskDueUrgency;
  text: string;
  badgeClassName: string;
  textClassName: string;
};

function formatTaskDueDateLabel(due: Date): string {
  return due.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Shared due label + chip/text classes for list, table, QC, and panel header.
 * Returns null when due is missing or status is completed/cancelled.
 */
export function formatTaskDueDisplay(
  dueDate: Date | string | null | undefined,
  status?: string,
  nowMs?: number,
): TaskDueDisplay | null {
  const urgency = getTaskDueUrgency(dueDate, status, nowMs);
  if (!urgency || !dueDate) {
    return null;
  }
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return null;
  }
  const diffDays = getTaskDueDiffDays(dueDate, nowMs);
  let text = formatTaskDueDateLabel(due);
  if (urgency === 'overdue' && diffDays !== null) {
    text = `${Math.abs(diffDays)} days overdue`;
  } else if (urgency === 'today') {
    text = 'Due today';
  } else if (urgency === 'soon' && diffDays === 1) {
    text = 'Due tomorrow';
  }

  return {
    urgency,
    text,
    badgeClassName: DUE_DATE_BADGE_COLORS[urgency],
    textClassName: DUE_DATE_TEXT_COLORS[urgency],
  };
}

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
