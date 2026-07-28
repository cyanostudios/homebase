import {
  compareIngestByField,
  getIngestSortValue,
  isIngestAscDefaultField,
  isIngestStringSortField,
} from '../ingestListSort';

const base = {
  name: 'Alpha Source',
  sourceType: 'json' as const,
  isActive: true,
  lastFetchStatus: 'success' as const,
  lastFetchedAt: '2026-07-10T10:00:00.000Z',
  updatedAt: '2026-07-10T12:00:00.000Z',
};

describe('isIngestStringSortField', () => {
  it('treats name, sourceType, isActive, lastFetchStatus as string fields', () => {
    expect(isIngestStringSortField('name')).toBe(true);
    expect(isIngestStringSortField('sourceType')).toBe(true);
    expect(isIngestStringSortField('isActive')).toBe(true);
    expect(isIngestStringSortField('lastFetchStatus')).toBe(true);
    expect(isIngestStringSortField('updatedAt')).toBe(false);
    expect(isIngestStringSortField('lastFetchedAt')).toBe(false);
  });
});

describe('isIngestAscDefaultField', () => {
  it('returns asc default for string fields, desc default for dates', () => {
    expect(isIngestAscDefaultField('name')).toBe(true);
    expect(isIngestAscDefaultField('sourceType')).toBe(true);
    expect(isIngestAscDefaultField('updatedAt')).toBe(false);
    expect(isIngestAscDefaultField('lastFetchedAt')).toBe(false);
  });
});

describe('getIngestSortValue', () => {
  it('lowercases name', () => {
    expect(getIngestSortValue({ ...base, name: 'Hello' }, 'name')).toBe('hello');
  });

  it('maps isActive boolean to sortable string', () => {
    expect(getIngestSortValue({ ...base, isActive: true }, 'isActive')).toBe('1');
    expect(getIngestSortValue({ ...base, isActive: false }, 'isActive')).toBe('0');
  });

  it('returns Date for date fields', () => {
    const val = getIngestSortValue(base, 'updatedAt');
    expect(val).toBeInstanceOf(Date);
  });

  it('returns null for null lastFetchedAt', () => {
    expect(getIngestSortValue({ ...base, lastFetchedAt: null }, 'lastFetchedAt')).toBeNull();
  });
});

describe('compareIngestByField', () => {
  it('sorts names ascending and descending', () => {
    const a = { ...base, name: 'A' };
    const b = { ...base, name: 'B' };
    expect(compareIngestByField(a, b, 'name', 'asc')).toBeLessThan(0);
    expect(compareIngestByField(a, b, 'name', 'desc')).toBeGreaterThan(0);
  });

  it('sorts sourceType alphabetically', () => {
    const a = { ...base, sourceType: 'html' as const };
    const b = { ...base, sourceType: 'json' as const };
    expect(compareIngestByField(a, b, 'sourceType', 'asc')).toBeLessThan(0);
  });

  it('sorts isActive: active (1) before inactive (0) when desc', () => {
    const active = { ...base, isActive: true };
    const inactive = { ...base, isActive: false };
    expect(compareIngestByField(active, inactive, 'isActive', 'desc')).toBeLessThan(0);
    expect(compareIngestByField(inactive, active, 'isActive', 'asc')).toBeLessThan(0);
  });

  it('sorts dates ascending and descending', () => {
    const earlier = { ...base, updatedAt: '2026-07-01T00:00:00.000Z' };
    const later = { ...base, updatedAt: '2026-07-20T00:00:00.000Z' };
    expect(compareIngestByField(earlier, later, 'updatedAt', 'asc')).toBeLessThan(0);
    expect(compareIngestByField(earlier, later, 'updatedAt', 'desc')).toBeGreaterThan(0);
  });

  it('places null lastFetchedAt after dated items when ascending', () => {
    const withFetch = { ...base, lastFetchedAt: '2026-07-01T00:00:00.000Z' };
    const withoutFetch = { ...base, lastFetchedAt: null };
    expect(compareIngestByField(withoutFetch, withFetch, 'lastFetchedAt', 'asc')).toBeGreaterThan(
      0,
    );
    expect(compareIngestByField(withoutFetch, withFetch, 'lastFetchedAt', 'desc')).toBeLessThan(0);
  });
});
