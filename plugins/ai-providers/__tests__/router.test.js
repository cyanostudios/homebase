const { AIProviderRouter } = require('../AIProviderRouter');

describe('AIProviderRouter', () => {
  let settingsModel;
  let router;

  beforeEach(() => {
    settingsModel = {
      getRoutingForScope: jest.fn(),
      getPreferredEnabledProviderKey: jest.fn(),
      resolveRuntimeConfig: jest.fn(),
    };
    router = new AIProviderRouter({ settingsModel });
  });

  test('prefers plugin override over global default', async () => {
    settingsModel.getRoutingForScope
      .mockResolvedValueOnce({
        scope: 'guides',
        providerKey: 'anthropic',
        model: 'claude-sonnet-4-5',
      })
      .mockResolvedValueOnce(null);
    settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'anthropic',
      apiKey: 'sk-ant',
      defaultModel: 'claude-haiku-4-5',
    });

    const result = await router.resolve({}, { pluginKey: 'guides' });

    expect(settingsModel.getRoutingForScope).toHaveBeenCalledWith({}, 'guides');
    expect(result).toEqual({
      providerKey: 'anthropic',
      model: 'claude-sonnet-4-5',
      apiKey: 'sk-ant',
      source: 'plugin',
    });
  });

  test('uses global default when plugin override is missing', async () => {
    settingsModel.getRoutingForScope.mockResolvedValueOnce(null).mockResolvedValueOnce({
      scope: '*',
      providerKey: 'openai',
      model: null,
    });
    settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'openai',
      apiKey: 'sk-openai',
      defaultModel: 'gpt-4o-mini',
    });

    const result = await router.resolve({}, { pluginKey: 'guides' });

    expect(settingsModel.getRoutingForScope).toHaveBeenCalledWith({}, '*');
    expect(result).toEqual({
      providerKey: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-openai',
      source: 'global',
    });
  });

  test('falls back to legacy preferred provider when routing is unset', async () => {
    settingsModel.getRoutingForScope.mockResolvedValue(null);
    settingsModel.getPreferredEnabledProviderKey.mockResolvedValue('openai');
    settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'openai',
      apiKey: 'sk-legacy',
      defaultModel: 'gpt-4.1-mini',
    });

    const result = await router.resolve({}, { pluginKey: 'guides' });

    expect(settingsModel.getPreferredEnabledProviderKey).toHaveBeenCalledWith({});
    expect(result).toEqual({
      providerKey: 'openai',
      model: 'gpt-4.1-mini',
      apiKey: 'sk-legacy',
      source: 'legacy',
    });
  });

  test('returns null when no routing or credentials exist', async () => {
    settingsModel.getRoutingForScope.mockResolvedValue(null);
    settingsModel.getPreferredEnabledProviderKey.mockResolvedValue(null);

    const result = await router.resolve({}, { pluginKey: 'guides' });

    expect(result).toBeNull();
  });

  test('returns null when routed provider has no credentials', async () => {
    settingsModel.getRoutingForScope.mockResolvedValue({
      scope: '*',
      providerKey: 'openai',
      model: 'gpt-4o',
    });
    settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'openai',
      apiKey: '',
      defaultModel: 'gpt-4o',
    });

    const result = await router.resolve({}, { pluginKey: 'guides' });

    expect(result).toBeNull();
  });
});
