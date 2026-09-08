import {
  FILES_CARDS_COLUMN_COUNT,
  getEffectiveFileGridColumns,
  isFileColumnCount,
  normalizeFileCardsColumnCount,
  parseStoredFileColumnCount,
  resolveFileColumnCount,
  settingsHasFileColumnPreference,
} from '../fileColumnCount';

describe('resolveFileColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveFileColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveFileColumnCount({ columnCount: '3' })).toBe(3);
    expect(resolveFileColumnCount({ columnCount: 6 })).toBe(6);
  });

  it('migrates legacy viewMode', () => {
    expect(resolveFileColumnCount({ viewMode: 'grid' })).toBe(6);
    expect(resolveFileColumnCount({ viewMode: 'list' })).toBe(1);
  });

  it('prefers columnCount over viewMode', () => {
    expect(resolveFileColumnCount({ columnCount: 1, viewMode: 'grid' })).toBe(1);
  });

  it('defaults to 1 when empty', () => {
    expect(resolveFileColumnCount(null)).toBe(1);
    expect(resolveFileColumnCount({})).toBe(1);
  });
});

describe('normalizeFileCardsColumnCount', () => {
  it('maps any cards pref to dense desktop count (6)', () => {
    expect(normalizeFileCardsColumnCount(1)).toBe(6);
    expect(normalizeFileCardsColumnCount(2)).toBe(6);
    expect(normalizeFileCardsColumnCount(3)).toBe(6);
    expect(normalizeFileCardsColumnCount(6)).toBe(6);
  });
});

describe('getEffectiveFileGridColumns', () => {
  it('uses 2 / 4 / 6 by viewport tier', () => {
    expect(getEffectiveFileGridColumns('phone')).toBe(2);
    expect(getEffectiveFileGridColumns('pad')).toBe(4);
    expect(getEffectiveFileGridColumns('desktop')).toBe(6);
  });

  it('clamps desktop to 2 while quick context is open', () => {
    expect(getEffectiveFileGridColumns('desktop', { quickContextOpen: true })).toBe(2);
    expect(getEffectiveFileGridColumns('pad', { quickContextOpen: true })).toBe(4);
  });
});

describe('settingsHasFileColumnPreference', () => {
  it('is false for empty or missing settings', () => {
    expect(settingsHasFileColumnPreference(null)).toBe(false);
    expect(settingsHasFileColumnPreference({})).toBe(false);
  });

  it('is true when columnCount or legacy viewMode is present', () => {
    expect(settingsHasFileColumnPreference({ columnCount: 2 })).toBe(true);
    expect(settingsHasFileColumnPreference({ viewMode: 'grid' })).toBe(true);
  });
});

describe('isFileColumnCount / parseStoredFileColumnCount', () => {
  it('accepts 1, 2, 3, 6', () => {
    expect(isFileColumnCount(1)).toBe(true);
    expect(isFileColumnCount(6)).toBe(true);
    expect(isFileColumnCount(4)).toBe(false);
    expect(parseStoredFileColumnCount('2')).toBe(2);
    expect(parseStoredFileColumnCount('6')).toBe(6);
    expect(parseStoredFileColumnCount('grid')).toBe(null);
  });
});

describe('FILES_CARDS_COLUMN_COUNT', () => {
  it('is 6 for dense desktop cards', () => {
    expect(FILES_CARDS_COLUMN_COUNT).toBe(6);
  });
});
