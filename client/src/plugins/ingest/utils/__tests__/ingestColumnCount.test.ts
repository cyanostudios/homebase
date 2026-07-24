import {
  isIngestColumnCount,
  parseStoredIngestColumnCount,
  resolveIngestColumnCount,
} from '../ingestColumnCount';

describe('resolveIngestColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveIngestColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveIngestColumnCount({ columnCount: '3' })).toBe(3);
  });

  it('migrates legacy viewMode grid to 3', () => {
    expect(resolveIngestColumnCount({ viewMode: 'grid' })).toBe(3);
  });

  it('defaults to 1 for list viewMode or no viewMode', () => {
    expect(resolveIngestColumnCount({ viewMode: 'list' })).toBe(1);
    expect(resolveIngestColumnCount({})).toBe(1);
  });

  it('prefers columnCount over viewMode', () => {
    expect(resolveIngestColumnCount({ columnCount: 1, viewMode: 'grid' })).toBe(1);
  });

  it('defaults to 1 for null/undefined', () => {
    expect(resolveIngestColumnCount(null)).toBe(1);
    expect(resolveIngestColumnCount(undefined)).toBe(1);
  });
});

describe('isIngestColumnCount / parseStoredIngestColumnCount', () => {
  it('accepts only 1, 2, 3', () => {
    expect(isIngestColumnCount(1)).toBe(true);
    expect(isIngestColumnCount(2)).toBe(true);
    expect(isIngestColumnCount(3)).toBe(true);
    expect(isIngestColumnCount(0)).toBe(false);
    expect(isIngestColumnCount(4)).toBe(false);
    expect(isIngestColumnCount('2')).toBe(false);
  });

  it('parses stored string values', () => {
    expect(parseStoredIngestColumnCount('1')).toBe(1);
    expect(parseStoredIngestColumnCount('2')).toBe(2);
    expect(parseStoredIngestColumnCount('3')).toBe(3);
    expect(parseStoredIngestColumnCount('grid')).toBe(null);
    expect(parseStoredIngestColumnCount(null)).toBe(null);
    expect(parseStoredIngestColumnCount('')).toBe(null);
  });
});

describe('getInitialIngestColumnCount helpers', () => {
  it('resolveIngestColumnCount covers session fallback paths', () => {
    expect(parseStoredIngestColumnCount(null)).toBe(null);
    expect(resolveIngestColumnCount({ viewMode: 'grid' })).toBe(3);
  });
});
