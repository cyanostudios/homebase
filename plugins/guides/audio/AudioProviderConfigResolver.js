const { AIProviderRouter } = require('../../ai-providers/AIProviderRouter');
const AudioProviderRegistry = require('./AudioProviderRegistry');
const {
  ensureAudioProvidersRegistered,
  listGeneratableAudioProviderKeys,
} = require('./registerDefaultProviders');

const GUIDES_AUDIO_PLUGIN_KEY = 'guides-audio';
const DEFAULT_AUDIO_PROVIDER = 'noop';

class AudioProviderConfigResolver {
  constructor(options = {}) {
    this.router = options.router ?? new AIProviderRouter(options);
    /** @deprecated use router; kept for tests injecting settingsModel */
    this.settingsModel = options.settingsModel ?? this.router.settingsModel;
  }

  /**
   * Prefer guides-audio routing, then env, then first configured audio-capable provider.
   * Ignores router fallbacks to text-only keys (e.g. global openai).
   */
  async getPreferredProviderKey(req) {
    ensureAudioProvidersRegistered();

    try {
      const resolved = await this.router.resolve(req, { pluginKey: GUIDES_AUDIO_PLUGIN_KEY });
      if (resolved?.providerKey) {
        const key = String(resolved.providerKey).trim().toLowerCase();
        if (AudioProviderRegistry.has(key)) {
          return key;
        }
      }
    } catch {
      // fall through to env / configured audio providers
    }

    const envFallback = String(process.env.GUIDES_AUDIO_PROVIDER || '')
      .trim()
      .toLowerCase();
    if (envFallback && AudioProviderRegistry.has(envFallback)) {
      return envFallback;
    }

    for (const key of listGeneratableAudioProviderKeys()) {
      try {
        const runtime = await this.settingsModel.resolveRuntimeConfig(req, key);
        if (runtime?.apiKey) {
          return key;
        }
      } catch {
        // try next
      }
    }

    return DEFAULT_AUDIO_PROVIDER;
  }

  async getProviderOptions(req, providerKey) {
    const normalized = String(providerKey || DEFAULT_AUDIO_PROVIDER)
      .trim()
      .toLowerCase();

    try {
      const routed = await this.router.resolve(req, { pluginKey: GUIDES_AUDIO_PLUGIN_KEY });
      if (
        routed?.providerKey === normalized &&
        routed.apiKey &&
        AudioProviderRegistry.has(normalized)
      ) {
        return {
          apiKey: routed.apiKey,
          model: routed.model,
          voiceId: routed.voiceId || undefined,
        };
      }
    } catch {
      // fall through
    }

    let resolved = null;
    try {
      resolved = await this.settingsModel.resolveRuntimeConfig(req, normalized);
    } catch {
      resolved = null;
    }

    if (!resolved?.apiKey) {
      return {};
    }

    return {
      apiKey: resolved.apiKey,
      model: resolved.defaultModel,
      voiceId: resolved.voiceId || undefined,
    };
  }

  async createProvider(req, providerKey) {
    ensureAudioProvidersRegistered();
    const normalized = String(providerKey || DEFAULT_AUDIO_PROVIDER)
      .trim()
      .toLowerCase();
    const options = await this.getProviderOptions(req, normalized);
    return AudioProviderRegistry.create(normalized, options);
  }

  async getProviderVersion(req, providerKey) {
    const provider = await this.createProvider(req, providerKey);
    return provider.version ?? '1';
  }
}

module.exports = AudioProviderConfigResolver;
