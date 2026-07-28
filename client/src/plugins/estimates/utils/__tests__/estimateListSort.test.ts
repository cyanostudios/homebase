import {
  compareEstimatesByField,
  getEstimateSortValue,
  isEstimateStringSortField,
} from '../estimateListSort';

const base = {
  estimateNumber: '2026-001',
  contactName: 'Alpha Corp',
  status: 'draft' as const,
  total: 1000,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-10T00:00:00.000Z'),
  validTo: new Date('2026-08-01T00:00:00.000Z'),
};

describe('isEstimateStringSortField', () => {
  it('treats estimateNumber, contactName, status as string fields', () => {
    expect(isEstimateStringSortField('estimateNumber')).toBe(true);
    expect(isEstimateStringSortField('contactName')).toBe(true);
    expect(isEstimateStringSortField('status')).toBe(true);
    expect(isEstimateStringSortField('total')).toBe(false);
    expect(isEstimateStringSortField('createdAt')).toBe(false);
  });
});

describe('getEstimateSortValue', () => {
  it('lowercases estimateNumber and contactName', () => {
    expect(getEstimateSortValue({ ...base, estimateNumber: 'EST-001' }, 'estimateNumber')).toBe(
      'est-001',
    );
    expect(getEstimateSortValue({ ...base, contactName: 'ACME' }, 'contactName')).toBe('acme');
  });

  it('returns total as number', () => {
    expect(getEstimateSortValue({ ...base, total: 500 }, 'total')).toBe(500);
  });

  it('returns date fields as-is', () => {
    expect(getEstimateSortValue(base, 'createdAt')).toEqual(base.createdAt);
    expect(getEstimateSortValue(base, 'validTo')).toEqual(base.validTo);
  });
});

describe('compareEstimatesByField', () => {
  it('sorts contactName ascending and descending', () => {
    const a = { ...base, contactName: 'AAAA' };
    const b = { ...base, contactName: 'BBBB' };
    expect(compareEstimatesByField(a, b, 'contactName', 'asc')).toBeLessThan(0);
    expect(compareEstimatesByField(a, b, 'contactName', 'desc')).toBeGreaterThan(0);
  });

  it('sorts total numerically', () => {
    const cheap = { ...base, total: 100 };
    const expensive = { ...base, total: 9000 };
    expect(compareEstimatesByField(cheap, expensive, 'total', 'asc')).toBeLessThan(0);
    expect(compareEstimatesByField(cheap, expensive, 'total', 'desc')).toBeGreaterThan(0);
  });

  it('sorts createdAt by time', () => {
    const earlier = { ...base, createdAt: new Date('2026-07-01T00:00:00.000Z') };
    const later = { ...base, createdAt: new Date('2026-07-20T00:00:00.000Z') };
    expect(compareEstimatesByField(earlier, later, 'createdAt', 'asc')).toBeLessThan(0);
    expect(compareEstimatesByField(earlier, later, 'createdAt', 'desc')).toBeGreaterThan(0);
  });

  it('accepts ISO string dates', () => {
    const earlier = {
      ...base,
      updatedAt: '2026-07-01T00:00:00.000Z' as unknown as Date,
    };
    const later = { ...base, updatedAt: '2026-07-20T00:00:00.000Z' as unknown as Date };
    expect(compareEstimatesByField(earlier, later, 'updatedAt', 'asc')).toBeLessThan(0);
  });
});
