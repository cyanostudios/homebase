import {
  pulseHistoryMatchesListFilters,
  togglePulseHistoryListFilter,
} from '../pulseHistoryListFilter';

describe('pulseHistoryListFilter', () => {
  const failedToday = {
    status: 'failed',
    sentAt: new Date().toISOString(),
  };
  const okOld = {
    status: 'sent',
    sentAt: '2020-01-01T12:00:00.000Z',
  };

  it('allows all when selection is empty', () => {
    expect(pulseHistoryMatchesListFilters(failedToday, [])).toBe(true);
    expect(pulseHistoryMatchesListFilters(okOld, [])).toBe(true);
  });

  it('ANDs failed and today', () => {
    expect(pulseHistoryMatchesListFilters(failedToday, ['failed', 'today'])).toBe(true);
    expect(pulseHistoryMatchesListFilters(okOld, ['failed', 'today'])).toBe(false);
    expect(pulseHistoryMatchesListFilters(failedToday, ['failed'])).toBe(true);
  });

  it('toggles facets independently', () => {
    expect(togglePulseHistoryListFilter([], 'failed')).toEqual(['failed']);
    expect(togglePulseHistoryListFilter(['failed'], 'today')).toEqual(['failed', 'today']);
    expect(togglePulseHistoryListFilter(['failed', 'today'], 'failed')).toEqual(['today']);
    expect(togglePulseHistoryListFilter(['today'], 'all')).toEqual([]);
  });
});
