import {
  compareFilesByField,
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
