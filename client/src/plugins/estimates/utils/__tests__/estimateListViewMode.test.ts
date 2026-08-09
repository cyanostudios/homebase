import {
  getInitialEstimateListViewMode,
  isEstimateListViewMode,
  resolveEstimateListViewMode,
} from '../estimateListViewMode';

describe('resolveEstimateListViewMode', () => {
  it('uses listViewMode when valid', () => {
    expect(resolveEstimateListViewMode({ listViewMode: 'table' })).toBe('table');
    expect(resolveEstimateListViewMode({ listViewMode: 'cards' })).toBe('cards');
  });

  it('defaults to cards', () => {
    expect(resolveEstimateListViewMode(null)).toBe('cards');
    expect(resolveEstimateListViewMode({})).toBe('cards');
    expect(resolveEstimateListViewMode({ listViewMode: 'grid' })).toBe('cards');
  });

  it('ignores legacy viewMode grid/list for table resolution', () => {
    expect(resolveEstimateListViewMode({ viewMode: 'grid' } as { listViewMode?: unknown })).toBe(
      'cards',
    );
    expect(resolveEstimateListViewMode({ viewMode: 'list' } as { listViewMode?: unknown })).toBe(
      'cards',
    );
  });
});

describe('isEstimateListViewMode / getInitialEstimateListViewMode', () => {
  it('accepts only cards and table', () => {
    expect(isEstimateListViewMode('cards')).toBe(true);
    expect(isEstimateListViewMode('table')).toBe(true);
    expect(isEstimateListViewMode('grid')).toBe(false);
  });

  it('defaults to cards when window is unavailable or empty', () => {
    expect(getInitialEstimateListViewMode()).toBe('cards');
  });
});
