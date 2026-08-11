import {
  taskIsOpen,
  taskIsOverdue,
  taskMatchesListFilters,
  toggleTaskListFilter,
} from '../taskListFilter';

const NOW = Date.parse('2026-08-11T12:00:00.000Z');

describe('taskIsOpen / taskIsOverdue', () => {
  it('treats non-completed/cancelled as open', () => {
    expect(taskIsOpen({ status: 'not started' })).toBe(true);
    expect(taskIsOpen({ status: 'completed' })).toBe(false);
    expect(taskIsOpen({ status: 'cancelled' })).toBe(false);
  });

  it('detects overdue open tasks', () => {
    expect(
      taskIsOverdue({ status: 'in progress', dueDate: new Date('2026-08-01T00:00:00.000Z') }, NOW),
    ).toBe(true);
    expect(
      taskIsOverdue({ status: 'completed', dueDate: new Date('2026-08-01T00:00:00.000Z') }, NOW),
    ).toBe(false);
  });
});

describe('taskMatchesListFilters', () => {
  const openOverdue = {
    status: 'in progress' as const,
    dueDate: new Date('2026-08-01T00:00:00.000Z'),
  };

  it('allows all when selection is empty', () => {
    expect(taskMatchesListFilters(openOverdue, [], NOW)).toBe(true);
  });

  it('ANDs open with overdue', () => {
    expect(taskMatchesListFilters(openOverdue, ['open', 'overdue'], NOW)).toBe(true);
    expect(
      taskMatchesListFilters(
        { status: 'completed', dueDate: new Date('2026-08-01T00:00:00.000Z') },
        ['open', 'overdue'],
        NOW,
      ),
    ).toBe(false);
  });
});

describe('toggleTaskListFilter', () => {
  it('replaces open/completed and keeps overdue facet', () => {
    expect(toggleTaskListFilter(['open'], 'completed')).toEqual(['completed']);
    expect(toggleTaskListFilter(['open', 'overdue'], 'completed')).toEqual([
      'overdue',
      'completed',
    ]);
    expect(toggleTaskListFilter(['open'], 'overdue')).toEqual(['open', 'overdue']);
    expect(toggleTaskListFilter(['overdue'], 'overdue')).toEqual([]);
  });
});
