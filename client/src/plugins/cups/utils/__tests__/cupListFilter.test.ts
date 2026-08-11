import {
  cupIsRemoved,
  cupIsUpcoming,
  cupMatchesListFilters,
  toggleCupListFilter,
} from '../cupListFilter';

const TODAY = Date.parse('2026-08-11T00:00:00.000Z');

const base = {
  deleted_at: null as string | null,
  visible: true,
  featured: false,
  start_date: '2026-08-20',
};

describe('cupIsRemoved / cupIsUpcoming', () => {
  it('detects removed cups', () => {
    expect(cupIsRemoved(base)).toBe(false);
    expect(cupIsRemoved({ deleted_at: '2026-01-01T00:00:00.000Z' })).toBe(true);
  });

  it('detects upcoming from today start', () => {
    expect(cupIsUpcoming('2026-08-11', TODAY)).toBe(true);
    expect(cupIsUpcoming('2026-08-10', TODAY)).toBe(false);
    expect(cupIsUpcoming(null, TODAY)).toBe(false);
  });
});

describe('cupMatchesListFilters', () => {
  it('excludes removed when selection is empty', () => {
    expect(cupMatchesListFilters(base, [], TODAY)).toBe(true);
    expect(
      cupMatchesListFilters({ ...base, deleted_at: '2026-01-01T00:00:00.000Z' }, [], TODAY),
    ).toBe(false);
  });

  it('ANDs visible and featured facets', () => {
    expect(cupMatchesListFilters(base, ['visible'], TODAY)).toBe(true);
    expect(cupMatchesListFilters(base, ['visible', 'featured'], TODAY)).toBe(false);
    expect(cupMatchesListFilters({ ...base, featured: true }, ['visible', 'featured'], TODAY)).toBe(
      true,
    );
  });

  it('when removed is selected, only removed matches (ignores other filters)', () => {
    const removed = { ...base, deleted_at: '2026-01-01T00:00:00.000Z', visible: false };
    expect(cupMatchesListFilters(removed, ['removed'], TODAY)).toBe(true);
    expect(cupMatchesListFilters(removed, ['removed', 'visible'], TODAY)).toBe(true);
    expect(cupMatchesListFilters(base, ['removed'], TODAY)).toBe(false);
  });
});

describe('toggleCupListFilter', () => {
  it('toggles facets independently and clears removed', () => {
    expect(toggleCupListFilter([], 'visible')).toEqual(['visible']);
    expect(toggleCupListFilter(['visible'], 'featured')).toEqual(['visible', 'featured']);
    expect(toggleCupListFilter(['removed'], 'visible')).toEqual(['visible']);
  });

  it('selecting removed clears other filters', () => {
    expect(toggleCupListFilter(['visible', 'featured'], 'removed')).toEqual(['removed']);
    expect(toggleCupListFilter(['removed'], 'removed')).toEqual([]);
  });
});
