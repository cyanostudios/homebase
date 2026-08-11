import { clubdeskMatchesListFilters, toggleClubdeskListFilter } from '../clubdeskListFilter';

describe('clubdeskMatchesListFilters', () => {
  it('allows all when selection is empty', () => {
    expect(clubdeskMatchesListFilters({ publicationStatus: 'draft' }, [])).toBe(true);
  });

  it('matches publication status', () => {
    expect(clubdeskMatchesListFilters({ publicationStatus: 'draft' }, ['draft'])).toBe(true);
    expect(clubdeskMatchesListFilters({ publicationStatus: 'published' }, ['draft'])).toBe(false);
  });
});

describe('toggleClubdeskListFilter', () => {
  it('replaces within exclusive status group', () => {
    expect(toggleClubdeskListFilter(['draft'], 'published')).toEqual(['published']);
    expect(toggleClubdeskListFilter(['published'], 'published')).toEqual([]);
  });
});
