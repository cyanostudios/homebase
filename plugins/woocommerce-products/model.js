// plugins/woocommerce-products/model.js
// Derived from neutral template; structure preserved.
// Provides per-user WooCommerce settings storage + helpers.
// Uses @homebase/core SDK for database access with automatic tenant isolation

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const CredentialsCrypto = require('../../server/core/services/security/CredentialsCrypto');

class WooCommerceModel {
  static CHANNEL_INSTANCES_TABLE = 'channel_instances';
  static CHANNEL_MAP_TABLE = 'channel_product_map';
  static ERROR_LOG_TABLE = 'channel_error_log';
  static CHANNEL = 'woocommerce';

  // ----- Row transformers -----
  normalizeCredentialsForStorage(credentials) {
    if (credentials == null) return null;
    if (typeof credentials === 'string') {
      if (CredentialsCrypto.isEncrypted(credentials)) return credentials;
      return CredentialsCrypto.encrypt(credentials);
    }
    return CredentialsCrypto.encrypt(JSON.stringify(credentials));
  }

  /** Returns value suitable for JSONB column: null or { v: encryptedString }. */
  credentialsForJsonb(encryptedString) {
    if (encryptedString == null) return null;
    return { v: encryptedString };
  }

  /** Reads credentials from DB format: { v: encryptedString }. Returns parsed object or null. */
  parseCredentials(rawCredentials) {
    if (rawCredentials == null || typeof rawCredentials !== 'object' || !('v' in rawCredentials))
      return null;
    const enc = rawCredentials.v;
    if (typeof enc !== 'string' || !CredentialsCrypto.isEncrypted(enc)) return null;
    try {
      const decrypted = CredentialsCrypto.decrypt(enc);
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }

  // ----- Channel Instances API -----

  async getInstanceByKey(req, instanceKey) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const sql = `
        SELECT id, channel, instance_key, market, label, credentials, created_at, updated_at
        FROM ${WooCommerceModel.CHANNEL_INSTANCES_TABLE}
        WHERE user_id = $1 AND channel = $2 AND instance_key = $3
        LIMIT 1
      `;
      const result = await db.query(sql, [userId, WooCommerceModel.CHANNEL, instanceKey]);
      if (!result.length) return null;

      const r = result[0];
      return {
        id: String(r.id),
        channel: r.channel,
        instanceKey: r.instance_key,
        market: r.market,
        label: r.label,
        credentials: this.parseCredentials(r.credentials),
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
      };
    } catch (error) {
      Logger.error('Failed to get WooCommerce instance', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get WooCommerce instance', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getInstanceById(req, instanceId) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const id = Number(instanceId);
      if (!Number.isFinite(id)) {
        throw new AppError('Invalid instance ID', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const sql = `
        SELECT id, channel, instance_key, market, label, credentials, created_at, updated_at
        FROM ${WooCommerceModel.CHANNEL_INSTANCES_TABLE}
        WHERE user_id = $1 AND channel = $2 AND id = $3
        LIMIT 1
      `;
      const result = await db.query(sql, [userId, WooCommerceModel.CHANNEL, id]);
      if (!result.length) return null;

      const r = result[0];
      return {
        id: String(r.id),
        channel: r.channel,
        instanceKey: r.instance_key,
        market: r.market,
        label: r.label,
        credentials: this.parseCredentials(r.credentials),
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
      };
    } catch (error) {
      Logger.error('Failed to get WooCommerce instance by ID', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get WooCommerce instance', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async listInstances(req) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const sql = `
        SELECT id, channel, instance_key, market, label, credentials, created_at, updated_at
        FROM ${WooCommerceModel.CHANNEL_INSTANCES_TABLE}
        WHERE user_id = $1 AND channel = $2
        ORDER BY instance_key ASC, id ASC
      `;
      const rows = await db.query(sql, [userId, WooCommerceModel.CHANNEL]);

      return rows.map((r) => ({
        id: String(r.id),
        channel: r.channel,
        instanceKey: r.instance_key,
        market: r.market,
        label: r.label,
        credentials: this.parseCredentials(r.credentials),
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
      }));
    } catch (error) {
      Logger.error('Failed to list WooCommerce instances', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to list WooCommerce instances',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async upsertInstance(req, { instanceKey, label, credentials } = {}) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const key = String(instanceKey || '').trim();
      if (!key) {
        throw new AppError(
          'Missing required field: instanceKey',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const lbl = label != null && String(label).trim() ? String(label).trim() : null;
      const creds = this.normalizeCredentialsForStorage(credentials);
      const credsJsonb = this.credentialsForJsonb(creds);

      const rows = await db.query(
        `
        INSERT INTO ${WooCommerceModel.CHANNEL_INSTANCES_TABLE}
          (user_id, channel, instance_key, market, label, credentials, created_at, updated_at)
        VALUES
          ($1, $2, $3, NULL, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, channel, instance_key) DO UPDATE SET
          label = EXCLUDED.label,
          credentials = EXCLUDED.credentials,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, channel, instance_key, market, label, credentials, created_at, updated_at
        `,
        [userId, WooCommerceModel.CHANNEL, key, lbl, credsJsonb],
      );

      const r = rows[0];
      return {
        id: String(r.id),
        channel: r.channel,
        instanceKey: r.instance_key,
        market: r.market,
        label: r.label,
        credentials: this.parseCredentials(r.credentials),
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
      };
    } catch (error) {
      Logger.error('Failed to upsert WooCommerce instance', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to upsert WooCommerce instance',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async deleteInstance(req, instanceId) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const id = Number(instanceId);
      if (!Number.isFinite(id)) {
        throw new AppError('Invalid instance ID', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const result = await db.query(
        `
        DELETE FROM ${WooCommerceModel.CHANNEL_INSTANCES_TABLE}
        WHERE user_id = $1 AND channel = $2 AND id = $3
        RETURNING id
        `,
        [userId, WooCommerceModel.CHANNEL, id],
      );

      if (!result.length) {
        throw new AppError('Instance not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('WooCommerce instance deleted', { userId, instanceId });
      return { id: String(result[0].id) };
    } catch (error) {
      Logger.error('Failed to delete WooCommerce instance', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to delete WooCommerce instance',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  // --- Channel mapping helpers (MVP) ---

  /**
   * Upsert per produkt/per kanal (och per instans för Woo) koppling + senaste sync-status.
   * channelInstanceId: optional; for Woo multi-store, pass instance id; for CDON/Fyndiq leave null.
   */
  async upsertChannelMap(
    req,
    { productId, channel, channelInstanceId, externalId, status, error },
  ) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const instanceId =
        channelInstanceId != null && Number.isFinite(Number(channelInstanceId))
          ? Number(channelInstanceId)
          : null;

      const sql = `
        INSERT INTO ${WooCommerceModel.CHANNEL_MAP_TABLE} (
          user_id, product_id, channel, channel_instance_id, enabled, external_id, last_synced_at, last_sync_status, last_error, created_at, updated_at
        ) VALUES (
          $1,       $2,         $3,      $4,                   TRUE,    $5,          CURRENT_TIMESTAMP, $6,              $7,         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id, product_id, channel, channel_instance_id) DO UPDATE SET
          enabled = TRUE,
          external_id = EXCLUDED.external_id,
          last_synced_at = CURRENT_TIMESTAMP,
          last_sync_status = EXCLUDED.last_sync_status,
          last_error = EXCLUDED.last_error,
          updated_at = CURRENT_TIMESTAMP
      `;
      const params = [
        userId,
        String(productId),
        String(channel),
        instanceId,
        externalId || null,
        status || 'success',
        error || null,
      ];
      await db.query(sql, params);
      Logger.info('Channel map upserted', {
        userId,
        productId,
        channel,
        channelInstanceId: instanceId,
        externalId,
      });
    } catch (error) {
      Logger.error('Failed to upsert channel map', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to upsert channel map', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Läs in befintlig kanal-mappning för en uppsättning produkter.
   * instanceId: optional; for Woo pass one instance id to get map for that store only; null = legacy one row per channel.
   * Returnerar Map<productId(string) -> external_id(string)> för rader där external_id finns.
   */
  async getChannelMapForProducts(req, channel, productIds, instanceId = null) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      if (!Array.isArray(productIds) || productIds.length === 0) return new Map();

      const instId =
        instanceId != null && Number.isFinite(Number(instanceId)) ? Number(instanceId) : null;
      let sql = `
        SELECT product_id, external_id
        FROM ${WooCommerceModel.CHANNEL_MAP_TABLE}
        WHERE user_id = $1
          AND channel = $2
          AND product_id = ANY($3::text[])
      `;
      const params = [userId, String(channel), productIds.map(String)];
      if (instId !== null) {
        sql += ` AND channel_instance_id = $4`;
        params.push(instId);
      } else {
        sql += ` AND (channel_instance_id IS NULL OR channel_instance_id = 0)`;
      }
      const res = await db.query(sql, params);
      const m = new Map();
      for (const r of res) {
        if (r.external_id) m.set(String(r.product_id), String(r.external_id));
      }
      return m;
    } catch (error) {
      Logger.error('Failed to get channel map for products', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Failed to get channel map for products',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  /**
   * Enkel fel-logg för felsökning.
   */
  async logChannelError(req, { channel, productId, payload, response, message }) {
    try {
      const db = Database.get(req);
      const pool = db.getPool();
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      // IMPORTANT: Do NOT query information_schema via db.query() (tenant-isolation may inject user_id).
      // Use the raw pool instead (and set search_path for local schema-per-tenant).
      const rawQuery = async (sql, params = []) => {
        const isLocalProvider = process.env.TENANT_PROVIDER === 'local';
        if (isLocalProvider) {
          const client = await pool.connect();
          try {
            const schemaName = `tenant_${req.session?.currentTenantUserId || userId}`;
            await client.query(`SET search_path TO ${schemaName}`);
            const res = await client.query(sql, params);
            return res.rows || [];
          } finally {
            client.release();
          }
        }
        const res = await pool.query(sql, params);
        return res.rows || [];
      };

      // Backward/forward compatible: older tenants may not have payload/response columns.
      if (!WooCommerceModel._errorLogCols) {
        const cols = await rawQuery(
          `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = $1
            AND table_schema = current_schema()
          `,
          [WooCommerceModel.ERROR_LOG_TABLE],
        );
        WooCommerceModel._errorLogCols = new Set(cols.map((r) => String(r.column_name)));
      }

      const cols = WooCommerceModel._errorLogCols;
      if (!cols || cols.size === 0) return;

      if (!cols.has('channel')) return;
      const insertCols = [];
      const values = [];

      if (cols.has('user_id')) {
        insertCols.push('user_id');
        values.push(userId);
      }
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
        INSERT INTO ${WooCommerceModel.ERROR_LOG_TABLE} (${insertCols.join(', ')})
        VALUES (${placeholders.join(', ')})
      `;
      await rawQuery(sql, values);
    } catch (error) {
      // Don't throw - error logging should not break the main flow
      Logger.warn('Failed to log channel error', error);
    }
  }

  /**
   * När en produkt är borttagen i kanalen ska vi:
   * - enabled=false
   * - external_id=null
   * - last_synced_at uppdateras
   * - last_sync_status sätts till en befintlig status (vi använder 'idle' här)
   * channelInstanceId: optional; for Woo clear only that instance's row.
   */
  async clearChannelMapByExternalId(
    req,
    { channel, channelInstanceId, externalId, status, error },
  ) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const instId =
        channelInstanceId != null && Number.isFinite(Number(channelInstanceId))
          ? Number(channelInstanceId)
          : null;
      let sql = `
        UPDATE ${WooCommerceModel.CHANNEL_MAP_TABLE}
        SET
          enabled = FALSE,
          external_id = NULL,
          last_synced_at = CURRENT_TIMESTAMP,
          last_sync_status = $4,
          last_error = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND channel = $2
          AND external_id = $3
      `;
      const params = [userId, String(channel), String(externalId), status || 'idle', error || null];
      if (instId !== null) {
        sql += ` AND channel_instance_id = $6`;
        params.push(instId);
      } else {
        sql += ` AND (channel_instance_id IS NULL OR channel_instance_id = 0)`;
      }
      await db.query(sql, params);
      Logger.info('Channel map cleared by external ID', {
        userId,
        channel,
        channelInstanceId: instId,
        externalId,
      });
    } catch (error) {
      Logger.error('Failed to clear channel map by external ID', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to clear channel map', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = WooCommerceModel;
