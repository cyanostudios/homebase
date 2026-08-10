const { Context, Database, Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const {
  PROVIDER_CATALOG,
  SUPPORTED_PROVIDERS,
  getProviderCatalogEntry,
  isEmailCapable,
  listCatalogForApi,
} = require('./providerCatalog');
const { ROUTABLE_PLUGINS, normalizeRoutablePluginKey } = require('./routablePlugins');

const SETTINGS_TABLE = 'mail_provider_settings';
const ROUTING_TABLE = 'mail_provider_routing';
const GLOBAL_ROUTING_SCOPE = '*';
const MASKED_SECRET = '••••••••';

function normalizeProviderKey(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(normalized)) {
    throw new AppError('Unsupported Mail provider', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return normalized;
}

function parseOptions(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return { ...value };
}

function normalizeSecret(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 5000) : null;
}

function normalizeOptionValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 500) : null;
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

/** Option keys allowed for a catalog entry (storage === 'option'). */
function catalogOptionKeys(catalogEntry) {
  return new Set(
    (catalogEntry?.fields || []).filter((field) => field.storage === 'option').map((f) => f.key),
  );
}

/** Drop unknown option keys so API never echoes non-catalog secrets. */
function filterOptionsToCatalog(providerKey, rawOptions) {
  const entry = getProviderCatalogEntry(providerKey);
  const allowed = catalogOptionKeys(entry);
  const parsed = parseOptions(rawOptions);
  const out = {};
  for (const key of allowed) {
    if (parsed[key] != null && String(parsed[key]).trim()) {
      out[key] = String(parsed[key]).trim();
    }
  }
  return out;
}

function applyFieldPayload(catalogEntry, existing, data) {
  let secretPrimary = existing?.secret_primary ?? null;
  let secretSecondary = existing?.secret_secondary ?? null;
  const allowedOptionKeys = catalogOptionKeys(catalogEntry);
  // Start from existing options but only keep catalog-whitelisted keys.
  const options = filterOptionsToCatalog(catalogEntry?.key, existing?.options);

  const fields = data.fields && typeof data.fields === 'object' ? data.fields : {};

  for (const field of catalogEntry.fields || []) {
    const incoming = fields[field.key] !== undefined ? fields[field.key] : data[field.key];
    if (incoming === undefined) {
      continue;
    }
    if (field.storage === 'secret_primary') {
      const normalized = normalizeSecret(incoming);
      if (normalized === null) {
        secretPrimary = null;
      } else if (normalized && !String(normalized).startsWith(MASKED_SECRET)) {
        secretPrimary = normalized;
      }
    } else if (field.storage === 'secret_secondary') {
      const normalized = normalizeSecret(incoming);
      if (normalized === null) {
        secretSecondary = null;
      } else if (normalized && !String(normalized).startsWith(MASKED_SECRET)) {
        secretSecondary = normalized;
      }
    } else if (field.storage === 'option') {
      const normalized = normalizeOptionValue(incoming);
      if (normalized) {
        options[field.key] = normalized;
      } else {
        delete options[field.key];
      }
    }
  }

  if (data.secretPrimary !== undefined) {
    const normalized = normalizeSecret(data.secretPrimary);
    if (normalized === null) secretPrimary = null;
    else if (normalized && !String(normalized).startsWith(MASKED_SECRET)) {
      secretPrimary = normalized;
    }
  }
  if (data.secretSecondary !== undefined) {
    const normalized = normalizeSecret(data.secretSecondary);
    if (normalized === null) secretSecondary = null;
    else if (normalized && !String(normalized).startsWith(MASKED_SECRET)) {
      secretSecondary = normalized;
    }
  }
  // Only catalog option keys are writable — prevents secret exfil via options JSONB.
  if (data.options && typeof data.options === 'object') {
    for (const [key, value] of Object.entries(data.options)) {
      if (!allowedOptionKeys.has(key)) {
        continue;
      }
      const normalized = normalizeOptionValue(value);
      if (normalized) options[key] = normalized;
      else delete options[key];
    }
  }

  return { secretPrimary, secretSecondary, options };
}

function isProviderConfigured(providerKey, rowLike) {
  const entry = getProviderCatalogEntry(providerKey);
  if (!entry) return false;
  const options = parseOptions(rowLike?.options);
  for (const field of entry.fields || []) {
    if (!field.required) continue;
    if (field.storage === 'secret_primary' && !rowLike?.secretPrimary && !rowLike?.secret_primary) {
      return false;
    }
    if (
      field.storage === 'secret_secondary' &&
      !rowLike?.secretSecondary &&
      !rowLike?.secret_secondary
    ) {
      return false;
    }
    if (field.storage === 'option' && !String(options[field.key] || '').trim()) {
      return false;
    }
  }
  return true;
}

class MailProviderSettingsModel {
  _requireUserId(req) {
    const userId = Context.getTenantUserId(req);
    if (!userId) {
      throw new AppError('Unauthorized', 401, AppError.CODES.UNAUTHORIZED);
    }
    return userId;
  }

  _transformRow(row, { includeSecret = false } = {}) {
    if (!row) return null;
    const options = filterOptionsToCatalog(row.provider_key, row.options);
    const hasSecretPrimary = !!row.secret_primary;
    const hasSecretSecondary = !!row.secret_secondary;
    const out = {
      id: String(row.id),
      userId: String(row.user_id),
      providerKey: row.provider_key,
      enabled: Boolean(row.enabled),
      secretPrimary: hasSecretPrimary ? MASKED_SECRET : '',
      secretSecondary: hasSecretSecondary ? MASKED_SECRET : '',
      hasSecretPrimary,
      hasSecretSecondary,
      options,
      configured: isProviderConfigured(row.provider_key, {
        secret_primary: row.secret_primary,
        secret_secondary: row.secret_secondary,
        options,
      }),
      emailCapable: isEmailCapable(row.provider_key),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    if (includeSecret) {
      out.secretPrimaryRaw = row.secret_primary || null;
      out.secretSecondaryRaw = row.secret_secondary || null;
    }
    return out;
  }

  listCatalog() {
    return listCatalogForApi();
  }

  async getSettings(req, providerKey, options = {}) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const normalizedProvider = normalizeProviderKey(providerKey);
      const rows = await db.query(
        `
          SELECT id, user_id, provider_key, enabled, secret_primary, secret_secondary, options,
                 created_at, updated_at
          FROM ${SETTINGS_TABLE}
          WHERE user_id = $1 AND provider_key = $2
          LIMIT 1
        `,
        [userId, normalizedProvider],
      );
      const row = rows[0];
      if (!row) {
        return {
          id: null,
          userId: String(userId),
          providerKey: normalizedProvider,
          enabled: false,
          secretPrimary: '',
          secretSecondary: '',
          hasSecretPrimary: false,
          hasSecretSecondary: false,
          options: {},
          configured: false,
          emailCapable: isEmailCapable(normalizedProvider),
          createdAt: null,
          updatedAt: null,
        };
      }
      return this._transformRow(row, options);
    } catch (error) {
      Logger.error('Failed to fetch Mail provider settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to fetch Mail provider settings',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async listConfiguredSettings(req) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const rows = await db.query(
        `
          SELECT id, user_id, provider_key, enabled, secret_primary, secret_secondary, options,
                 created_at, updated_at
          FROM ${SETTINGS_TABLE}
          WHERE user_id = $1
          ORDER BY provider_key ASC
        `,
        [userId],
      );
      return rows.map((row) => this._transformRow(row));
    } catch (error) {
      Logger.error('Failed to list Mail provider settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to list Mail provider settings',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async deleteSettings(req, providerKey) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const normalizedProvider = normalizeProviderKey(providerKey);
      // Clear routing assignments that would orphan email send after credential delete.
      await db.query(`DELETE FROM ${ROUTING_TABLE} WHERE user_id = $1 AND provider_key = $2`, [
        userId,
        normalizedProvider,
      ]);
      await db.query(`DELETE FROM ${SETTINGS_TABLE} WHERE user_id = $1 AND provider_key = $2`, [
        userId,
        normalizedProvider,
      ]);
      return { providerKey: normalizedProvider, deleted: true };
    } catch (error) {
      Logger.error('Failed to delete Mail provider settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to delete Mail provider settings',
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
      const catalogEntry = getProviderCatalogEntry(normalizedProvider);
      const rows = await db.query(
        `
          SELECT id, secret_primary, secret_secondary, options, enabled
          FROM ${SETTINGS_TABLE}
          WHERE user_id = $1 AND provider_key = $2
          LIMIT 1
        `,
        [userId, normalizedProvider],
      );
      const existing = rows[0] ?? null;
      const enabled =
        data.enabled !== undefined ? Boolean(data.enabled) : Boolean(existing?.enabled ?? false);
      const applied = applyFieldPayload(catalogEntry, existing, data || {});

      const savedRows = await db.query(
        `
          INSERT INTO ${SETTINGS_TABLE} (
            user_id, provider_key, enabled, secret_primary, secret_secondary, options,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (user_id, provider_key) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            secret_primary = EXCLUDED.secret_primary,
            secret_secondary = EXCLUDED.secret_secondary,
            options = EXCLUDED.options,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, user_id, provider_key, enabled, secret_primary, secret_secondary, options,
                    created_at, updated_at
        `,
        [
          userId,
          normalizedProvider,
          enabled,
          applied.secretPrimary,
          applied.secretSecondary,
          JSON.stringify(applied.options),
        ],
      );
      return this._transformRow(savedRows[0]);
    } catch (error) {
      Logger.error('Failed to save Mail provider settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to save Mail provider settings',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async getResolvedProviderConfig(req, providerKey) {
    const settings = await this.getSettings(req, providerKey, { includeSecret: true });
    if (!settings?.enabled) {
      return null;
    }
    if (
      !isProviderConfigured(providerKey, {
        secret_primary: settings.secretPrimaryRaw,
        secret_secondary: settings.secretSecondaryRaw,
        options: settings.options,
      })
    ) {
      return null;
    }
    return {
      providerKey: settings.providerKey,
      enabled: true,
      secretPrimary: settings.secretPrimaryRaw,
      secretSecondary: settings.secretSecondaryRaw,
      options: filterOptionsToCatalog(settings.providerKey, settings.options || {}),
    };
  }

  async resolveRuntimeConfig(req, providerKey) {
    const normalized = normalizeProviderKey(providerKey);
    return this.getResolvedProviderConfig(req, normalized);
  }

  async getPreferredEnabledEmailProviderKey(req) {
    for (const key of Object.keys(PROVIDER_CATALOG)) {
      if (!isEmailCapable(key)) continue;
      const resolved = await this.getResolvedProviderConfig(req, key);
      if (resolved) {
        return key;
      }
    }
    return null;
  }

  _transformRoutingRow(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      scope: row.scope,
      providerKey: row.provider_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async _assertRoutingProviderAvailable(req, providerKey) {
    const normalized = normalizeProviderKey(providerKey);
    if (!isEmailCapable(normalized)) {
      throw new AppError('Selected provider cannot send email', 400, 'provider_not_email_capable');
    }
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
          SELECT id, user_id, scope, provider_key, created_at, updated_at
          FROM ${ROUTING_TABLE}
          WHERE user_id = $1 AND scope = $2
          LIMIT 1
        `,
        [userId, normalizedScope],
      );
      return this._transformRoutingRow(rows[0]);
    } catch (error) {
      Logger.error('Failed to fetch Mail provider routing', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to fetch Mail provider routing',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async listRouting(req) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const rows = await db.query(
        `
          SELECT id, user_id, scope, provider_key, created_at, updated_at
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
        };
      });

      return {
        global: globalRow ? { providerKey: globalRow.providerKey } : null,
        plugins: pluginAssignments,
        routablePlugins: ROUTABLE_PLUGINS.map((entry) => ({ ...entry })),
      };
    } catch (error) {
      Logger.error('Failed to list Mail provider routing', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to list Mail provider routing',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async saveRouting(req, scope, data) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const normalizedScope = normalizeRoutingScope(scope);
      const normalizedProvider = await this._assertRoutingProviderAvailable(req, data.providerKey);

      const savedRows = await db.query(
        `
          INSERT INTO ${ROUTING_TABLE} (
            user_id, scope, provider_key, created_at, updated_at
          ) VALUES (
            $1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (user_id, scope) DO UPDATE SET
            provider_key = EXCLUDED.provider_key,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, user_id, scope, provider_key, created_at, updated_at
        `,
        [userId, normalizedScope, normalizedProvider],
      );

      const saved = this._transformRoutingRow(savedRows[0]);
      if (normalizedScope === GLOBAL_ROUTING_SCOPE) {
        return { global: { providerKey: saved.providerKey } };
      }
      return {
        plugin: {
          pluginKey: saved.scope,
          providerKey: saved.providerKey,
        },
      };
    } catch (error) {
      Logger.error('Failed to save Mail provider routing', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to save Mail provider routing',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async deletePluginRouting(req, pluginKey) {
    try {
      const db = Database.get(req);
      const userId = this._requireUserId(req);
      const normalizedPlugin = normalizeRoutablePluginKey(pluginKey);
      await db.query(`DELETE FROM ${ROUTING_TABLE} WHERE user_id = $1 AND scope = $2`, [
        userId,
        normalizedPlugin,
      ]);
      return { pluginKey: normalizedPlugin, deleted: true };
    } catch (error) {
      Logger.error('Failed to delete Mail provider routing override', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to delete Mail provider routing override',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }
}

const providerModel = new MailProviderSettingsModel();

module.exports = providerModel;
module.exports.MailProviderSettingsModel = MailProviderSettingsModel;
module.exports.MASKED_SECRET = MASKED_SECRET;
module.exports.GLOBAL_ROUTING_SCOPE = GLOBAL_ROUTING_SCOPE;
module.exports.normalizeProviderKey = normalizeProviderKey;
