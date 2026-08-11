import { estimateMatchesListFilters, toggleEstimateListFilter } from '../estimateListFilter';

describe('estimateMatchesListFilters', () => {
  it('allows all when selection is empty', () => {
    expect(estimateMatchesListFilters({ status: 'sent' }, [])).toBe(true);
  });

  it('matches exclusive statuses', () => {
    expect(estimateMatchesListFilters({ status: 'draft' }, ['draft'])).toBe(true);
    expect(estimateMatchesListFilters({ status: 'accepted' }, ['sent'])).toBe(false);
    expect(estimateMatchesListFilters({ status: 'accepted' }, ['accepted'])).toBe(true);
  });
});

describe('toggleEstimateListFilter', () => {
  it('replaces within exclusive status group', () => {
    expect(toggleEstimateListFilter(['draft'], 'sent')).toEqual(['sent']);
    expect(toggleEstimateListFilter(['sent'], 'accepted')).toEqual(['accepted']);
    expect(toggleEstimateListFilter(['accepted'], 'accepted')).toEqual([]);
  });
});
