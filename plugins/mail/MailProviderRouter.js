/**
 * Resolves which Mail email provider/credentials to use for a plugin request.
 * Precedence: plugin override → global default → legacy first enabled email → none.
 */
const { isRoutablePluginKey } = require('./routablePlugins');
const { isEmailCapable } = require('./providerCatalog');

const GLOBAL_SCOPE = '*';

class MailProviderRouter {
  constructor(options = {}) {
    this.settingsModel = options.settingsModel ?? require('./providerModel');
  }

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

  async checkReadiness(req, { pluginKey } = {}) {
    const routedKey = await this._peekRoutedProviderKey(req, pluginKey);
    if (routedKey && !isEmailCapable(routedKey)) {
      return {
        ready: false,
        providerKey: routedKey,
        failure: { code: 'provider_not_email_capable' },
      };
    }

    const resolved = await this.resolve(req, { pluginKey });
    if (!resolved?.providerKey) {
      return { ready: false, failure: { code: 'provider_not_configured' } };
    }
    if (resolved.providerKey === 'resend' && !resolved.secretPrimary) {
      return {
        ready: false,
        providerKey: resolved.providerKey,
        failure: { code: 'provider_not_configured' },
      };
    }
    if (resolved.providerKey === 'smtp' && !resolved.options?.host) {
      return {
        ready: false,
        providerKey: resolved.providerKey,
        failure: { code: 'provider_not_configured' },
      };
    }
    return { ready: true, providerKey: resolved.providerKey };
  }

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

    const legacyKey = await this.settingsModel.getPreferredEnabledEmailProviderKey(req);
    if (legacyKey) {
      return this._resolveWithCredentials(req, legacyKey, 'legacy');
    }

    return null;
  }

  async _resolveWithCredentials(req, providerKey, source) {
    const key = String(providerKey ?? '')
      .trim()
      .toLowerCase();
    if (!key || !isEmailCapable(key)) {
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

module.exports = { MailProviderRouter, GLOBAL_SCOPE };
