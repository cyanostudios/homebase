import {
  isEstimateColumnCount,
  parseStoredEstimateColumnCount,
  resolveEstimateColumnCount,
} from '../estimateColumnCount';

describe('resolveEstimateColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveEstimateColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveEstimateColumnCount({ columnCount: '3' })).toBe(3);
  });

  it('migrates legacy viewMode grid to 3 and list to 1', () => {
    expect(resolveEstimateColumnCount({ viewMode: 'grid' })).toBe(3);
    expect(resolveEstimateColumnCount({ viewMode: 'list' })).toBe(1);
  });

  it('prefers columnCount over viewMode', () => {
    expect(resolveEstimateColumnCount({ columnCount: 1, viewMode: 'grid' })).toBe(1);
  });

  it('defaults to 1', () => {
    expect(resolveEstimateColumnCount(null)).toBe(1);
    expect(resolveEstimateColumnCount({})).toBe(1);
  });
});

describe('isEstimateColumnCount / parseStoredEstimateColumnCount', () => {
  it('accepts only 1, 2, 3', () => {
    expect(isEstimateColumnCount(1)).toBe(true);
    expect(isEstimateColumnCount(4)).toBe(false);
    expect(parseStoredEstimateColumnCount('2')).toBe(2);
    expect(parseStoredEstimateColumnCount('grid')).toBe(null);
  });
});

describe('getInitialEstimateColumnCount (window unavailable path)', () => {
  it('defaults to 1 when session keys are absent', () => {
    expect(parseStoredEstimateColumnCount(null)).toBe(null);
    expect(resolveEstimateColumnCount({ viewMode: 'grid' })).toBe(3);
  });
});
