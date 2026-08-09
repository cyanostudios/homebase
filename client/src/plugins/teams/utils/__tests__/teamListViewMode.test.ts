import {
  getInitialTeamListViewMode,
  isTeamListViewMode,
  resolveTeamListViewMode,
} from '../teamListViewMode';

describe('resolveTeamListViewMode', () => {
  it('uses listViewMode when valid', () => {
    expect(resolveTeamListViewMode({ listViewMode: 'table' })).toBe('table');
    expect(resolveTeamListViewMode({ listViewMode: 'cards' })).toBe('cards');
  });

  it('defaults to cards', () => {
    expect(resolveTeamListViewMode(null)).toBe('cards');
    expect(resolveTeamListViewMode({})).toBe('cards');
  });
});

describe('isTeamListViewMode / getInitialTeamListViewMode', () => {
  it('accepts only cards and table and defaults initial to cards', () => {
    expect(isTeamListViewMode('table')).toBe(true);
    expect(isTeamListViewMode('grid')).toBe(false);
    expect(getInitialTeamListViewMode()).toBe('cards');
  });
});
