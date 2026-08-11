import {
  aiProviderMatchesListFilters,
  aiProviderMatchesSingleFilter,
  toggleAIProvidersListFilter,
} from '../aiProvidersListFilter';

describe('aiProvidersListFilter', () => {
  const enabled = { enabled: true, hasApiKey: true };
  const disabled = { enabled: false, hasApiKey: false };

  it('matches single filters', () => {
    expect(aiProviderMatchesSingleFilter(enabled, 'enabled')).toBe(true);
    expect(aiProviderMatchesSingleFilter(enabled, 'disabled')).toBe(false);
    expect(aiProviderMatchesSingleFilter(enabled, 'configured')).toBe(true);
    expect(aiProviderMatchesSingleFilter(disabled, 'configured')).toBe(false);
  });

  it('ANDs selected filters; empty selection matches all', () => {
    expect(aiProviderMatchesListFilters(enabled, [])).toBe(true);
    expect(aiProviderMatchesListFilters(enabled, ['enabled', 'configured'])).toBe(true);
    expect(aiProviderMatchesListFilters(disabled, ['enabled', 'configured'])).toBe(false);
  });

  it('toggles enabled/disabled exclusively and configured independently', () => {
    expect(toggleAIProvidersListFilter([], 'enabled')).toEqual(['enabled']);
    expect(toggleAIProvidersListFilter(['enabled'], 'disabled')).toEqual(['disabled']);
    expect(toggleAIProvidersListFilter(['disabled', 'configured'], 'enabled')).toEqual([
      'configured',
      'enabled',
    ]);
    expect(toggleAIProvidersListFilter(['enabled'], 'configured')).toEqual([
      'enabled',
      'configured',
    ]);
  });
});
