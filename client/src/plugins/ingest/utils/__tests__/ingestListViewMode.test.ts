import {
  getInitialIngestListViewMode,
  isIngestListViewMode,
  resolveIngestListViewMode,
} from '../ingestListViewMode';

describe('resolveIngestListViewMode', () => {
  it('uses listViewMode when valid', () => {
    expect(resolveIngestListViewMode({ listViewMode: 'table' })).toBe('table');
    expect(resolveIngestListViewMode({ listViewMode: 'cards' })).toBe('cards');
  });

  it('defaults to cards', () => {
    expect(resolveIngestListViewMode(null)).toBe('cards');
    expect(resolveIngestListViewMode({})).toBe('cards');
  });
});

describe('isIngestListViewMode / getInitialIngestListViewMode', () => {
  it('accepts only cards and table and defaults initial to cards', () => {
    expect(isIngestListViewMode('table')).toBe(true);
    expect(isIngestListViewMode('list')).toBe(false);
    expect(getInitialIngestListViewMode()).toBe('cards');
  });
});
