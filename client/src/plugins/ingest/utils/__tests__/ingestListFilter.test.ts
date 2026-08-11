import { ingestMatchesListFilters, toggleIngestListFilter } from '../ingestListFilter';

describe('ingestMatchesListFilters', () => {
  const activeSuccess = { isActive: true, lastFetchStatus: 'success' as const };
  const inactiveFailed = { isActive: false, lastFetchStatus: 'failed' as const };

  it('allows all when selection is empty', () => {
    expect(ingestMatchesListFilters(activeSuccess, [])).toBe(true);
  });

  it('ANDs active facet with fetch status', () => {
    expect(ingestMatchesListFilters(activeSuccess, ['active', 'success'])).toBe(true);
    expect(ingestMatchesListFilters(inactiveFailed, ['active', 'failed'])).toBe(false);
    expect(ingestMatchesListFilters(inactiveFailed, ['failed'])).toBe(true);
  });
});

describe('toggleIngestListFilter', () => {
  it('replaces success/failed and keeps active facet', () => {
    expect(toggleIngestListFilter(['active'], 'success')).toEqual(['active', 'success']);
    expect(toggleIngestListFilter(['active', 'success'], 'failed')).toEqual(['active', 'failed']);
    expect(toggleIngestListFilter(['success'], 'success')).toEqual([]);
    expect(toggleIngestListFilter([], 'active')).toEqual(['active']);
  });
});
