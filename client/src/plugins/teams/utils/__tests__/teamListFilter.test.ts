import { teamMatchesListFilters, toggleTeamListFilter } from '../teamListFilter';

describe('teamMatchesListFilters', () => {
  it('allows all when selection is empty', () => {
    expect(teamMatchesListFilters({ status: 'active' }, [])).toBe(true);
    expect(teamMatchesListFilters({ status: 'dormant' }, [])).toBe(true);
  });

  it('matches status and break', () => {
    expect(teamMatchesListFilters({ status: 'active' }, ['active'])).toBe(true);
    expect(teamMatchesListFilters({ status: 'dormant' }, ['active'])).toBe(false);
    expect(teamMatchesListFilters({ status: 'break' }, ['break'])).toBe(true);
    expect(teamMatchesListFilters({ status: 'active' }, ['break'])).toBe(false);
  });
});

describe('toggleTeamListFilter', () => {
  it('replaces within exclusive status group and clears on re-click', () => {
    expect(toggleTeamListFilter([], 'active')).toEqual(['active']);
    expect(toggleTeamListFilter(['active'], 'break')).toEqual(['break']);
    expect(toggleTeamListFilter(['break'], 'break')).toEqual([]);
  });
});
