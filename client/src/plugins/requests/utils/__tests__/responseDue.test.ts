import {
  getDaysUntilResponseDue,
  getResponseDueSlaDays,
  getResponseDueUrgency,
  responseDueAtFromDays,
} from '../../types/requests';

function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

describe('getDaysUntilResponseDue', () => {
  it('returns null for missing dates', () => {
    expect(getDaysUntilResponseDue(null)).toBeNull();
    expect(getDaysUntilResponseDue(undefined)).toBeNull();
  });

  it('returns whole calendar days until due', () => {
    expect(getDaysUntilResponseDue(isoDaysFromToday(7))).toBe(7);
    expect(getDaysUntilResponseDue(isoDaysFromToday(0))).toBe(0);
    expect(getDaysUntilResponseDue(isoDaysFromToday(-2))).toBe(-2);
  });
});

describe('getResponseDueUrgency', () => {
  it('is green for 7+ days', () => {
    expect(getResponseDueUrgency(7)).toBe('green');
    expect(getResponseDueUrgency(14)).toBe('green');
  });

  it('is yellow for 2–6 days', () => {
    expect(getResponseDueUrgency(2)).toBe('yellow');
    expect(getResponseDueUrgency(3)).toBe('yellow');
    expect(getResponseDueUrgency(6)).toBe('yellow');
  });

  it('is red for ≤1 day and overdue', () => {
    expect(getResponseDueUrgency(1)).toBe('red');
    expect(getResponseDueUrgency(0)).toBe('red');
    expect(getResponseDueUrgency(-1)).toBe('red');
  });
});

describe('responseDueAtFromDays (from submission)', () => {
  it('counts SLA from created_at, not today', () => {
    const created = isoDaysFromToday(-14);
    const due = responseDueAtFromDays(21, created);
    expect(getResponseDueSlaDays(created, due)).toBe(21);
    expect(getDaysUntilResponseDue(due)).toBe(7);
    expect(getResponseDueUrgency(getDaysUntilResponseDue(due))).toBe('green');
  });

  it('default 7-day SLA on a 14-day-old request is overdue', () => {
    const created = isoDaysFromToday(-14);
    const due = responseDueAtFromDays(7, created);
    expect(getDaysUntilResponseDue(due)).toBe(-7);
    expect(getResponseDueUrgency(getDaysUntilResponseDue(due))).toBe('red');
  });

  it('clamps negative input to 0', () => {
    const created = isoDaysFromToday(-3);
    expect(getResponseDueSlaDays(created, responseDueAtFromDays(-3, created))).toBe(0);
  });
});
