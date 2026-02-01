// plugins/channels/model.js
// Channels aggregation based on existing tables:
// - channel_product_map: per-product/per-channel toggle + sync status
// - woocommerce_settings: indicates if Woo is configured
//
// Keeps the template structure (model/controller/routes).
// Adds safe helpers for per-product toggling WITHOUT assuming DB unique constraints
// (does a SELECT, then INSERT or UPDATE).

class ChannelsModel {
  constructor(pool) {
    this.pool = pool;
  }

  static CHANNEL_MAP_TABLE = 'channel_product_map';
  static WOO_SETTINGS_TABLE = 'woocommerce_settings';

  // ---------- READ: list channel summaries (unchanged behavior) ----------
  async getAll(userId) {
    // 1) Channels present in the mapping table
    const channelsRes = await this.pool.query(
      `SELECT DISTINCT channel FROM ${ChannelsModel.CHANNEL_MAP_TABLE} WHERE user_id = $1`,
      [userId]
    );
    const channels = channelsRes.rows.map(r => r.channel);

    // 2) Is Woo configured?
    const wooCfgRes = await this.pool.query(
      `SELECT 1 FROM ${ChannelsModel.WOO_SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const wooConfigured = wooCfgRes.rowCount > 0;

    // 3) Build the set of channels (add "woocommerce" if configured)
    const set = new Set(channels);
    if (wooConfigured) set.add('woocommerce');

    const summaries = [];
    for (const ch of set) {
      const statRes = await this.pool.query(
        `
        SELECT
          COUNT(*)::int AS mapped_count,
          COUNT(*) FILTER (WHERE enabled)                  ::int AS enabled_count,
          COUNT(*) FILTER (WHERE last_sync_status='success')::int AS success_count,
          COUNT(*) FILTER (WHERE last_sync_status='error')  ::int AS error_count,
          COUNT(*) FILTER (WHERE last_sync_status='queued') ::int AS queued_count,
          COUNT(*) FILTER (WHERE last_sync_status='idle')   ::int AS idle_count,
          MAX(last_synced_at) AS last_synced_at
        FROM ${ChannelsModel.CHANNEL_MAP_TABLE}
        WHERE user_id = $1 AND channel = $2
        `,
        [userId, ch]
      );
      const s = statRes.rows[0] || {};

      summaries.push({
        id: ch,
        channel: ch,
        configured: ch === 'woocommerce' ? wooConfigured : (s.mapped_count || 0) > 0,
        mappedCount: s.mapped_count || 0,
        enabledCount: s.enabled_count || 0,
        status: {
          success: s.success_count || 0,
          error:   s.error_count   || 0,
          queued:  s.queued_count  || 0,
          idle:    s.idle_count    || 0,
        },
        lastSyncedAt: s.last_synced_at || null,
      });
    }

    // Stable alphabetical order
    return summaries.sort((a, b) => String(a.channel).localeCompare(String(b.channel)));
  }

  // ---------- HELPERS: per-product channel mapping (safe upsert pattern) ----------

  /**
   * Normalize a channel key for consistent storage.
   */
  sanitizeChannelKey(channel) {
    return String(channel || '').trim().toLowerCase();
  }

  /**
   * Get a single mapping row for (user, product, channel).
   * Returns the row object or null.
   */
  async getProductMapRow(userId, productId, channel) {
    const ch = this.sanitizeChannelKey(channel);
    const sql = `
      SELECT *
      FROM ${ChannelsModel.CHANNEL_MAP_TABLE}
      WHERE user_id = $1 AND product_id = $2 AND channel = $3
      LIMIT 1
    `;
    const res = await this.pool.query(sql, [userId, productId, ch]);
    return res.rows[0] || null;
  }

  /**
   * Set "enabled" flag for a product on a channel.
   * Does a SELECT first; if no row exists, INSERT. Otherwise, UPDATE.
   * Returns the resulting row.
   *
   * NOTE: We intentionally avoid assuming a UNIQUE constraint on (user_id, product_id, channel).
   */
  async setProductEnabled(userId, { productId, channel, enabled }) {
    const ch = this.sanitizeChannelKey(channel);
    const current = await this.getProductMapRow(userId, productId, ch);

    if (!current) {
      // INSERT minimal row; other fields (external_id, last_sync_status, etc.) stay NULL/default.
      const insertSql = `
        INSERT INTO ${ChannelsModel.CHANNEL_MAP_TABLE}
          (user_id, product_id, channel, enabled)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const ins = await this.pool.query(insertSql, [userId, productId, ch, !!enabled]);
      return ins.rows[0];
    }

    // UPDATE only the enabled flag; keep other fields intact.
    const updateSql = `
      UPDATE ${ChannelsModel.CHANNEL_MAP_TABLE}
      SET enabled = $4
      WHERE user_id = $1 AND product_id = $2 AND channel = $3
      RETURNING *
    `;
    const upd = await this.pool.query(updateSql, [userId, productId, ch, !!enabled]);
    return upd.rows[0] || null;
  }

  // ---------- Non-MVP CRUD (kept for parity, not used) ----------
  async create()  { throw new Error('Not implemented'); }
  async update()  { throw new Error('Not implemented'); }
  async delete()  { throw new Error('Not implemented'); }
}

module.exports = ChannelsModel;
