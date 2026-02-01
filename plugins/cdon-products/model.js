// plugins/cdon-products/model.js
// Per-user CDON settings + channel map helpers. Uses @homebase/core SDK.

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class CdonProductsModel {
  static SETTINGS_TABLE = 'cdon_settings';
  static CHANNEL_MAP_TABLE = 'channel_product_map';
  static ERROR_LOG_TABLE = 'channel_error_log';

  async getSettings(req) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const res = await db.query(
        `SELECT * FROM ${CdonProductsModel.SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      return res.length ? this.transformSettingsRow(res[0]) : null;
    } catch (error) {
      Logger.error('Failed to get CDON settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get CDON settings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async upsertSettings(req, data) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const apiKey = String(data.apiKey || '').trim();
      const apiSecret = String(data.apiSecret || '').trim();
      const connected = Boolean(apiKey && apiSecret);

      const sql = `
        INSERT INTO ${CdonProductsModel.SETTINGS_TABLE} (
          user_id, api_key, api_secret, connected, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id) DO UPDATE SET
          api_key = EXCLUDED.api_key,
          api_secret = EXCLUDED.api_secret,
          connected = EXCLUDED.connected,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const res = await db.query(sql, [userId, apiKey || null, apiSecret || null, connected]);
      return this.transformSettingsRow(res[0]);
    } catch (error) {
      Logger.error('Failed to save CDON settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to save CDON settings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformSettingsRow(row) {
    return {
      id: String(row.id),
      apiKey: row.api_key || '',
      apiSecret: row.api_secret || '',
      connected: !!row.connected,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  async upsertChannelMap(req, { productId, channel, enabled, externalId, status, error }) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const sql = `
        INSERT INTO ${CdonProductsModel.CHANNEL_MAP_TABLE} (
          user_id, product_id, channel, enabled, external_id, last_synced_at, last_sync_status, last_error, created_at, updated_at
        ) VALUES (
          $1,       $2,         $3,      $4,      $5,          CURRENT_TIMESTAMP, $6,              $7,         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id, product_id, channel) DO UPDATE SET
          enabled = EXCLUDED.enabled,
          external_id = EXCLUDED.external_id,
          last_synced_at = CURRENT_TIMESTAMP,
          last_sync_status = EXCLUDED.last_sync_status,
          last_error = EXCLUDED.last_error,
          updated_at = CURRENT_TIMESTAMP
      `;
      await db.query(sql, [
        userId,
        String(productId),
        String(channel),
        !!enabled,
        externalId || null,
        status || 'idle',
        error || null,
      ]);
    } catch (err) {
      Logger.error('Failed to upsert channel map (CDON)', err);
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to upsert channel map', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async logChannelError(req, { channel, productId, payload, response, message }) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const sql = `
        INSERT INTO ${CdonProductsModel.ERROR_LOG_TABLE}
          (user_id, channel, product_id, payload, response, error_message, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `;
      await db.query(sql, [
        userId,
        String(channel),
        productId != null ? String(productId) : null,
        payload ? JSON.stringify(payload) : null,
        response ? JSON.stringify(response) : null,
        message || null,
      ]);
    } catch (e) {
      // Don't break primary flow
      Logger.warn('Failed to log channel error (CDON)', e);
    }
  }
}

module.exports = CdonProductsModel;

