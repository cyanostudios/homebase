/**
 * Resolves which Pulse SMS provider/credentials to use for a plugin request.
 * Precedence: plugin override → global default → legacy first enabled SMS → none.
 */
const { isRoutablePluginKey } = require('./routablePlugins');
const { isSmsNotificationCapable } = require('./providerCatalog');

const GLOBAL_SCOPE = '*';

class PulseProviderRouter {
  /**
   * @param {{ settingsModel?: import('./providerModel') }} [options]
   */
  constructor(options = {}) {
    this.settingsModel = options.settingsModel ?? require('./providerModel');
  }

  /**
   * Peek routed provider key without requiring credentials (plugin → global).
   * @returns {Promise<string|null>}
   */
  async _peekRoutedProviderKey(req, pluginKey) {
    const normalizedPluginKey = String(pluginKey ?? '')
      .trim()
      .toLowerCase();

    if (normalizedPluginKey && isRoutablePluginKey(normalizedPluginKey)) {
      const pluginRow = await this.settingsModel.getRoutingForScope(req, normalizedPluginKey);
      if (pluginRow?.providerKey) {
        return String(pluginRow.providerKey).toLowerCase();
      }
    }

    const globalRow = await this.settingsModel.getRoutingForScope(req, GLOBAL_SCOPE);
    if (globalRow?.providerKey) {
      return String(globalRow.providerKey).toLowerCase();
    }
    return null;
  }

  /**
   * @param {import('express').Request} req
   * @param {{ pluginKey: string }} options
   * @returns {Promise<{ ready: boolean, providerKey?: string, failure?: { code: string } }>}
   */
  async checkReadiness(req, { pluginKey } = {}) {
    const routedKey = await this._peekRoutedProviderKey(req, pluginKey);
    if (routedKey && !isSmsNotificationCapable(routedKey)) {
      return {
        ready: false,
        providerKey: routedKey,
        failure: { code: 'provider_not_sms_capable' },
      };
    }

    const resolved = await this.resolve(req, { pluginKey });
    if (!resolved?.providerKey) {
      return { ready: false, failure: { code: 'provider_not_configured' } };
    }
    if (resolved.providerKey === 'mock') {
      return { ready: true, providerKey: 'mock' };
    }
    if (!resolved.secretPrimary || !resolved.secretSecondary) {
      return {
        ready: false,
        providerKey: resolved.providerKey,
        failure: { code: 'provider_not_configured' },
      };
    }
    return { ready: true, providerKey: resolved.providerKey };
  }

  /**
   * @param {import('express').Request} req
   * @param {{ pluginKey?: string }} options
   * @returns {Promise<{
   *   providerKey: string,
   *   secretPrimary: string|null,
   *   secretSecondary: string|null,
   *   options: object,
   *   source: 'plugin'|'global'|'legacy'|'none'
   * }|null>}
   */
  async resolve(req, { pluginKey } = {}) {
    const normalizedPluginKey = String(pluginKey ?? '')
      .trim()
      .toLowerCase();

    let routingDecision = null;

    if (normalizedPluginKey && isRoutablePluginKey(normalizedPluginKey)) {
      routingDecision = await this.settingsModel.getRoutingForScope(req, normalizedPluginKey);
    }

    if (!routingDecision) {
      routingDecision = await this.settingsModel.getRoutingForScope(req, GLOBAL_SCOPE);
    }

    if (routingDecision) {
      const source = routingDecision.scope === GLOBAL_SCOPE ? 'global' : 'plugin';
      return this._resolveWithCredentials(req, routingDecision.providerKey, source);
    }

    const legacyKey = await this.settingsModel.getPreferredEnabledSmsProviderKey(req);
    if (legacyKey) {
      return this._resolveWithCredentials(req, legacyKey, 'legacy');
    }

    return null;
  }

  async _resolveWithCredentials(req, providerKey, source) {
    const key = String(providerKey ?? '')
      .trim()
      .toLowerCase();
    if (!key || !isSmsNotificationCapable(key)) {
      return null;
    }
    const runtime = await this.settingsModel.resolveRuntimeConfig(req, key);
    if (!runtime) {
      return null;
    }
    return {
      providerKey: runtime.providerKey,
      secretPrimary: runtime.secretPrimary,
      secretSecondary: runtime.secretSecondary,
      options: runtime.options || {},
      source,
    };
  }
}

module.exports = { PulseProviderRouter, GLOBAL_SCOPE };
