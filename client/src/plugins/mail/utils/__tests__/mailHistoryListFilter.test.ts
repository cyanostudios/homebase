import {
  mailHistoryMatchesListFilters,
  toggleMailHistoryListFilter,
} from '../mailHistoryListFilter';

describe('mailHistoryListFilter', () => {
  const withSourceToday = {
    pluginSource: 'tasks',
    sentAt: new Date().toISOString(),
  };
  const noSourceOld = {
    pluginSource: null,
    sentAt: '2020-01-01T12:00:00.000Z',
  };

  it('allows all when selection is empty', () => {
    expect(mailHistoryMatchesListFilters(withSourceToday, [])).toBe(true);
    expect(mailHistoryMatchesListFilters(noSourceOld, [])).toBe(true);
  });

  it('ANDs withSource and today', () => {
    expect(mailHistoryMatchesListFilters(withSourceToday, ['withSource', 'today'])).toBe(true);
    expect(mailHistoryMatchesListFilters(noSourceOld, ['withSource', 'today'])).toBe(false);
    expect(mailHistoryMatchesListFilters(withSourceToday, ['withSource'])).toBe(true);
  });

  it('toggles facets independently', () => {
    expect(toggleMailHistoryListFilter([], 'withSource')).toEqual(['withSource']);
    expect(toggleMailHistoryListFilter(['withSource'], 'today')).toEqual(['withSource', 'today']);
    expect(toggleMailHistoryListFilter(['withSource', 'today'], 'withSource')).toEqual(['today']);
    expect(toggleMailHistoryListFilter(['today'], 'all')).toEqual([]);
  });
});
