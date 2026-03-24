import type { ExportFormatConfig } from '@/core/utils/exportUtils';

import type { Task } from '../types/tasks';

function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return '';
  }
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleDateString('sv-SE');
  } catch {
    return '';
  }
}

/** Resolve assigned contact names (used when contacts are available from useApp). */
function getAssignedNames(
  contacts: { id: string; companyName?: string }[],
  assignedToIds: string[],
): string {
  if (!assignedToIds.length || !contacts.length) {
    return '';
  }
  return assignedToIds
    .map((id) => contacts.find((x) => String(x.id) === String(id))?.companyName)
    .filter(Boolean)
    .join(', ');
}

export function taskToTxtContent(task: Task): string {
  const due = task.dueDate ? formatDate(task.dueDate) : '—';
  return `${task.title}\n\n${task.content || ''}\n\nStatus: ${task.status}\nPriority: ${task.priority}\nDue: ${due}\nCreated: ${formatDate(task.createdAt)}`;
}

export function getTaskExportBaseFilename(task: Task): string {
  return (task.title || 'task').replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

export function getTaskExportFilename(task: Task, extension: string): string {
  return `${getTaskExportBaseFilename(task)}.${extension}`;
}

export function taskToCsvRow(
  task: Task,
  contacts: { id: string; companyName?: string }[],
): Record<string, any> {
  return {
    title: task.title || '',
    content: (task.content || '').slice(0, 500),
    status: task.status || '',
    priority: task.priority || '',
    dueDate: task.dueDate
      ? task.dueDate instanceof Date
        ? task.dueDate.toISOString()
        : String(task.dueDate)
      : '',
    assignedTo: getAssignedNames(
      contacts,
      task.assignedToIds ?? (task.assignedTo ? [String(task.assignedTo)] : []),
    ),
    createdAt:
      task.createdAt instanceof Date ? task.createdAt.toISOString() : String(task.createdAt ?? ''),
    updatedAt:
      task.updatedAt instanceof Date ? task.updatedAt.toISOString() : String(task.updatedAt ?? ''),
  };
}

export function taskToPdfRow(
  task: Task,
  contacts: { id: string; companyName?: string }[],
): Record<string, any> {
  return {
    title: (task.title || '').slice(0, 30),
    status: task.status || '',
    priority: task.priority || '',
    dueDate: task.dueDate ? formatDate(task.dueDate) : '',
    assignedTo: getAssignedNames(
      contacts,
      task.assignedToIds ?? (task.assignedTo ? [String(task.assignedTo)] : []),
    ),
    createdAt: formatDate(task.createdAt),
    updatedAt: formatDate(task.updatedAt),
  };
}

/** Build export config for tasks. Requires contacts for assignedTo display name. */
export function getTasksExportConfig(
  contacts: { id: string; companyName?: string }[],
): ExportFormatConfig {
  return {
    txt: {
      getContent: taskToTxtContent,
      getFilename: (task: Task) => getTaskExportFilename(task, 'txt'),
      baseFilename: `tasks-export-${new Date().toISOString().split('T')[0]}`,
    },
    csv: {
      headers: [
        'title',
        'content',
        'status',
        'priority',
        'dueDate',
        'assignedTo',
        'createdAt',
        'updatedAt',
      ],
      mapItemToRow: (task: Task) => taskToCsvRow(task, contacts),
    },
    pdf: {
      columns: [
        { key: 'title', label: 'Title' },
        { key: 'status', label: 'Status' },
        { key: 'priority', label: 'Priority' },
        { key: 'dueDate', label: 'Due Date' },
        { key: 'assignedTo', label: 'Assigned To' },
        { key: 'createdAt', label: 'Created' },
        { key: 'updatedAt', label: 'Updated' },
      ],
      mapItemToRow: (task: Task) => taskToPdfRow(task, contacts),
      title: 'Tasks Export',
    },
  };
}
