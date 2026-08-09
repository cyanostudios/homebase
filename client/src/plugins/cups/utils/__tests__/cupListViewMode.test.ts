import {
  getInitialCupListViewMode,
  isCupListViewMode,
  resolveCupListViewMode,
} from '../cupListViewMode';

describe('resolveCupListViewMode', () => {
  it('uses listViewMode when valid', () => {
    expect(resolveCupListViewMode({ listViewMode: 'table' })).toBe('table');
    expect(resolveCupListViewMode({ listViewMode: 'cards' })).toBe('cards');
  });

  it('defaults to cards and ignores legacy viewMode', () => {
    expect(resolveCupListViewMode(null)).toBe('cards');
    expect(resolveCupListViewMode({ listViewMode: 'grid' })).toBe('cards');
    expect(resolveCupListViewMode({ viewMode: 'grid' } as { listViewMode?: unknown })).toBe(
      'cards',
    );
  });
});

describe('isCupListViewMode / getInitialCupListViewMode', () => {
  it('accepts only cards and table', () => {
    expect(isCupListViewMode('cards')).toBe(true);
    expect(isCupListViewMode('table')).toBe(true);
    expect(isCupListViewMode('list')).toBe(false);
  });

  it('defaults to cards', () => {
    expect(getInitialCupListViewMode()).toBe('cards');
  });
});
