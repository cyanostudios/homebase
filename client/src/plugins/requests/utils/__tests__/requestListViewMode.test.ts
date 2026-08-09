import {
  getInitialRequestListViewMode,
  isRequestListViewMode,
  resolveRequestListViewMode,
} from '../requestListViewMode';

describe('resolveRequestListViewMode', () => {
  it('uses listViewMode when valid', () => {
    expect(resolveRequestListViewMode({ listViewMode: 'table' })).toBe('table');
    expect(resolveRequestListViewMode({ listViewMode: 'cards' })).toBe('cards');
  });

  it('defaults to cards and ignores legacy viewMode', () => {
    expect(resolveRequestListViewMode(null)).toBe('cards');
    expect(resolveRequestListViewMode({ listViewMode: 'grid' })).toBe('cards');
    expect(resolveRequestListViewMode({ viewMode: 'grid' } as { listViewMode?: unknown })).toBe(
      'cards',
    );
  });
});

describe('isRequestListViewMode / getInitialRequestListViewMode', () => {
  it('accepts only cards and table', () => {
    expect(isRequestListViewMode('cards')).toBe(true);
    expect(isRequestListViewMode('table')).toBe(true);
    expect(isRequestListViewMode('list')).toBe(false);
  });

  it('defaults to cards', () => {
    expect(getInitialRequestListViewMode()).toBe('cards');
  });
});
