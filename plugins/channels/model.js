// plugins/channels/model.js
// Channels aggregation based on existing tables:
// - channel_product_map: per-product/per-channel toggle + sync status
// - woocommerce_settings: indicates if Woo is configured
//
// Uses @homebase/core SDK for database access with automatic tenant isolation

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class ChannelsModel {
  static CHANNEL_MAP_TABLE = 'channel_product_map';
  static WOO_SETTINGS_TABLE = 'woocommerce_settings';
  static CDON_SETTINGS_TABLE = 'cdon_settings';
  static FYNDIQ_SETTINGS_TABLE = 'fyndiq_settings';
  static ERROR_LOG_TABLE = 'channel_error_log';
  static CHANNEL_INSTANCES_TABLE = 'channel_instances';
  static CHANNEL_OVERRIDES_TABLE = 'channel_product_overrides';

  // ---------- READ: list channel summaries ----------
  async getAll(req) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      // 1) Channels present in the mapping table
      const channelsRes = await db.query(
        `SELECT DISTINCT channel FROM ${ChannelsModel.CHANNEL_MAP_TABLE} WHERE user_id = $1`,
        [userId]
      );
      const channels = channelsRes.map(r => r.channel);

      // 2) Is Woo configured?
      const wooCfgRes = await db.query(
        `SELECT 1 FROM ${ChannelsModel.WOO_SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      const wooConfigured = wooCfgRes.length > 0;

      // 2b) Is CDON configured?
      const cdonCfgRes = await db.query(
        `SELECT connected FROM ${ChannelsModel.CDON_SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      const cdonConfigured = cdonCfgRes.length > 0 && !!cdonCfgRes[0]?.connected;

      // 2c) Is Fyndiq configured?
      const fyndiqCfgRes = await db.query(
        `SELECT connected FROM ${ChannelsModel.FYNDIQ_SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      const fyndiqConfigured = fyndiqCfgRes.length > 0 && !!fyndiqCfgRes[0]?.connected;

      // 3) Build the set of channels (add "woocommerce" if configured)
      const set = new Set(channels);
      if (wooConfigured) set.add('woocommerce');
      if (cdonConfigured) set.add('cdon');
      if (fyndiqConfigured) set.add('fyndiq');

      const summaries = [];
      for (const ch of set) {
        const statRes = await db.query(
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
        const s = statRes[0] || {};

        const isConfigured =
          ch === 'woocommerce'
            ? wooConfigured
            : ch === 'cdon'
              ? cdonConfigured
              : ch === 'fyndiq'
                ? fyndiqConfigured
                : (s.mapped_count || 0) > 0;

        summaries.push({
          id: ch,
          channel: ch,
          configured: isConfigured,
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
    } catch (error) {
      Logger.error('Failed to fetch channels', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch channels', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ---------- HELPERS: per-product channel mapping (safe upsert pattern) ----------

  /**
   * Normalize a channel key for consistent storage.
   */
  sanitizeChannelKey(channel) {
    return String(channel || '').trim().toLowerCase();
  }

  /**
   * Get all channel/instance targets for a product (where it is published or enabled).
   * Used for sync-on-save: push updates to these channels.
   * Returns [{ channel, channelInstanceId }] (channelInstanceId null for non-Woo or legacy Woo).
   */
  async getProductChannelTargets(req, productId) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const pid = String(productId || '').trim();
      if (!pid) return [];

      const sql = `
        SELECT channel, channel_instance_id
        FROM ${ChannelsModel.CHANNEL_MAP_TABLE}
        WHERE user_id = $1 AND product_id = $2
          AND (enabled = TRUE OR external_id IS NOT NULL)
      `;
      const rows = await db.query(sql, [userId, pid]);
      return rows.map((r) => ({
        channel: r.channel,
        channelInstanceId: r.channel_instance_id != null ? String(r.channel_instance_id) : null,
      }));
    } catch (error) {
      Logger.error('Failed to get product channel targets', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get product channel targets', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Get a single mapping row for (user, product, channel).
   * Returns the row object or null.
   */
  async getProductMapRow(req, productId, channel) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const ch = this.sanitizeChannelKey(channel);
      const sql = `
        SELECT *
        FROM ${ChannelsModel.CHANNEL_MAP_TABLE}
        WHERE user_id = $1 AND product_id = $2 AND channel = $3
        LIMIT 1
      `;
      const res = await db.query(sql, [userId, productId, ch]);
      return res[0] || null;
    } catch (error) {
      Logger.error('Failed to get product map row', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get product map row', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Set "enabled" flag for a product on a channel.
   * Does a SELECT first; if no row exists, INSERT. Otherwise, UPDATE.
   * Returns the resulting row.
   */
  async setProductEnabled(req, { productId, channel, enabled }) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const ch = this.sanitizeChannelKey(channel);
      const current = await this.getProductMapRow(req, productId, ch);

      if (!current) {
        // INSERT minimal row; other fields (external_id, last_sync_status, etc.) stay NULL/default.
        const insertSql = `
          INSERT INTO ${ChannelsModel.CHANNEL_MAP_TABLE}
            (user_id, product_id, channel, enabled)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        const ins = await db.query(insertSql, [userId, productId, ch, !!enabled]);
        return ins[0];
      }

      // UPDATE only the enabled flag; keep other fields intact.
      const updateSql = `
        UPDATE ${ChannelsModel.CHANNEL_MAP_TABLE}
        SET enabled = $4
        WHERE user_id = $1 AND product_id = $2 AND channel = $3
        RETURNING *
      `;
      const upd = await db.query(updateSql, [userId, productId, ch, !!enabled]);
      return upd[0] || null;
    } catch (error) {
      Logger.error('Failed to set product enabled', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to set product enabled', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ---------- READ: recent channel errors ----------
  async getErrors(req, { channel, limit = 50 } = {}) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const ch = this.sanitizeChannelKey(channel);
      const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);

      const res = await db.query(
        `
        SELECT id, channel, product_id, error_message, created_at
        FROM ${ChannelsModel.ERROR_LOG_TABLE}
        WHERE user_id = $1 AND channel = $2
        ORDER BY created_at DESC, id DESC
        LIMIT $3
        `,
        [userId, ch, lim],
      );

      return res.map((r) => ({
        id: String(r.id),
        channel: r.channel,
        productId: r.product_id != null ? String(r.product_id) : null,
        message: r.error_message || null,
        createdAt: r.created_at || null,
      }));
    } catch (error) {
      Logger.error('Failed to fetch channel errors', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch channel errors', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ---------- Channel instances ----------
  async listInstances(req, { channel } = {}) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const ch = channel ? this.sanitizeChannelKey(channel) : null;
      let sql = `
        SELECT id, channel, instance_key, market, label, credentials, created_at, updated_at
        FROM ${ChannelsModel.CHANNEL_INSTANCES_TABLE}
        WHERE user_id = $1
      `;
      const params = [userId];
      
      if (ch) {
        sql += ` AND channel = $2`;
        params.push(ch);
      }
      
      sql += ` ORDER BY channel ASC, COALESCE(market,'') ASC, instance_key ASC, id ASC`;
      
      const rows = await db.query(sql, params);

      return rows.map((r) => ({
        id: String(r.id),
        channel: r.channel,
        instanceKey: r.instance_key,
        market: r.market,
        label: r.label,
        credentials: r.credentials ?? null,
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
      }));
    } catch (error) {
      Logger.error('Failed to list channel instances', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to list channel instances', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async upsertInstance(req, { channel, instanceKey, market, label, credentials } = {}) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const ch = this.sanitizeChannelKey(channel);
      const key = String(instanceKey || '').trim();
      if (!ch || !key) {
        throw new AppError('Missing required fields (channel, instanceKey)', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const mkt = market != null && String(market).trim() ? String(market).trim().toLowerCase() : null;
      const lbl = label != null && String(label).trim() ? String(label).trim() : null;
      const creds = credentials != null ? credentials : null;

      const rows = await db.query(
        `
        INSERT INTO ${ChannelsModel.CHANNEL_INSTANCES_TABLE}
          (user_id, channel, instance_key, market, label, credentials, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, channel, instance_key) DO UPDATE SET
          market = EXCLUDED.market,
          label = EXCLUDED.label,
          credentials = EXCLUDED.credentials,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, channel, instance_key, market, label, credentials, created_at, updated_at
        `,
        [userId, ch, key, mkt, lbl, creds],
      );

      const r = rows[0];
      return {
        id: String(r.id),
        channel: r.channel,
        instanceKey: r.instance_key,
        market: r.market,
        label: r.label,
        credentials: r.credentials ?? null,
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
      };
    } catch (error) {
      Logger.error('Failed to upsert channel instance', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to upsert channel instance', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateInstance(req, id, { market, label, credentials } = {}) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const instanceId = Number(id);
      if (!Number.isFinite(instanceId)) {
        throw new AppError('Invalid instance id', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const mkt = market != null && String(market).trim() ? String(market).trim().toLowerCase() : null;
      const lbl = label != null && String(label).trim() ? String(label).trim() : null;
      const creds = credentials != null ? credentials : null;

      const rows = await db.query(
        `
        UPDATE ${ChannelsModel.CHANNEL_INSTANCES_TABLE}
        SET
          market = $3,
          label = $4,
          credentials = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND id = $2
        RETURNING id, channel, instance_key, market, label, credentials, created_at, updated_at
        `,
        [userId, instanceId, mkt, lbl, creds],
      );
      if (!rows.length) throw new AppError('Instance not found', 404, AppError.CODES.NOT_FOUND);

      const r = rows[0];
      return {
        id: String(r.id),
        channel: r.channel,
        instanceKey: r.instance_key,
        market: r.market,
        label: r.label,
        credentials: r.credentials ?? null,
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
      };
    } catch (error) {
      Logger.error('Failed to update channel instance', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update channel instance', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ---------- Per-product overrides (active/price/category per instance) ----------
  async listProductOverrides(req, { productId, channel } = {}) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const pid = String(productId || '').trim();
      if (!pid) throw new AppError('productId is required', 400, AppError.CODES.VALIDATION_ERROR);
      const ch = channel ? this.sanitizeChannelKey(channel) : null;

      let sql = `
        SELECT
          o.id,
          o.product_id::text AS product_id,
          o.channel,
          o.instance,
          o.active,
          o.price_amount,
          o.currency,
          o.vat_rate,
          o.category,
          o.channel_instance_id,
          ci.instance_key,
          ci.market,
          ci.label,
          o.updated_at
        FROM ${ChannelsModel.CHANNEL_OVERRIDES_TABLE} o
        LEFT JOIN ${ChannelsModel.CHANNEL_INSTANCES_TABLE} ci
          ON ci.id = o.channel_instance_id
        WHERE o.user_id = $1
          AND o.product_id::text = $2
      `;
      const params = [userId, pid];
      
      if (ch) {
        sql += ` AND o.channel = $3`;
        params.push(ch);
      }
      
      sql += ` ORDER BY o.channel ASC, COALESCE(ci.market,'') ASC, COALESCE(ci.instance_key, o.instance) ASC, o.id ASC`;
      
      const rows = await db.query(sql, params);

      return rows.map((r) => ({
        id: String(r.id),
        productId: String(r.product_id),
        channel: r.channel,
        instanceId: r.channel_instance_id != null ? String(r.channel_instance_id) : null,
        instanceKey: r.instance_key || r.instance,
        market: r.market || null,
        label: r.label || null,
        active: !!r.active,
        priceAmount: r.price_amount != null ? Number(r.price_amount) : null,
        currency: r.currency || null,
        vatRate: r.vat_rate != null ? Number(r.vat_rate) : null,
        category: r.category || null,
        updatedAt: r.updated_at || null,
      }));
    } catch (error) {
      Logger.error('Failed to list product overrides', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to list product overrides', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async upsertProductOverride(req, { productId, channelInstanceId, active, priceAmount, currency, vatRate, category } = {}) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const pid = String(productId || '').trim();
      const instId = Number(channelInstanceId);
      if (!pid) throw new AppError('productId is required', 400, AppError.CODES.VALIDATION_ERROR);
      if (!Number.isFinite(instId)) throw new AppError('channelInstanceId is required', 400, AppError.CODES.VALIDATION_ERROR);

      // Load instance to mirror channel+instance into overrides (for backwards compat)
      const instRows = await db.query(
        `
        SELECT id, channel, instance_key
        FROM ${ChannelsModel.CHANNEL_INSTANCES_TABLE}
        WHERE user_id = $1 AND id = $2
        LIMIT 1
        `,
        [userId, instId],
      );
      if (!instRows.length) throw new AppError('Channel instance not found', 404, AppError.CODES.NOT_FOUND);
      const inst = instRows[0];

      const ch = this.sanitizeChannelKey(inst.channel);
      const instanceKey = String(inst.instance_key);

      const price = priceAmount != null && Number.isFinite(Number(priceAmount)) ? Number(priceAmount) : null;
      const vat = vatRate != null && Number.isFinite(Number(vatRate)) ? Number(vatRate) : null;
      const cur = currency != null && String(currency).trim() ? String(currency).trim().toUpperCase() : null;
      const cat = category != null && String(category).trim() ? String(category).trim() : null;

      const rows = await db.query(
        `
        INSERT INTO ${ChannelsModel.CHANNEL_OVERRIDES_TABLE}
          (user_id, product_id, channel, instance, channel_instance_id, active, price_amount, currency, vat_rate, category, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, product_id, channel, instance) DO UPDATE SET
          channel_instance_id = EXCLUDED.channel_instance_id,
          active = EXCLUDED.active,
          price_amount = EXCLUDED.price_amount,
          currency = EXCLUDED.currency,
          vat_rate = EXCLUDED.vat_rate,
          category = EXCLUDED.category,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
        `,
        [userId, pid, ch, instanceKey, instId, !!active, price, cur, vat, cat],
      );

      return { ok: true, id: rows?.[0]?.id != null ? String(rows[0].id) : null };
    } catch (error) {
      Logger.error('Failed to upsert product override', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to upsert product override', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ---------- Import template (CSV) ----------
  async buildImportTemplateCsv(req) {
    try {
      const instances = await this.listInstances(req);

      // Core product columns (stable)
      const baseCols = [
        'sku',
        'title',
        'description',
        'quantity',
        'vatRate',
        'brand',
        'mpn',
        'gtin',
      ];

      // Instance columns
      const instCols = [];
      for (const inst of instances) {
        const ch = String(inst.channel || '').toLowerCase();
        const key = String(inst.instanceKey || '').trim();
        if (!ch || !key) continue;

        instCols.push(`${ch}.${key}.active`);
        instCols.push(`${ch}.${key}.price`);
        instCols.push(`${ch}.${key}.currency`);
        if (ch === 'woocommerce') instCols.push(`${ch}.${key}.categories`);
        else instCols.push(`${ch}.${key}.category`);
      }

      const cols = [...baseCols, ...instCols];
      const header = cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
      // Provide a blank example row so Excel opens it nicely
      const example = cols.map(() => '""').join(',');
      return `${header}\n${example}\n`;
    } catch (error) {
      Logger.error('Failed to build import template CSV', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to build import template', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = ChannelsModel;
