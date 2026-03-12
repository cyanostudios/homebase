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

      // Load per-instance overrides (Selloklon): active/price/currency/category per market instance.
      const db = Database.get(req);
      const productIds = Array.from(
        new Set(products.map((p) => String(p?.id || '').trim()).filter(Boolean)),
      );
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
          WHERE o.user_id = $1
            AND o.channel = 'fyndiq'
            AND o.product_id::text = ANY($2::text[])
          `,
          [userId, productIds],
        );

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
          if (!marketsFilter.includes(String(market).toLowerCase())) return false;
          return data && data.active === true;
        });
        if (!hasActiveTarget) {
          expectedSkip += 1;
          items.push({
            productId,
            sku: p?.sku || null,
            status: 'expected_skip',
            reason: 'no_active_channel_market',
          });
          continue;
        }
        const payload = mapProductToFyndiqArticle(p, overrides, defaultLanguage, marketsFilter);

        if (!payload) {
          const issues = getFyndiqArticleInputIssues(p, overrides, defaultLanguage, marketsFilter);
          const reason = issues.length ? issues.join(',') : 'mapper_rejected_unknown';
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
        return res.status(400).json({
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
        });
      }

      const bulkPayload = payloadsWithMeta.map((x) => x.payload);
      const { url, resp, text, json } = await this.fyndiqRequest('/api/v1/articles/bulk', {
        username: settings.apiKey,
        password: settings.apiSecret,
        method: 'POST',
        body: JSON.stringify(bulkPayload),
      });

      const responses = json && Array.isArray(json.responses) ? json.responses : [];
      for (let i = 0; i < payloadsWithMeta.length; i++) {
        const { productId, sku } = payloadsWithMeta[i];
        const r = responses[i];
        const statusCode = r?.status_code != null ? Number(r.status_code) : null;
        const success = statusCode === 202;
        const errMsg = success
          ? null
          : r?.description != null
            ? String(r.description)
            : r?.errors
              ? JSON.stringify(r.errors)
              : resp.ok
                ? null
                : 'Export failed';

        await this.model.upsertChannelMap(req, {
          productId,
          channel: 'fyndiq',
          enabled: true,
          externalId: sku || null,
          status: success ? 'success' : 'error',
          error: errMsg,
        });
        const it = items.find((x) => x.productId === productId && x.status === 'queued');
        if (it) {
          it.status = success ? 'success' : 'error';
          if (!success) it.error = errMsg;
        }
        if (!success && errMsg) {
          await this.model.logChannelError(req, {
            channel: 'fyndiq',
            productId,
            payload: bulkPayload[i] || null,
            response: r,
            message: errMsg,
          });
        }
      }

      return res.json({
        ok: true,
        endpoint: '/api/v1/articles/bulk',
        result: { status: resp.status, url, responses: json?.responses },
        counts: {
          requested: products.length,
          success: items.filter((x) => x.status === 'success').length,
          error: items.filter((x) => x.status === 'error').length,
          skipped: items.filter((x) => x.status === 'skipped').length,
          expected_skip: expectedSkip,
        },
        items,
      });
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
      if (!['se', 'dk', 'fi'].includes(market)) {
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
        const vatRate = Number(row.value.vat_rate);
        if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
          return { ok: false, reason: `invalid_${rowName}_vat_rate` };
        }
      }
    }
    return { ok: true };
  }

  validateFyndiqUpdateArticlePriceAction(action) {
    const envelope = this.validateFyndiqUpdateActionEnvelope(action);
    if (!envelope.ok) return envelope;
    const priceCheck = this.validateFyndiqPriceRows(action.body.price, 'price');
    if (!priceCheck.ok) return priceCheck;
    const originalPriceCheck = this.validateFyndiqPriceRows(
      action.body.original_price,
      'original_price',
    );
    if (!originalPriceCheck.ok) return originalPriceCheck;
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
          WHERE m.user_id = $1
            AND m.channel = 'fyndiq'
            AND m.product_id::text = ANY($2::text[])
          `,
          [userId, productIds],
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
          WHERE o.user_id = $1
            AND o.channel = 'fyndiq'
            AND o.product_id::text = ANY($2::text[])
            AND lower(COALESCE(ci.market, o.instance)) IN ('se', 'dk', 'fi', 'no')
          `,
          [userId, productIds],
        )
      : [];

    const mapsByProduct = new Map();
    for (const row of mapRows) {
      const pid = String(row.product_id);
      if (!mapsByProduct.has(pid)) mapsByProduct.set(pid, []);
      mapsByProduct.get(pid).push(row);
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
    const validProductIds = new Set();

    for (const p of products) {
      const productId = String(p?.id || '').trim();
      const sku = String(p?.sku || '').trim();
      const basePrice = Number(p?.priceAmount);
      const hasBasePrice = Number.isFinite(basePrice) && basePrice > 0;
      const baseCurrency = String(p?.currency || '')
        .trim()
        .toUpperCase();
      const mappings = mapsByProduct.get(productId) || [];
      const enabledMappings = mappings.filter((m) => {
        if (m.enabled !== true || m.external_id == null) return false;
        const market = String(m.market || '')
          .trim()
          .toLowerCase();
        return marketsFilter.includes(market);
      });
      if (!enabledMappings.length) {
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

      const articleIdSet = new Set(enabledMappings.map((m) => String(m.external_id)));
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

      const firstMap = enabledMappings[0];
      const articleId = String(firstMap.external_id || '').trim();
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
      for (const m of enabledMappings) {
        const market = String(m.market || '')
          .trim()
          .toLowerCase();
        const instanceKey = String(m.instance_key || '').trim();
        if (!['se', 'dk', 'fi'].includes(market)) {
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
        const overrideCurrency = String(marketOverride?.currency || '')
          .trim()
          .toUpperCase();
        const currency = /^[A-Z]{3}$/.test(overrideCurrency) ? overrideCurrency : baseCurrency;
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
        const vatRate = Number(marketOverride?.vatRate);
        const value = { amount, currency };
        if (Number.isFinite(vatRate)) value.vat_rate = vatRate;
        priceRows.push({ market, value });
        const originalAmount =
          marketOverride?.originalPrice != null &&
          Number.isFinite(marketOverride.originalPrice) &&
          marketOverride.originalPrice > 0
            ? marketOverride.originalPrice
            : amount;
        const originalValue = {
          amount: originalAmount,
          currency,
          ...(Number.isFinite(vatRate) ? { vat_rate: vatRate } : {}),
        };
        originalPriceRows.push({ market, value: originalValue });
      }
      if (marketValidationFailed || !priceRows.length) continue;

      const priceAction = {
        action: 'update_article_price',
        id: articleId,
        body: { price: priceRows, original_price: originalPriceRows },
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
      actions.push(quantityAction);
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

    report.updated = validProductIds.size;
    for (const p of products) {
      const productId = String(p?.id || '').trim();
      if (!validProductIds.has(productId)) continue;
      report.rows.push({
        productId,
        sku: String(p?.sku || '').trim() || null,
        channel: 'fyndiq',
        instanceKey: null,
        status: 'updated',
        reason: null,
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
      const userId = req.session?.user?.id;
      if (!userId) return res.status(401).json({ error: 'User not authenticated' });

      const rows = await db.query(
        `
        SELECT id::text AS id, sku
        FROM products
        WHERE user_id = $1
          AND id::text = ANY($2::text[])
        `,
        [userId, productIds],
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
  async syncOpenOrders(req) {
    const settings = await this.model.getSettings(req);
    if (!settings || !settings.apiKey || !settings.apiSecret) {
      return { fetched: 0, created: 0 };
    }

    const limit = 100;
    const allOrders = [];
    let page = 1;
    let hasMore = true;

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
      hasMore = items.length >= limit;
      page += 1;
    }

    let created = 0;
    for (const o of allOrders) {
      if (o == null || o.id == null) continue;
      const normalized = await this.normalizeFyndiqOrderToHomebase(o, req);
      if (!normalized) continue;

      const ingestRes = await this.ordersModel.ingest(req, normalized);
      if (ingestRes.created) created += 1;
      if (ingestRes.created && ingestRes.orderId) {
        await this.applyInventoryFromOrderId(req, ingestRes.orderId).catch(() => {});
      }
    }
    return { fetched: allOrders.length, created };
  }

  /**
   * Build one normalized order from a single Fyndiq API order object.
   * API doc: id, article_id, title, article_sku, price { amount, vat_amount, vat_rate, currency }, total_price, quantity,
   * shipping_address { first_name, last_name, street_address, city, postal_code, country, phone_number }, market, state, created_at.
   */
  async normalizeFyndiqOrderToHomebase(o, req) {
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

    const userId = req.session?.user?.id;
    const db = Database.get(req);
    const sku = o.article_sku != null ? String(o.article_sku).trim() : null;
    let platformProductId = null;
    if (userId && sku) {
      const mapRes = await db.query(
        `SELECT id::text AS product_id FROM products WHERE user_id = $1 AND id::text = $2 LIMIT 1`,
        [userId, sku],
      );
      if (mapRes.length) platformProductId = String(mapRes[0].product_id);
    }

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

      const results = [];
      for (const o of allOrders) {
        if (o == null || o.id == null) continue;
        const normalized = await this.normalizeFyndiqOrderToHomebase(o, req);
        if (!normalized) continue;

        const ingestRes = await this.ordersModel.ingest(req, normalized);
        if (ingestRes.created && ingestRes.orderId) {
          await this.applyInventoryFromOrderId(req, ingestRes.orderId).catch((err) => {
            Logger.warn('Inventory sync failed (non-fatal)', err, { orderId: ingestRes.orderId });
          });
        }
        results.push({ channelOrderId: String(o.id), ...ingestRes });
      }

      return res.json({
        ok: true,
        fetched: allOrders.length,
        ingested: results.length,
        created: results.filter((r) => r.created).length,
        skippedExisting: results.filter((r) => !r.created).length,
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

  async applyInventoryFromOrderId(req, orderId) {
    const db = Database.get(req);
    const userId = req.session?.user?.id;
    if (!userId) return;

    const items = await db.query(
      `SELECT oi.sku, oi.product_id, oi.quantity
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id AND o.user_id = $1
       WHERE oi.order_id = $2
       ORDER BY oi.id`,
      [userId, Number(orderId)],
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

    for (const [pid, qty] of byProductId.entries()) {
      await db.query(
        `
        UPDATE products
        SET quantity = GREATEST(quantity - $3, 0),
            updated_at = NOW()
        WHERE user_id = $1 AND id = $2
        `,
        [userId, pid, qty],
      );
    }
  }
}

module.exports = FyndiqProductsController;
