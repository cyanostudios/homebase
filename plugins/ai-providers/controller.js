const { Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const {
  MASKED_SECRET,
  normalizeProviderKey,
  getProviderDefaultModel,
  GLOBAL_ROUTING_SCOPE,
} = require('./model');
const { normalizeRoutablePluginKey } = require('./routablePlugins');
const defaultConnectionTestRegistry = require('./ConnectionTestRegistry');

class AIProvidersController {
  /**
   * @param {import('./model').AIProviderSettingsModel} model
   * @param {{ connectionTestRegistry?: typeof defaultConnectionTestRegistry }} [options]
   */
  constructor(model, options = {}) {
    this.model = model;
    this.connectionTestRegistry = options.connectionTestRegistry ?? defaultConnectionTestRegistry;
  }

  async getSettings(req, res) {
    try {
      const settings = await this.model.listConfiguredSettings(req);
      res.json({ providers: settings });
    } catch (error) {
      Logger.error('Get AI provider settings failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch AI provider settings' });
    }
  }

  async getCatalog(req, res) {
    try {
      const providers = this.model.listCatalog();
      res.json({ providers });
    } catch (error) {
      Logger.error('Get AI provider catalog failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch AI provider catalog' });
    }
  }

  async getRouting(req, res) {
    try {
      const routing = await this.model.listRouting(req);
      res.json(routing);
    } catch (error) {
      Logger.error('Get AI provider routing failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch AI provider routing' });
    }
  }

  async saveGlobalRouting(req, res) {
    try {
      const result = await this.model.saveRouting(req, GLOBAL_ROUTING_SCOPE, req.body || {});
      res.json(result);
    } catch (error) {
      Logger.error('Save global AI provider routing failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to save global AI provider routing' });
    }
  }

  async savePluginRouting(req, res) {
    try {
      const pluginKey = normalizeRoutablePluginKey(req.params.pluginKey);
      const result = await this.model.saveRouting(req, pluginKey, req.body || {});
      res.json(result);
    } catch (error) {
      Logger.error('Save plugin AI provider routing failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to save plugin AI provider routing' });
    }
  }

  async deletePluginRouting(req, res) {
    try {
      const pluginKey = normalizeRoutablePluginKey(req.params.pluginKey);
      const result = await this.model.deletePluginRouting(req, pluginKey);
      res.json(result);
    } catch (error) {
      Logger.error('Delete plugin AI provider routing failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to delete plugin AI provider routing' });
    }
  }

  async deleteSettings(req, res) {
    try {
      const providerKey = normalizeProviderKey(req.params.providerKey);
      const result = await this.model.deleteSettings(req, providerKey);
      res.json(result);
    } catch (error) {
      Logger.error('Delete AI provider settings failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to delete AI provider settings' });
    }
  }

  async saveSettings(req, res) {
    try {
      const providerKey = normalizeProviderKey(req.params.providerKey);
      const settings = await this.model.saveSettings(req, providerKey, req.body || {});
      res.json({ provider: settings });
    } catch (error) {
      Logger.error('Save AI provider settings failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to save AI provider settings' });
    }
  }

  async testSettings(req, res) {
    try {
      const providerKey = normalizeProviderKey(req.params.providerKey);

      const useSaved = Boolean(req.body?.useSaved);
      const saved =
        useSaved || String(req.body?.apiKey ?? '').startsWith(MASKED_SECRET)
          ? await this.model.getSettings(req, providerKey, { includeSecret: true })
          : null;

      const apiKeyInput =
        req.body?.apiKey != null && !String(req.body.apiKey).startsWith(MASKED_SECRET)
          ? String(req.body.apiKey).trim()
          : '';
      const apiKey = apiKeyInput || saved?.apiKeyRaw || '';
      const model =
        String(req.body?.defaultModel || saved?.defaultModel || '').trim() ||
        getProviderDefaultModel(providerKey) ||
        undefined;

      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required to test connection' });
      }

      if (!this.connectionTestRegistry.has(providerKey)) {
        return res.status(400).json({ error: 'Connection test not available for this provider' });
      }

      const provider = this.connectionTestRegistry.create(providerKey, {
        apiKey,
        model,
      });

      if (typeof provider?.testConnection !== 'function') {
        return res.status(400).json({ error: 'Connection test not available for this provider' });
      }

      const result = await provider.testConnection();

      res.json({
        ok: true,
        provider: providerKey,
        model: result.model,
      });
    } catch (error) {
      Logger.error('Test AI provider settings failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to test AI provider settings',
      });
    }
  }
}

module.exports = AIProvidersController;
