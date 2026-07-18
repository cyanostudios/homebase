// plugins/guides/sources/ContentSourceSettingsModel.js
const { Context, Database, Logger } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');
const {
  listContentSourceCatalog,
  getContentSourceCatalogEntry,
  DEFAULT_CONTENT_SOURCES,
} = require('./contentSourceCatalog');

const SETTINGS_TABLE = 'guide_content_source_settings';

class ContentSourceSettingsModel {
  _requireUserId(req) {
    const userId = Context.getTenantUserId(req);
    if (!userId) {
      throw new AppError('Unauthorized', 401, AppError.CODES.UNAUTHORIZED);
    }
    return userId;
  }

  _normalizeSourceKey(sourceKey) {
    const entry = getContentSourceCatalogEntry(sourceKey);
    if (!entry) {
      throw new AppError('Unknown content source', 400, AppError.CODES.VALIDATION_ERROR);
    }
    return entry.key;
  }

  /**
   * Catalog entries merged with tenant overrides (or enabledByDefault).
   * @returns {Promise<Array<{ key: string, label: string, attribution: string|null, enabledByDefault: boolean, enabled: boolean }>>}
   */
  async listEffective(req) {
    const userId = this._requireUserId(req);
    const catalog = listContentSourceCatalog();
    const overrides = await this._listOverrides(req, userId);
    const byKey = new Map(overrides.map((row) => [row.source_key, Boolean(row.enabled)]));

    return catalog.map((entry) => ({
      key: entry.key,
      label: entry.label,
      attribution: entry.attribution ?? null,
      enabledByDefault: Boolean(entry.enabledByDefault),
      enabled: byKey.has(entry.key) ? byKey.get(entry.key) : Boolean(entry.enabledByDefault),
    }));
  }

  /**
   * Keys that should be queried for the next research pack.
   * @returns {Promise<string[]>}
   */
  async getEnabledSourceKeys(req) {
    try {
      const effective = await this.listEffective(req);
      const keys = effective.filter((e) => e.enabled).map((e) => e.key);
      return keys.length ? keys : [...DEFAULT_CONTENT_SOURCES];
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 401) {
        throw error;
      }
      Logger.warn('Falling back to default content sources', {
        message: error instanceof Error ? error.message : String(error),
      });
      return [...DEFAULT_CONTENT_SOURCES];
    }
  }

  /**
   * @param {boolean} enabled
   */
  async setEnabled(req, sourceKey, enabled) {
    const userId = this._requireUserId(req);
    const normalized = this._normalizeSourceKey(sourceKey);
    const db = Database.get(req);

    try {
      const rows = await db.query(
        `
          INSERT INTO ${SETTINGS_TABLE} (user_id, source_key, enabled, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (user_id, source_key)
          DO UPDATE SET
            enabled = EXCLUDED.enabled,
            updated_at = NOW()
          RETURNING id, user_id, source_key, enabled, created_at, updated_at
        `,
        [userId, normalized, Boolean(enabled)],
      );

      const catalog = getContentSourceCatalogEntry(normalized);
      return {
        key: normalized,
        label: catalog.label,
        attribution: catalog.attribution ?? null,
        enabledByDefault: Boolean(catalog.enabledByDefault),
        enabled: Boolean(rows[0].enabled),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to save content source setting', error, { sourceKey: normalized });
      throw new AppError(
        'Failed to save content source setting',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async _listOverrides(req, userId) {
    try {
      const db = Database.get(req);
      return await db.query(
        `
          SELECT source_key, enabled
          FROM ${SETTINGS_TABLE}
          WHERE user_id = $1
        `,
        [userId],
      );
    } catch (error) {
      Logger.error('Failed to list content source settings', error, { userId });
      throw new AppError(
        'Failed to list content source settings',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }
}

module.exports = ContentSourceSettingsModel;
