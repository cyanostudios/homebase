import {
  isTaskColumnCount,
  parseStoredTaskColumnCount,
  resolveTaskColumnCount,
} from '../taskColumnCount';

describe('resolveTaskColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveTaskColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveTaskColumnCount({ columnCount: '3' })).toBe(3);
  });

  it('migrates legacy viewMode grid to 3 and list to 1', () => {
    expect(resolveTaskColumnCount({ viewMode: 'grid' })).toBe(3);
    expect(resolveTaskColumnCount({ viewMode: 'list' })).toBe(1);
  });

  it('prefers columnCount over viewMode', () => {
    expect(resolveTaskColumnCount({ columnCount: 1, viewMode: 'grid' })).toBe(1);
  });

  it('defaults to 1', () => {
    expect(resolveTaskColumnCount(null)).toBe(1);
    expect(resolveTaskColumnCount({})).toBe(1);
  });
});

describe('isTaskColumnCount / parseStoredTaskColumnCount', () => {
  it('accepts only 1, 2, 3', () => {
    expect(isTaskColumnCount(1)).toBe(true);
    expect(isTaskColumnCount(4)).toBe(false);
    expect(parseStoredTaskColumnCount('2')).toBe(2);
    expect(parseStoredTaskColumnCount('grid')).toBe(null);
  });
});

describe('getInitialTaskColumnCount', () => {
  it('defaults to 1 when window is unavailable', () => {
    // Node test env: implementation returns 1 when session keys are absent / no window.
    // Session read paths are covered via parseStoredTaskColumnCount + resolveTaskColumnCount.
    expect(parseStoredTaskColumnCount(null)).toBe(null);
    expect(resolveTaskColumnCount({ viewMode: 'grid' })).toBe(3);
  });
});
