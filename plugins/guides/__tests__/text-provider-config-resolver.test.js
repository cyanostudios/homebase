jest.mock('../providers/text/registerDefaultProviders', () => ({
  ensureTextProvidersRegistered: jest.fn(),
}));

jest.mock('../../ai-providers/AIProviderRouter', () => ({
  AIProviderRouter: jest.fn(),
}));

const { AIProviderRouter } = require('../../ai-providers/AIProviderRouter');
const TextProviderConfigResolver = require('../providers/text/TextProviderConfigResolver');

describe('TextProviderConfigResolver', () => {
  let router;

  beforeEach(() => {
    router = {
      resolve: jest.fn(),
      settingsModel: {
        resolveRuntimeConfig: jest.fn(),
      },
    };
    AIProviderRouter.mockImplementation(() => router);
  });

  test('prefers routed provider over env fallback', async () => {
    router.resolve.mockResolvedValue({
      providerKey: 'openai',
      model: 'gpt-4.1-mini',
      apiKey: 'sk-db',
      source: 'global',
    });
    const resolver = new TextProviderConfigResolver({ router });

    const key = await resolver.getPreferredProviderKey({});
    const options = await resolver.getProviderOptions({}, 'openai');

    expect(key).toBe('openai');
    expect(options).toEqual({ apiKey: 'sk-db', model: 'gpt-4.1-mini' });
    expect(router.resolve).toHaveBeenCalledWith({}, { pluginKey: 'guides' });
  });

  test('falls back to env when router returns no provider', async () => {
    router.resolve.mockResolvedValue(null);
    router.settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'openai',
      apiKey: 'sk-env',
      defaultModel: 'gpt-4o-mini',
    });
    const resolver = new TextProviderConfigResolver({ router });
    const previousKey = process.env.GUIDES_TEXT_PROVIDER;

    process.env.GUIDES_TEXT_PROVIDER = 'openai';

    try {
      const key = await resolver.getPreferredProviderKey({});
      const options = await resolver.getProviderOptions({}, 'openai');

      expect(key).toBe('openai');
      expect(options).toEqual({ apiKey: 'sk-env', model: 'gpt-4o-mini' });
    } finally {
      process.env.GUIDES_TEXT_PROVIDER = previousKey;
    }
  });

  test('returns empty options for unsupported provider keys', async () => {
    router.resolve.mockResolvedValue(null);
    router.settingsModel.resolveRuntimeConfig.mockRejectedValue(
      new Error('Unsupported AI provider'),
    );
    const resolver = new TextProviderConfigResolver({ router });

    await expect(resolver.getProviderOptions({}, 'noop')).resolves.toEqual({});
  });
});
