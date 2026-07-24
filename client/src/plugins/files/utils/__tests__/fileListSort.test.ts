import {
  compareFilesByField,
  compareFilesTwoLevel,
  getFileSortValue,
  isFileStringSortField,
  isFileDateSortField,
  isFileNumericSortField,
} from '../fileListSort';

const base = {
  id: 'abc-123',
  name: 'Alpha.png',
  mimeType: 'image/png',
  size: 1024,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-10T00:00:00.000Z'),
};

describe('isFileStringSortField / isFileDateSortField / isFileNumericSortField', () => {
  it('correctly classifies string fields', () => {
    expect(isFileStringSortField('name')).toBe(true);
    expect(isFileStringSortField('mimeType')).toBe(true);
    expect(isFileStringSortField('id')).toBe(true);
    expect(isFileStringSortField('updatedAt')).toBe(false);
    expect(isFileStringSortField('size')).toBe(false);
  });

  it('correctly classifies date fields', () => {
    expect(isFileDateSortField('updatedAt')).toBe(true);
    expect(isFileDateSortField('createdAt')).toBe(true);
    expect(isFileDateSortField('name')).toBe(false);
  });

  it('correctly classifies numeric fields', () => {
    expect(isFileNumericSortField('size')).toBe(true);
    expect(isFileNumericSortField('name')).toBe(false);
  });
});

describe('getFileSortValue', () => {
  it('lowercases name and mimeType', () => {
    expect(getFileSortValue({ ...base, name: 'Hello.PNG' }, 'name')).toBe('hello.png');
    expect(getFileSortValue({ ...base, mimeType: 'Image/PNG' }, 'mimeType')).toBe('image/png');
  });

  it('returns null for absent dates', () => {
    expect(getFileSortValue({ ...base, updatedAt: null }, 'updatedAt')).toBeNull();
    expect(getFileSortValue({ ...base, createdAt: null }, 'createdAt')).toBeNull();
  });

  it('returns null for absent size', () => {
    expect(getFileSortValue({ ...base, size: null }, 'size')).toBeNull();
    expect(getFileSortValue({ ...base, size: undefined }, 'size')).toBeNull();
  });

  it('returns date fields as Date', () => {
    const val = getFileSortValue(base, 'updatedAt');
    expect(val).toBeInstanceOf(Date);
  });
});

describe('compareFilesByField', () => {
  it('sorts names ascending and descending', () => {
    const a = { ...base, name: 'A.txt' };
    const b = { ...base, name: 'B.txt' };
    expect(compareFilesByField(a, b, 'name', 'asc')).toBeLessThan(0);
    expect(compareFilesByField(a, b, 'name', 'desc')).toBeGreaterThan(0);
  });

  it('sorts size ascending, nulls last', () => {
    const small = { ...base, size: 100 };
    const large = { ...base, size: 9999 };
    const noSize = { ...base, size: null };
    expect(compareFilesByField(small, large, 'size', 'asc')).toBeLessThan(0);
    expect(compareFilesByField(noSize, small, 'size', 'asc')).toBeGreaterThan(0);
    expect(compareFilesByField(noSize, small, 'size', 'desc')).toBeLessThan(0);
  });

  it('places null updatedAt after dated files when ascending', () => {
    const withDate = { ...base, updatedAt: new Date('2026-07-10T00:00:00.000Z') };
    const withoutDate = { ...base, updatedAt: null };
    expect(compareFilesByField(withoutDate, withDate, 'updatedAt', 'asc')).toBeGreaterThan(0);
    expect(compareFilesByField(withoutDate, withDate, 'updatedAt', 'desc')).toBeLessThan(0);
  });

  it('accepts ISO string dates', () => {
    const earlier = {
      ...base,
      updatedAt: '2026-07-01T00:00:00.000Z' as unknown as Date,
    };
    const later = {
      ...base,
      updatedAt: '2026-07-20T00:00:00.000Z' as unknown as Date,
    };
    expect(compareFilesByField(earlier, later, 'updatedAt', 'asc')).toBeLessThan(0);
  });
});

describe('compareFilesTwoLevel', () => {
  it('uses primary only when secondary is empty', () => {
    const a = { ...base, name: 'A.txt' };
    const b = { ...base, name: 'B.txt' };
    expect(compareFilesTwoLevel(a, b, 'name', '', 'asc')).toBeLessThan(0);
  });

  it('breaks ties with secondary field', () => {
    const a = { ...base, name: 'same.txt', size: 100 };
    const b = { ...base, name: 'same.txt', size: 9999 };
    expect(compareFilesTwoLevel(a, b, 'name', 'size', 'asc')).toBeLessThan(0);
    expect(compareFilesTwoLevel(a, b, 'name', 'size', 'desc')).toBeGreaterThan(0);
  });

  it('returns 0 when primary and secondary are equal', () => {
    const a = { ...base, name: 'same.txt', size: 1024 };
    const b = { ...base, name: 'same.txt', size: 1024 };
    expect(compareFilesTwoLevel(a, b, 'name', 'size', 'asc')).toBe(0);
  });

  it('with date primary + secondary, reorders same-day items by secondary', () => {
    const earlierInDay = {
      ...base,
      name: 'Zulu.txt',
      updatedAt: new Date(2026, 6, 10, 8, 0, 0),
    };
    const laterInDay = {
      ...base,
      name: 'Alpha.txt',
      updatedAt: new Date(2026, 6, 10, 18, 0, 0),
    };
    // Full timestamp alone would put laterInDay first in desc
    expect(compareFilesTwoLevel(earlierInDay, laterInDay, 'updatedAt', '', 'desc')).toBeGreaterThan(
      0,
    );
    // Same calendar day + name asc → Alpha before Zulu
    expect(
      compareFilesTwoLevel(earlierInDay, laterInDay, 'updatedAt', 'name', 'asc'),
    ).toBeGreaterThan(0);
    expect(compareFilesTwoLevel(laterInDay, earlierInDay, 'updatedAt', 'name', 'asc')).toBeLessThan(
      0,
    );
  });

  it('with date primary + secondary, different days still follow primary day order', () => {
    const day1 = {
      ...base,
      name: 'Alpha.txt',
      updatedAt: new Date(2026, 6, 9, 23, 0, 0),
    };
    const day2 = {
      ...base,
      name: 'Zulu.txt',
      updatedAt: new Date(2026, 6, 10, 1, 0, 0),
    };
    expect(compareFilesTwoLevel(day1, day2, 'updatedAt', 'name', 'desc')).toBeGreaterThan(0);
  });
});
