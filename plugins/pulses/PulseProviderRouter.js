/**
 * Resolves which Pulse SMS provider/credentials to use for a plugin request.
 * Precedence: plugin must have sms_enabled → optional plugin provider override → global → legacy.
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
   * Returns null when Pulse SMS is not enabled for the plugin.
   * @returns {Promise<string|null>}
   */
  async _peekRoutedProviderKey(req, pluginKey) {
    const normalizedPluginKey = String(pluginKey ?? '')
      .trim()
      .toLowerCase();

    if (normalizedPluginKey && isRoutablePluginKey(normalizedPluginKey, req)) {
      const pluginRow = await this.settingsModel.getRoutingForScope(req, normalizedPluginKey);
      if (!pluginRow?.smsEnabled) {
        return null;
      }
      if (pluginRow.providerKey) {
        return String(pluginRow.providerKey).toLowerCase();
      }
    } else if (normalizedPluginKey) {
      return null;
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
    const normalizedPluginKey = String(pluginKey ?? '')
      .trim()
      .toLowerCase();
    if (normalizedPluginKey && isRoutablePluginKey(normalizedPluginKey, req)) {
      const pluginRow = await this.settingsModel.getRoutingForScope(req, normalizedPluginKey);
      if (!pluginRow?.smsEnabled) {
        return { ready: false, failure: { code: 'pulse_not_enabled_for_plugin' } };
      }
    }

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

    if (normalizedPluginKey && isRoutablePluginKey(normalizedPluginKey, req)) {
      const pluginRow = await this.settingsModel.getRoutingForScope(req, normalizedPluginKey);
      if (!pluginRow?.smsEnabled) {
        return null;
      }
      if (pluginRow.providerKey) {
        return this._resolveWithCredentials(req, pluginRow.providerKey, 'plugin');
      }
    } else if (normalizedPluginKey) {
      return null;
    }

    const globalRow = await this.settingsModel.getRoutingForScope(req, GLOBAL_SCOPE);
    if (globalRow?.providerKey) {
      return this._resolveWithCredentials(req, globalRow.providerKey, 'global');
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
