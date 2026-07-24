import {
  compareTasksByField,
  compareTasksTwoLevel,
  getTaskSortValue,
  isTaskStringSortField,
} from '../taskListSort';

const base = {
  title: 'Alpha',
  status: 'not started' as const,
  priority: 'Medium' as const,
  dueDate: new Date('2026-08-01T00:00:00.000Z'),
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-10T00:00:00.000Z'),
};

describe('isTaskStringSortField', () => {
  it('treats title, status, priority as string fields', () => {
    expect(isTaskStringSortField('title')).toBe(true);
    expect(isTaskStringSortField('status')).toBe(true);
    expect(isTaskStringSortField('priority')).toBe(true);
    expect(isTaskStringSortField('updatedAt')).toBe(false);
    expect(isTaskStringSortField('dueDate')).toBe(false);
  });
});

describe('getTaskSortValue', () => {
  it('lowercases title and maps priority to sortable rank string', () => {
    expect(getTaskSortValue({ ...base, title: 'Hello' }, 'title')).toBe('hello');
    expect(getTaskSortValue({ ...base, priority: 'High' }, 'priority')).toBe('3');
    expect(getTaskSortValue({ ...base, priority: 'Low' }, 'priority')).toBe('1');
  });

  it('returns date fields as-is', () => {
    expect(getTaskSortValue(base, 'dueDate')).toEqual(base.dueDate);
    expect(getTaskSortValue(base, 'updatedAt')).toEqual(base.updatedAt);
  });
});

describe('compareTasksByField', () => {
  it('sorts titles ascending and descending', () => {
    const a = { ...base, title: 'A' };
    const b = { ...base, title: 'B' };
    expect(compareTasksByField(a, b, 'title', 'asc')).toBeLessThan(0);
    expect(compareTasksByField(a, b, 'title', 'desc')).toBeGreaterThan(0);
  });

  it('sorts priority Low < Medium < High when ascending', () => {
    const low = { ...base, priority: 'Low' as const };
    const high = { ...base, priority: 'High' as const };
    expect(compareTasksByField(low, high, 'priority', 'asc')).toBeLessThan(0);
    expect(compareTasksByField(low, high, 'priority', 'desc')).toBeGreaterThan(0);
  });

  it('places null dueDate after dated tasks when ascending', () => {
    const withDue = { ...base, dueDate: new Date('2026-08-01T00:00:00.000Z') };
    const withoutDue = { ...base, dueDate: null };
    expect(compareTasksByField(withoutDue, withDue, 'dueDate', 'asc')).toBeGreaterThan(0);
    expect(compareTasksByField(withoutDue, withDue, 'dueDate', 'desc')).toBeLessThan(0);
  });

  it('accepts ISO string dates', () => {
    const earlier = { ...base, updatedAt: '2026-07-01T00:00:00.000Z' as unknown as Date };
    const later = { ...base, updatedAt: '2026-07-20T00:00:00.000Z' as unknown as Date };
    expect(compareTasksByField(earlier, later, 'updatedAt', 'asc')).toBeLessThan(0);
  });
});

describe('compareTasksTwoLevel', () => {
  it('uses primary only when secondary is empty', () => {
    const a = { ...base, title: 'A', priority: 'High' as const };
    const b = { ...base, title: 'B', priority: 'Low' as const };
    expect(compareTasksTwoLevel(a, b, 'title', '', 'asc')).toBeLessThan(0);
  });

  it('breaks ties with secondary field', () => {
    const a = { ...base, title: 'Same', priority: 'Low' as const };
    const b = { ...base, title: 'Same', priority: 'High' as const };
    expect(compareTasksTwoLevel(a, b, 'title', 'priority', 'asc')).toBeLessThan(0);
    expect(compareTasksTwoLevel(a, b, 'title', 'priority', 'desc')).toBeGreaterThan(0);
  });

  it('returns 0 when primary and secondary are equal', () => {
    const a = { ...base, title: 'Same', priority: 'Medium' as const };
    const b = { ...base, title: 'Same', priority: 'Medium' as const };
    expect(compareTasksTwoLevel(a, b, 'title', 'priority', 'asc')).toBe(0);
  });

  it('with date primary + secondary, reorders same-day items by secondary', () => {
    const earlierInDay = {
      ...base,
      title: 'Zulu',
      updatedAt: new Date(2026, 6, 10, 8, 0, 0),
    };
    const laterInDay = {
      ...base,
      title: 'Alpha',
      updatedAt: new Date(2026, 6, 10, 18, 0, 0),
    };
    // Full timestamp alone would put laterInDay first in desc
    expect(compareTasksTwoLevel(earlierInDay, laterInDay, 'updatedAt', '', 'desc')).toBeGreaterThan(
      0,
    );
    // Same calendar day + title asc → Alpha before Zulu
    expect(
      compareTasksTwoLevel(earlierInDay, laterInDay, 'updatedAt', 'title', 'asc'),
    ).toBeGreaterThan(0);
    expect(
      compareTasksTwoLevel(laterInDay, earlierInDay, 'updatedAt', 'title', 'asc'),
    ).toBeLessThan(0);
  });

  it('with date primary + secondary, different days still follow primary day order', () => {
    const day1 = {
      ...base,
      title: 'Alpha',
      updatedAt: new Date(2026, 6, 9, 23, 0, 0),
    };
    const day2 = {
      ...base,
      title: 'Zulu',
      updatedAt: new Date(2026, 6, 10, 1, 0, 0),
    };
    expect(compareTasksTwoLevel(day1, day2, 'updatedAt', 'title', 'desc')).toBeGreaterThan(0);
  });
});
