import { priceListMatchesListFilters, togglePriceListListFilter } from '../priceListListFilter';

describe('priceListMatchesListFilters', () => {
  it('allows all when selection is empty', () => {
    expect(priceListMatchesListFilters({ publicationStatus: 'published' }, [])).toBe(true);
  });

  it('matches publication status', () => {
    expect(priceListMatchesListFilters({ publicationStatus: 'draft' }, ['draft'])).toBe(true);
    expect(priceListMatchesListFilters({ publicationStatus: 'published' }, ['draft'])).toBe(false);
  });
});

describe('togglePriceListListFilter', () => {
  it('replaces within exclusive status group', () => {
    expect(togglePriceListListFilter([], 'draft')).toEqual(['draft']);
    expect(togglePriceListListFilter(['draft'], 'published')).toEqual(['published']);
  });
});
