import type { Task } from '../types/tasks';

export type TaskQuickEditDraft = Partial<{
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

/** Payload for immediate list status changes via saveTask. */
export function buildTaskListStatusSavePayload(
  task: Pick<
    Task,
    | 'title'
    | 'content'
    | 'mentions'
    | 'priority'
    | 'dueDate'
    | 'assignedToIds'
    | 'assignedTo'
    | 'teamId'
  >,
  newStatus: string,
  draft: TaskQuickEditDraft | null | undefined,
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
    status: newStatus,
    priority: (draft?.priority ?? task.priority) as string,
    dueDate: draft?.dueDate !== undefined ? draft.dueDate : task.dueDate,
    assignedToIds:
      draft?.assignedToIds !== undefined
        ? draft.assignedToIds
        : (task.assignedToIds ?? (task.assignedTo ? [String(task.assignedTo)] : [])),
    teamId: draft?.teamId !== undefined ? draft.teamId : (task.teamId ?? null),
  };
}
