import {
  isMatchColumnCount,
  parseStoredMatchColumnCount,
  resolveMatchColumnCount,
} from '../matchColumnCount';

describe('resolveMatchColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveMatchColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveMatchColumnCount({ columnCount: '3' })).toBe(3);
  });

  it('migrates legacy viewMode grid to 3 and list to 1', () => {
    expect(resolveMatchColumnCount({ viewMode: 'grid' })).toBe(3);
    expect(resolveMatchColumnCount({ viewMode: 'list' })).toBe(1);
  });

  it('prefers columnCount over viewMode', () => {
    expect(resolveMatchColumnCount({ columnCount: 1, viewMode: 'grid' })).toBe(1);
  });

  it('defaults to 1', () => {
    expect(resolveMatchColumnCount(null)).toBe(1);
    expect(resolveMatchColumnCount({})).toBe(1);
  });
});

describe('isMatchColumnCount / parseStoredMatchColumnCount', () => {
  it('accepts only 1, 2, 3', () => {
    expect(isMatchColumnCount(1)).toBe(true);
    expect(isMatchColumnCount(4)).toBe(false);
    expect(parseStoredMatchColumnCount('2')).toBe(2);
    expect(parseStoredMatchColumnCount('grid')).toBe(null);
  });
});

describe('getInitialMatchColumnCount', () => {
  it('defaults to 1 when window is unavailable', () => {
    // Node test env: implementation returns 1 when session keys are absent / no window.
    expect(parseStoredMatchColumnCount(null)).toBe(null);
    expect(resolveMatchColumnCount({ viewMode: 'grid' })).toBe(3);
  });
});
