import {
  isListFilterActive,
  isListFilterSelectionEmpty,
  itemMatchesListFilters,
  toggleListFilterSelection,
} from '../listFilterSelection';

describe('toggleListFilterSelection', () => {
  const timeGroup = ['upcoming', 'upcoming7', 'upcoming14'] as const;
  const groups = [timeGroup];

  it('toggles independent filters', () => {
    expect(toggleListFilterSelection([], 'homeTeam')).toEqual(['homeTeam']);
    expect(toggleListFilterSelection(['homeTeam'], 'homeTeam')).toEqual([]);
    expect(toggleListFilterSelection(['homeTeam'], 'featured')).toEqual(['homeTeam', 'featured']);
  });

  it('replaces within exclusive groups and keeps other filters', () => {
    expect(toggleListFilterSelection([], 'upcoming7', groups)).toEqual(['upcoming7']);
    expect(toggleListFilterSelection(['upcoming7'], 'upcoming14', groups)).toEqual(['upcoming14']);
    expect(toggleListFilterSelection(['homeTeam', 'upcoming7'], 'upcoming14', groups)).toEqual([
      'homeTeam',
      'upcoming14',
    ]);
    expect(toggleListFilterSelection(['upcoming7'], 'upcoming7', groups)).toEqual([]);
  });
});

describe('itemMatchesListFilters', () => {
  const matchOne = (n: number, f: 'even' | 'positive') => (f === 'even' ? n % 2 === 0 : n > 0);

  it('allows all when empty', () => {
    expect(itemMatchesListFilters(-1, [], matchOne)).toBe(true);
  });

  it('ANDs selected filters', () => {
    expect(itemMatchesListFilters(4, ['even', 'positive'], matchOne)).toBe(true);
    expect(itemMatchesListFilters(-2, ['even', 'positive'], matchOne)).toBe(false);
    expect(itemMatchesListFilters(3, ['even'], matchOne)).toBe(false);
  });
});

describe('selection helpers', () => {
  it('reports active and empty', () => {
    expect(isListFilterSelectionEmpty([])).toBe(true);
    expect(isListFilterActive(['a'], 'a')).toBe(true);
    expect(isListFilterActive(['a'], 'b')).toBe(false);
  });
});
