// plugins/fyndiq-products/model.js
// Skeleton connector model: tenant-scoped settings + channel map helpers.
//
// Uses @homebase/core SDK for database access with automatic tenant isolation

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const CredentialsCrypto = require('../../server/core/services/security/CredentialsCrypto');

class FyndiqProductsModel {
  static SETTINGS_TABLE = 'fyndiq_settings';
  static CHANNEL_MAP_TABLE = 'channel_product_map';
  static ERROR_LOG_TABLE = 'channel_error_log';

  async getSettings(req) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const res = await db.query(`SELECT * FROM ${FyndiqProductsModel.SETTINGS_TABLE} LIMIT 1`, []);
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
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const apiKey = String(data.apiKey || '').trim();
      const apiSecret = String(data.apiSecret || '').trim();
      const connected = Boolean(apiKey && apiSecret);

      const existing = await db.query(
        `SELECT id FROM ${FyndiqProductsModel.SETTINGS_TABLE} ORDER BY id ASC LIMIT 1`,
        [],
      );
      const values = [
        apiKey ? CredentialsCrypto.encrypt(apiKey) : null,
        apiSecret ? CredentialsCrypto.encrypt(apiSecret) : null,
        connected,
      ];
      const res = existing.length
        ? await db.query(
            `UPDATE ${FyndiqProductsModel.SETTINGS_TABLE}
             SET api_key = $1, api_secret = $2, connected = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [...values, existing[0].id],
          )
        : await db.query(
            `INSERT INTO ${FyndiqProductsModel.SETTINGS_TABLE} (
               api_key, api_secret, connected, created_at, updated_at
             ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING *`,
            values,
          );
      return this.transformSettingsRow(res[0]);
    } catch (error) {
      Logger.error('Failed to save Fyndiq settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to save Fyndiq settings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformSettingsRow(row) {
    const apiKey = row.api_key ? CredentialsCrypto.decrypt(row.api_key) : '';
    const apiSecret = row.api_secret ? CredentialsCrypto.decrypt(row.api_secret) : '';
    return {
      id: String(row.id),
      apiKey: apiKey || '',
      apiSecret: apiSecret || '',
      connected: !!row.connected,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  async upsertChannelMap(req, { productId, channel, enabled, externalId, status, error }) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const sql = `
        INSERT INTO ${FyndiqProductsModel.CHANNEL_MAP_TABLE} (
          product_id, channel, channel_instance_id, enabled, external_id, last_synced_at, last_sync_status, last_error, created_at, updated_at
        ) VALUES (
          $1,       $2,         NULL,    $3,                 $4,      CURRENT_TIMESTAMP, $5,              $6,         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (product_id, channel, channel_instance_id) DO UPDATE SET
          enabled = EXCLUDED.enabled,
          external_id = EXCLUDED.external_id,
          last_synced_at = CURRENT_TIMESTAMP,
          last_sync_status = EXCLUDED.last_sync_status,
          last_error = EXCLUDED.last_error,
          updated_at = CURRENT_TIMESTAMP
      `;
      await db.query(sql, [
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
      const pool = db.getPool();
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const rawQuery = async (sql, params = []) => {
        const isLocalProvider = process.env.TENANT_PROVIDER === 'local';
        if (isLocalProvider) {
          const client = await pool.connect();
          try {
            const schemaName = req.session?.tenantSchemaName;
            if (!/^tenant_\d+$/.test(schemaName)) {
              throw new AppError('Invalid tenant schema', 500, AppError.CODES.DATABASE_ERROR);
            }
            await client.query('BEGIN');
            try {
              await client.query(`SET LOCAL search_path TO ${schemaName}`);
              const res = await client.query(sql, params);
              await client.query('COMMIT');
              return res.rows || [];
            } catch (inner) {
              try {
                await client.query('ROLLBACK');
              } catch {}
              throw inner;
            }
          } finally {
            client.release();
          }
        }
        const res = await pool.query(sql, params);
        return res.rows || [];
      };

      if (!FyndiqProductsModel._errorLogCols) {
        const cols = await rawQuery(
          `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = $1
            AND table_schema = current_schema()
          `,
          [FyndiqProductsModel.ERROR_LOG_TABLE],
        );
        FyndiqProductsModel._errorLogCols = new Set(cols.map((r) => String(r.column_name)));
      }

      const cols = FyndiqProductsModel._errorLogCols;
      if (!cols || cols.size === 0) return;
      if (!cols.has('channel')) return;
      const insertCols = [];
      const values = [];

      insertCols.push('channel');
      values.push(String(channel));

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
      await rawQuery(sql, values);
    } catch (e) {
      Logger.warn('Failed to log channel error (Fyndiq)', e);
    }
  }
}

module.exports = FyndiqProductsModel;
