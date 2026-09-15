import { formatTaskDueDisplay, getTaskDueDiffDays, getTaskDueUrgency } from '../../types/tasks';

/** Local noon — avoids UTC/TZ drift in calendar-day math. */
function localNoon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

const NOW = localNoon(2026, 8, 11).getTime();

describe('getTaskDueDiffDays', () => {
  it('returns null for missing or invalid dates', () => {
    expect(getTaskDueDiffDays(null, NOW)).toBeNull();
    expect(getTaskDueDiffDays(undefined, NOW)).toBeNull();
    expect(getTaskDueDiffDays('not-a-date', NOW)).toBeNull();
  });

  it('returns calendar-day delta from local midnight', () => {
    expect(getTaskDueDiffDays(localNoon(2026, 8, 11), NOW)).toBe(0);
    expect(getTaskDueDiffDays(localNoon(2026, 8, 12), NOW)).toBe(1);
    expect(getTaskDueDiffDays(localNoon(2026, 8, 1), NOW)).toBe(-10);
    expect(getTaskDueDiffDays(localNoon(2026, 8, 18), NOW)).toBe(7);
  });
});

describe('getTaskDueUrgency', () => {
  it('returns null when due missing or status completed/cancelled', () => {
    expect(getTaskDueUrgency(null, 'in progress', NOW)).toBeNull();
    expect(getTaskDueUrgency(localNoon(2026, 8, 1), 'completed', NOW)).toBeNull();
    expect(getTaskDueUrgency(localNoon(2026, 8, 1), 'cancelled', NOW)).toBeNull();
    expect(getTaskDueUrgency('bad', 'in progress', NOW)).toBeNull();
  });

  it('maps overdue / today / tomorrow / soon / later buckets', () => {
    expect(getTaskDueUrgency(localNoon(2026, 8, 1), 'in progress', NOW)).toBe('overdue');
    expect(getTaskDueUrgency(localNoon(2026, 8, 11), 'not started', NOW)).toBe('today');
    expect(getTaskDueUrgency(localNoon(2026, 8, 12), 'not started', NOW)).toBe('soon');
    expect(getTaskDueUrgency(localNoon(2026, 8, 14), 'not started', NOW)).toBe('soon');
    expect(getTaskDueUrgency(localNoon(2026, 8, 18), 'not started', NOW)).toBe('later');
  });
});

describe('formatTaskDueDisplay', () => {
  it('returns null for completed/cancelled/missing', () => {
    expect(formatTaskDueDisplay(localNoon(2026, 8, 11), 'completed', NOW)).toBeNull();
    expect(formatTaskDueDisplay(null, 'in progress', NOW)).toBeNull();
  });

  it('uses shared overdue/today/tomorrow labels', () => {
    expect(formatTaskDueDisplay(localNoon(2026, 8, 1), 'in progress', NOW)?.text).toBe(
      '10 days overdue',
    );
    expect(formatTaskDueDisplay(localNoon(2026, 8, 11), 'in progress', NOW)?.text).toBe(
      'Due today',
    );
    expect(formatTaskDueDisplay(localNoon(2026, 8, 12), 'in progress', NOW)?.text).toBe(
      'Due tomorrow',
    );
  });

  it('formats later/soon dates consistently (short locale) with matching colors', () => {
    const display = formatTaskDueDisplay(localNoon(2026, 8, 18), 'in progress', NOW);
    expect(display?.urgency).toBe('later');
    expect(display?.text).toMatch(/18/);
    expect(display?.badgeClassName).toContain('emerald');
    expect(display?.textClassName).toContain('emerald');
  });
});
