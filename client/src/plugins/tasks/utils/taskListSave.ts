import type { Task } from '../types/tasks';

export type TaskQuickEditFieldKey = 'status' | 'priority' | 'dueDate' | 'assignedToIds' | 'teamId';

export type TaskQuickEditFields = Partial<{
  status: string;
  priority: string;
  dueDate: Date | null;
  assignedToIds: string[];
  teamId: string | null;
}>;

/** Soft-preview and panel share one draft; always scope by taskId so values never leak across items. */
export type TaskQuickEditDraft = TaskQuickEditFields & {
  taskId: string;
};

/**
 * Returns draft field overlay for a task, or null when the draft belongs to another item.
 * Strips `taskId` so callers can safely spread onto display models.
 */
export function quickEditFieldsForTask(
  draft: TaskQuickEditDraft | null | undefined,
  taskId: string | null | undefined,
): TaskQuickEditFields | null {
  if (!draft || taskId === null || taskId === undefined || taskId === '') {
    return null;
  }
  if (String(draft.taskId) !== String(taskId)) {
    return null;
  }
  const { taskId: _taskId, ...fields } = draft;
  return fields;
}

type TaskListSaveBase = Pick<
  Task,
  | 'title'
  | 'content'
  | 'mentions'
  | 'status'
  | 'priority'
  | 'dueDate'
  | 'assignedToIds'
  | 'assignedTo'
  | 'teamId'
>;

export type TaskListQuickFieldPatch = Partial<{
  status: string;
  priority: string;
  dueDate: Date | null;
  assignedToIds: string[];
  teamId: string | null;
}>;

/**
 * Whether a successful update should sync the open panel (current task, draft, mode).
 * List inline saves of a *different* task must not force the open panel to view.
 */
export function shouldApplyOpenTaskSaveEffects(
  currentTaskId: string | null | undefined,
  updatedTaskId: string,
): boolean {
  if (currentTaskId === null || currentTaskId === undefined || currentTaskId === '') {
    return false;
  }
  return String(currentTaskId) === String(updatedTaskId);
}

function resolveAssignedToIds(
  task: TaskListSaveBase,
  patch: TaskListQuickFieldPatch,
  draft: TaskQuickEditFields | null | undefined,
): string[] {
  if (patch.assignedToIds !== undefined) {
    return patch.assignedToIds.map(String);
  }
  if (draft?.assignedToIds !== undefined) {
    return draft.assignedToIds.map(String);
  }
  if (Array.isArray(task.assignedToIds)) {
    return task.assignedToIds.map(String);
  }
  if (task.assignedTo !== null && task.assignedTo !== undefined && task.assignedTo !== '') {
    return [String(task.assignedTo)];
  }
  return [];
}

/** Payload for immediate list / quick-context field changes via saveTask. */
export function buildTaskListQuickFieldsSavePayload(
  task: TaskListSaveBase,
  patch: TaskListQuickFieldPatch,
  draft: TaskQuickEditFields | null | undefined,
): {
  title: string;
  content: string;
  mentions: Task['mentions'];
  status: string;
  priority: string;
  dueDate: Date | null | undefined;
  assignedToIds: string[];
  teamId: string | null;
} {
  return {
    title: task.title,
    content: task.content ?? '',
    mentions: task.mentions ?? [],
    status: (patch.status ?? draft?.status ?? task.status) as string,
    priority: (patch.priority ?? draft?.priority ?? task.priority) as string,
    dueDate:
      patch.dueDate !== undefined
        ? patch.dueDate
        : draft?.dueDate !== undefined
          ? draft.dueDate
          : task.dueDate,
    assignedToIds: resolveAssignedToIds(task, patch, draft),
    teamId:
      patch.teamId !== undefined
        ? patch.teamId
        : draft?.teamId !== undefined
          ? draft.teamId
          : (task.teamId ?? null),
  };
}

/** Payload for immediate list status changes via saveTask. */
export function buildTaskListStatusSavePayload(
  task: Omit<TaskListSaveBase, 'status'>,
  newStatus: string,
  draft: TaskQuickEditFields | null | undefined,
) {
  return buildTaskListQuickFieldsSavePayload(
    { ...task, status: newStatus as TaskListSaveBase['status'] },
    { status: newStatus },
    draft,
  );
}
