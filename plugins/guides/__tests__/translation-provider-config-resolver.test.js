jest.mock('../providers/translation/registerDefaultProviders', () => ({
  ensureTranslationProvidersRegistered: jest.fn(),
}));

jest.mock('../../ai-providers/AIProviderRouter', () => ({
  AIProviderRouter: jest.fn(),
}));

const { AIProviderRouter } = require('../../ai-providers/AIProviderRouter');
const TranslationProviderConfigResolver = require('../providers/translation/TranslationProviderConfigResolver');

describe('TranslationProviderConfigResolver', () => {
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
    const resolver = new TranslationProviderConfigResolver({ router });

    const key = await resolver.getPreferredProviderKey({});
    const options = await resolver.getProviderOptions({}, 'openai');

    expect(key).toBe('openai');
    expect(options).toEqual({ apiKey: 'sk-db', model: 'gpt-4.1-mini' });
  });

  test('falls back to GUIDES_TRANSLATION_PROVIDER then GUIDES_TEXT_PROVIDER', async () => {
    router.resolve.mockResolvedValue(null);
    const resolver = new TranslationProviderConfigResolver({ router });
    const prevTrans = process.env.GUIDES_TRANSLATION_PROVIDER;
    const prevText = process.env.GUIDES_TEXT_PROVIDER;

    delete process.env.GUIDES_TRANSLATION_PROVIDER;
    process.env.GUIDES_TEXT_PROVIDER = 'openai';

    try {
      await expect(resolver.getPreferredProviderKey({})).resolves.toBe('openai');
    } finally {
      process.env.GUIDES_TRANSLATION_PROVIDER = prevTrans;
      process.env.GUIDES_TEXT_PROVIDER = prevText;
    }
  });
});
