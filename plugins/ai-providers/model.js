const { Context, Database, Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const {
  PROVIDER_CATALOG,
  SUPPORTED_PROVIDERS,
  getProviderCatalogEntry,
  getProviderDefaultModel,
} = require('./providerCatalog');
const { ROUTABLE_PLUGINS, normalizeRoutablePluginKey } = require('./routablePlugins');

const SETTINGS_TABLE = 'ai_provider_settings';
const ROUTING_TABLE = 'ai_provider_routing';
const GLOBAL_ROUTING_SCOPE = '*';
const MASKED_SECRET = '••••••••';

function normalizeProviderKey(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(normalized)) {
    throw new AppError('Unsupported AI provider', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return normalized;
}

function normalizeModel(value, providerKey) {
  const fallback = getProviderDefaultModel(providerKey) || '';
  const trimmed = String(value ?? fallback).trim();
  return trimmed ? trimmed.slice(0, 255) : fallback;
}

function normalizeRoutingModel(value, providerKey) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 255);
}

function normalizeRoutingScope(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new AppError('Routing scope is required', 400, AppError.CODES.VALIDATION_ERROR);
  }
  if (normalized === GLOBAL_ROUTING_SCOPE) {
    return normalized;
  }
  return normalizeRoutablePluginKey(normalized);
}

function normalizeApiKey(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 5000) : null;
}

class AIProviderSettingsModel {
  _requireUserId(req) {
    const userId = Context.getTenantUserId(req);
    if (!userId) {
      throw new AppError('Unauthorized', 401, AppError.CODES.UNAUTHORIZED);
    }
    return userId;
  }

  _transformRow(row, { includeSecret = false } = {}) {
    if (!row) {
      return null;
    }
    const hasApiKey = !!row.api_key;
    const catalogDefault = getProviderDefaultModel(row.provider_key);
    const out = {
      id: String(row.id),
      userId: String(row.user_id),
      providerKey: row.provider_key,
      enabled: Boolean(row.enabled),
      defaultModel: row.default_model || catalogDefault,
      apiKey: hasApiKey ? MASKED_SECRET : '',
      hasApiKey,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    if (includeSecret && row.api_key) {
      out.apiKeyRaw = row.api_key;
    }
    return out;
  }

  _buildDefault(providerKey) {
    return {
      id: null,
      userId: null,
      providerKey,
      enabled: false,
      defaultModel: getProviderDefaultModel(providerKey),
      apiKey: '',
      hasApiKey: false,
      createdAt: null,
      updatedAt: null,
    };
  }

  async getSettings(req, providerKey, options = {}) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const normalizedProvider = normalizeProviderKey(providerKey);
      const rows = await db.query(
        `
          SELECT id, user_id, provider_key, enabled, api_key, default_model, created_at, updated_at
          FROM ${SETTINGS_TABLE}
          WHERE user_id = $1 AND provider_key = $2
          LIMIT 1
        `,
        [userId, normalizedProvider],
      );
      const row = rows[0];
      return row
        ? this._transformRow(row, options)
        : {
            ...this._buildDefault(normalizedProvider),
            userId: String(userId),
          };
    } catch (error) {
      Logger.error('Failed to fetch AI provider settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to fetch AI provider settings',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async listSettings(req) {
    const settings = await Promise.all(
      Array.from(SUPPORTED_PROVIDERS).map((key) => this.getSettings(req, key)),
    );
    return settings;
  }

  /** Configured providers only (rows persisted in tenant DB). */
  async listConfiguredSettings(req) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const rows = await db.query(
        `
          SELECT id, user_id, provider_key, enabled, api_key, default_model, created_at, updated_at
          FROM ${SETTINGS_TABLE}
          WHERE user_id = $1
          ORDER BY provider_key ASC
        `,
        [userId],
      );
      return rows.map((row) => this._transformRow(row));
    } catch (error) {
      Logger.error('Failed to list configured AI provider settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to list configured AI provider settings',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  listCatalog() {
    return Object.values(PROVIDER_CATALOG).map((entry) => ({
      providerKey: entry.key,
      defaultModel: entry.defaultModel,
      textGenerationCapable: entry.textGenerationCapable === true,
      models: (entry.models || []).map((model) => ({
        id: model.id,
        label: model.label || model.id,
      })),
    }));
  }

  async deleteSettings(req, providerKey) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const normalizedProvider = normalizeProviderKey(providerKey);
      await db.query(
        `
          DELETE FROM ${SETTINGS_TABLE}
          WHERE user_id = $1 AND provider_key = $2
        `,
        [userId, normalizedProvider],
      );
      return { providerKey: normalizedProvider, deleted: true };
    } catch (error) {
      Logger.error('Failed to delete AI provider settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to delete AI provider settings',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async saveSettings(req, providerKey, data) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const normalizedProvider = normalizeProviderKey(providerKey);
      const catalogDefault = getProviderDefaultModel(normalizedProvider);
      const apiKeyInput = normalizeApiKey(data.apiKey);
      const rows = await db.query(
        `
          SELECT id, api_key, enabled, default_model
          FROM ${SETTINGS_TABLE}
          WHERE user_id = $1 AND provider_key = $2
          LIMIT 1
        `,
        [userId, normalizedProvider],
      );
      const existing = rows[0] ?? null;

      const enabled =
        data.enabled !== undefined ? Boolean(data.enabled) : Boolean(existing?.enabled ?? false);
      const defaultModel =
        data.defaultModel !== undefined
          ? normalizeModel(data.defaultModel, normalizedProvider)
          : existing?.default_model || catalogDefault;

      let apiKey = existing?.api_key ?? null;
      if (apiKeyInput === null) {
        apiKey = null;
      } else if (
        apiKeyInput !== undefined &&
        apiKeyInput !== '' &&
        !String(apiKeyInput).startsWith(MASKED_SECRET)
      ) {
        apiKey = apiKeyInput;
      }

      const savedRows = await db.query(
        `
          INSERT INTO ${SETTINGS_TABLE} (
            user_id, provider_key, enabled, api_key, default_model, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (user_id, provider_key) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            api_key = EXCLUDED.api_key,
            default_model = EXCLUDED.default_model,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, user_id, provider_key, enabled, api_key, default_model, created_at, updated_at
        `,
        [userId, normalizedProvider, enabled, apiKey, defaultModel],
      );
      return this._transformRow(savedRows[0]);
    } catch (error) {
      Logger.error('Failed to save AI provider settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to save AI provider settings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * DB-only resolution: enabled row with stored API key.
   * @returns {Promise<{ providerKey: string, enabled: boolean, apiKey: string, defaultModel: string }|null>}
   */
  async getResolvedProviderConfig(req, providerKey) {
    const settings = await this.getSettings(req, providerKey, { includeSecret: true });
    const catalogDefault = getProviderDefaultModel(providerKey);
    if (!settings?.enabled || !settings.apiKeyRaw) {
      return null;
    }
    return {
      providerKey: settings.providerKey,
      enabled: settings.enabled,
      apiKey: settings.apiKeyRaw,
      defaultModel: settings.defaultModel || catalogDefault,
    };
  }

  /**
   * Runtime config: DB (enabled + key) first, then env via PROVIDER_CATALOG metadata.
   * @returns {Promise<{ providerKey: string, apiKey: string, defaultModel: string }|null>}
   */
  async resolveRuntimeConfig(req, providerKey) {
    const normalized = normalizeProviderKey(providerKey);
    const fromDb = await this.getResolvedProviderConfig(req, normalized);
    if (fromDb) {
      return {
        providerKey: fromDb.providerKey,
        apiKey: fromDb.apiKey,
        defaultModel: fromDb.defaultModel,
      };
    }

    const entry = getProviderCatalogEntry(normalized);
    if (!entry) {
      return null;
    }

    return {
      providerKey: normalized,
      apiKey: process.env[entry.envApiKey] ?? '',
      defaultModel: process.env[entry.envModel] || entry.defaultModel,
    };
  }

  /**
   * First catalog provider with an enabled DB config (credentials present).
   * @returns {Promise<string|null>}
   */
  async getPreferredEnabledProviderKey(req) {
    for (const key of Object.keys(PROVIDER_CATALOG)) {
      const resolved = await this.getResolvedProviderConfig(req, key);
      if (resolved) {
        return key;
      }
    }
    return null;
  }

  _transformRoutingRow(row) {
    if (!row) {
      return null;
    }
    return {
      id: String(row.id),
      userId: String(row.user_id),
      scope: row.scope,
      providerKey: row.provider_key,
      model: row.model || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async _assertRoutingProviderAvailable(req, providerKey) {
    const normalized = normalizeProviderKey(providerKey);
    const resolved = await this.getResolvedProviderConfig(req, normalized);
    if (!resolved) {
      throw new AppError(
        'Selected provider is not configured and enabled',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    return normalized;
  }

  async getRoutingForScope(req, scope) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const normalizedScope = normalizeRoutingScope(scope);
      const rows = await db.query(
        `
          SELECT id, user_id, scope, provider_key, model, created_at, updated_at
          FROM ${ROUTING_TABLE}
          WHERE user_id = $1 AND scope = $2
          LIMIT 1
        `,
        [userId, normalizedScope],
      );
      return this._transformRoutingRow(rows[0]);
    } catch (error) {
      Logger.error('Failed to fetch AI provider routing', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch AI provider routing', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async listRouting(req) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const rows = await db.query(
        `
          SELECT id, user_id, scope, provider_key, model, created_at, updated_at
          FROM ${ROUTING_TABLE}
          WHERE user_id = $1
          ORDER BY scope ASC
        `,
        [userId],
      );
      const byScope = new Map(
        rows.map((row) => {
          const transformed = this._transformRoutingRow(row);
          return [transformed.scope, transformed];
        }),
      );

      const globalRow = byScope.get(GLOBAL_ROUTING_SCOPE) ?? null;
      const pluginAssignments = ROUTABLE_PLUGINS.map((plugin) => {
        const row = byScope.get(plugin.key);
        return {
          pluginKey: plugin.key,
          label: plugin.label,
          providerKey: row?.providerKey ?? null,
          model: row?.model ?? null,
        };
      });

      return {
        global: globalRow ? { providerKey: globalRow.providerKey, model: globalRow.model } : null,
        plugins: pluginAssignments,
        routablePlugins: ROUTABLE_PLUGINS.map((entry) => ({ ...entry })),
      };
    } catch (error) {
      Logger.error('Failed to list AI provider routing', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to list AI provider routing', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async saveRouting(req, scope, data) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const normalizedScope = normalizeRoutingScope(scope);
      const normalizedProvider = await this._assertRoutingProviderAvailable(req, data.providerKey);
      const model = normalizeRoutingModel(data.model, normalizedProvider);

      const savedRows = await db.query(
        `
          INSERT INTO ${ROUTING_TABLE} (
            user_id, scope, provider_key, model, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (user_id, scope) DO UPDATE SET
            provider_key = EXCLUDED.provider_key,
            model = EXCLUDED.model,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, user_id, scope, provider_key, model, created_at, updated_at
        `,
        [userId, normalizedScope, normalizedProvider, model],
      );

      const saved = this._transformRoutingRow(savedRows[0]);
      if (normalizedScope === GLOBAL_ROUTING_SCOPE) {
        return { global: { providerKey: saved.providerKey, model: saved.model } };
      }
      return {
        plugin: {
          pluginKey: saved.scope,
          providerKey: saved.providerKey,
          model: saved.model,
        },
      };
    } catch (error) {
      Logger.error('Failed to save AI provider routing', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to save AI provider routing', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deletePluginRouting(req, pluginKey) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const normalizedPlugin = normalizeRoutablePluginKey(pluginKey);
      await db.query(
        `
          DELETE FROM ${ROUTING_TABLE}
          WHERE user_id = $1 AND scope = $2
        `,
        [userId, normalizedPlugin],
      );
      return { pluginKey: normalizedPlugin, deleted: true };
    } catch (error) {
      Logger.error('Failed to delete AI provider routing override', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to delete AI provider routing override',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }
}

module.exports = {
  AIProviderSettingsModel,
  MASKED_SECRET,
  PROVIDER_CATALOG,
  SUPPORTED_PROVIDERS,
  GLOBAL_ROUTING_SCOPE,
  normalizeProviderKey,
  getProviderDefaultModel,
};
