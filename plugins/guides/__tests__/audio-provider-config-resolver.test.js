jest.mock('../audio/registerDefaultProviders', () => ({
  ensureAudioProvidersRegistered: jest.fn(),
  listGeneratableAudioProviderKeys: jest.fn(() => ['elevenlabs']),
}));

jest.mock('../audio/AudioProviderRegistry', () => ({
  has: jest.fn((key) => ['noop', 'elevenlabs'].includes(String(key).toLowerCase())),
  create: jest.fn(),
}));

jest.mock('../../ai-providers/AIProviderRouter', () => ({
  AIProviderRouter: jest.fn(),
}));

const { AIProviderRouter } = require('../../ai-providers/AIProviderRouter');
const AudioProviderRegistry = require('../audio/AudioProviderRegistry');
const { listGeneratableAudioProviderKeys } = require('../audio/registerDefaultProviders');
const AudioProviderConfigResolver = require('../audio/AudioProviderConfigResolver');

describe('AudioProviderConfigResolver', () => {
  let router;

  beforeEach(() => {
    jest.clearAllMocks();
    AudioProviderRegistry.has.mockImplementation((key) =>
      ['noop', 'elevenlabs'].includes(String(key).toLowerCase()),
    );
    listGeneratableAudioProviderKeys.mockReturnValue(['elevenlabs']);
    router = {
      resolve: jest.fn(),
      settingsModel: {
        resolveRuntimeConfig: jest.fn(),
      },
    };
    AIProviderRouter.mockImplementation(() => router);
  });

  test('prefers routed audio provider over env fallback', async () => {
    router.resolve.mockResolvedValue({
      providerKey: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      apiKey: 'xi-db',
      source: 'plugin',
    });
    const resolver = new AudioProviderConfigResolver({ router });

    const key = await resolver.getPreferredProviderKey({});
    const options = await resolver.getProviderOptions({}, 'elevenlabs');

    expect(key).toBe('elevenlabs');
    expect(options).toEqual({ apiKey: 'xi-db', model: 'eleven_multilingual_v2' });
    expect(router.resolve).toHaveBeenCalledWith({}, { pluginKey: 'guides-audio' });
  });

  test('ignores router fallback to text-only providers', async () => {
    router.resolve.mockResolvedValue({
      providerKey: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-db',
      source: 'global',
    });
    router.settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'elevenlabs',
      apiKey: 'xi-saved',
      defaultModel: 'eleven_multilingual_v2',
    });
    const resolver = new AudioProviderConfigResolver({ router });
    const previousKey = process.env.GUIDES_AUDIO_PROVIDER;
    delete process.env.GUIDES_AUDIO_PROVIDER;

    try {
      const key = await resolver.getPreferredProviderKey({});
      expect(key).toBe('elevenlabs');
    } finally {
      if (previousKey === undefined) {
        delete process.env.GUIDES_AUDIO_PROVIDER;
      } else {
        process.env.GUIDES_AUDIO_PROVIDER = previousKey;
      }
    }
  });

  test('falls back to env when router returns no audio provider', async () => {
    router.resolve.mockResolvedValue(null);
    router.settingsModel.resolveRuntimeConfig.mockResolvedValue({
      providerKey: 'elevenlabs',
      apiKey: 'xi-env',
      defaultModel: 'eleven_multilingual_v2',
    });
    const resolver = new AudioProviderConfigResolver({ router });
    const previousKey = process.env.GUIDES_AUDIO_PROVIDER;

    process.env.GUIDES_AUDIO_PROVIDER = 'elevenlabs';

    try {
      const key = await resolver.getPreferredProviderKey({});
      const options = await resolver.getProviderOptions({}, 'elevenlabs');

      expect(key).toBe('elevenlabs');
      expect(options).toEqual({ apiKey: 'xi-env', model: 'eleven_multilingual_v2' });
    } finally {
      process.env.GUIDES_AUDIO_PROVIDER = previousKey;
    }
  });

  test('returns empty options for unsupported provider keys', async () => {
    router.resolve.mockResolvedValue(null);
    router.settingsModel.resolveRuntimeConfig.mockRejectedValue(
      new Error('Unsupported AI provider'),
    );
    const resolver = new AudioProviderConfigResolver({ router });

    await expect(resolver.getProviderOptions({}, 'noop')).resolves.toEqual({});
  });
});
