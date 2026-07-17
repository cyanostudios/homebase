const { AIProviderRouter } = require('../../../ai-providers/AIProviderRouter');
const TextProviderRegistry = require('./TextProviderRegistry');
const { ensureTextProvidersRegistered } = require('./registerDefaultProviders');

const GUIDES_PLUGIN_KEY = 'guides';
const DEFAULT_TEXT_PROVIDER = 'noop';

class TextProviderConfigResolver {
  constructor(options = {}) {
    this.router = options.router ?? new AIProviderRouter(options);
    /** @deprecated use router; kept for tests injecting settingsModel */
    this.settingsModel = options.settingsModel ?? this.router.settingsModel;
  }

  async getPreferredProviderKey(req) {
    try {
      const resolved = await this.router.resolve(req, { pluginKey: GUIDES_PLUGIN_KEY });
      if (resolved?.providerKey) {
        return resolved.providerKey;
      }
    } catch {
      // fall through to env fallback
    }

    const fallback = String(process.env.GUIDES_TEXT_PROVIDER || DEFAULT_TEXT_PROVIDER)
      .trim()
      .toLowerCase();
    return fallback || DEFAULT_TEXT_PROVIDER;
  }

  async getProviderOptions(req, providerKey) {
    const normalized = String(providerKey || DEFAULT_TEXT_PROVIDER)
      .trim()
      .toLowerCase();

    try {
      const routed = await this.router.resolve(req, { pluginKey: GUIDES_PLUGIN_KEY });
      if (routed?.providerKey === normalized && routed.apiKey) {
        return {
          apiKey: routed.apiKey,
          model: routed.model,
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
    };
  }

  async createProvider(req, providerKey) {
    ensureTextProvidersRegistered();
    const normalized = String(providerKey || DEFAULT_TEXT_PROVIDER)
      .trim()
      .toLowerCase();
    const options = await this.getProviderOptions(req, normalized);
    return TextProviderRegistry.create(normalized, options);
  }

  async getProviderVersion(req, providerKey) {
    const provider = await this.createProvider(req, providerKey);
    return provider.version ?? '1';
  }
}

module.exports = TextProviderConfigResolver;
