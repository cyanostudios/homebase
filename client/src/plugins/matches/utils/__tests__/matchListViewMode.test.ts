import {
  getInitialMatchListViewMode,
  isMatchListViewMode,
  resolveMatchListViewMode,
} from '../matchListViewMode';

describe('resolveMatchListViewMode', () => {
  it('uses listViewMode when valid', () => {
    expect(resolveMatchListViewMode({ listViewMode: 'table' })).toBe('table');
    expect(resolveMatchListViewMode({ listViewMode: 'cards' })).toBe('cards');
  });

  it('defaults to cards and ignores legacy viewMode', () => {
    expect(resolveMatchListViewMode(null)).toBe('cards');
    expect(resolveMatchListViewMode({ listViewMode: 'grid' })).toBe('cards');
    expect(resolveMatchListViewMode({ viewMode: 'list' } as { listViewMode?: unknown })).toBe(
      'cards',
    );
  });
});

describe('isMatchListViewMode / getInitialMatchListViewMode', () => {
  it('accepts only cards and table', () => {
    expect(isMatchListViewMode('cards')).toBe(true);
    expect(isMatchListViewMode('table')).toBe(true);
    expect(isMatchListViewMode('grid')).toBe(false);
  });

  it('defaults to cards', () => {
    expect(getInitialMatchListViewMode()).toBe('cards');
  });
});
