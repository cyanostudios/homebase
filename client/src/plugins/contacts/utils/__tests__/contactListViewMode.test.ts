import {
  getInitialContactListViewMode,
  isContactListViewMode,
  parseStoredContactListViewMode,
  resolveContactListViewMode,
} from '../contactListViewMode';

describe('resolveContactListViewMode', () => {
  it('uses listViewMode when valid', () => {
    expect(resolveContactListViewMode({ listViewMode: 'table' })).toBe('table');
    expect(resolveContactListViewMode({ listViewMode: 'cards' })).toBe('cards');
  });

  it('defaults to cards', () => {
    expect(resolveContactListViewMode(null)).toBe('cards');
    expect(resolveContactListViewMode({})).toBe('cards');
    expect(resolveContactListViewMode({ listViewMode: 'grid' })).toBe('cards');
  });

  it('ignores legacy viewMode grid/list for table resolution', () => {
    expect(resolveContactListViewMode({ viewMode: 'grid' } as { listViewMode?: unknown })).toBe(
      'cards',
    );
    expect(resolveContactListViewMode({ viewMode: 'list' } as { listViewMode?: unknown })).toBe(
      'cards',
    );
  });
});

describe('isContactListViewMode / parseStoredContactListViewMode', () => {
  it('accepts only cards and table', () => {
    expect(isContactListViewMode('cards')).toBe(true);
    expect(isContactListViewMode('table')).toBe(true);
    expect(isContactListViewMode('grid')).toBe(false);
    expect(parseStoredContactListViewMode('table')).toBe('table');
    expect(parseStoredContactListViewMode('list')).toBe(null);
  });
});

describe('getInitialContactListViewMode', () => {
  it('defaults to cards when window is unavailable or empty', () => {
    expect(getInitialContactListViewMode()).toBe('cards');
  });
});
