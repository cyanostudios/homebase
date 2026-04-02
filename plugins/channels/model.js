// plugins/channels/model.js
// Channels aggregation based on existing tables:
// - channel_product_map: tenant-scoped per-product/per-channel toggle + sync status
// - woocommerce_settings: indicates if Woo is configured
//
// Uses @homebase/core SDK for database access with automatic tenant isolation

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const CredentialsCrypto = require('../../server/core/services/security/CredentialsCrypto');

function trimNonEmpty(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s !== '' ? s : null;
}

function parseCredentialsJsonb(rawCredentials) {
  // channel_instances.credentials is stored as JSONB: { v: <encrypted string> }.
  // Only decrypt locally to derive non-sensitive fields like storeUrl.
  if (rawCredentials == null || typeof rawCredentials !== 'object') return null;
  if (!('v' in rawCredentials)) return null;
  const enc = rawCredentials.v;
  if (typeof enc !== 'string' || !CredentialsCrypto.isEncrypted(enc)) return null;
  try {
    const decrypted = CredentialsCrypto.decrypt(enc);
    const parsed = JSON.parse(decrypted);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * CDON/Fyndiq consumer product URLs use a 16-character hex slug (from a UUID or equivalent).
 * Pure digit strings are not valid storefront article ids (they are often internal product id or SKU).
 */
function isCdOnFyndiqStorefrontArticleId(raw) {
  const s = trimNonEmpty(raw);
  if (!s) return false;
  if (/^\d+$/.test(s)) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return true;
  }
  if (/^[0-9a-f]{32}$/i.test(s)) return true;
  if (/^[0-9a-f]{16}$/i.test(s)) return true;
  return false;
}

function resolveCdOnFyndiqStorefrontArticleId(channel, row) {
  const ch = String(channel || '').toLowerCase();
  if (ch === 'cdon') {
    const aid = trimNonEmpty(row.cdon_article_id);
    const ext = trimNonEmpty(row.external_id);
    if (isCdOnFyndiqStorefrontArticleId(aid)) return aid;
    if (isCdOnFyndiqStorefrontArticleId(ext)) return ext;
    return null;
  }
  if (ch === 'fyndiq') {
    const ext = trimNonEmpty(row.external_id);
    if (isCdOnFyndiqStorefrontArticleId(ext)) return ext;
    return null;
  }
  return trimNonEmpty(row.external_id);
}

class ChannelsModel {
  static CHANNEL_MAP_TABLE = 'channel_product_map';
  static CDON_SETTINGS_TABLE = 'cdon_settings';
  static FYNDIQ_SETTINGS_TABLE = 'fyndiq_settings';
  static ERROR_LOG_TABLE = 'channel_error_log';
  static CHANNEL_INSTANCES_TABLE = 'channel_instances';
  static CHANNEL_OVERRIDES_TABLE = 'channel_product_overrides';

  formatCredentialsForApi(credentials) {
    if (credentials == null) return null;
    return { masked: true, hasCredentials: true };
  }

  normalizeCredentialsForStorage(credentials) {
    if (credentials == null) return null;
    if (typeof credentials === 'string') {
      if (CredentialsCrypto.isEncrypted(credentials)) return credentials;
      return CredentialsCrypto.encrypt(credentials);
    }
    return CredentialsCrypto.encrypt(JSON.stringify(credentials));
  }

  /** Value for JSONB column: null or { v: encryptedString }. */
  credentialsForJsonb(encryptedString) {
    if (encryptedString == null) return null;
    return { v: encryptedString };
  }

  // ---------- READ: list channel summaries ----------
  async getAll(req) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
      }

      // 1) Channels present in the mapping table
      const channelsRes = await db.query(
        `SELECT DISTINCT channel FROM ${ChannelsModel.CHANNEL_MAP_TABLE}`,
        [],
      );
      const channels = channelsRes.map((r) => r.channel);

      // 2) Is Woo configured? (multi-store: channel_instances = stores)
      const wooInstancesRes = await db.query(
        `SELECT 1 FROM ${ChannelsModel.CHANNEL_INSTANCES_TABLE} WHERE channel = $1 LIMIT 1`,
        ['woocommerce'],
      );
      const wooConfigured = wooInstancesRes.length > 0;

      // 2b) Is CDON configured?
      const cdonCfgRes = await db.query(
        `SELECT connected FROM ${ChannelsModel.CDON_SETTINGS_TABLE} LIMIT 1`,
        [],
      );
      const cdonConfigured = cdonCfgRes.length > 0 && !!cdonCfgRes[0]?.connected;

      // 2c) Is Fyndiq configured?
      const fyndiqCfgRes = await db.query(
        `SELECT connected FROM ${ChannelsModel.FYNDIQ_SETTINGS_TABLE} LIMIT 1`,
        [],
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
          WHERE channel = $1
          `,
          [ch],
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
            error: s.error_count || 0,
            queued: s.queued_count || 0,
            idle: s.idle_count || 0,
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
    return String(channel || '')
      .trim()
      .toLowerCase();
  }

  /**
   * Get all channel/instance targets for a product (where it is published or enabled).
   * Used for sync-on-save and ProductForm channel checkboxes.
   * Returns targets from: (1) channel_product_map (enabled), (2) channel_product_overrides (active).
   * Sello import writes to overrides; this ensures those show as targeted in UI.
   * Returns [{ channel, channelInstanceId }] (channelInstanceId null for non-Woo or legacy Woo).
   */
  async getProductChannelTargets(req, productId) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
      }

      const pid = String(productId || '').trim();
      if (!pid) return [];

      const [mapRows, overrideRows] = await Promise.all([
        db.query(
          `SELECT channel, channel_instance_id
           FROM ${ChannelsModel.CHANNEL_MAP_TABLE}
           WHERE product_id = $1 AND enabled = TRUE`,
          [pid],
        ),
        db.query(
          `SELECT channel, channel_instance_id
           FROM ${ChannelsModel.CHANNEL_OVERRIDES_TABLE}
           WHERE product_id = $1 AND active = TRUE AND channel_instance_id IS NOT NULL`,
          [pid],
        ),
      ]);

      const seen = new Set();
      const targets = [];
      for (const r of [...mapRows, ...overrideRows]) {
        const ch = String(r.channel || '').toLowerCase();
        const instId = r.channel_instance_id != null ? String(r.channel_instance_id) : null;
        const key = `${ch}:${instId ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        targets.push({ channel: ch, channelInstanceId: instId });
      }
      return targets;
    } catch (error) {
      Logger.error('Failed to get product channel targets', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to get product channel targets',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  /**
   * Get all channel links for a product (rows with external_id, for building product URLs).
   * Returns [{ channel, channelInstanceId, market, label, externalId, storeUrl? }].
   * CDON/Fyndiq: only rows whose ids look like storefront article ids (UUID / hex slug); no numeric-only fallbacks.
   * For map rows with channel_instance_id = NULL (CDON/Fyndiq), expands to one link per active market from overrides.
   */
  async getProductChannelLinks(req, productId) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
      }

      const pid = String(productId || '').trim();
      if (!pid) return [];

      const rows = await db.query(
        `
        SELECT
          m.channel,
          m.channel_instance_id,
          m.external_id,
          m.cdon_article_id,
          ci.market,
          ci.label,
          ci.instance_key,
          ci.credentials
        FROM ${ChannelsModel.CHANNEL_MAP_TABLE} m
        LEFT JOIN ${ChannelsModel.CHANNEL_INSTANCES_TABLE} ci
          ON ci.id = m.channel_instance_id
        WHERE m.product_id = $1
          AND (
            (m.external_id IS NOT NULL AND TRIM(m.external_id) <> '')
            OR (m.channel = 'cdon' AND m.cdon_article_id IS NOT NULL AND TRIM(m.cdon_article_id) <> '')
          )
        ORDER BY m.channel ASC, COALESCE(ci.market, '') ASC, COALESCE(ci.instance_key, '') ASC
        `,
        [pid],
      );

      const result = [];
      for (const r of rows) {
        const ch = String(r.channel || '').toLowerCase();
        let linkId;
        if (ch === 'cdon' || ch === 'fyndiq') {
          linkId = resolveCdOnFyndiqStorefrontArticleId(ch, r);
          if (!linkId) continue;
        } else {
          linkId = trimNonEmpty(r.external_id);
          if (!linkId) continue;
        }

        const creds = ch === 'woocommerce' ? parseCredentialsJsonb(r?.credentials) : null;
        const storeUrl =
          ch === 'woocommerce'
            ? trimNonEmpty(
                (creds?._homebase_store_url || creds?.storeUrl || creds?.store_url) ??
                  (r?.credentials?._homebase_store_url ||
                    r?.credentials?.storeUrl ||
                    r?.credentials?.store_url),
              )
            : null;

        if (r.channel_instance_id == null && (ch === 'cdon' || ch === 'fyndiq')) {
          const overrideRows = await db.query(
            `
            SELECT ci.market, ci.label, ci.instance_key
            FROM ${ChannelsModel.CHANNEL_OVERRIDES_TABLE} o
            INNER JOIN ${ChannelsModel.CHANNEL_INSTANCES_TABLE} ci
              ON ci.id = o.channel_instance_id
            WHERE o.product_id::text = $1 AND o.channel = $2 AND o.active = TRUE
              AND o.channel_instance_id IS NOT NULL
            ORDER BY COALESCE(ci.market, '') ASC, COALESCE(ci.instance_key, '') ASC
            `,
            [pid, ch],
          );
          if (overrideRows.length > 0) {
            for (const ov of overrideRows) {
              result.push({
                channel: ch,
                channelInstanceId: null,
                market: ov.market != null ? String(ov.market).trim().toLowerCase() : null,
                label: ov.label != null ? String(ov.label).trim() : null,
                instanceKey: ov.instance_key != null ? String(ov.instance_key).trim() : null,
                externalId: linkId,
                storeUrl,
              });
            }
          } else {
            result.push({
              channel: ch,
              channelInstanceId: null,
              market: null,
              label: null,
              instanceKey: null,
              externalId: linkId,
              storeUrl,
            });
          }
        } else {
          result.push({
            channel: ch,
            channelInstanceId: r.channel_instance_id != null ? String(r.channel_instance_id) : null,
            market: r.market != null ? String(r.market).trim().toLowerCase() : null,
            label: r.label != null ? String(r.label).trim() : null,
            instanceKey: r.instance_key != null ? String(r.instance_key).trim() : null,
            externalId: linkId,
            storeUrl,
          });
        }
      }
      return result;
    } catch (error) {
      Logger.error('Failed to get product channel links', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get product channel links', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Get a single mapping row for (user, product, channel, channelInstanceId?).
   * When channelInstanceId is provided, matches that instance; otherwise returns first row for channel.
   * Returns the row object or null.
   */
  async getProductMapRow(req, productId, channel, channelInstanceId = null) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
      }

      const ch = this.sanitizeChannelKey(channel);
      const instId =
        channelInstanceId != null && Number.isFinite(Number(channelInstanceId))
          ? Number(channelInstanceId)
          : null;

      let sql;
      const params = [productId, ch];
      if (instId != null) {
        sql = `
          SELECT * FROM ${ChannelsModel.CHANNEL_MAP_TABLE}
          WHERE product_id = $1 AND channel = $2 AND channel_instance_id = $3
          LIMIT 1
        `;
        params.push(instId);
      } else {
        sql = `
          SELECT * FROM ${ChannelsModel.CHANNEL_MAP_TABLE}
          WHERE product_id = $1 AND channel = $2
            AND (channel_instance_id IS NULL OR channel_instance_id = 0)
          LIMIT 1
        `;
      }
      const res = await db.query(sql, params);
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
   * Set "enabled" flag for a product on a channel (optionally for a specific instance).
   * Does a SELECT first; if no row exists, INSERT. Otherwise, UPDATE.
   * Returns the resulting row.
   */
  async setProductEnabled(req, { productId, channel, enabled, channelInstanceId }) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
      }

      const ch = this.sanitizeChannelKey(channel);
      const instId =
        channelInstanceId != null && Number.isFinite(Number(channelInstanceId))
          ? Number(channelInstanceId)
          : null;
      const current = await this.getProductMapRow(req, productId, ch, instId);

      if (!current) {
        const insertSql = `
          INSERT INTO ${ChannelsModel.CHANNEL_MAP_TABLE}
            (product_id, channel, channel_instance_id, enabled)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        const ins = await db.query(insertSql, [productId, ch, instId, !!enabled]);
        return ins[0];
      }

      let updateSql;
      if (instId != null) {
        updateSql = `
          UPDATE ${ChannelsModel.CHANNEL_MAP_TABLE}
          SET enabled = $3
          WHERE product_id = $1 AND channel = $2 AND channel_instance_id = $4
          RETURNING *
        `;
        const upd = await db.query(updateSql, [productId, ch, !!enabled, instId]);
        return upd[0] || null;
      }
      updateSql = `
        UPDATE ${ChannelsModel.CHANNEL_MAP_TABLE}
        SET enabled = $3
        WHERE product_id = $1 AND channel = $2
          AND (channel_instance_id IS NULL OR channel_instance_id = 0)
        RETURNING *
      `;
      const upd = await db.query(updateSql, [productId, ch, !!enabled]);
      return upd[0] || null;
    } catch (error) {
      Logger.error('Failed to set product enabled', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to set product enabled', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Apply multiple enable/disable updates for one product in one request (fewer round-trips).
   * @param {object} req
   * @param {{ productId: string, updates: Array<{ channel: string, channelInstanceId?: number, enabled: boolean }> }} opts
   */
  async setProductMapBulk(req, { productId, updates } = {}) {
    if (!productId || !Array.isArray(updates) || updates.length === 0) {
      return { ok: true, count: 0 };
    }
    for (const u of updates) {
      try {
        await this.setProductEnabled(req, {
          productId,
          channel: u.channel,
          enabled: !!u.enabled,
          channelInstanceId: u.channelInstanceId,
        });
      } catch (err) {
        Logger.error('setProductMapBulk item failed', err);
        if (err instanceof AppError) throw err;
        throw new AppError('Failed to update channel mapping', 500, AppError.CODES.DATABASE_ERROR);
      }
    }
    return { ok: true, count: updates.length };
  }

  // ---------- READ: recent channel errors ----------
  async getErrors(req, { channel, limit = 50 } = {}) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
      }

      const ch = this.sanitizeChannelKey(channel);
      const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);

      const res = await db.query(
        `
        SELECT id, channel, product_id, error_message, created_at
        FROM ${ChannelsModel.ERROR_LOG_TABLE}
        WHERE channel = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
        `,
        [ch, lim],
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
  async listInstances(req, { channel, includeDisabled } = {}) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const ch = channel ? this.sanitizeChannelKey(channel) : null;
      let sql = `
        SELECT id, channel, instance_key, market, label, credentials, enabled, sello_integration_id, created_at, updated_at
        FROM ${ChannelsModel.CHANNEL_INSTANCES_TABLE}
        WHERE 1=1
      `;
      const params = [];

      if (ch) {
        sql += ` AND channel = $1`;
        params.push(ch);
      }
      if (!includeDisabled) {
        sql += ` AND enabled = true`;
      }

      sql += ` ORDER BY channel ASC, COALESCE(market,'') ASC, instance_key ASC, id ASC`;

      const rows = await db.query(sql, params);

      return rows.map((r) => ({
        id: String(r.id),
        channel: r.channel,
        instanceKey: r.instance_key,
        market: r.market,
        label: r.label,
        credentials: this.formatCredentialsForApi(r.credentials),
        enabled: r.enabled !== false,
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
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const ch = this.sanitizeChannelKey(channel);
      const key = String(instanceKey || '').trim();
      if (!ch || !key) {
        throw new AppError(
          'Missing required fields (channel, instanceKey)',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      if (ch === 'woocommerce' && key.toLowerCase() === 'default') {
        throw new AppError(
          'WooCommerce instanceKey "default" is not allowed',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const mkt =
        market != null && String(market).trim() ? String(market).trim().toLowerCase() : null;
      const lbl = label != null && String(label).trim() ? String(label).trim() : null;
      const creds = this.normalizeCredentialsForStorage(credentials);
      const credsJsonb = this.credentialsForJsonb(creds);

      const rows = await db.query(
        `
        INSERT INTO ${ChannelsModel.CHANNEL_INSTANCES_TABLE}
          (channel, instance_key, market, label, credentials, enabled, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (channel, instance_key) DO UPDATE SET
          market = EXCLUDED.market,
          label = EXCLUDED.label,
          credentials = EXCLUDED.credentials,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, channel, instance_key, market, label, credentials, enabled, created_at, updated_at
        `,
        [ch, key, mkt, lbl, credsJsonb],
      );

      const r = rows[0];
      return {
        id: String(r.id),
        channel: r.channel,
        instanceKey: r.instance_key,
        market: r.market,
        label: r.label,
        credentials: this.formatCredentialsForApi(r.credentials),
        enabled: r.enabled !== false,
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
      };
    } catch (error) {
      Logger.error('Failed to upsert channel instance', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to upsert channel instance', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateInstance(req, id, { market, label, credentials, enabled, selloIntegrationId } = {}) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const instanceId = Number(id);
      if (!Number.isFinite(instanceId)) {
        throw new AppError('Invalid instance id', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const setClauses = [];
      const params = [instanceId];
      let paramIdx = 2;

      if (market !== undefined) {
        const mkt =
          market != null && String(market).trim() ? String(market).trim().toLowerCase() : null;
        setClauses.push(`market = $${paramIdx}`);
        params.push(mkt);
        paramIdx += 1;
      }
      if (selloIntegrationId !== undefined) {
        const sid =
          selloIntegrationId != null && String(selloIntegrationId).trim()
            ? String(selloIntegrationId).trim()
            : null;
        setClauses.push(`sello_integration_id = $${paramIdx}`);
        params.push(sid);
        paramIdx += 1;
      }
      if (label !== undefined) {
        const lbl = label != null && String(label).trim() ? String(label).trim() : null;
        setClauses.push(`label = $${paramIdx}`);
        params.push(lbl);
        paramIdx += 1;
      }
      if (credentials !== undefined) {
        setClauses.push(`credentials = $${paramIdx}`);
        params.push(this.credentialsForJsonb(this.normalizeCredentialsForStorage(credentials)));
        paramIdx += 1;
      }
      if (enabled !== undefined) {
        setClauses.push(`enabled = $${paramIdx}`);
        params.push(!!enabled);
        paramIdx += 1;
      }

      if (setClauses.length === 0) {
        throw new AppError('No fields to update', 400, AppError.CODES.VALIDATION_ERROR);
      }
      setClauses.push('updated_at = CURRENT_TIMESTAMP');

      const rows = await db.query(
        `
        UPDATE ${ChannelsModel.CHANNEL_INSTANCES_TABLE}
        SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING id, channel, instance_key, market, label, credentials, enabled, sello_integration_id, created_at, updated_at
        `,
        params,
      );
      if (!rows.length) throw new AppError('Instance not found', 404, AppError.CODES.NOT_FOUND);

      const r = rows[0];
      return {
        id: String(r.id),
        channel: r.channel,
        instanceKey: r.instance_key,
        market: r.market,
        label: r.label,
        credentials: this.formatCredentialsForApi(r.credentials),
        enabled: r.enabled !== false,
        selloIntegrationId: r.sello_integration_id || null,
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
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

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
          o.sale_price,
          o.original_price,
          o.channel_instance_id,
          ci.instance_key,
          ci.market,
          ci.label,
          o.updated_at
        FROM ${ChannelsModel.CHANNEL_OVERRIDES_TABLE} o
        LEFT JOIN ${ChannelsModel.CHANNEL_INSTANCES_TABLE} ci
          ON ci.id = o.channel_instance_id
        WHERE o.product_id::text = $1
      `;
      const params = [pid];

      if (ch) {
        sql += ` AND o.channel = $2`;
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
        salePrice: r.sale_price != null ? Number(r.sale_price) : null,
        originalPrice: r.original_price != null ? Number(r.original_price) : null,
        updatedAt: r.updated_at || null,
      }));
    } catch (error) {
      Logger.error('Failed to list product overrides', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to list product overrides', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async upsertProductOverride(
    req,
    {
      productId,
      channelInstanceId,
      active,
      priceAmount,
      currency,
      vatRate,
      category,
      salePrice,
      originalPrice,
    } = {},
  ) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const pid = String(productId || '').trim();
      const instId = Number(channelInstanceId);
      if (!pid) throw new AppError('productId is required', 400, AppError.CODES.VALIDATION_ERROR);
      if (!Number.isFinite(instId))
        throw new AppError('channelInstanceId is required', 400, AppError.CODES.VALIDATION_ERROR);

      // Load instance to mirror channel+instance into overrides (for backwards compat)
      const instRows = await db.query(
        `
        SELECT id, channel, instance_key
        FROM ${ChannelsModel.CHANNEL_INSTANCES_TABLE}
        WHERE id = $1
        LIMIT 1
        `,
        [instId],
      );
      if (!instRows.length)
        throw new AppError('Channel instance not found', 404, AppError.CODES.NOT_FOUND);
      const inst = instRows[0];

      const ch = this.sanitizeChannelKey(inst.channel);
      const instanceKey = String(inst.instance_key);

      const price =
        priceAmount != null && Number.isFinite(Number(priceAmount)) && Number(priceAmount) > 0
          ? Number(priceAmount)
          : null;
      const vat = vatRate != null && Number.isFinite(Number(vatRate)) ? Number(vatRate) : null;
      const cur =
        currency != null && String(currency).trim() ? String(currency).trim().toUpperCase() : null;
      const cat = category != null && String(category).trim() ? String(category).trim() : null;
      const sale =
        salePrice != null && Number.isFinite(Number(salePrice)) && Number(salePrice) > 0
          ? Number(salePrice)
          : null;
      const orig =
        originalPrice != null && Number.isFinite(Number(originalPrice)) && Number(originalPrice) > 0
          ? Number(originalPrice)
          : null;

      const rows = await db.query(
        `
        INSERT INTO ${ChannelsModel.CHANNEL_OVERRIDES_TABLE}
          (product_id, channel, instance, channel_instance_id, active, price_amount, currency, vat_rate, category, sale_price, original_price, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (product_id, channel, instance) DO UPDATE SET
          channel_instance_id = EXCLUDED.channel_instance_id,
          active = EXCLUDED.active,
          price_amount = EXCLUDED.price_amount,
          currency = EXCLUDED.currency,
          vat_rate = EXCLUDED.vat_rate,
          category = EXCLUDED.category,
          sale_price = EXCLUDED.sale_price,
          original_price = EXCLUDED.original_price,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
        `,
        [pid, ch, instanceKey, instId, !!active, price, cur, vat, cat, sale, orig],
      );

      return { ok: true, id: rows?.[0]?.id != null ? String(rows[0].id) : null };
    } catch (error) {
      Logger.error('Failed to upsert product override', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to upsert product override', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Bulk upsert overrides for one product: one SELECT for instances, one multi-row INSERT.
   * @param {object} req - request
   * @param {{ productId: string, items: Array<{ channelInstanceId: number, active?: boolean, priceAmount?: number|null, currency?: string|null, vatRate?: number|null, category?: string|null }> }} opts
   */
  async upsertProductOverridesBulk(req, { productId, items } = {}) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;
      if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

      const pid = String(productId || '').trim();
      if (!pid) throw new AppError('productId is required', 400, AppError.CODES.VALIDATION_ERROR);
      if (!Array.isArray(items) || items.length === 0) return { ok: true, count: 0 };

      const instanceIds = [
        ...new Set(
          items
            .map((o) => Number(o.channelInstanceId))
            .filter((id) => Number.isFinite(id) && id >= 1),
        ),
      ];
      if (instanceIds.length === 0) return { ok: true, count: 0 };

      const instRows = await db.query(
        `SELECT id, channel, instance_key FROM ${ChannelsModel.CHANNEL_INSTANCES_TABLE}
         WHERE id = ANY($1::int[])`,
        [instanceIds],
      );
      const instMap = new Map(
        instRows.map((r) => [
          r.id,
          { channel: this.sanitizeChannelKey(r.channel), instanceKey: String(r.instance_key) },
        ]),
      );

      const existingRows = await db.query(
        `SELECT channel_instance_id, active, price_amount, currency, vat_rate, category, sale_price, original_price
         FROM ${ChannelsModel.CHANNEL_OVERRIDES_TABLE}
         WHERE product_id = $1 AND channel_instance_id = ANY($2::int[])`,
        [pid, instanceIds],
      );
      const existingByInstanceId = new Map(
        existingRows.map((row) => [
          Number(row.channel_instance_id),
          {
            active: row.active === true,
            price: row.price_amount != null ? Number(row.price_amount) : null,
            cur: row.currency != null ? String(row.currency).trim().toUpperCase() : null,
            vat: row.vat_rate != null ? Number(row.vat_rate) : null,
            cat: row.category != null ? String(row.category).trim() : null,
            sale: row.sale_price != null ? Number(row.sale_price) : null,
            orig: row.original_price != null ? Number(row.original_price) : null,
          },
        ]),
      );

      const rows = [];
      for (const o of items) {
        const instId = Number(o.channelInstanceId);
        if (!Number.isFinite(instId) || instId < 1) continue;
        const inst = instMap.get(instId);
        if (!inst) continue;
        const ex = existingByInstanceId.get(instId);
        const has = (k) => Object.prototype.hasOwnProperty.call(o, k);
        const price = has('priceAmount')
          ? o.priceAmount != null &&
            Number.isFinite(Number(o.priceAmount)) &&
            Number(o.priceAmount) > 0
            ? Number(o.priceAmount)
            : null
          : (ex?.price ?? null);
        const vat = has('vatRate')
          ? o.vatRate != null && Number.isFinite(Number(o.vatRate))
            ? Number(o.vatRate)
            : null
          : (ex?.vat ?? null);
        const cur = has('currency')
          ? o.currency != null && String(o.currency).trim()
            ? String(o.currency).trim().toUpperCase()
            : null
          : (ex?.cur ?? null);
        const cat = has('category')
          ? o.category != null && String(o.category).trim()
            ? String(o.category).trim()
            : null
          : (ex?.cat ?? null);
        const sale = has('salePrice')
          ? o.salePrice != null &&
            Number.isFinite(Number(o.salePrice)) &&
            Number(o.salePrice) > 0
            ? Number(o.salePrice)
            : null
          : (ex?.sale ?? null);
        const orig = has('originalPrice')
          ? o.originalPrice != null &&
            Number.isFinite(Number(o.originalPrice)) &&
            Number(o.originalPrice) > 0
            ? Number(o.originalPrice)
            : null
          : (ex?.orig ?? null);
        rows.push({
          instId,
          ch: inst.channel,
          instanceKey: inst.instanceKey,
          active: has('active') ? !!o.active : (ex?.active ?? false),
          price,
          cur,
          vat,
          cat,
          sale,
          orig,
        });
      }
      if (rows.length === 0) return { ok: true, count: 0 };

      const rowsToWrite = rows.filter((row) => {
        const existingRow = existingByInstanceId.get(row.instId);
        if (!existingRow) {
          return true;
        }
        return !(
          existingRow.active === row.active &&
          existingRow.price === row.price &&
          existingRow.cur === row.cur &&
          existingRow.vat === row.vat &&
          existingRow.cat === row.cat &&
          existingRow.sale === row.sale &&
          existingRow.orig === row.orig
        );
      });
      if (rowsToWrite.length === 0) {
        return { ok: true, count: 0 };
      }

      const values = [];
      const params = [pid];
      let idx = 2;
      for (const r of rowsToWrite) {
        values.push(
          `($1, $${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        );
        params.push(
          r.ch,
          r.instanceKey,
          r.instId,
          r.active,
          r.price,
          r.cur,
          r.vat,
          r.cat,
          r.sale,
          r.orig,
        );
        idx += 10;
      }
      await db.query(
        `INSERT INTO ${ChannelsModel.CHANNEL_OVERRIDES_TABLE}
          (product_id, channel, instance, channel_instance_id, active, price_amount, currency, vat_rate, category, sale_price, original_price, created_at, updated_at)
         VALUES ${values.join(', ')}
         ON CONFLICT (product_id, channel, instance) DO UPDATE SET
          channel_instance_id = EXCLUDED.channel_instance_id,
          active = EXCLUDED.active,
          price_amount = EXCLUDED.price_amount,
          currency = EXCLUDED.currency,
          vat_rate = EXCLUDED.vat_rate,
          category = EXCLUDED.category,
          sale_price = EXCLUDED.sale_price,
          original_price = EXCLUDED.original_price,
          updated_at = CURRENT_TIMESTAMP`,
        params,
      );
      return { ok: true, count: rowsToWrite.length };
    } catch (error) {
      Logger.error('Failed to upsert product overrides bulk', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to upsert product overrides', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ---------- Import template (CSV) ----------
  async buildImportTemplateCsv(req) {
    try {
      const instances = await this.listInstances(req);

      // Core product columns (stable). Texter per land → channelSpecific.textsExtended (see products import).
      const baseCols = [
        'sku',
        'title.se',
        'description.se',
        'title.dk',
        'description.dk',
        'title.fi',
        'description.fi',
        'title.no',
        'description.no',
        'textsStandard',
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
