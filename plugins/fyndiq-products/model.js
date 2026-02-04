// plugins/fyndiq-products/model.js
// Skeleton connector model: per-user settings + channel map helpers.
//
// Uses @homebase/core SDK for database access with automatic tenant isolation

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class FyndiqProductsModel {
  static SETTINGS_TABLE = 'fyndiq_settings';
  static CHANNEL_MAP_TABLE = 'channel_product_map';
  static ERROR_LOG_TABLE = 'channel_error_log';

  async getSettings(req) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const res = await db.query(
        `SELECT * FROM ${FyndiqProductsModel.SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      return res.length ? this.transformSettingsRow(res[0]) : null;
    } catch (error) {
      Logger.error('Failed to get Fyndiq settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get Fyndiq settings', 500, AppError.CODES.DATABASE_ERROR);
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
        INSERT INTO ${FyndiqProductsModel.SETTINGS_TABLE} (
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
      Logger.error('Failed to save Fyndiq settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to save Fyndiq settings', 500, AppError.CODES.DATABASE_ERROR);
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
        INSERT INTO ${FyndiqProductsModel.CHANNEL_MAP_TABLE} (
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
      Logger.error('Failed to upsert channel map (Fyndiq)', err);
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to upsert channel map', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async logChannelError(req, { channel, productId, payload, response, message }) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      if (!FyndiqProductsModel._errorLogCols) {
        const cols = await db.query(
          `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = $1
          `,
          [FyndiqProductsModel.ERROR_LOG_TABLE],
        );
        FyndiqProductsModel._errorLogCols = new Set(cols.map((r) => String(r.column_name)));
      }

      const cols = FyndiqProductsModel._errorLogCols;
      const insertCols = ['user_id', 'channel'];
      const values = [userId, String(channel)];

      if (cols.has('product_id')) {
        insertCols.push('product_id');
        values.push(productId != null ? String(productId) : null);
      }
      if (cols.has('payload')) {
        insertCols.push('payload');
        values.push(payload ? JSON.stringify(payload) : null);
      }
      if (cols.has('response')) {
        insertCols.push('response');
        values.push(response ? JSON.stringify(response) : null);
      }
      if (cols.has('error_message')) {
        insertCols.push('error_message');
        values.push(message || null);
      }

      const placeholders = insertCols.map((_, i) => `$${i + 1}`);
      if (cols.has('created_at')) {
        insertCols.push('created_at');
        placeholders.push('CURRENT_TIMESTAMP');
      }

      const sql = `
        INSERT INTO ${FyndiqProductsModel.ERROR_LOG_TABLE} (${insertCols.join(', ')})
        VALUES (${placeholders.join(', ')})
      `;
      await db.query(sql, values);
    } catch (e) {
      Logger.warn('Failed to log channel error (Fyndiq)', e);
    }
  }
}

module.exports = FyndiqProductsModel;

