import {
  pulseProviderMatchesListFilters,
  pulseProviderMatchesSingleFilter,
  togglePulseProvidersListFilter,
} from '../pulseProvidersListFilter';

describe('pulseProvidersListFilter', () => {
  const enabled = { enabled: true, configured: true };
  const disabled = { enabled: false, configured: false };

  it('matches single filters and ANDs selection', () => {
    expect(pulseProviderMatchesSingleFilter(enabled, 'enabled')).toBe(true);
    expect(pulseProviderMatchesListFilters(enabled, [])).toBe(true);
    expect(pulseProviderMatchesListFilters(enabled, ['enabled', 'configured'])).toBe(true);
    expect(pulseProviderMatchesListFilters(disabled, ['enabled', 'configured'])).toBe(false);
  });

  it('toggles enabled/disabled exclusively and configured independently', () => {
    expect(togglePulseProvidersListFilter(['enabled'], 'disabled')).toEqual(['disabled']);
    expect(togglePulseProvidersListFilter(['disabled', 'configured'], 'enabled')).toEqual([
      'configured',
      'enabled',
    ]);
    expect(togglePulseProvidersListFilter(['enabled'], 'configured')).toEqual([
      'enabled',
      'configured',
    ]);
  });
});
