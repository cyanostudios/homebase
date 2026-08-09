import {
  getInitialClubdeskListViewMode,
  isClubdeskListViewMode,
  resolveClubdeskListViewMode,
} from '../clubdeskListViewMode';

describe('resolveClubdeskListViewMode', () => {
  it('uses listViewMode when valid', () => {
    expect(resolveClubdeskListViewMode({ listViewMode: 'table' })).toBe('table');
    expect(resolveClubdeskListViewMode({ listViewMode: 'cards' })).toBe('cards');
  });

  it('defaults to cards', () => {
    expect(resolveClubdeskListViewMode(null)).toBe('cards');
    expect(resolveClubdeskListViewMode({})).toBe('cards');
    expect(resolveClubdeskListViewMode({ listViewMode: 'grid' })).toBe('cards');
  });
});

describe('isClubdeskListViewMode', () => {
  it('accepts only cards and table', () => {
    expect(isClubdeskListViewMode('cards')).toBe(true);
    expect(isClubdeskListViewMode('table')).toBe(true);
    expect(isClubdeskListViewMode('grid')).toBe(false);
  });
});

describe('getInitialClubdeskListViewMode', () => {
  it('defaults to cards when window is unavailable or empty', () => {
    expect(getInitialClubdeskListViewMode()).toBe('cards');
  });
});
