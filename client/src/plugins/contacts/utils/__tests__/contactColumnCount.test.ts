import {
  getInitialContactColumnCount,
  isContactColumnCount,
  parseStoredContactColumnCount,
  resolveContactColumnCount,
} from '../contactColumnCount';

describe('resolveContactColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveContactColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveContactColumnCount({ columnCount: 3 })).toBe(3);
  });

  it('migrates legacy viewMode grid to 3 and list to 1', () => {
    expect(resolveContactColumnCount({ viewMode: 'grid' })).toBe(3);
    expect(resolveContactColumnCount({ viewMode: 'list' })).toBe(1);
  });

  it('prefers columnCount over viewMode', () => {
    expect(resolveContactColumnCount({ columnCount: 1, viewMode: 'grid' })).toBe(1);
  });

  it('defaults to 3', () => {
    expect(resolveContactColumnCount(null)).toBe(3);
    expect(resolveContactColumnCount({})).toBe(3);
  });
});

describe('isContactColumnCount / parseStoredContactColumnCount', () => {
  it('accepts only 1, 2, 3', () => {
    expect(isContactColumnCount(1)).toBe(true);
    expect(isContactColumnCount(4)).toBe(false);
    expect(parseStoredContactColumnCount('2')).toBe(2);
    expect(parseStoredContactColumnCount('x')).toBe(null);
  });
});

describe('getInitialContactColumnCount', () => {
  it('defaults to 3 when window is unavailable', () => {
    expect(getInitialContactColumnCount()).toBe(3);
  });
});
