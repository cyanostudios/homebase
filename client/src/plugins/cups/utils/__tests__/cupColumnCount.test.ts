import {
  isCupColumnCount,
  parseStoredCupColumnCount,
  resolveCupColumnCount,
} from '../cupColumnCount';

describe('resolveCupColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveCupColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveCupColumnCount({ columnCount: '3' })).toBe(3);
  });

  it('migrates legacy viewMode grid to 3 and list to 1', () => {
    expect(resolveCupColumnCount({ viewMode: 'grid' })).toBe(3);
    expect(resolveCupColumnCount({ viewMode: 'list' })).toBe(1);
  });

  it('prefers columnCount over viewMode', () => {
    expect(resolveCupColumnCount({ columnCount: 1, viewMode: 'grid' })).toBe(1);
  });

  it('defaults to 1', () => {
    expect(resolveCupColumnCount(null)).toBe(1);
    expect(resolveCupColumnCount({})).toBe(1);
  });
});

describe('isCupColumnCount / parseStoredCupColumnCount', () => {
  it('accepts only 1, 2, 3', () => {
    expect(isCupColumnCount(1)).toBe(true);
    expect(isCupColumnCount(4)).toBe(false);
    expect(parseStoredCupColumnCount('2')).toBe(2);
    expect(parseStoredCupColumnCount('grid')).toBe(null);
  });
});
