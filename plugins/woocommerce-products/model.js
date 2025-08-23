// Derived from neutral template; structure preserved.
// Provides per-user WooCommerce settings storage + helpers.

const config = require('./plugin.config');

class WooCommerceModel {
  constructor(pool) {
    this.pool = pool;
  }

  // Settings live in this table (created earlier)
  static SETTINGS_TABLE = 'woocommerce_settings';

  // ----- Settings API -----

  async getSettings(userId) {
    const sql = `
      SELECT *
      FROM ${WooCommerceModel.SETTINGS_TABLE}
      WHERE user_id = $1
      LIMIT 1
    `;
    const result = await this.pool.query(sql, [userId]);
    return result.rows.length ? this.transformSettingsRow(result.rows[0]) : null;
  }

  async upsertSettings(userId, data) {
    const storeUrl = String(data.storeUrl || '').trim();
    const consumerKey = String(data.consumerKey || '').trim();
    const consumerSecret = String(data.consumerSecret || '').trim();
    const useQueryAuth = Boolean(data.useQueryAuth);

    const sql = `
      INSERT INTO ${WooCommerceModel.SETTINGS_TABLE} (
        user_id, store_url, consumer_key, consumer_secret, use_query_auth, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id) DO UPDATE SET
        store_url = EXCLUDED.store_url,
        consumer_key = EXCLUDED.consumer_key,
        consumer_secret = EXCLUDED.consumer_secret,
        use_query_auth = EXCLUDED.use_query_auth,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await this.pool.query(sql, [
      userId,
      storeUrl,
      consumerKey,
      consumerSecret,
      useQueryAuth,
    ]);
    return this.transformSettingsRow(result.rows[0]);
  }

  // ----- Template-compat (not used in Woo settings flow but kept for parity) -----

  async getAll(userId) {
    // Return settings as a single-item array for template parity
    const s = await this.getSettings(userId);
    return s ? [s] : [];
  }

  async create(userId, data) {
    return this.upsertSettings(userId, data);
  }

  async update(userId, _id, data) {
    return this.upsertSettings(userId, data);
  }

  async delete(userId, _id) {
    // Deleting settings: uncommon; keep for completeness
    const sql = `
      DELETE FROM ${WooCommerceModel.SETTINGS_TABLE}
      WHERE user_id = $1
      RETURNING id
    `;
    const result = await this.pool.query(sql, [userId]);
    if (!result.rows.length) throw new Error('Item not found');
    return { id: String(result.rows[0].id) };
  }

  // ----- Row transformers -----

  transformSettingsRow(row) {
    return {
      id: String(row.id),
      storeUrl: row.store_url,
      consumerKey: row.consumer_key,
      consumerSecret: row.consumer_secret,
      useQueryAuth: !!row.use_query_auth,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      _raw: row, // remove later if undesired
    };
  }

  // --- Channel mapping helpers (MVP) ---

  /**
   * Upsert per produkt/per kanal koppling + senaste sync-status.
   * Kräver tabell channel_product_map med unik (user_id, product_id, channel).
   */
  async upsertChannelMap(userId, { productId, channel, externalId, status, error }) {
    const sql = `
      INSERT INTO channel_product_map (
        user_id, product_id, channel, enabled, external_id, last_synced_at, last_sync_status, last_error, created_at, updated_at
      ) VALUES (
        $1,       $2,         $3,      TRUE,    $4,          CURRENT_TIMESTAMP, $5,              $6,         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id, product_id, channel) DO UPDATE SET
        enabled = TRUE,
        external_id = EXCLUDED.external_id,
        last_synced_at = CURRENT_TIMESTAMP,
        last_sync_status = EXCLUDED.last_sync_status,
        last_error = EXCLUDED.last_error,
        updated_at = CURRENT_TIMESTAMP
    `;
    const params = [userId, productId, channel, externalId || null, status || 'success', error || null];
    await this.pool.query(sql, params);
  }

  /**
   * Enkel fel-logg för felsökning.
   * Kräver tabell channel_error_log(user_id, channel, product_id, payload, response, error_message, created_at)
   */
  async logChannelError(userId, { channel, productId, payload, response, message }) {
    const sql = `
      INSERT INTO channel_error_log (user_id, channel, product_id, payload, response, error_message, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `;
    await this.pool.query(sql, [
      userId,
      channel,
      productId || null,
      payload ? JSON.stringify(payload) : null,
      response ? JSON.stringify(response) : null,
      message || null,
    ]);
  }
}

module.exports = WooCommerceModel;
