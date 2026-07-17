const { AIProviderSettingsModel } = require('./model');
const { isRoutablePluginKey } = require('./routablePlugins');

const GLOBAL_SCOPE = '*';

/**
 * Resolves which provider/model/credentials to use for a plugin request.
 * Precedence: plugin override → global default → legacy first enabled → none.
 */
class AIProviderRouter {
  /**
   * @param {{ settingsModel?: import('./model').AIProviderSettingsModel }} [options]
   */
  constructor(options = {}) {
    this.settingsModel = options.settingsModel ?? new AIProviderSettingsModel();
  }

  /**
   * @param {import('express').Request} req
   * @param {{ pluginKey: string, capability?: string }} options
   * @returns {Promise<{ providerKey: string, model: string, apiKey: string, source: 'plugin'|'global'|'legacy'|'none' }|null>}
   */
  async resolve(req, { pluginKey, capability: _capability } = {}) {
    const normalizedPluginKey = String(pluginKey ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedPluginKey) {
      return null;
    }

    let routingDecision = null;

    if (isRoutablePluginKey(normalizedPluginKey)) {
      routingDecision = await this.settingsModel.getRoutingForScope(req, normalizedPluginKey);
    }

    if (!routingDecision) {
      routingDecision = await this.settingsModel.getRoutingForScope(req, GLOBAL_SCOPE);
    }

    if (routingDecision) {
      const source = routingDecision.scope === GLOBAL_SCOPE ? 'global' : 'plugin';
      return this._resolveWithCredentials(
        req,
        routingDecision.providerKey,
        routingDecision.model,
        source,
      );
    }

    const legacyKey = await this.settingsModel.getPreferredEnabledProviderKey(req);
    if (legacyKey) {
      return this._resolveWithCredentials(req, legacyKey, null, 'legacy');
    }

    return null;
  }

  /**
   * @param {import('express').Request} req
   * @param {string} providerKey
   * @param {string|null|undefined} routedModel
   * @param {'plugin'|'global'|'legacy'} source
   */
  async _resolveWithCredentials(req, providerKey, routedModel, source) {
    const runtime = await this.settingsModel.resolveRuntimeConfig(req, providerKey);
    if (!runtime?.apiKey) {
      return null;
    }

    const model = String(routedModel ?? '').trim() || runtime.defaultModel || '';

    return {
      providerKey: runtime.providerKey,
      model,
      apiKey: runtime.apiKey,
      source,
    };
  }
}

module.exports = {
  AIProviderRouter,
  GLOBAL_SCOPE,
};
