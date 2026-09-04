import {
  compareRequestsByField,
  isRequestAscDefaultField,
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
  responseDueAt: '2026-07-08T00:00:00.000Z' as string | null,
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
    expect(isRequestStringSortField('responseDueAt')).toBe(false);
  });

  it('defaults priority magnitude to descending', () => {
    expect(isRequestAscDefaultField('title')).toBe(true);
    expect(isRequestAscDefaultField('priority')).toBe(false);
    expect(isRequestAscDefaultField('updated_at')).toBe(false);
  });

  it('sorts by responseDueAt with nulls last when ascending', () => {
    expect(
      compareRequestsByField(
        { ...base, responseDueAt: '2026-08-01T00:00:00.000Z' },
        { ...base, responseDueAt: null },
        'responseDueAt',
        'asc',
      ),
    ).toBeLessThan(0);
  });
});
