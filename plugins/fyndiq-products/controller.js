// plugins/fyndiq-products/controller.js
// Fyndiq connector controller: settings + connection test + export (API) + safe local mapping updates.

const { Logger, Context, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const OrdersModel = require('../orders/model');
const {
  mapProductToFyndiqArticle,
  getFyndiqArticleInputIssues,
  validateFyndiqArticlePayload,
} = require('./mapToFyndiqArticle');
const { fetchCategoriesFromApi: fetchCategoriesFromApiModule } = require('./fetchCategories');

const FYNDIQ_CURRENCY_BY_MARKET = { se: 'SEK', dk: 'DKK', fi: 'EUR', no: 'NOK' };

class FyndiqProductsController {
  constructor(model) {
    this.model = model;
    this.ordersModel = new OrdersModel();
  }

  // --------- Helpers ---------

  getFetch() {
    return typeof fetch === 'function'
      ? fetch
      : async (...args) => {
          const mod = await import('node-fetch').catch(() => null);
          if (!mod?.default)
            throw new Error('fetch is not available (Node <18) and node-fetch is not installed');
          return mod.default(...args);
        };
  }

  getBasicAuthHeader(username, password) {
    const u = String(username ?? '').trim();
    const p = String(password ?? '').trim();
    if (!u || !p) return '';
    const token = Buffer.from(`${u}:${p}`, 'utf8').toString('base64');
    return `Basic ${token}`;
  }

  async fyndiqRequest(path, { username, password, method = 'GET', body, headers = {} } = {}) {
    const fetchFn = this.getFetch();
    const auth = this.getBasicAuthHeader(username, password);
    if (!auth && (username != null || password != null)) {
      throw new Error('Fyndiq auth: username and password must both be non-empty.');
    }
    const headersObj = new Headers();
    headersObj.set('Accept', 'application/json');
    if (method !== 'GET') headersObj.set('Content-Type', 'application/json');
    if (auth) headersObj.set('Authorization', auth);
    headersObj.set('X-Client-Name', 'homebase');
    for (const [k, v] of Object.entries(headers)) {
      if (v != null && v !== '') headersObj.set(k, String(v));
    }
    const url = `https://merchants-api.fyndiq.se${path}`;
    const maxRedirects = 5;
    let resp = await fetchFn(url, {
      method,
      headers: headersObj,
      body,
      redirect: 'manual',
    });
    let text = await resp.text().catch(() => '');
    for (let i = 0; i < maxRedirects && [301, 302, 307, 308].includes(resp.status); i++) {
      const location = resp.headers.get('Location');
      if (!location) break;
      const nextHeaders = new Headers();
      headersObj.forEach((v, k) => nextHeaders.set(k, v));
      resp = await fetchFn(location, { method, headers: nextHeaders, body, redirect: 'manual' });
      text = await resp.text().catch(() => '');
    }
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return { url, resp, text, json };
  }

  async getSettings(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      return res.json(settings || null);
    } catch (error) {
      Logger.error('Get Fyndiq settings error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to fetch Fyndiq settings' });
    }
  }

  async putSettings(req, res) {
    try {
      const saved = await this.model.upsertSettings(req, req.body || {});
      return res.json(saved);
    } catch (error) {
      Logger.error('Save Fyndiq settings error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to save Fyndiq settings' });
    }
  }

  // ---- Categories (read-only). API requires market and language; no guessing. ----
  async getCategories(req, res) {
    try {
      const market = String(req.query?.market || '')
        .trim()
        .toLowerCase();
      const language = String(req.query?.language || '').trim();
      if (!market || !language) {
        return res.status(400).json({
          ok: false,
          error:
            'market and language are required. Use query params: ?market=se&language=sv-SE (per Fyndiq API).',
        });
      }

      const settings = await this.model.getSettings(req);
      const username = String(settings?.apiKey ?? '').trim();
      const password = String(settings?.apiSecret ?? '').trim();
      if (!username || !password) {
        return res
          .status(400)
          .json({ ok: false, error: 'Fyndiq settings not found. Save settings first.' });
      }

      const items = await fetchCategoriesFromApiModule(market, language, username, password);
      return res.json({ ok: true, items });
    } catch (error) {
      Logger.error('Fyndiq getCategories error', error, { userId: Context.getUserId(req) });
      const detail = error?.message || String(error);
      if (detail?.includes('credentials') || detail?.includes('401')) {
        return res.status(502).json({
          ok: false,
          error:
            'Fyndiq API rejected credentials. Check username and password in Fyndiq Products plugin settings.',
          detail: detail || 'Missing Authorization header',
        });
      }
      return res.status(502).json({
        ok: false,
        error: 'Failed to fetch Fyndiq categories',
        detail: detail || 'Unknown error',
      });
    }
  }

  async _getSettingsOr400(req, res) {
    const settings = await this.model.getSettings(req);
    if (!settings?.apiKey || !settings?.apiSecret) {
      res.status(400).json({ ok: false, error: 'Fyndiq settings not found. Save settings first.' });
      return null;
    }
    return settings;
  }

  async _forwardFyndiq(req, res, path, opts = {}) {
    try {
      const settings = await this._getSettingsOr400(req, res);
      if (!settings) return;
      const { url, resp, text, json } = await this.fyndiqRequest(path, {
        username: settings.apiKey,
        password: settings.apiSecret,
        method: opts.method || 'GET',
        body: opts.body,
      });
      const status = resp.status;
      if (json !== null) return res.status(status).json(json);
      return res.status(status).send(text || undefined);
    } catch (error) {
      Logger.error('Fyndiq API forward error', error, { userId: Context.getUserId(req), path });
      return res
        .status(502)
        .json({ ok: false, error: 'Fyndiq request failed', detail: error?.message });
    }
  }

  async createArticle(req, res) {
    const body = req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : undefined;
    return this._forwardFyndiq(req, res, '/api/v1/articles', { method: 'POST', body });
  }

  async bulkCreateArticles(req, res) {
    const body =
      req.body != null
        ? Array.isArray(req.body)
          ? JSON.stringify(req.body)
          : JSON.stringify(req.body)
        : undefined;
    return this._forwardFyndiq(req, res, '/api/v1/articles/bulk', { method: 'POST', body });
  }

  async listArticles(req, res) {
    const limit = req.query?.limit != null ? String(req.query.limit) : '';
    const page = req.query?.page != null ? String(req.query.page) : '';
    const for_sale = req.query?.for_sale;
    const q = new URLSearchParams();
    if (limit) q.set('limit', limit);
    if (page) q.set('page', page);
    if (for_sale !== undefined && for_sale !== '') q.set('for_sale', String(for_sale));
    const path = '/api/v1/articles' + (q.toString() ? `?${q.toString()}` : '');
    return this._forwardFyndiq(req, res, path);
  }

  async getArticle(req, res) {
    const articleId = req.params?.articleId;
    if (!articleId) return res.status(400).json({ ok: false, error: 'Missing articleId' });
    return this._forwardFyndiq(req, res, `/api/v1/articles/${encodeURIComponent(articleId)}`);
  }

  async getArticleBySku(req, res) {
    const sku = req.params?.sku;
    if (!sku) return res.status(400).json({ ok: false, error: 'Missing sku' });
    return this._forwardFyndiq(req, res, `/api/v1/articles/sku/${encodeURIComponent(sku)}`);
  }

  async updateArticle(req, res) {
    const articleId = req.params?.articleId;
    if (!articleId) return res.status(400).json({ ok: false, error: 'Missing articleId' });
    const body = req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : undefined;
    return this._forwardFyndiq(req, res, `/api/v1/articles/${encodeURIComponent(articleId)}`, {
      method: 'PUT',
      body,
    });
  }

  async updateArticlePrice(req, res) {
    const articleId = req.params?.articleId;
    if (!articleId) return res.status(400).json({ ok: false, error: 'Missing articleId' });
    const body = req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : undefined;
    return this._forwardFyndiq(
      req,
      res,
      `/api/v1/articles/${encodeURIComponent(articleId)}/price`,
      { method: 'PUT', body },
    );
  }

  async updateArticleQuantity(req, res) {
    const articleId = req.params?.articleId;
    if (!articleId) return res.status(400).json({ ok: false, error: 'Missing articleId' });
    const body = req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : undefined;
    return this._forwardFyndiq(
      req,
      res,
      `/api/v1/articles/${encodeURIComponent(articleId)}/quantity`,
      { method: 'PUT', body },
    );
  }

  /**
   * Push stock quantity to Fyndiq for one product (used by orders pushStockToChannels).
   * @param {object} req - request with session
   * @param {{ productId: string, articleId: string, quantity: number }} opts
   * @returns {{ ok: boolean, error?: string }}
   */
  async syncStock(req, { productId, articleId, quantity }) {
    const id = String(articleId ?? '').trim();
    if (!id) {
      return { ok: false, error: 'Missing Fyndiq article ID for stock sync' };
    }
    const settings = await this.model.getSettings(req);
    if (!settings?.apiKey || !settings?.apiSecret) {
      return { ok: false, error: 'Fyndiq settings not found' };
    }
    const qty = Math.max(0, Math.min(500_000, Math.trunc(Number(quantity))));
    const path = `/api/v1/articles/${encodeURIComponent(id)}/quantity`;
    const { resp, text, json } = await this.fyndiqRequest(path, {
      username: settings.apiKey,
      password: settings.apiSecret,
      method: 'PUT',
      body: JSON.stringify({ quantity: qty }),
    });
    if (!resp.ok) {
      const errMsg = json?.errors
        ? Object.values(json.errors).flat().join(', ')
        : json?.description || text || `HTTP ${resp.status}`;
      return { ok: false, error: errMsg };
    }
    return { ok: true };
  }

  /**
   * Fyndiq PUT /api/v1/articles/bulk — up to 200 update_article_quantity requests per call (plan).
   * @param {object} req
   * @param {Array<{ articleId: string, quantity: number, productId?: string }>} items
   * @returns {{ failures: Array<{ productId?: string, articleId: string, error: string }> }}
   */
  async syncStockBulk(req, items) {
    const failures = [];
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      return { failures };
    }
    const settings = await this.model.getSettings(req);
    if (!settings?.apiKey || !settings?.apiSecret) {
      for (const it of list) {
        failures.push({
          productId: it.productId,
          articleId: String(it.articleId || ''),
          error: 'Fyndiq settings not found',
        });
      }
      return { failures };
    }
    const chunkSize = 200;
    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize);
      const payload = [];
      for (const it of chunk) {
        const id = String(it.articleId ?? '').trim();
        const qty = Math.max(0, Math.min(500_000, Math.trunc(Number(it.quantity))));
        if (!id) {
          failures.push({
            productId: it.productId,
            articleId: '',
            error: 'Missing Fyndiq article ID for stock sync',
          });
          continue;
        }
        payload.push({
          action: 'update_article_quantity',
          id,
          body: { quantity: qty },
        });
      }
      if (!payload.length) {
        continue;
      }
      const { resp, text, json } = await this.fyndiqRequest('/api/v1/articles/bulk', {
        username: settings.apiKey,
        password: settings.apiSecret,
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const responses = Array.isArray(json?.responses) ? json.responses : [];
      if (!resp.ok) {
        const errMsg =
          json?.description ||
          (json?.errors ? JSON.stringify(json.errors) : null) ||
          text ||
          `HTTP ${resp.status}`;
        for (let j = 0; j < payload.length; j++) {
          const p = payload[j];
          const orig = chunk.find((c) => String(c.articleId || '').trim() === p.id);
          failures.push({
            productId: orig?.productId,
            articleId: p.id,
            error: errMsg,
          });
        }
        continue;
      }
      for (let j = 0; j < payload.length; j++) {
        const p = payload[j];
        const r = responses[j];
        const statusCode = r?.status_code ?? r?.statusCode;
        if (statusCode != null && Number(statusCode) >= 400) {
          const orig = chunk.find((c) => String(c.articleId || '').trim() === p.id);
          const msg =
            r?.description ||
            (r?.errors ? JSON.stringify(r.errors) : null) ||
            `Fyndiq bulk status ${statusCode}`;
          failures.push({
            productId: orig?.productId,
            articleId: p.id,
            error: msg,
          });
        }
      }
    }
    return { failures };
  }

  async bulkUpdateArticles(req, res) {
    const body =
      req.body != null
        ? Array.isArray(req.body)
          ? JSON.stringify(req.body)
          : JSON.stringify(req.body)
        : undefined;
    return this._forwardFyndiq(req, res, '/api/v1/articles/bulk', { method: 'PUT', body });
  }

  async deleteArticle(req, res) {
    const articleId = req.params?.articleId;
    if (!articleId) return res.status(400).json({ ok: false, error: 'Missing articleId' });
    return this._forwardFyndiq(req, res, `/api/v1/articles/${encodeURIComponent(articleId)}`, {
      method: 'DELETE',
    });
  }

  async testConnection(req, res) {
    try {
      const inBody = req.body || {};
      const settings = inBody.apiKey
        ? {
            apiKey: String(inBody.apiKey || '').trim(),
            apiSecret: String(inBody.apiSecret || '').trim(),
          }
        : await this.model.getSettings(req);

      if (!settings?.apiKey || !settings?.apiSecret) {
        return res
          .status(400)
          .json({ ok: false, error: 'Missing Fyndiq credentials (apiKey, apiSecret).' });
      }

      // Validate credentials by hitting a simple authenticated endpoint
      const { url, resp, text, json } = await this.fyndiqRequest('/api/v1/merchant', {
        username: settings.apiKey,
        password: settings.apiSecret,
        method: 'GET',
      });

      if (resp.status === 401 || resp.status === 403) {
        return res
          .status(401)
          .json({ ok: false, status: resp.status, error: 'Unauthorized (check user/password)' });
      }

      if (!resp.ok) {
        return res.status(resp.status).json({
          ok: false,
          status: resp.status,
          error: 'Fyndiq API error',
          endpoint: url,
          detail: json || text || resp.statusText,
        });
      }

      return res.json({
        ok: true,
        status: resp.status,
        endpoint: url,
        message: 'Fyndiq API reachable and credentials accepted.',
      });
    } catch (error) {
      Logger.error('Fyndiq test connection error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to test Fyndiq connection' });
    }
  }

  // POST /api/fyndiq-products/products/export
  async exportProducts(req, res) {
    try {
      const mode = String(req.body?.mode || '')
        .trim()
        .toLowerCase();
      const dryRun = req.body?.dryRun === true;
      const diagnose = req.body?.diagnose === true;
      const includePriceAndQuantity = req.body?.includePriceAndQuantity !== false;
      if (mode === 'update_only_strict') {
        return this.exportProductsUpdateOnlyStrict(req, res);
      }

      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) {
        return res.status(400).json({ error: 'Fyndiq settings not found. Save settings first.' });
      }

      const products = Array.isArray(req.body?.products) ? req.body.products : null;
      if (!products || products.length === 0) {
        return res.status(400).json({ error: 'Request must include products: []' });
      }

      const allowedMarkets = ['se', 'dk', 'fi', 'no'];
      let marketsFilter = allowedMarkets;
      if (Array.isArray(req.body?.markets) && req.body.markets.length > 0) {
        const normalized = req.body.markets
          .map((m) => String(m).toLowerCase())
          .filter((m) => allowedMarkets.includes(m));
        if (normalized.length) marketsFilter = normalized;
      }

      const userId = req.session?.user?.id;
      if (!userId) return res.status(401).json({ error: 'User not authenticated' });

      const diagnoseTrace = diagnose
        ? { productIds: [], overrideRows: [], mapRows: [], perProduct: {} }
        : null;

      // Load per-instance overrides (Selloklon): active/price/currency/category per market instance.
      const db = Database.get(req);
      const productIds = Array.from(
        new Set(products.map((p) => String(p?.id || '').trim()).filter(Boolean)),
      );
      if (diagnoseTrace) diagnoseTrace.productIds = productIds;

      const overridesByProductId = new Map(); // productId -> market -> override

      if (productIds.length) {
        const rows = await db.query(
          `
          SELECT
            o.product_id::text AS product_id,
            COALESCE(ci.market, NULL) AS market,
            ci.instance_key,
            o.active,
            o.price_amount,
            o.currency,
            o.vat_rate,
            o.category,
            o.original_price
          FROM channel_product_overrides o
          LEFT JOIN channel_instances ci
            ON ci.id = o.channel_instance_id
          WHERE o.channel = 'fyndiq'
            AND o.product_id::text = ANY($1::text[])
          `,
          [productIds],
        );
        if (diagnoseTrace) diagnoseTrace.overrideRows = rows.map((r) => ({ ...r }));

        for (const r of rows) {
          const pid = String(r.product_id);
          const instKey = r.instance_key != null ? String(r.instance_key).trim() : null;
          const market = r.market != null ? String(r.market).trim().toLowerCase() : null;
          const currency = r.currency != null ? String(r.currency).trim().toUpperCase() : null;

          // Only use overrides with explicit market (no inferring market from currency).
          if (!market || !['se', 'dk', 'fi', 'no'].includes(market)) continue;

          if (!overridesByProductId.has(pid)) overridesByProductId.set(pid, {});
          overridesByProductId.get(pid)[market] = {
            instanceKey: instKey,
            active: !!r.active,
            priceAmount: r.price_amount != null ? Number(r.price_amount) : null,
            currency,
            vatRate: r.vat_rate != null ? Number(r.vat_rate) : null,
            category: r.category != null ? String(r.category).trim() : null,
            originalPrice:
              r.original_price != null && Number.isFinite(Number(r.original_price))
                ? Number(r.original_price)
                : null,
          };
        }

        // Also consider channel_product_map (enabled): if user enabled product for a Fyndiq market
        // in Kanaler and saved, map is updated but overrides may not have active=true yet.
        // So treat enabled map rows as active for that market (merge into overrides so mapper sees it).
        // For map rows with channel_instance_id set: get market from channel_instances.
        // For map rows with channel_instance_id NULL: get active markets from channel_product_overrides.
        const mapRows = await db.query(
          `
          SELECT
            m.product_id::text AS product_id,
            LOWER(TRIM(ci.market)) AS market
          FROM channel_product_map m
          LEFT JOIN channel_instances ci ON ci.id = m.channel_instance_id
          WHERE m.channel = 'fyndiq'
            AND m.enabled = TRUE
            AND m.product_id::text = ANY($1::text[])
            AND TRIM(COALESCE(ci.market, '')) <> ''
          UNION
          SELECT
            o.product_id::text AS product_id,
            LOWER(TRIM(ci.market)) AS market
          FROM channel_product_map m
          INNER JOIN channel_product_overrides o
            ON o.product_id::text = m.product_id::text
            AND o.channel = 'fyndiq' AND o.active = TRUE AND o.channel_instance_id IS NOT NULL
          INNER JOIN channel_instances ci ON ci.id = o.channel_instance_id
          WHERE m.channel = 'fyndiq'
            AND m.enabled = TRUE
            AND m.channel_instance_id IS NULL
            AND m.product_id::text = ANY($1::text[])
            AND TRIM(COALESCE(ci.market, '')) <> ''
          `,
          [productIds],
        );
        if (diagnoseTrace) diagnoseTrace.mapRows = mapRows.map((r) => ({ ...r }));

        for (const r of mapRows) {
          const pid = String(r.product_id);
          const market = r.market != null ? String(r.market).trim().toLowerCase() : null;
          if (!market || !allowedMarkets.includes(market)) continue;
          if (!overridesByProductId.has(pid)) overridesByProductId.set(pid, {});
          const perMarket = overridesByProductId.get(pid);
          if (!perMarket[market]) {
            perMarket[market] = {
              instanceKey: null,
              active: true,
              priceAmount: null,
              currency: null,
              vatRate: null,
              category: null,
              originalPrice: null,
            };
          } else {
            perMarket[market].active = perMarket[market].active || true;
          }
        }
      }

      const mappedArticlesByProductId = new Map();
      if (productIds.length) {
        const articleIdRows = await db.query(
          `
          SELECT
            product_id::text AS product_id,
            external_id
          FROM channel_product_map
          WHERE channel = 'fyndiq'
            AND channel_instance_id IS NULL
            AND product_id::text = ANY($1::text[])
            AND external_id IS NOT NULL
            AND TRIM(external_id) <> ''
          `,
          [productIds],
        );
        for (const row of articleIdRows) {
          const productId = String(row.product_id || '').trim();
          const articleId = row.external_id != null ? String(row.external_id).trim() : '';
          if (!productId || !articleId || mappedArticlesByProductId.has(productId)) continue;
          mappedArticlesByProductId.set(productId, articleId);
        }
      }

      // Build one Fyndiq article payload per product via mapper (exact API shape; no guessing).
      const defaultLanguage = 'sv-SE';
      const payloadsWithMeta = [];
      const items = [];
      let expectedSkip = 0;

      for (const p of products) {
        const productId = String(p?.id || '').trim();
        if (!productId) continue;

        const overrides = overridesByProductId.get(productId) || {};
        const hasActiveTarget = Object.entries(overrides).some(([market, data]) => {
          if (!allowedMarkets.includes(String(market).toLowerCase())) return false;
          return data && data.active === true;
        });
        if (!hasActiveTarget) {
          expectedSkip += 1;
          if (diagnoseTrace) {
            diagnoseTrace.perProduct[productId] = {
              skip: 'no_active_channel_market',
              overrides: Object.fromEntries(
                Object.entries(overrides).map(([k, v]) => [k, { ...v }]),
              ),
              marketsFilter,
            };
          }
          Logger.info('Fyndiq export skip (no active market)', {
            productId,
            marketsFilter,
            overrideMarkets: Object.keys(overrides),
          });
          items.push({
            productId,
            sku: p?.sku || null,
            status: 'expected_skip',
            reason: 'no_active_channel_market',
          });
          continue;
        }
        const payload = mapProductToFyndiqArticle(p, overrides, defaultLanguage);

        if (!payload) {
          const issues = getFyndiqArticleInputIssues(p, overrides, defaultLanguage);
          const reason = issues.length ? issues.join(',') : 'mapper_rejected_unknown';
          if (diagnoseTrace) {
            diagnoseTrace.perProduct[productId] = {
              skip: 'mapper_rejected',
              reason,
              issues,
              overrides: Object.fromEntries(
                Object.entries(overrides).map(([k, v]) => [k, { ...v }]),
              ),
            };
          }
          Logger.warn('Fyndiq export mapper rejected', { productId, reason, issues });
          if (!dryRun) {
            await this.model.upsertChannelMap(req, {
              productId,
              channel: 'fyndiq',
              enabled: true,
              externalId: null,
              status: 'error',
              error: `mapper_rejected:${reason}`,
            });
          }
          items.push({
            productId,
            sku: p?.sku || null,
            status: 'error',
            error: `mapper_rejected:${reason}`,
          });
          continue;
        }
        const payloadCheck = validateFyndiqArticlePayload(payload);
        if (!payloadCheck.ok) {
          if (!dryRun) {
            await this.model.upsertChannelMap(req, {
              productId,
              channel: 'fyndiq',
              enabled: true,
              externalId: null,
              status: 'error',
              error: `contract_validation_failed:${payloadCheck.reason}`,
            });
          }
          items.push({
            productId,
            sku: p?.sku || null,
            status: 'error',
            error: `contract_validation_failed:${payloadCheck.reason}`,
          });
          continue;
        }

        if (diagnoseTrace) {
          diagnoseTrace.perProduct[productId] = {
            ok: true,
            exportMode: mappedArticlesByProductId.has(productId) ? 'direct_update' : 'create',
            payloadMarkets: payload.markets,
            payloadCategories: payload.categories,
          };
        }
        payloadsWithMeta.push({ productId, sku: payload.sku, payload });
        items.push({ productId, sku: payload.sku, status: 'queued' });
      }

      const preflight = {
        requested: products.length,
        ready: payloadsWithMeta.length,
        validation_error: items.filter((x) => x.status === 'error').length,
        expected_skip: expectedSkip,
      };
      if (dryRun) {
        return res.json({
          ok: true,
          channel: 'fyndiq',
          mode: 'phase2_preflight',
          dryRun: true,
          counts: preflight,
          items,
        });
      }

      if (payloadsWithMeta.length === 0) {
        const errResponse = {
          ok: false,
          error:
            'No products to export (mapper rejected all; check required fields and categories)',
          counts: {
            requested: products.length,
            success: 0,
            error: preflight.validation_error,
            skipped: 0,
            expected_skip: expectedSkip,
          },
          items,
        };
        if (diagnoseTrace) errResponse.diagnose = diagnoseTrace;
        Logger.warn('Fyndiq export: no products to send', {
          userId: Context.getUserId(req),
          counts: errResponse.counts,
        });
        return res.status(400).json(errResponse);
      }

      const putAllowed = [
        'sku',
        'parent_sku',
        'legacy_product_id',
        'status',
        'categories',
        'properties',
        'variational_properties',
        'brand',
        'gtin',
        'main_image',
        'images',
        'markets',
        'title',
        'description',
        'shipping_time',
        'kn_number',
        'internal_note',
        'delivery_type',
      ];
      const buildArticlePayload = (payload) => {
        const articlePayload = {};
        for (const key of putAllowed) {
          if (payload[key] !== undefined) {
            articlePayload[key] = payload[key];
          }
        }
        return articlePayload;
      };
      const markItemResult = (productId, success, errMsg) => {
        const it = items.find((x) => x.productId === productId && x.status === 'queued');
        if (it) {
          it.status = success ? 'success' : 'error';
          if (!success && errMsg) it.error = errMsg;
        }
      };
      const uuidV4Like =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      const createPayloadsWithMeta = [];
      const updatePayloadsWithMeta = [];
      for (const entry of payloadsWithMeta) {
        const mappedArticleId = mappedArticlesByProductId.get(entry.productId) || null;
        if (mappedArticleId) {
          updatePayloadsWithMeta.push({ ...entry, articleId: mappedArticleId });
        } else {
          createPayloadsWithMeta.push(entry);
        }
      }

      let bulkCreateResult = null;
      if (createPayloadsWithMeta.length > 0) {
        const bulkPayload = createPayloadsWithMeta.map((x) => x.payload);
        bulkCreateResult = await this.fyndiqRequest('/api/v1/articles/bulk', {
          username: settings.apiKey,
          password: settings.apiSecret,
          method: 'POST',
          body: JSON.stringify(bulkPayload),
        });

        const responses =
          bulkCreateResult.json && Array.isArray(bulkCreateResult.json.responses)
            ? bulkCreateResult.json.responses
            : [];
        for (let i = 0; i < createPayloadsWithMeta.length; i++) {
          const { productId, sku } = createPayloadsWithMeta[i];
          const payload = bulkPayload[i] || null;
          let r = responses[i];
          const statusCode = r?.status_code != null ? Number(r.status_code) : null;
          // Bulk create success: item has id+description (no status_code); failure: status_code 400/409 etc.
          let success =
            statusCode === 202 ||
            (bulkCreateResult.resp.ok && r?.id != null && r?.description != null);
          let errMsg = success
            ? null
            : r?.description != null
              ? String(r.description)
              : r?.errors
                ? JSON.stringify(r.errors)
                : bulkCreateResult.resp.ok
                  ? null
                  : 'Export failed';
          let resolvedArticleId = success && r?.id ? String(r.id).trim() : null;

          if (!success && statusCode != null) {
            Logger.info('Fyndiq export item response', {
              productId,
              statusCode,
              description: r?.description,
              errors: r?.errors,
            });
          }

          // 409 = SKU already used: article exists on Fyndiq. Get article_id (from response or by SKU), then PUT to update article, price and quantity.
          if (!success && statusCode === 409 && payload) {
            let articleId =
              r?.errors?.article_id != null ? String(r.errors.article_id).trim() : null;
            if (!articleId && payload.sku) {
              const getResp = await this.fyndiqRequest(
                `/api/v1/articles/sku/${encodeURIComponent(String(payload.sku))}`,
                {
                  username: settings.apiKey,
                  password: settings.apiSecret,
                  method: 'GET',
                },
              );
              if (diagnoseTrace?.perProduct?.[productId]) {
                diagnoseTrace.perProduct[productId].getBySku = {
                  status: getResp.resp?.status,
                  hasArticleId: !!getResp.json?.content?.article?.id,
                };
              }
              Logger.info('Fyndiq GET by SKU (after 409)', {
                productId,
                sku: payload.sku,
                getStatus: getResp.resp?.status,
                hasArticleId: !!getResp.json?.content?.article?.id,
              });
              if (getResp.resp.ok && getResp.json?.content?.article?.id) {
                articleId = String(getResp.json.content.article.id).trim();
              }
            }
            if (articleId) {
              resolvedArticleId = articleId;
              const articlePayload = buildArticlePayload(payload);
              const putResp = await this.fyndiqRequest(
                `/api/v1/articles/${encodeURIComponent(articleId)}`,
                {
                  username: settings.apiKey,
                  password: settings.apiSecret,
                  method: 'PUT',
                  body: JSON.stringify(articlePayload),
                },
              );
              const putOk =
                putResp.resp.ok ||
                putResp.resp.status === 200 ||
                putResp.resp.status === 202 ||
                putResp.resp.status === 204;
              if (diagnoseTrace?.perProduct?.[productId]) {
                diagnoseTrace.perProduct[productId].putAfter409 = {
                  articleId,
                  status: putResp.resp?.status,
                  ok: putOk,
                  error: putOk ? null : putResp.json?.description || putResp.json?.errors,
                };
              }
              Logger.info('Fyndiq PUT (after 409)', {
                productId,
                articleId,
                putStatus: putResp.resp?.status,
                putOk,
                putError: putOk ? null : putResp.json?.description || putResp.json?.errors,
              });
              if (putOk) {
                const { price, original_price } = payload;
                if (includePriceAndQuantity && price && Array.isArray(price) && price.length > 0) {
                  const priceBody = { price };
                  if (
                    original_price &&
                    Array.isArray(original_price) &&
                    original_price.length > 0
                  ) {
                    priceBody.original_price = original_price;
                  }
                  const priceResp = await this.fyndiqRequest(
                    `/api/v1/articles/${encodeURIComponent(articleId)}/price`,
                    {
                      username: settings.apiKey,
                      password: settings.apiSecret,
                      method: 'PUT',
                      body: JSON.stringify(priceBody),
                    },
                  );
                  const priceOk =
                    priceResp.resp.ok ||
                    priceResp.resp.status === 200 ||
                    priceResp.resp.status === 204;
                  if (diagnoseTrace?.perProduct?.[productId]) {
                    diagnoseTrace.perProduct[productId].putPrice = {
                      status: priceResp.resp?.status,
                      ok: priceOk,
                      error: priceOk ? null : priceResp.json?.description || priceResp.json?.errors,
                    };
                  }
                  if (!priceOk) {
                    errMsg =
                      priceResp.json?.description ||
                      (priceResp.json?.errors ? JSON.stringify(priceResp.json.errors) : null) ||
                      `Price update failed (${priceResp.resp.status})`;
                    success = false;
                  }
                }
                if (
                  success !== false &&
                  includePriceAndQuantity &&
                  Number.isInteger(Number(payload.quantity)) &&
                  Number(payload.quantity) >= 0
                ) {
                  const quantityResp = await this.fyndiqRequest(
                    `/api/v1/articles/${encodeURIComponent(articleId)}/quantity`,
                    {
                      username: settings.apiKey,
                      password: settings.apiSecret,
                      method: 'PUT',
                      body: JSON.stringify({ quantity: Math.trunc(Number(payload.quantity)) }),
                    },
                  );
                  const quantityOk =
                    quantityResp.resp.ok ||
                    quantityResp.resp.status === 200 ||
                    quantityResp.resp.status === 204;
                  if (diagnoseTrace?.perProduct?.[productId]) {
                    diagnoseTrace.perProduct[productId].putQuantity = {
                      status: quantityResp.resp?.status,
                      ok: quantityOk,
                      error: quantityOk
                        ? null
                        : quantityResp.json?.description || quantityResp.json?.errors,
                    };
                  }
                  if (!quantityOk) {
                    errMsg =
                      quantityResp.json?.description ||
                      (quantityResp.json?.errors
                        ? JSON.stringify(quantityResp.json.errors)
                        : null) ||
                      `Quantity update failed (${quantityResp.resp.status})`;
                    success = false;
                  }
                }
                if (success !== false) {
                  success = true;
                  errMsg = null;
                }
              } else {
                errMsg =
                  putResp.json?.description ||
                  (putResp.json?.errors ? JSON.stringify(putResp.json.errors) : null) ||
                  `Update failed (${putResp.resp.status})`;
                r = putResp.json || r;
              }
            }
          }

          await this.model.upsertChannelMap(req, {
            productId,
            channel: 'fyndiq',
            enabled: true,
            externalId: resolvedArticleId || null,
            status: success ? 'success' : 'error',
            error: errMsg,
          });
          markItemResult(productId, success, errMsg);
          if (!success && errMsg) {
            await this.model.logChannelError(req, {
              channel: 'fyndiq',
              productId,
              payload,
              response: r,
              message: errMsg,
            });
          }
        }
      }

      for (const { productId, articleId, payload } of updatePayloadsWithMeta) {
        let success = true;
        let errMsg = null;
        let responsePayload = null;
        const resolvedArticleId = String(articleId || '').trim();
        if (!uuidV4Like.test(resolvedArticleId)) {
          success = false;
          errMsg = 'invalid_article_id';
        }

        const articlePayload = buildArticlePayload(payload);
        if (success) {
          const putResp = await this.fyndiqRequest(
            `/api/v1/articles/${encodeURIComponent(resolvedArticleId)}`,
            {
              username: settings.apiKey,
              password: settings.apiSecret,
              method: 'PUT',
              body: JSON.stringify(articlePayload),
            },
          );
          const putOk =
            putResp.resp.ok ||
            putResp.resp.status === 200 ||
            putResp.resp.status === 202 ||
            putResp.resp.status === 204;
          responsePayload = putResp.json;
          if (diagnoseTrace?.perProduct?.[productId]) {
            diagnoseTrace.perProduct[productId].directPut = {
              articleId: resolvedArticleId,
              status: putResp.resp?.status,
              ok: putOk,
              shippingTime: articlePayload.shipping_time ?? null,
              error: putOk ? null : putResp.json?.description || putResp.json?.errors,
            };
          }
          if (!putOk) {
            success = false;
            errMsg =
              putResp.json?.description ||
              (putResp.json?.errors ? JSON.stringify(putResp.json.errors) : null) ||
              `Update failed (${putResp.resp.status})`;
          }
        }

        if (
          success &&
          includePriceAndQuantity &&
          payload.price &&
          Array.isArray(payload.price) &&
          payload.price.length > 0
        ) {
          const priceBody = { price: payload.price };
          if (
            payload.original_price &&
            Array.isArray(payload.original_price) &&
            payload.original_price.length > 0
          ) {
            priceBody.original_price = payload.original_price;
          }
          const priceResp = await this.fyndiqRequest(
            `/api/v1/articles/${encodeURIComponent(resolvedArticleId)}/price`,
            {
              username: settings.apiKey,
              password: settings.apiSecret,
              method: 'PUT',
              body: JSON.stringify(priceBody),
            },
          );
          const priceOk =
            priceResp.resp.ok || priceResp.resp.status === 200 || priceResp.resp.status === 204;
          if (diagnoseTrace?.perProduct?.[productId]) {
            diagnoseTrace.perProduct[productId].directPrice = {
              status: priceResp.resp?.status,
              ok: priceOk,
              error: priceOk ? null : priceResp.json?.description || priceResp.json?.errors,
            };
          }
          if (!priceOk) {
            success = false;
            errMsg =
              priceResp.json?.description ||
              (priceResp.json?.errors ? JSON.stringify(priceResp.json.errors) : null) ||
              `Price update failed (${priceResp.resp.status})`;
            responsePayload = priceResp.json;
          }
        }

        if (
          success &&
          includePriceAndQuantity &&
          Number.isInteger(Number(payload.quantity)) &&
          Number(payload.quantity) >= 0
        ) {
          const quantityResp = await this.fyndiqRequest(
            `/api/v1/articles/${encodeURIComponent(resolvedArticleId)}/quantity`,
            {
              username: settings.apiKey,
              password: settings.apiSecret,
              method: 'PUT',
              body: JSON.stringify({ quantity: Math.trunc(Number(payload.quantity)) }),
            },
          );
          const quantityOk =
            quantityResp.resp.ok ||
            quantityResp.resp.status === 200 ||
            quantityResp.resp.status === 204;
          if (diagnoseTrace?.perProduct?.[productId]) {
            diagnoseTrace.perProduct[productId].directQuantity = {
              status: quantityResp.resp?.status,
              ok: quantityOk,
              error: quantityOk
                ? null
                : quantityResp.json?.description || quantityResp.json?.errors,
            };
          }
          if (!quantityOk) {
            success = false;
            errMsg =
              quantityResp.json?.description ||
              (quantityResp.json?.errors ? JSON.stringify(quantityResp.json.errors) : null) ||
              `Quantity update failed (${quantityResp.resp.status})`;
            responsePayload = quantityResp.json;
          }
        }

        await this.model.upsertChannelMap(req, {
          productId,
          channel: 'fyndiq',
          enabled: true,
          externalId: resolvedArticleId || null,
          status: success ? 'success' : 'error',
          error: errMsg,
        });
        markItemResult(productId, success, errMsg);
        if (!success && errMsg) {
          await this.model.logChannelError(req, {
            channel: 'fyndiq',
            productId,
            payload,
            response: responsePayload,
            message: errMsg,
          });
        }
      }

      const jsonResponse = {
        ok: true,
        endpoint: '/api/v1/articles/bulk',
        result: {
          create:
            bulkCreateResult != null
              ? {
                  status: bulkCreateResult.resp.status,
                  url: bulkCreateResult.url,
                  responses: bulkCreateResult.json?.responses,
                }
              : null,
          directUpdates: updatePayloadsWithMeta.length,
        },
        counts: {
          requested: products.length,
          success: items.filter((x) => x.status === 'success').length,
          error: items.filter((x) => x.status === 'error').length,
          skipped: items.filter((x) => x.status === 'skipped').length,
          expected_skip: expectedSkip,
        },
        items,
      };
      if (diagnoseTrace) {
        diagnoseTrace.bulkResponse =
          bulkCreateResult != null
            ? { status: bulkCreateResult.resp.status, responses: bulkCreateResult.json?.responses }
            : null;
        jsonResponse.diagnose = diagnoseTrace;
      }
      Logger.info('Fyndiq export completed', {
        userId: Context.getUserId(req),
        counts: jsonResponse.counts,
      });
      return res.json(jsonResponse);
    } catch (error) {
      Logger.error('Fyndiq export error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ error: 'Export to Fyndiq failed', detail: String(error?.message || error) });
    }
  }

  validateFyndiqUpdateActionEnvelope(action) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      return { ok: false, reason: 'invalid_action_envelope' };
    }
    const actionName = String(action.action || '').trim();
    if (!['update_article_price', 'update_article_quantity'].includes(actionName)) {
      return { ok: false, reason: 'unsupported_action' };
    }
    const id = String(action.id || '').trim();
    if (!id) {
      return { ok: false, reason: 'invalid_article_id' };
    }
    const uuidV4Like = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidV4Like.test(id)) {
      return { ok: false, reason: 'invalid_article_id' };
    }
    if (!action.body || typeof action.body !== 'object' || Array.isArray(action.body)) {
      return { ok: false, reason: 'missing_action_body' };
    }
    return { ok: true };
  }

  validateFyndiqPriceRows(rows, rowName) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, reason: `missing_${rowName}_rows` };
    }
    for (const row of rows) {
      const market = String(row?.market || '')
        .trim()
        .toLowerCase();
      if (!['se', 'dk', 'fi', 'no'].includes(market)) {
        return { ok: false, reason: `invalid_${rowName}_market` };
      }
      if (!row?.value || typeof row.value !== 'object' || Array.isArray(row.value)) {
        return { ok: false, reason: `missing_${rowName}_value` };
      }
      const amount = Number(row.value.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return { ok: false, reason: `invalid_${rowName}_amount` };
      }
      const currency = String(row.value.currency || '')
        .trim()
        .toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) {
        return { ok: false, reason: `invalid_${rowName}_currency` };
      }
      if (row.value.vat_rate != null) {
        return { ok: false, reason: `unexpected_${rowName}_vat_rate` };
      }
    }
    return { ok: true };
  }

  validateFyndiqUpdateArticlePriceAction(action) {
    const envelope = this.validateFyndiqUpdateActionEnvelope(action);
    if (!envelope.ok) return envelope;
    const priceCheck = this.validateFyndiqPriceRows(action.body.price, 'price');
    if (!priceCheck.ok) return priceCheck;
    if (action.body.original_price != null) {
      const originalPriceCheck = this.validateFyndiqPriceRows(
        action.body.original_price,
        'original_price',
      );
      if (!originalPriceCheck.ok) return originalPriceCheck;
    }
    return { ok: true };
  }

  validateFyndiqUpdateArticleQuantityAction(action) {
    const envelope = this.validateFyndiqUpdateActionEnvelope(action);
    if (!envelope.ok) return envelope;
    const quantity = Number(action.body.quantity);
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
      return { ok: false, reason: 'invalid_quantity' };
    }
    return { ok: true };
  }

  async exportProductsUpdateOnlyStrict(req, res) {
    const settings = await this.model.getSettings(req);
    if (!settings?.apiKey || !settings?.apiSecret) {
      return res.status(400).json({ error: 'Fyndiq settings not found. Save settings first.' });
    }
    const products = Array.isArray(req.body?.products) ? req.body.products : [];
    if (!products.length) {
      return res.status(400).json({ error: 'Request must include products: []' });
    }
    const allowedMarkets = ['se', 'dk', 'fi', 'no'];
    let marketsFilter = allowedMarkets;
    if (Array.isArray(req.body?.markets) && req.body.markets.length > 0) {
      const normalized = req.body.markets
        .map((m) =>
          String(m || '')
            .trim()
            .toLowerCase(),
        )
        .filter((m) => allowedMarkets.includes(m));
      if (!normalized.length) {
        return res
          .status(400)
          .json({ error: 'markets must include at least one of: se, dk, fi, no' });
      }
      marketsFilter = normalized;
    }

    const userId = Context.getUserId(req);
    const db = Database.get(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const productIds = products.map((p) => String(p?.id || '').trim()).filter(Boolean);
    const mapRows = productIds.length
      ? await db.query(
          `
          SELECT
            m.product_id::text AS product_id,
            m.enabled,
            m.external_id,
            ci.instance_key,
            ci.market
          FROM channel_product_map m
          LEFT JOIN channel_instances ci ON ci.id = m.channel_instance_id
          WHERE m.channel = 'fyndiq'
            AND m.product_id::text = ANY($1::text[])
          `,
          [productIds],
        )
      : [];
    const targetMarketRows = productIds.length
      ? await db.query(
          `
          SELECT
            m.product_id::text AS product_id,
            LOWER(TRIM(ci.market)) AS market,
            ci.instance_key
          FROM channel_product_map m
          LEFT JOIN channel_instances ci ON ci.id = m.channel_instance_id
          WHERE m.channel = 'fyndiq'
            AND m.enabled = TRUE
            AND m.product_id::text = ANY($1::text[])
            AND TRIM(COALESCE(ci.market, '')) <> ''
          UNION
          SELECT
            o.product_id::text AS product_id,
            LOWER(TRIM(ci.market)) AS market,
            ci.instance_key
          FROM channel_product_map m
          INNER JOIN channel_product_overrides o
            ON o.product_id::text = m.product_id::text
            AND o.channel = 'fyndiq' AND o.active = TRUE AND o.channel_instance_id IS NOT NULL
          INNER JOIN channel_instances ci ON ci.id = o.channel_instance_id
          WHERE m.channel = 'fyndiq'
            AND m.enabled = TRUE
            AND m.channel_instance_id IS NULL
            AND m.product_id::text = ANY($1::text[])
            AND TRIM(COALESCE(ci.market, '')) <> ''
          `,
          [productIds],
        )
      : [];
    const overrideRows = productIds.length
      ? await db.query(
          `
          SELECT
            o.product_id::text AS product_id,
            lower(COALESCE(ci.market, o.instance)) AS market,
            o.price_amount,
            o.currency,
            o.vat_rate,
            o.original_price
          FROM channel_product_overrides o
          LEFT JOIN channel_instances ci ON ci.id = o.channel_instance_id
          WHERE o.channel = 'fyndiq'
            AND o.product_id::text = ANY($1::text[])
            AND lower(COALESCE(ci.market, o.instance)) IN ('se', 'dk', 'fi', 'no')
          `,
          [productIds],
        )
      : [];

    const mapsByProduct = new Map();
    for (const row of mapRows) {
      const pid = String(row.product_id);
      if (!mapsByProduct.has(pid)) mapsByProduct.set(pid, []);
      mapsByProduct.get(pid).push(row);
    }
    const targetMarketsByProduct = new Map();
    for (const row of targetMarketRows) {
      const pid = String(row.product_id || '').trim();
      const market = String(row.market || '')
        .trim()
        .toLowerCase();
      const instanceKey = row.instance_key != null ? String(row.instance_key).trim() : null;
      if (!pid || !market || !allowedMarkets.includes(market)) continue;
      if (!targetMarketsByProduct.has(pid)) targetMarketsByProduct.set(pid, new Map());
      targetMarketsByProduct.get(pid).set(market, { market, instanceKey });
    }
    const overridesByProductAndMarket = new Map();
    for (const row of overrideRows) {
      const pid = String(row.product_id);
      const market = String(row.market || '')
        .trim()
        .toLowerCase();
      if (!pid || !market) continue;
      if (!overridesByProductAndMarket.has(pid)) overridesByProductAndMarket.set(pid, new Map());
      overridesByProductAndMarket.get(pid).set(market, {
        priceAmount: row.price_amount != null ? Number(row.price_amount) : null,
        currency: row.currency != null ? String(row.currency).trim().toUpperCase() : null,
        vatRate: row.vat_rate != null ? Number(row.vat_rate) : null,
        originalPrice:
          row.original_price != null && Number.isFinite(Number(row.original_price))
            ? Number(row.original_price)
            : null,
      });
    }

    const report = {
      channel: 'fyndiq',
      mode: 'update_only_strict',
      requested: products.length,
      updated: 0,
      skipped_no_map: 0,
      expected_skip: 0,
      validation_error: 0,
      channel_error: 0,
      rows: [],
    };

    const actions = [];
    const actionMeta = [];
    const validProductIds = new Set();

    for (const p of products) {
      const productId = String(p?.id || '').trim();
      const sku = String(p?.sku || '').trim();
      const basePrice = Number(p?.priceAmount);
      const hasBasePrice = Number.isFinite(basePrice) && basePrice > 0;
      const mappings = mapsByProduct.get(productId) || [];
      const enabledMappings = mappings.filter((m) => {
        if (m.enabled !== true) return false;
        const market = String(m.market || '')
          .trim()
          .toLowerCase();
        return marketsFilter.includes(market);
      });
      const targetMarkets = Array.from(
        (targetMarketsByProduct.get(productId) || new Map()).values(),
      ).filter((entry) => marketsFilter.includes(entry.market));
      const directArticleIds = enabledMappings
        .map((m) => (m.external_id != null ? String(m.external_id).trim() : ''))
        .filter(Boolean);
      const globalArticleIds = mappings
        .filter((m) => m.enabled === true && (m.channel_instance_id ?? null) == null)
        .map((m) => (m.external_id != null ? String(m.external_id).trim() : ''))
        .filter(Boolean);
      const articleIdSet = new Set([...directArticleIds, ...globalArticleIds]);
      if (articleIdSet.size === 0 || targetMarkets.length === 0) {
        report.skipped_no_map += 1;
        report.expected_skip += 1;
        report.rows.push({
          productId,
          sku: sku || null,
          channel: 'fyndiq',
          instanceKey: null,
          status: 'skipped_no_map',
          reason: 'no_mapped_target',
          classification: 'expected_skip',
        });
        continue;
      }

      if (articleIdSet.size !== 1) {
        report.validation_error += 1;
        report.rows.push({
          productId,
          sku: sku || null,
          channel: 'fyndiq',
          instanceKey: null,
          status: 'validation_error',
          reason: 'conflicting_article_ids',
        });
        continue;
      }

      const firstMap = enabledMappings[0] ?? targetMarkets[0] ?? null;
      const articleId = Array.from(articleIdSet)[0];
      const uuidV4Like =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidV4Like.test(articleId)) {
        report.validation_error += 1;
        report.rows.push({
          productId,
          sku: sku || null,
          channel: 'fyndiq',
          instanceKey: firstMap.instance_key || null,
          status: 'validation_error',
          reason: 'invalid_article_id',
        });
        continue;
      }

      const quantity = Number(p?.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) {
        report.validation_error += 1;
        report.rows.push({
          productId,
          sku: sku || null,
          channel: 'fyndiq',
          instanceKey: firstMap.instance_key || null,
          status: 'validation_error',
          reason: 'invalid_quantity',
        });
        continue;
      }

      const priceRows = [];
      const originalPriceRows = [];
      const overridesByMarket = overridesByProductAndMarket.get(productId) || new Map();
      let marketValidationFailed = false;
      for (const m of targetMarkets) {
        const market = String(m.market || '')
          .trim()
          .toLowerCase();
        const marketCode = market.toUpperCase();
        const instanceKey = String(m.instanceKey || '').trim();
        if (!['se', 'dk', 'fi', 'no'].includes(market)) {
          report.validation_error += 1;
          report.rows.push({
            productId,
            sku: sku || null,
            channel: 'fyndiq',
            instanceKey: instanceKey || null,
            status: 'validation_error',
            reason: 'missing_market_on_instance',
          });
          marketValidationFailed = true;
          continue;
        }
        const marketOverride = overridesByMarket.get(market);
        const overrideAmountRaw = Number(marketOverride?.priceAmount);
        const overrideAmount =
          Number.isFinite(overrideAmountRaw) && overrideAmountRaw > 0 ? overrideAmountRaw : null;
        const amount = overrideAmount != null ? overrideAmount : hasBasePrice ? basePrice : null;
        const expectedCurrency = FYNDIQ_CURRENCY_BY_MARKET[market] || null;
        const overrideCurrency = String(marketOverride?.currency || '')
          .trim()
          .toUpperCase();
        if (overrideCurrency && expectedCurrency && overrideCurrency !== expectedCurrency) {
          report.validation_error += 1;
          report.rows.push({
            productId,
            sku: sku || null,
            channel: 'fyndiq',
            instanceKey: instanceKey || null,
            status: 'validation_error',
            reason: `invalid_currency_for_market:${market}:${overrideCurrency}`,
          });
          marketValidationFailed = true;
          continue;
        }
        const currency = expectedCurrency;
        if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
          report.validation_error += 1;
          report.rows.push({
            productId,
            sku: sku || null,
            channel: 'fyndiq',
            instanceKey: instanceKey || null,
            status: 'validation_error',
            reason: 'missing_or_invalid_effective_price',
          });
          marketValidationFailed = true;
          continue;
        }
        const value = { amount, currency };
        priceRows.push({ market: marketCode, value });
        const originalAmount =
          marketOverride?.originalPrice != null &&
          Number.isFinite(marketOverride.originalPrice) &&
          marketOverride.originalPrice > 0
            ? marketOverride.originalPrice
            : null;
        if (originalAmount != null) {
          const originalValue = {
            amount: originalAmount,
            currency,
          };
          originalPriceRows.push({ market: marketCode, value: originalValue });
        }
      }
      if (marketValidationFailed || !priceRows.length) continue;

      const priceBody = { price: priceRows };
      if (originalPriceRows.length > 0) {
        priceBody.original_price = originalPriceRows;
      }
      const priceAction = {
        action: 'update_article_price',
        id: articleId,
        body: priceBody,
      };
      const quantityAction = {
        action: 'update_article_quantity',
        id: articleId,
        body: { quantity: Math.trunc(quantity) },
      };
      const priceValidation = this.validateFyndiqUpdateArticlePriceAction(priceAction);
      if (!priceValidation.ok) {
        report.validation_error += 1;
        report.rows.push({
          productId,
          sku: sku || null,
          channel: 'fyndiq',
          instanceKey: firstMap.instance_key || null,
          status: 'validation_error',
          reason: priceValidation.reason,
        });
        continue;
      }
      const quantityValidation = this.validateFyndiqUpdateArticleQuantityAction(quantityAction);
      if (!quantityValidation.ok) {
        report.validation_error += 1;
        report.rows.push({
          productId,
          sku: sku || null,
          channel: 'fyndiq',
          instanceKey: firstMap.instance_key || null,
          status: 'validation_error',
          reason: quantityValidation.reason,
        });
        continue;
      }
      actions.push(priceAction);
      actionMeta.push({
        productId,
        sku: sku || null,
        articleId,
        action: 'update_article_price',
      });
      actions.push(quantityAction);
      actionMeta.push({
        productId,
        sku: sku || null,
        articleId,
        action: 'update_article_quantity',
      });
      validProductIds.add(productId);
    }

    if (!actions.length) {
      return res.json({ ok: true, ...report });
    }

    const response = await this.fyndiqRequest('/api/v1/articles/bulk', {
      username: settings.apiKey,
      password: settings.apiSecret,
      method: 'PUT',
      body: JSON.stringify(actions),
    });

    if (!response.resp.ok) {
      report.channel_error += validProductIds.size;
      for (const p of products) {
        const productId = String(p?.id || '').trim();
        if (!validProductIds.has(productId)) continue;
        report.rows.push({
          productId,
          sku: String(p?.sku || '').trim() || null,
          channel: 'fyndiq',
          instanceKey: null,
          status: 'channel_error',
          reason: `channel_error_${response.resp.status}`,
        });
      }
      return res
        .status(response.resp.status)
        .json({ ok: false, ...report, detail: response.json || response.text || null });
    }

    const responseRows = Array.isArray(response.json?.responses) ? response.json.responses : [];
    const failuresByProduct = new Map();
    for (let i = 0; i < actionMeta.length; i++) {
      const meta = actionMeta[i];
      const row = responseRows[i] || null;
      const statusCode = row?.status_code != null ? Number(row.status_code) : null;
      const ok =
        statusCode == null ||
        (Number.isFinite(statusCode) && statusCode >= 200 && statusCode < 300);
      if (ok) continue;
      const description = row?.description != null ? String(row.description).trim() : '';
      const errors =
        row?.errors != null
          ? typeof row.errors === 'string'
            ? row.errors
            : JSON.stringify(row.errors)
          : '';
      const message =
        description ||
        errors ||
        `${meta.action || 'bulk_action'} failed (${statusCode || 'unknown'})`;
      const existing = failuresByProduct.get(meta.productId) || [];
      existing.push(message);
      failuresByProduct.set(meta.productId, existing);
    }

    for (const p of products) {
      const productId = String(p?.id || '').trim();
      if (!validProductIds.has(productId)) continue;
      const failures = failuresByProduct.get(productId) || [];
      if (failures.length > 0) {
        report.channel_error += 1;
        report.rows.push({
          productId,
          sku: String(p?.sku || '').trim() || null,
          channel: 'fyndiq',
          instanceKey: null,
          status: 'channel_error',
          reason: failures.join('; '),
        });
        continue;
      }
      report.updated += 1;
      report.rows.push({
        productId,
        sku: String(p?.sku || '').trim() || null,
        channel: 'fyndiq',
        instanceKey: null,
        status: 'updated',
        reason: null,
      });
    }

    if (responseRows.length > 0 && failuresByProduct.size > 0) {
      Logger.warn('Fyndiq strict update reported failed actions', {
        responses: responseRows,
        userId: Context.getUserId(req),
      });
    }
    return res.json({ ok: true, ...report });
  }

  // DELETE /api/fyndiq-products/batch
  // body: { productIds: string[] }
  async batchDelete(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) {
        return res.status(400).json({ error: 'Fyndiq settings not found. Save settings first.' });
      }

      const productIdsRaw = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
      const productIds = Array.from(
        new Set(productIdsRaw.map((x) => String(x).trim()).filter(Boolean)),
      );

      if (productIds.length === 0) {
        return res.json({ ok: true, deleted: 0, items: [] });
      }
      if (productIds.length > 500) {
        return res
          .status(400)
          .json({ error: 'Too many productIds (max 500)', code: 'VALIDATION_ERROR' });
      }

      // Resolve SKU for each productId
      const db = Database.get(req);
      const userId = Context.getUserId(req);
      if (!userId) return res.status(401).json({ error: 'User not authenticated' });

      const rows = await db.query(
        `
        SELECT id::text AS id, sku
        FROM products
        WHERE id::text = ANY($1::text[])
        `,
        [productIds],
      );
      const skuById = new Map(rows.map((r) => [String(r.id), r.sku ? String(r.sku).trim() : null]));

      const items = [];
      for (const pid of productIds) {
        const sku = skuById.get(String(pid)) || null;

        if (!sku) {
          await this.model.upsertChannelMap(req, {
            productId: pid,
            channel: 'fyndiq',
            enabled: false,
            externalId: null,
            status: 'error',
            error: 'Missing SKU for product (cannot delete on Fyndiq)',
          });
          items.push({ productId: pid, status: 'error', error: 'Missing SKU' });
          continue;
        }

        // Resolve article id by SKU
        const lookup = await this.fyndiqRequest(`/api/v1/articles/sku/${encodeURIComponent(sku)}`, {
          username: settings.apiKey,
          password: settings.apiSecret,
          method: 'GET',
        });

        // If not found, treat as already deleted
        if (lookup.resp.status === 404) {
          await this.model.upsertChannelMap(req, {
            productId: pid,
            channel: 'fyndiq',
            enabled: false,
            externalId: sku,
            status: 'idle',
            error: null,
          });
          items.push({ productId: pid, sku, status: 'not_found' });
          continue;
        }

        if (!lookup.resp.ok) {
          const msg = `Lookup failed (${lookup.resp.status})`;
          await this.model.upsertChannelMap(req, {
            productId: pid,
            channel: 'fyndiq',
            enabled: false,
            externalId: sku,
            status: 'error',
            error: msg,
          });
          await this.model.logChannelError(req, {
            channel: 'fyndiq',
            productId: pid,
            payload: { sku },
            response: lookup.json || lookup.text || null,
            message: msg,
          });
          items.push({ productId: pid, sku, status: 'error', error: msg });
          continue;
        }

        // Doc: GET /api/v1/articles/sku/{{SKU}} returns 200 with content.article.id
        const articleId = lookup.json?.content?.article?.id ?? null;
        if (!articleId) {
          const msg = 'Could not resolve articleId from lookup response';
          await this.model.upsertChannelMap(req, {
            productId: pid,
            channel: 'fyndiq',
            enabled: false,
            externalId: sku,
            status: 'error',
            error: msg,
          });
          await this.model.logChannelError(req, {
            channel: 'fyndiq',
            productId: pid,
            payload: { sku },
            response: lookup.json || lookup.text || null,
            message: msg,
          });
          items.push({ productId: pid, sku, status: 'error', error: msg });
          continue;
        }

        const del = await this.fyndiqRequest(
          `/api/v1/articles/${encodeURIComponent(String(articleId))}`,
          {
            username: settings.apiKey,
            password: settings.apiSecret,
            method: 'DELETE',
          },
        );

        const isNotFound = del.resp.status === 404;
        if (!del.resp.ok && !isNotFound) {
          const msg = `Delete failed (${del.resp.status})`;
          await this.model.upsertChannelMap(req, {
            productId: pid,
            channel: 'fyndiq',
            enabled: false,
            externalId: sku,
            status: 'error',
            error: msg,
          });
          await this.model.logChannelError(req, {
            channel: 'fyndiq',
            productId: pid,
            payload: { sku, articleId },
            response: del.json || del.text || null,
            message: msg,
          });
          items.push({ productId: pid, sku, status: 'error', error: msg });
          continue;
        }

        await this.model.upsertChannelMap(req, {
          productId: pid,
          channel: 'fyndiq',
          enabled: false,
          externalId: sku,
          status: 'idle',
          error: null,
        });
        items.push({ productId: pid, sku, status: del.resp.ok ? 'deleted' : 'not_found' });
      }

      const deleted = items.filter(
        (x) => x.status === 'deleted' || x.status === 'not_found',
      ).length;

      return res.json({
        ok: true,
        endpoint: 'https://merchants-api.fyndiq.se/api/v1/articles/{id}',
        deleted,
        items,
      });
    } catch (error) {
      Logger.error('Fyndiq batch delete error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ error: 'Delete from Fyndiq failed', detail: String(error?.message || error) });
    }
  }

  // --------- Order import ---------

  /**
   * Internal: sync open Fyndiq orders. API: GET /api/v1/orders?state=CREATED&limit=100&page=1 (doc: state, page, limit).
   * Used by OrderSyncService. Returns { fetched, created, error? }.
   */
  async syncOpenOrders(req, settingsOverride = null) {
    const settings = settingsOverride || (await this.model.getSettings(req));
    if (!settings || !settings.apiKey || !settings.apiSecret) {
      return {
        fetched: 0,
        created: 0,
        changed: 0,
        skipped: 0,
        inventoryUpdatedProducts: 0,
        pagesFetched: 0,
      };
    }

    const limit = 100;
    const allOrders = [];
    let page = 1;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const path = `/api/v1/orders?state=CREATED&limit=${limit}&page=${page}`;
      const { resp, json } = await this.fyndiqRequest(path, {
        username: settings.apiKey,
        password: settings.apiSecret,
        method: 'GET',
      });
      if (!resp.ok) {
        const detail = json && json.message ? String(json.message) : resp.statusText;
        return { fetched: allOrders.length, created: -1, error: String(detail).slice(0, 500) };
      }
      const items = Array.isArray(json) ? json : [];
      allOrders.push(...items);
      pagesFetched += 1;
      hasMore = items.length >= limit;
      page += 1;
    }

    const productIdBySku = await this.ordersModel.loadProductIdsByChannelExternalId(
      req,
      'fyndiq',
      allOrders.map((o) => o?.article_sku),
    );
    const normalizedOrders = [];
    for (const o of allOrders) {
      if (o == null || o.id == null) continue;
      const normalized = await this.normalizeFyndiqOrderToHomebase(o, req, { productIdBySku });
      if (normalized) normalizedOrders.push(normalized);
    }

    let created = 0;
    let changed = 0;
    let skipped = 0;
    const inventoryAdjustments = new Map();
    for (const chunk of this.ordersModel.chunkArray(normalizedOrders)) {
      const ingestRes = await this.ordersModel.ingestBatch(req, chunk);
      created += ingestRes.createdCount;
      changed += ingestRes.changedCount;
      skipped += ingestRes.skippedCount;
      for (const adj of ingestRes.inventoryAdjustments || []) {
        const pid = Number(adj?.productId);
        const qty = Number(adj?.quantity);
        if (!Number.isFinite(pid) || !Number.isFinite(qty) || qty <= 0) continue;
        inventoryAdjustments.set(pid, (inventoryAdjustments.get(pid) || 0) + qty);
      }
    }

    await this.applyInventoryAdjustments(
      req,
      Array.from(inventoryAdjustments.entries()).map(([productId, quantity]) => ({
        productId,
        quantity,
      })),
    ).catch(() => {});

    return {
      fetched: allOrders.length,
      created,
      changed,
      skipped,
      inventoryUpdatedProducts: inventoryAdjustments.size,
      pagesFetched,
    };
  }

  /**
   * Build one normalized order from a single Fyndiq API order object.
   * API doc: id, article_id, title, article_sku, price { amount, vat_amount, vat_rate, currency }, total_price, quantity,
   * shipping_address { first_name, last_name, street_address, city, postal_code, country, phone_number }, market, state, created_at.
   */
  async normalizeFyndiqOrderToHomebase(o, req, { productIdBySku = null } = {}) {
    if (o == null || o.id == null) return null;
    const channelOrderId = String(o.id);

    const placedAtRaw = o.created_at;
    let placedAt = placedAtRaw ? String(placedAtRaw).trim() : null;
    if (
      placedAt &&
      !placedAt.endsWith('Z') &&
      !placedAt.includes('+') &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(placedAt)
    ) {
      placedAt = placedAt.replace(' ', 'T') + 'Z';
    }

    const price = o.price || o.total_price;
    const currency = price && price.currency ? String(price.currency).toUpperCase() : 'SEK';
    const status = this.mapFyndiqOrderStatusToHomebase(o.state);

    const ship = o.shipping_address;
    const customer = {
      email: null,
      firstName: ship && ship.first_name != null ? String(ship.first_name).trim() : null,
      lastName: ship && ship.last_name != null ? String(ship.last_name).trim() : null,
      phone: ship && ship.phone_number != null ? String(ship.phone_number).trim() : null,
      shippingAddress: ship || null,
      billingAddress: null,
    };

    const qty = Number(o.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return null;

    const amount = price && price.amount != null ? Number(price.amount) : null;
    const vatAmount = price && price.vat_amount != null ? Number(price.vat_amount) : null;
    const vatRateDoc = price && price.vat_rate != null ? Number(price.vat_rate) : null;
    const unitPriceInclVat =
      Number.isFinite(amount) && Number.isFinite(vatAmount)
        ? (amount + vatAmount) / (qty || 1)
        : null;
    const vatRatePct = Number.isFinite(vatRateDoc)
      ? vatRateDoc <= 1
        ? vatRateDoc * 100
        : vatRateDoc
      : null;

    const totalPrice = o.total_price;
    const totalAmount =
      totalPrice && totalPrice.amount != null && totalPrice.vat_amount != null
        ? Number(totalPrice.amount) + Number(totalPrice.vat_amount)
        : Number.isFinite(unitPriceInclVat) && qty > 0
          ? unitPriceInclVat * qty
          : null;

    const sku = o.article_sku != null ? String(o.article_sku).trim() : null;
    const platformProductId =
      sku && productIdBySku instanceof Map && productIdBySku.has(sku)
        ? productIdBySku.get(sku) || null
        : null;

    const title =
      o.title != null || o.article_title != null ? String(o.title || o.article_title).trim() : null;
    const items = [
      {
        sku: sku || null,
        productId: platformProductId,
        title: title || null,
        quantity: Math.trunc(qty),
        unitPrice: Number.isFinite(unitPriceInclVat) ? unitPriceInclVat : null,
        vatRate: Number.isFinite(vatRatePct) ? vatRatePct : null,
        raw: o,
      },
    ];

    return {
      channel: 'fyndiq',
      channelOrderId,
      platformOrderNumber: channelOrderId,
      placedAt,
      totalAmount: Number.isFinite(totalAmount) ? totalAmount : null,
      currency,
      status,
      shippingAddress: ship || null,
      billingAddress: null,
      customer,
      items,
      raw: o,
    };
  }

  /**
   * GET /api/v1/orders. Doc: query params state (CREATED|FULFILLED|NOT_FULFILLED), limit, page.
   */
  async pullOrders(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: 'Fyndiq settings not found. Save settings first.' });
      }

      const limit =
        req.body?.perPage != null ? Math.min(Math.max(Number(req.body.perPage), 1), 1000) : 100;
      // Default: only active (open) orders. Send body.state = ['CREATED','FULFILLED'] to include shipped.
      const states =
        req.body?.state != null
          ? Array.isArray(req.body.state)
            ? req.body.state
            : [req.body.state]
          : ['CREATED'];

      const allOrders = [];
      for (const state of states) {
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const path = `/api/v1/orders?state=${encodeURIComponent(state)}&limit=${limit}&page=${page}`;
          const { resp, json } = await this.fyndiqRequest(path, {
            username: settings.apiKey,
            password: settings.apiSecret,
            method: 'GET',
          });
          if (!resp.ok) {
            const detail = json && json.message ? String(json.message) : resp.statusText;
            return res.status(resp.status).json({
              error: 'Failed to fetch Fyndiq orders',
              detail: String(detail).slice(0, 500),
            });
          }
          const items = Array.isArray(json) ? json : [];
          allOrders.push(...items);
          hasMore = items.length >= limit;
          page += 1;
        }
      }

      const productIdBySku = await this.ordersModel.loadProductIdsByChannelExternalId(
        req,
        'fyndiq',
        allOrders.map((o) => o?.article_sku),
      );
      const normalizedOrders = [];
      const channelOrderIds = [];
      for (const o of allOrders) {
        if (o == null || o.id == null) continue;
        const normalized = await this.normalizeFyndiqOrderToHomebase(o, req, { productIdBySku });
        if (!normalized) continue;
        normalizedOrders.push(normalized);
        channelOrderIds.push(String(o.id));
      }

      const results = [];
      const inventoryAdjustments = new Map();
      let cursor = 0;
      for (const chunk of this.ordersModel.chunkArray(normalizedOrders)) {
        const ingestRes = await this.ordersModel.ingestBatch(req, chunk);
        chunk.forEach((_, chunkIdx) => {
          const result = ingestRes.results[chunkIdx];
          results.push({ channelOrderId: channelOrderIds[cursor + chunkIdx], ...result });
        });
        cursor += chunk.length;
        for (const adj of ingestRes.inventoryAdjustments || []) {
          const pid = Number(adj?.productId);
          const qty = Number(adj?.quantity);
          if (!Number.isFinite(pid) || !Number.isFinite(qty) || qty <= 0) continue;
          inventoryAdjustments.set(pid, (inventoryAdjustments.get(pid) || 0) + qty);
        }
      }

      await this.applyInventoryAdjustments(
        req,
        Array.from(inventoryAdjustments.entries()).map(([productId, quantity]) => ({
          productId,
          quantity,
        })),
      ).catch((err) => {
        Logger.warn('Inventory sync failed (non-fatal)', err, { userId: Context.getUserId(req) });
      });

      const shouldRenumber = req.body?.renumber !== false;
      if (shouldRenumber) {
        await this.ordersModel.renumberOrderNumbersByPlacedAt(req);
      }

      return res.json({
        ok: true,
        fetched: allOrders.length,
        ingested: results.length,
        created: results.filter((r) => r.created).length,
        changed: results.filter((r) => r.changed).length,
        skippedExisting: results.filter((r) => r.unchanged).length,
        inventoryUpdatedProducts: inventoryAdjustments.size,
        results,
      });
    } catch (error) {
      Logger.error('Fyndiq orders pull error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ error: 'Failed to pull Fyndiq orders', detail: String(error?.message || error) });
    }
  }

  /** Doc: state is CREATED | FULFILLED | NOT_FULFILLED only. */
  mapFyndiqOrderStatusToHomebase(state) {
    const s = String(state || '').toUpperCase();
    if (s === 'CREATED') return 'processing';
    if (s === 'FULFILLED') return 'shipped';
    if (s === 'NOT_FULFILLED') return 'cancelled';
    return 'processing';
  }

  async applyInventoryAdjustments(req, adjustments) {
    const db = Database.get(req);
    const userId = Context.getUserId(req);
    if (!userId || !Array.isArray(adjustments) || adjustments.length === 0) return;

    for (const adj of adjustments) {
      const pid = adj?.productId != null ? Number(adj.productId) : null;
      const qty = Number(adj?.quantity);
      if (pid == null || !Number.isFinite(pid) || !Number.isFinite(qty) || qty <= 0) continue;
      await db.query(
        `
        UPDATE products
        SET quantity = GREATEST(quantity - $2, 0),
            updated_at = NOW()
        WHERE id = $1
        `,
        [pid, Math.trunc(qty)],
      );
    }
  }

  async applyInventoryFromOrderId(req, orderId) {
    const db = Database.get(req);
    const userId = Context.getUserId(req);
    if (!userId) return;

    const items = await db.query(
      `SELECT oi.sku, oi.product_id, oi.quantity
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [Number(orderId)],
    );
    if (!items.length) return;

    const byProductId = new Map();
    for (const it of items) {
      const qty = Number(it?.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const pid = it?.product_id != null ? Number(it.product_id) : null;
      if (pid != null && Number.isFinite(pid)) {
        byProductId.set(pid, (byProductId.get(pid) || 0) + Math.trunc(qty));
      }
    }

    await this.applyInventoryAdjustments(
      req,
      Array.from(byProductId.entries()).map(([productId, quantity]) => ({ productId, quantity })),
    );
  }
}

module.exports = FyndiqProductsController;
