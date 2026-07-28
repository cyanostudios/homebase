import { compareRequestsByField, isRequestStringSortField } from '../requestListSort';

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
