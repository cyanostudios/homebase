import {
  compareRequestsByField,
  compareRequestsTwoLevel,
  isRequestStringSortField,
} from '../requestListSort';

const base = {
  title: 'Alpha',
  status: 'not started' as const,
  priority: 'Medium' as const,
  requestType: 'general',
  source: 'internal' as const,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-10T08:00:00.000Z',
};

describe('requestListSort', () => {
  it('sorts priority Low < High ascending', () => {
    expect(
      compareRequestsByField(
        { ...base, priority: 'Low' },
        { ...base, priority: 'High' },
        'priority',
        'asc',
      ),
    ).toBeLessThan(0);
  });

  it('breaks ties with secondary', () => {
    const a = { ...base, status: 'not started' as const, title: 'A' };
    const b = { ...base, status: 'not started' as const, title: 'B' };
    expect(compareRequestsTwoLevel(a, b, 'status', 'title', 'asc')).toBeLessThan(0);
  });

  it('with date primary + secondary, reorders same-day by secondary', () => {
    const earlier = {
      ...base,
      title: 'Zulu',
      updated_at: new Date(2026, 6, 10, 8, 0, 0).toISOString(),
    };
    const later = {
      ...base,
      title: 'Alpha',
      updated_at: new Date(2026, 6, 10, 18, 0, 0).toISOString(),
    };
    expect(compareRequestsTwoLevel(earlier, later, 'updated_at', 'title', 'asc')).toBeGreaterThan(
      0,
    );
  });

  it('sorts by source', () => {
    expect(
      compareRequestsByField(
        { ...base, source: 'external' },
        { ...base, source: 'internal' },
        'source',
        'asc',
      ),
    ).toBeLessThan(0);
  });

  it('isRequestStringSortField', () => {
    expect(isRequestStringSortField('title')).toBe(true);
    expect(isRequestStringSortField('updated_at')).toBe(false);
  });
});
