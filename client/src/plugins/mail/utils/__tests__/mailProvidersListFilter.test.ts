import {
  mailProviderMatchesListFilters,
  mailProviderMatchesSingleFilter,
  toggleMailProvidersListFilter,
} from '../mailProvidersListFilter';

describe('mailProvidersListFilter', () => {
  const enabled = { enabled: true, configured: true };
  const disabled = { enabled: false, configured: false };

  it('matches single filters and ANDs selection', () => {
    expect(mailProviderMatchesSingleFilter(enabled, 'enabled')).toBe(true);
    expect(mailProviderMatchesListFilters(enabled, [])).toBe(true);
    expect(mailProviderMatchesListFilters(enabled, ['enabled', 'configured'])).toBe(true);
    expect(mailProviderMatchesListFilters(disabled, ['enabled', 'configured'])).toBe(false);
  });

  it('toggles enabled/disabled exclusively and configured independently', () => {
    expect(toggleMailProvidersListFilter(['enabled'], 'disabled')).toEqual(['disabled']);
    expect(toggleMailProvidersListFilter(['disabled', 'configured'], 'enabled')).toEqual([
      'configured',
      'enabled',
    ]);
    expect(toggleMailProvidersListFilter(['enabled'], 'configured')).toEqual([
      'enabled',
      'configured',
    ]);
  });
});
