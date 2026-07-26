import {
  isFileColumnCount,
  parseStoredFileColumnCount,
  resolveFileColumnCount,
  settingsHasFileColumnPreference,
} from '../fileColumnCount';

describe('resolveFileColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveFileColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveFileColumnCount({ columnCount: '3' })).toBe(3);
  });

  it('migrates legacy viewMode grid to 3 and list to 1', () => {
    expect(resolveFileColumnCount({ viewMode: 'grid' })).toBe(3);
    expect(resolveFileColumnCount({ viewMode: 'list' })).toBe(1);
  });

  it('prefers columnCount over viewMode', () => {
    expect(resolveFileColumnCount({ columnCount: 1, viewMode: 'grid' })).toBe(1);
  });

  it('defaults to 1', () => {
    expect(resolveFileColumnCount(null)).toBe(1);
    expect(resolveFileColumnCount({})).toBe(1);
  });
});

describe('settingsHasFileColumnPreference', () => {
  it('is false for empty or missing settings', () => {
    expect(settingsHasFileColumnPreference(null)).toBe(false);
    expect(settingsHasFileColumnPreference(undefined)).toBe(false);
    expect(settingsHasFileColumnPreference({})).toBe(false);
  });

  it('is true when columnCount or legacy viewMode is present', () => {
    expect(settingsHasFileColumnPreference({ columnCount: 2 })).toBe(true);
    expect(settingsHasFileColumnPreference({ viewMode: 'grid' })).toBe(true);
    expect(settingsHasFileColumnPreference({ viewMode: 'list' })).toBe(true);
  });
});

describe('isFileColumnCount / parseStoredFileColumnCount', () => {
  it('accepts only 1, 2, 3', () => {
    expect(isFileColumnCount(1)).toBe(true);
    expect(isFileColumnCount(4)).toBe(false);
    expect(parseStoredFileColumnCount('2')).toBe(2);
    expect(parseStoredFileColumnCount('grid')).toBe(null);
  });
});

describe('getInitialFileColumnCount', () => {
  it('defaults to 1 when window is unavailable', () => {
    expect(parseStoredFileColumnCount(null)).toBe(null);
    expect(resolveFileColumnCount({ viewMode: 'grid' })).toBe(3);
  });
});
