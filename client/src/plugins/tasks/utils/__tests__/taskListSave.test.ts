import { buildTaskListStatusSavePayload, shouldApplyOpenTaskSaveEffects } from '../taskListSave';

describe('shouldApplyOpenTaskSaveEffects', () => {
  it('returns true when open task matches updated id', () => {
    expect(shouldApplyOpenTaskSaveEffects('42', '42')).toBe(true);
  });

  it('returns false when open task is a different id', () => {
    expect(shouldApplyOpenTaskSaveEffects('1', '2')).toBe(false);
  });

  it('returns false when no task is open', () => {
    expect(shouldApplyOpenTaskSaveEffects(null, '2')).toBe(false);
    expect(shouldApplyOpenTaskSaveEffects(undefined, '2')).toBe(false);
    expect(shouldApplyOpenTaskSaveEffects('', '2')).toBe(false);
  });

  it('compares ids as strings', () => {
    expect(shouldApplyOpenTaskSaveEffects(1 as unknown as string, '1')).toBe(true);
  });
});

describe('buildTaskListStatusSavePayload', () => {
  const baseTask = {
    title: 'Ship list redesign',
    content: '<p>Body</p>',
    mentions: [],
    priority: 'High' as const,
    dueDate: new Date('2026-08-01T00:00:00.000Z'),
    assignedToIds: ['c1'],
    assignedTo: null,
    teamId: '7',
  };

  it('applies new status and keeps list task fields when no draft', () => {
    expect(buildTaskListStatusSavePayload(baseTask, 'in progress', null)).toEqual({
      title: 'Ship list redesign',
      content: '<p>Body</p>',
      mentions: [],
      status: 'in progress',
      priority: 'High',
      dueDate: baseTask.dueDate,
      assignedToIds: ['c1'],
      teamId: '7',
    });
  });

  it('merges open-task quick-edit draft fields under the new status', () => {
    const draft = {
      priority: 'Low',
      dueDate: null as Date | null,
      assignedToIds: ['c2', 'c3'],
      teamId: null as string | null,
    };
    expect(buildTaskListStatusSavePayload(baseTask, 'completed', draft)).toEqual({
      title: 'Ship list redesign',
      content: '<p>Body</p>',
      mentions: [],
      status: 'completed',
      priority: 'Low',
      dueDate: null,
      assignedToIds: ['c2', 'c3'],
      teamId: null,
    });
  });

  it('falls back to legacy assignedTo when assignedToIds missing', () => {
    const task = {
      ...baseTask,
      assignedToIds: undefined as unknown as string[],
      assignedTo: 'legacy-9',
    };
    expect(buildTaskListStatusSavePayload(task, 'not started', null).assignedToIds).toEqual([
      'legacy-9',
    ]);
  });
});
