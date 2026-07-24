import {
  isRequestColumnCount,
  parseStoredRequestColumnCount,
  resolveRequestColumnCount,
} from '../requestColumnCount';

describe('resolveRequestColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveRequestColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveRequestColumnCount({ columnCount: '3' })).toBe(3);
  });

  it('migrates legacy viewMode grid to 3 and list to 1', () => {
    expect(resolveRequestColumnCount({ viewMode: 'grid' })).toBe(3);
    expect(resolveRequestColumnCount({ viewMode: 'list' })).toBe(1);
  });

  it('prefers columnCount over viewMode', () => {
    expect(resolveRequestColumnCount({ columnCount: 1, viewMode: 'grid' })).toBe(1);
  });

  it('defaults to 1', () => {
    expect(resolveRequestColumnCount(null)).toBe(1);
    expect(resolveRequestColumnCount({})).toBe(1);
  });
});

describe('isRequestColumnCount / parseStoredRequestColumnCount', () => {
  it('accepts only 1, 2, 3', () => {
    expect(isRequestColumnCount(1)).toBe(true);
    expect(isRequestColumnCount(4)).toBe(false);
    expect(parseStoredRequestColumnCount('2')).toBe(2);
    expect(parseStoredRequestColumnCount('grid')).toBe(null);
  });
});

describe('getInitialRequestColumnCount', () => {
  it('defaults to 1 when session keys are absent', () => {
    expect(parseStoredRequestColumnCount(null)).toBe(null);
    expect(resolveRequestColumnCount({ viewMode: 'grid' })).toBe(3);
  });
});
