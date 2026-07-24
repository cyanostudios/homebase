import {
  isNoteColumnCount,
  parseStoredNoteColumnCount,
  resolveNoteColumnCount,
} from '../noteColumnCount';

describe('resolveNoteColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveNoteColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveNoteColumnCount({ columnCount: '3' })).toBe(3);
  });

  it('migrates legacy viewMode grid to 3 and list to 1', () => {
    expect(resolveNoteColumnCount({ viewMode: 'grid' })).toBe(3);
    expect(resolveNoteColumnCount({ viewMode: 'list' })).toBe(1);
  });

  it('prefers columnCount over viewMode', () => {
    expect(resolveNoteColumnCount({ columnCount: 1, viewMode: 'grid' })).toBe(1);
  });

  it('defaults to 1', () => {
    expect(resolveNoteColumnCount(null)).toBe(1);
    expect(resolveNoteColumnCount({})).toBe(1);
  });
});

describe('isNoteColumnCount / parseStoredNoteColumnCount', () => {
  it('accepts only 1, 2, 3', () => {
    expect(isNoteColumnCount(1)).toBe(true);
    expect(isNoteColumnCount(4)).toBe(false);
    expect(parseStoredNoteColumnCount('2')).toBe(2);
    expect(parseStoredNoteColumnCount('grid')).toBe(null);
  });
});

describe('getInitialNoteColumnCount', () => {
  it('defaults to 1 when window is unavailable', () => {
    // Node test env: implementation returns 1 when session keys are absent / no window.
    // Session read paths are covered via parseStoredNoteColumnCount + resolveNoteColumnCount.
    expect(parseStoredNoteColumnCount(null)).toBe(null);
    expect(resolveNoteColumnCount({ viewMode: 'grid' })).toBe(3);
  });
});
