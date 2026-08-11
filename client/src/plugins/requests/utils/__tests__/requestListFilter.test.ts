import {
  isRequestListStatusFilterNonDefault,
  requestMatchesListFilters,
  toggleRequestListFilter,
} from '../requestListFilter';

describe('requestMatchesListFilters', () => {
  it('allows all when selection is empty', () => {
    expect(requestMatchesListFilters({ status: 'completed' }, [])).toBe(true);
  });

  it('matches active open statuses', () => {
    expect(requestMatchesListFilters({ status: 'not started' }, ['active'])).toBe(true);
    expect(requestMatchesListFilters({ status: 'in progress' }, ['active'])).toBe(true);
    expect(requestMatchesListFilters({ status: 'completed' }, ['active'])).toBe(false);
  });

  it('matches completed and cancelled', () => {
    expect(requestMatchesListFilters({ status: 'completed' }, ['completed'])).toBe(true);
    expect(requestMatchesListFilters({ status: 'cancelled' }, ['cancelled'])).toBe(true);
  });
});

describe('toggleRequestListFilter', () => {
  it('replaces within exclusive status group', () => {
    expect(toggleRequestListFilter(['active'], 'completed')).toEqual(['completed']);
    expect(toggleRequestListFilter(['completed'], 'cancelled')).toEqual(['cancelled']);
    expect(toggleRequestListFilter(['active'], 'active')).toEqual([]);
  });
});

describe('isRequestListStatusFilterNonDefault', () => {
  it('treats only active singleton as default', () => {
    expect(isRequestListStatusFilterNonDefault(['active'])).toBe(false);
    expect(isRequestListStatusFilterNonDefault([])).toBe(true);
    expect(isRequestListStatusFilterNonDefault(['completed'])).toBe(true);
  });
});
