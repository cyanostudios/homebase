import {
  isGuideColumnCount,
  parseStoredGuideColumnCount,
  resolveGuideColumnCount,
} from '../guideColumnCount';

describe('resolveGuideColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveGuideColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveGuideColumnCount({ columnCount: '3' })).toBe(3);
  });

  it('migrates legacy viewMode grid to 3 and list to 1', () => {
    expect(resolveGuideColumnCount({ viewMode: 'grid' })).toBe(3);
    expect(resolveGuideColumnCount({ viewMode: 'list' })).toBe(1);
  });

  it('prefers columnCount over viewMode', () => {
    expect(resolveGuideColumnCount({ columnCount: 1, viewMode: 'grid' })).toBe(1);
  });

  it('defaults to 1', () => {
    expect(resolveGuideColumnCount(null)).toBe(1);
    expect(resolveGuideColumnCount({})).toBe(1);
  });
});

describe('isGuideColumnCount / parseStoredGuideColumnCount', () => {
  it('accepts only 1, 2, 3', () => {
    expect(isGuideColumnCount(1)).toBe(true);
    expect(isGuideColumnCount(4)).toBe(false);
    expect(parseStoredGuideColumnCount('2')).toBe(2);
    expect(parseStoredGuideColumnCount('grid')).toBe(null);
  });
});

describe('getInitialGuideColumnCount', () => {
  it('defaults via parse when session keys are absent', () => {
    expect(parseStoredGuideColumnCount(null)).toBe(null);
    expect(resolveGuideColumnCount({ viewMode: 'grid' })).toBe(3);
  });
});
