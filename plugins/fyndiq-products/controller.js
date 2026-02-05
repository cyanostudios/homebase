// plugins/fyndiq-products/controller.js
// Fyndiq connector controller: settings + connection test + export (API) + safe local mapping updates.

const { Logger, Context, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const OrdersModel = require('../orders/model');

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
        if (!mod?.default) throw new Error('fetch is not available (Node <18) and node-fetch is not installed');
        return mod.default(...args);
      };
  }

  getBasicAuthHeader(username, password) {
    const u = String(username || '');
    const p = String(password || '');
    const token = Buffer.from(`${u}:${p}`).toString('base64');
    return `Basic ${token}`;
  }

  async fyndiqRequest(path, { username, password, method = 'GET', body, headers = {} } = {}) {
    const fetchFn = this.getFetch();
    const url = `https://merchants-api.fyndiq.se${path}`;
    const resp = await fetchFn(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : null),
        Authorization: this.getBasicAuthHeader(username, password),
        'X-Client-Name': 'homebase',
        ...headers,
      },
      body,
    });
    const text = await resp.text().catch(() => '');
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

  /**
   * Best-effort: query Fyndiq processing statuses by SKU.
   * The public OpenAPI spec does not describe the schema, so we attempt two common payload formats.
   */
  async getStatusesBySku({ username, password, skus }) {
    const uniqueSkus = Array.from(new Set((Array.isArray(skus) ? skus : []).map((s) => String(s || '').trim()).filter(Boolean)));
    if (!uniqueSkus.length) return { ok: false, detail: 'No SKUs provided' };

    // Attempt 1: { skus: [...] }
    let r1 = await this.fyndiqRequest('/api/v1/statuses/sku', {
      username,
      password,
      method: 'POST',
      body: JSON.stringify({ skus: uniqueSkus }),
    });

    if (r1.resp.ok) return { ok: true, url: r1.url, json: r1.json, rawText: r1.text };

    // If validation error, attempt 2: [...] (array)
    if (r1.resp.status === 422) {
      const r2 = await this.fyndiqRequest('/api/v1/statuses/sku', {
        username,
        password,
        method: 'POST',
        body: JSON.stringify(uniqueSkus),
      });
      if (r2.resp.ok) return { ok: true, url: r2.url, json: r2.json, rawText: r2.text };
      return { ok: false, url: r2.url, status: r2.resp.status, detail: r2.json || r2.text || r2.resp.statusText };
    }

    return { ok: false, url: r1.url, status: r1.resp.status, detail: r1.json || r1.text || r1.resp.statusText };
  }

  parseStatusItems(statusPayload) {
    // We don't have a guaranteed schema; normalize into [{ sku, status, errorMessage? }]
    const out = [];
    if (Array.isArray(statusPayload)) {
      for (const it of statusPayload) {
        const sku = it?.sku ?? it?.SKU ?? it?.article_sku ?? it?.articleSku;
        const status = it?.status ?? it?.state ?? it?.result ?? it?.processingStatus;
        const errorMessage = it?.error ?? it?.errorMessage ?? it?.message ?? it?.detail ?? null;
        if (sku) out.push({ sku: String(sku), status: status != null ? String(status) : null, errorMessage: errorMessage ? String(errorMessage) : null, raw: it });
      }
      return out;
    }

    if (statusPayload && typeof statusPayload === 'object') {
      // common shapes: { items: [...] } or { statuses: [...] } or { <sku>: {status,...}}
      const items = statusPayload.items || statusPayload.statuses || statusPayload.results;
      if (Array.isArray(items)) return this.parseStatusItems(items);

      const keys = Object.keys(statusPayload);
      // heuristic: if keys look like SKUs
      for (const k of keys) {
        const v = statusPayload[k];
        if (v && typeof v === 'object') {
          const status = v.status ?? v.state ?? v.result ?? null;
          const errorMessage = v.error ?? v.errorMessage ?? v.message ?? v.detail ?? null;
          out.push({ sku: String(k), status: status != null ? String(status) : null, errorMessage: errorMessage ? String(errorMessage) : null, raw: v });
        }
      }
      return out;
    }

    return out;
  }

  statusToMapState(statusStr) {
    const s = String(statusStr || '').toLowerCase();
    // Heuristic mapping.
    if (!s) return 'queued';
    if (s.includes('error') || s.includes('fail') || s.includes('invalid') || s.includes('rejected')) return 'error';
    if (s.includes('success') || s.includes('ok') || s.includes('done') || s.includes('completed')) return 'success';
    if (s.includes('pending') || s.includes('queued') || s.includes('processing')) return 'queued';
    return 'queued';
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

  // ---- Categories (read-only) ----
  async getCategories(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) {
        return res.status(400).json({ ok: false, error: 'Fyndiq settings not found. Save settings first.' });
      }

      const market = String(req.query?.market || '').trim().toLowerCase();
      const language = String(req.query?.language || '').trim().toLowerCase();

      if (!market || !language) {
        return res.status(400).json({ ok: false, error: 'Missing query params: market, language' });
      }

      const { url, resp, text, json } = await this.fyndiqRequest(`/api/v1/categories/${encodeURIComponent(market)}/${encodeURIComponent(language)}`, {
        username: settings.apiKey,
        password: settings.apiSecret,
        method: 'GET',
      });

      if (!resp.ok) {
        return res.status(resp.status).json({ ok: false, error: 'Failed to fetch Fyndiq categories', endpoint: url, detail: json || text });
      }

      return res.json({ ok: true, endpoint: url, items: json ?? [] });
    } catch (error) {
      Logger.error('Fyndiq getCategories error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to fetch Fyndiq categories' });
    }
  }

  async testConnection(req, res) {
    try {
      const inBody = req.body || {};
      const settings = inBody.apiKey ? {
        apiKey: String(inBody.apiKey || '').trim(),
        apiSecret: String(inBody.apiSecret || '').trim(),
      } : await this.model.getSettings(req);

      if (!settings?.apiKey || !settings?.apiSecret) {
        return res.status(400).json({ ok: false, error: 'Missing Fyndiq credentials (apiKey, apiSecret).' });
      }

      // Validate credentials by hitting a simple authenticated endpoint
      const { url, resp, text, json } = await this.fyndiqRequest('/api/v1/merchant', {
        username: settings.apiKey,
        password: settings.apiSecret,
        method: 'GET',
      });

      if (resp.status === 401 || resp.status === 403) {
        return res.status(401).json({ ok: false, status: resp.status, error: 'Unauthorized (check user/password)' });
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
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) {
        return res.status(400).json({ error: 'Fyndiq settings not found. Save settings first.' });
      }

      const products = Array.isArray(req.body?.products) ? req.body.products : null;
      if (!products || products.length === 0) {
        return res.status(400).json({ error: 'Request must include products: []' });
      }

      const allowedMarkets = ['se', 'dk', 'fi'];
      let marketsFilter = allowedMarkets;
      if (Array.isArray(req.body?.markets) && req.body.markets.length > 0) {
        const normalized = req.body.markets.map((m) => String(m).toLowerCase()).filter((m) => allowedMarkets.includes(m));
        if (normalized.length) marketsFilter = normalized;
      }

      const userId = req.session?.user?.id || req.session?.user?.uuid;
      if (!userId) return res.status(401).json({ error: 'User not authenticated' });

      // Load per-instance overrides (Selloklon): active/price/currency/category per market instance.
      const db = Database.get(req);
      const productIds = Array.from(new Set(products.map((p) => String(p?.id || '').trim()).filter(Boolean)));
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
            o.category
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
          let market = r.market != null ? String(r.market).trim().toLowerCase() : null;
          const currency = r.currency != null ? String(r.currency).trim().toUpperCase() : null;

          // Heuristic fallback when market isn't configured yet (e.g. migrated from numeric Sello codes)
          if (!market) {
            if (currency === 'SEK') market = 'se';
            else if (currency === 'DKK') market = 'dk';
            else if (currency === 'EUR') market = 'fi';
            else {
              const p = r.price_amount != null ? Number(r.price_amount) : null;
              if (p != null && Number.isFinite(p) && Math.abs(p - Math.round(p)) > 0.0001) market = 'fi'; // decimals -> often EUR
              else market = 'se';
            }
          }

          if (!overridesByProductId.has(pid)) overridesByProductId.set(pid, {});
          overridesByProductId.get(pid)[market] = {
            instanceKey: instKey,
            active: !!r.active,
            priceAmount: r.price_amount != null ? Number(r.price_amount) : null,
            currency,
            vatRate: r.vat_rate != null ? Number(r.vat_rate) : null,
            category: r.category != null ? String(r.category).trim() : null,
          };
        }
      }

      // Build payload(s) for /api/v1/articles/bulk grouped by market.
      // Note: Fyndiq schema isn't published with strict types; server will validate/ignore unknown fields.
      const payloadByMarket = { se: [], dk: [], fi: [] };
      const items = [];

      for (const p of products) {
        const productId = String(p?.id || '').trim();
        const sku = String(p?.sku || '').trim();
        const title = String(p?.title || '').trim();
        const quantity = p?.quantity != null ? Math.max(0, Math.trunc(Number(p.quantity))) : 0;

        if (!productId) continue;
        if (!sku) {
          await this.model.upsertChannelMap(req, {
            productId,
            channel: 'fyndiq',
            enabled: true,
            externalId: null,
            status: 'error',
            error: 'Missing SKU (used as article identifier on Fyndiq)',
          });
          await this.model.logChannelError(req, {
            channel: 'fyndiq',
            productId,
            payload: p,
            response: null,
            message: 'Missing SKU (used as article identifier on Fyndiq)',
          });
          items.push({ productId, status: 'error', error: 'Missing SKU' });
          continue;
        }
        if (!title) {
          await this.model.upsertChannelMap(req, {
            productId,
            channel: 'fyndiq',
            enabled: true,
            externalId: null,
            status: 'error',
            error: 'Missing required fields (title)',
          });
          await this.model.logChannelError(req, {
            channel: 'fyndiq',
            productId,
            payload: p,
            response: null,
            message: 'Missing required fields (title)',
          });
          items.push({ productId, status: 'error', error: 'Missing title' });
          continue;
        }

        const images = [];
        if (p?.mainImage) images.push(String(p.mainImage));
        if (Array.isArray(p?.images)) {
          for (const u of p.images) if (u) images.push(String(u));
        }

        const mpn = p?.mpn != null ? String(p.mpn).trim() : sku;

        const marketOverrides = overridesByProductId.get(productId) || {};
        const basePrice = p?.priceAmount != null && Number.isFinite(Number(p.priceAmount)) ? Number(p.priceAmount) : null;

        for (const market of marketsFilter) {
          const ov = marketOverrides[market] || null;
          const price = ov?.priceAmount != null ? Number(ov.priceAmount) : basePrice;
          if (price == null || !Number.isFinite(price)) {
            items.push({ productId, sku, market, status: 'error', error: `Missing price for fyndiq.${market} (set override or product price)` });
            continue;
          }

          const defaultCurrency = market === 'dk' ? 'DKK' : market === 'fi' ? 'EUR' : 'SEK';
          const currency = (ov?.currency || p?.currency || defaultCurrency).toString().toUpperCase();

          payloadByMarket[market].push({
            market,
            sku,
            mpn,
            title,
            description: p?.description != null ? String(p.description) : '',
            price,
            currency,
            quantity,
            brand: p?.brand != null ? String(p.brand) : undefined,
            gtin: p?.gtin != null ? String(p.gtin) : undefined,
            category: ov?.category || undefined,
            images: images.length ? images : undefined,
          });

          items.push({ productId, sku, mpn, market, status: 'queued' });
        }
      }

      const marketsToSend = Object.entries(payloadByMarket).filter(([m]) => marketsFilter.includes(m)).filter(([, arr]) => arr.length);
      if (!marketsToSend.length) {
        return res.status(400).json({
          ok: false,
          error: 'No products to export for selected Fyndiq markets (check price per product/market)',
          counts: { requested: products.length, success: 0, error: items.filter((x) => x.status === 'error').length, skipped: items.filter((x) => x.status === 'skipped').length },
          items,
        });
      }

      const resultsByMarket = {};
      for (const [market, payload] of marketsToSend) {
        const { url, resp, text, json } = await this.fyndiqRequest('/api/v1/articles/bulk', {
          username: settings.apiKey,
          password: settings.apiSecret,
          method: 'POST',
          body: JSON.stringify(payload),
        });

        resultsByMarket[market] = { endpoint: url, status: resp.status, result: json || text || null };

        if (!resp.ok) {
          for (const it of items.filter((x) => x.status === 'queued' && x.market === market)) {
            await this.model.upsertChannelMap(req, {
              productId: it.productId,
              channel: 'fyndiq',
              enabled: true,
              externalId: it.sku || null,
              status: 'error',
              error: `Fyndiq export failed (${resp.status})`,
            });
            await this.model.logChannelError(req, {
              channel: 'fyndiq',
              productId: it.productId,
              payload: payload.find((x) => x.sku === it.sku) || null,
              response: json || text || null,
              message: `Fyndiq export failed (${resp.status})`,
            });
            it.status = 'error';
            it.error = 'Export failed';
          }
        }
      }

      // Mark as queued first (processing may be async) and then try to fetch statuses by SKU.
      for (const it of items.filter((x) => x.status === 'queued')) {
        await this.model.upsertChannelMap(req, {
          productId: it.productId,
          channel: 'fyndiq',
          enabled: true,
          externalId: it.sku || null,
          status: 'queued',
          error: null,
        });
      }

      let statusLookup = null;
      try {
        statusLookup = await this.getStatusesBySku({
          username: settings.apiKey,
          password: settings.apiSecret,
          skus: Array.from(new Set(items.filter((x) => x.sku && x.status !== 'error').map((x) => x.sku))),
        });
      } catch (_e) {
        statusLookup = null;
      }

      if (statusLookup?.ok) {
        const parsed = this.parseStatusItems(statusLookup.json);
        const bySku = new Map(parsed.map((x) => [String(x.sku).trim(), x]));

        for (const it of items.filter((x) => x.status === 'queued')) {
          const st = bySku.get(String(it.sku).trim());
          if (!st) continue;

          const mappedStatus = this.statusToMapState(st.status);
          const errMsg = mappedStatus === 'error' ? (st.errorMessage || st.status || 'Export failed') : null;

          await this.model.upsertChannelMap(req, {
            productId: it.productId,
            channel: 'fyndiq',
            enabled: true,
            externalId: it.sku || null,
            status: mappedStatus,
            error: errMsg,
          });

          if (mappedStatus === 'error') {
            await this.model.logChannelError(req, {
              channel: 'fyndiq',
              productId: it.productId,
              payload: payload.find((x) => String(x.sku).trim() === String(it.sku).trim()) || null,
              response: st.raw || null,
              message: errMsg,
            });
            it.status = 'error';
            it.error = errMsg || 'Export failed';
          } else if (mappedStatus === 'success') {
            it.status = 'success';
          }
        }
      }

      return res.json({
        ok: true,
        endpoint: '/api/v1/articles/bulk',
        result: resultsByMarket,
        statusLookup: statusLookup?.ok
          ? { ok: true, endpoint: statusLookup.url, raw: statusLookup.json ?? null }
          : statusLookup
            ? { ok: false, endpoint: statusLookup.url, status: statusLookup.status, detail: statusLookup.detail }
            : null,
        counts: {
          requested: products.length,
          success: items.filter((x) => x.status === 'success').length,
          error: items.filter((x) => x.status === 'error').length,
          skipped: items.filter((x) => x.status === 'skipped').length,
        },
        items,
      });
    } catch (error) {
      Logger.error('Fyndiq export error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ error: 'Export to Fyndiq failed', detail: String(error?.message || error) });
    }
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
      const productIds = Array.from(new Set(productIdsRaw.map((x) => String(x).trim()).filter(Boolean)));

      if (productIds.length === 0) {
        return res.json({ ok: true, deleted: 0, items: [] });
      }
      if (productIds.length > 500) {
        return res.status(400).json({ error: 'Too many productIds (max 500)', code: 'VALIDATION_ERROR' });
      }

      // Resolve SKU for each productId
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
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

        // Heuristic: article id is often `id` in response
        const articleId = lookup.json?.id ?? lookup.json?.article_id ?? lookup.json?.articleId ?? null;
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

        const del = await this.fyndiqRequest(`/api/v1/articles/${encodeURIComponent(String(articleId))}`, {
          username: settings.apiKey,
          password: settings.apiSecret,
          method: 'DELETE',
        });

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

      const deleted = items.filter((x) => x.status === 'deleted' || x.status === 'not_found').length;

      return res.json({
        ok: true,
        endpoint: 'https://merchants-api.fyndiq.se/api/v1/articles/{id}',
        deleted,
        items,
      });
    } catch (error) {
      Logger.error('Fyndiq batch delete error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ error: 'Delete from Fyndiq failed', detail: String(error?.message || error) });
    }
  }

  // --------- Order import ---------

  async pullOrders(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: 'Fyndiq settings not found. Save settings first.' });
      }

      // Fyndiq Merchant API: GET /api/v1/orders
      // Query params: status (pending, processing, shipped, delivered, cancelled), limit, offset
      const limit = req.body?.perPage != null ? Math.min(Math.max(Number(req.body.perPage) || 20, 1), 100) : 20;

      // If status is provided as a string, wrap it in an array; if it's an array, use it; otherwise default to a broad list.
      let statuses = req.body?.status;
      if (!statuses) {
        statuses = ['pending', 'processing', 'shipped', 'delivered'];
      } else if (typeof statuses === 'string') {
        statuses = [statuses];
      }

      const allOrders = [];
      if (statuses && statuses.length > 0) {
        // Specific statuses requested (e.g. from UI filter)
        for (const status of statuses) {
          const path = `/api/v1/orders?status=${encodeURIComponent(status)}&limit=${limit}`;
          const { resp, json } = await this.fyndiqRequest(path, {
            username: settings.apiKey,
            password: settings.apiSecret,
            method: 'GET',
          });
          if (!resp.ok) continue;
          let items = Array.isArray(json) ? json : (json?.orders || json?.data || json?.Order || []);
          if (!Array.isArray(items) && typeof json === 'object') items = [json];
          allOrders.push(...items);
        }
      } else {
        // Broad fetch (no filter): fetch many recent ones at once.
        // We fetch 100 which should cover recent current + some historical.
        const path = `/api/v1/orders?limit=100`;
        const { resp, json } = await this.fyndiqRequest(path, {
          username: settings.apiKey,
          password: settings.apiSecret,
          method: 'GET',
        });
        if (resp.ok) {
          let items = Array.isArray(json) ? json : (json?.orders || json?.data || json?.Order || []);
          if (!Array.isArray(items) && typeof json === 'object') items = [json];
          allOrders.push(...items);
        }
      }

      const orders = allOrders;

      const userId = req.session?.user?.id || req.session?.user?.uuid;
      const db = Database.get(req);

      // Group Fyndiq orders by Fyndiq order id (UUID) only. No fallbacks.
      const groupKey = (o) => (o?.id != null ? `id:${o.id}` : null);
      const byGroup = new Map();
      for (const o of orders) {
        const key = groupKey(o);
        if (key == null) continue;
        if (!byGroup.has(key)) byGroup.set(key, []);
        byGroup.get(key).push(o);
      }

      const results = [];
      for (const [, group] of byGroup) {
        const primary = group[0];
        // Fyndiq API: use only id (UUID) as order identifier. No fallbacks.
        const channelOrderId = primary?.id != null ? String(primary.id) : null;
        if (!channelOrderId) continue;

        const platformOrderNumber = channelOrderId;
        let placedAt = primary?.createdAt ?? primary?.created_at ?? primary?.orderDate ?? primary?.order_date ?? primary?.date ?? null;
        if (placedAt) {
          placedAt = String(placedAt).trim();
          if (placedAt && !placedAt.endsWith('Z') && !placedAt.includes('+') && !placedAt.includes('GMT')) {
            placedAt += 'Z';
          }
        }
        let totalAmount = null;
        let currency = primary?.currency ?? primary?.Currency ?? null;
        if (!currency) {
          for (const o of group) {
            const lineItems = Array.isArray(o?.items) ? o.items : Array.isArray(o?.orderItems) ? o.orderItems : Array.isArray(o?.order_items) ? o.order_items : Array.isArray(o?.Items) ? o.Items : Array.isArray(o?.line_items) ? o.line_items : Array.isArray(o?.lineItems) ? o.lineItems : Array.isArray(o?.products) ? o.products : Array.isArray(o?.Products) ? o.Products : [];
            for (const li of lineItems) {
              const cur = li?.price?.currency ?? li?.price?.Currency ?? li?.total_price?.currency ?? li?.total_price?.Currency ?? li?.currency ?? li?.Currency;
              if (cur) { currency = String(cur).trim().toUpperCase(); break; }
            }
            if (currency) break;
          }
        }
        currency = currency ? String(currency).trim().toUpperCase() : 'SEK';
        const statusRaw = primary?.status ?? primary?.Status ?? primary?.state ?? primary?.State;
        const status = this.mapFyndiqOrderStatusToHomebase(statusRaw);

        const pickCustomer = (o) => ({
          email: o?.customer_email ?? o?.customer_email_address ?? o?.customerEmail ?? o?.email ?? o?.Email ?? o?.order_email ?? o?.orderEmail ?? (o?.customer && (o.customer.email ?? o.customer.email_address ?? o.customer.Email)) ?? null,
          firstName: o?.customer_first_name ?? o?.customerFirstName ?? o?.first_name ?? o?.firstName ?? (o?.customer && (o.customer.first_name ?? o.customer.firstName ?? o.customer.name)) ?? null,
          lastName: o?.customer_last_name ?? o?.customerLastName ?? o?.last_name ?? o?.lastName ?? (o?.customer && o.customer.last_name) ?? null,
          phone: o?.customer_phone ?? o?.customerPhone ?? o?.phone ?? o?.Phone ?? (o?.customer && (o.customer.phone ?? o.customer.phone_mobile ?? o.customer.phoneMobile)) ?? null,
        });
        const customer = pickCustomer(primary);
        for (const o of group) {
          const c = pickCustomer(o);
          if (c.email && !customer.email) customer.email = c.email;
          if (c.firstName && !customer.firstName) customer.firstName = c.firstName;
          if (c.lastName && !customer.lastName) customer.lastName = c.lastName;
          if (c.phone && !customer.phone) customer.phone = c.phone;
        }

        const shippingAddress = primary?.shipping_address ?? primary?.shippingAddress ?? primary?.shipping ?? null;
        const billingAddress = primary?.billing_address ?? primary?.billingAddress ?? primary?.billing ?? null;

        // Extract phone number from shipping address if not already set
        if (!customer.phone && shippingAddress) {
          customer.phone = shippingAddress?.phone_number ?? shippingAddress?.phoneNumber ?? shippingAddress?.phone ?? null;
        }

        // Extract email from shipping address if not already set
        if (!customer.email && shippingAddress) {
          customer.email = shippingAddress?.email ?? shippingAddress?.email_address ?? null;
        }

        // Add addresses to customer object
        if (shippingAddress || billingAddress) {
          customer.shippingAddress = shippingAddress;
          customer.billingAddress = billingAddress;
        }
        const items = [];
        const seenItemKey = new Set();

        for (const o of group) {
          // Try multiple possible locations for line items
          let lineItems = Array.isArray(o?.items) ? o.items :
            Array.isArray(o?.orderItems) ? o.orderItems :
              Array.isArray(o?.order_items) ? o.order_items :
                Array.isArray(o?.Items) ? o.Items :
                  Array.isArray(o?.line_items) ? o.line_items :
                    Array.isArray(o?.lineItems) ? o.lineItems :
                      Array.isArray(o?.products) ? o.products :
                        Array.isArray(o?.Products) ? o.Products : [];

          // If no items array found, try to extract from order object itself (single item order)
          if (lineItems.length === 0 && o) {
            const qty = Number(o?.quantity ?? o?.Quantity ?? o?.qty ?? o?.Qty ?? 1);
            if (Number.isFinite(qty) && qty > 0) {
              lineItems = [o]; // Treat the order itself as a line item
            }
          }

          for (const li of lineItems) {
            const qty = Number(li?.quantity ?? li?.Quantity ?? li?.qty ?? li?.Qty ?? 1);
            if (!Number.isFinite(qty) || qty <= 0) continue;

            const sku = li?.sku ?? li?.SKU ?? li?.article_sku ?? li?.articleSku ?? li?.product_sku ?? li?.productSku ?? o?.sku ?? o?.SKU ?? null;
            const mpn = li?.mpn ?? li?.MPN ?? li?.article_mpn ?? li?.articleMpn ?? o?.mpn ?? o?.MPN ?? null;
            const itemKey = `${sku ?? ''}|${li?.id ?? li?.order_row_id ?? li?.orderRowId ?? o?.id ?? ''}|${li?.title ?? li?.Title ?? li?.name ?? li?.Name ?? ''}`;
            if (seenItemKey.has(itemKey)) continue;
            seenItemKey.add(itemKey);

            const title =
              li?.title ?? li?.Title ?? li?.name ?? li?.Name ?? li?.product_name ?? li?.productName ?? li?.article_name ?? li?.articleName ?? li?.product_title ?? li?.productTitle ?? o?.title ?? o?.Title ?? o?.name ?? o?.Name ?? (li?.raw && (li.raw.title ?? li.raw.name ?? li.raw.product_name)) ?? null;

            // Price and VAT: only use values derived from Fyndiq API data — no guessing of VAT rates or ex/incl.
            let unitPrice = null;
            let vatRate = null;

            if (li?.price?.amount != null) {
              const amount = Number(li.price.amount);
              const vatAmount = li?.price?.vat_amount != null ? Number(li.price.vat_amount) : null;
              if (Number.isFinite(amount)) {
                if (Number.isFinite(vatAmount)) {
                  unitPrice = amount + vatAmount;
                  if (amount > 0) vatRate = (vatAmount / amount) * 100;
                } else {
                  unitPrice = amount;
                }
              }
            }
            if (unitPrice == null && li?.total_price?.amount != null) {
              const totalPrice = Number(li.total_price.amount);
              const vatAmount = li?.total_price?.vat_amount != null ? Number(li.total_price.vat_amount) : null;
              if (Number.isFinite(totalPrice)) {
                unitPrice = totalPrice;
                if (Number.isFinite(vatAmount) && totalPrice > vatAmount) {
                  const exVat = totalPrice - vatAmount;
                  if (exVat > 0) vatRate = (vatAmount / exVat) * 100;
                }
              }
            }
            if (unitPrice == null) {
              unitPrice =
                li?.unit_price != null ? Number(li.unit_price) :
                  li?.unitPrice != null ? Number(li.unitPrice) :
                    li?.price != null ? Number(li.price) :
                      li?.price_per_unit != null ? Number(li.price_per_unit) :
                        li?.pricePerUnit != null ? Number(li.pricePerUnit) :
                          li?.Price != null ? Number(li.Price) :
                            li?.selling_price != null ? Number(li.selling_price) :
                              li?.sellingPrice != null ? Number(li.sellingPrice) :
                                o?.price != null ? Number(o.price) :
                                  o?.Price != null ? Number(o.Price) : null;
            }

            // If unit price not found, try to calculate from total
            let finalUnitPrice = unitPrice;
            if (!Number.isFinite(finalUnitPrice)) {
              const lineTotal = li?.total != null ? Number(li.total) :
                li?.Total != null ? Number(li.Total) :
                  li?.line_total != null ? Number(li.line_total) :
                    li?.lineTotal != null ? Number(li.lineTotal) :
                      o?.total != null ? Number(o.total) : null;
              if (Number.isFinite(lineTotal) && qty > 0) {
                finalUnitPrice = lineTotal / qty;
              }
            }

            // If VAT rate not set yet, try to get from price.vat_rate (Fyndiq API structure)
            if (!Number.isFinite(vatRate)) {
              if (li?.price?.vat_rate != null) {
                // Fyndiq returns vat_rate as decimal (0.25 = 25%)
                vatRate = Number(li.price.vat_rate) * 100;
              } else if (li?.total_price?.vat_rate != null) {
                vatRate = Number(li.total_price.vat_rate) * 100;
              } else {
                // Fallback to other possible locations
                vatRate = li?.vat_rate != null ? Number(li.vat_rate) :
                  li?.vatRate != null ? Number(li.vatRate) :
                    o?.vat_rate != null ? Number(o.vat_rate) :
                      o?.vatRate != null ? Number(o.vatRate) : null;
                // If vat_rate is a decimal (0.25), convert to percentage
                if (Number.isFinite(vatRate) && vatRate <= 1) {
                  vatRate = vatRate * 100;
                }
              }
            }

            let platformProductId = null;
            if (userId && (sku || mpn)) {
              const mapRes = await db.query(
                `SELECT id::text AS product_id FROM products WHERE user_id = $1 AND (sku = $2 OR mpn = $3) LIMIT 1`,
                [userId, sku || null, mpn || null],
              );
              if (mapRes.length) platformProductId = String(mapRes[0].product_id);
            }

            items.push({
              sku: sku || null,
              productId: platformProductId,
              title: title ? String(title).trim() : null,
              quantity: Math.trunc(qty),
              unitPrice: Number.isFinite(finalUnitPrice) ? finalUnitPrice : null,
              vatRate: Number.isFinite(vatRate) ? vatRate : null,
              raw: li,
            });
          }

          const t = o?.total_amount != null ? Number(o.total_amount) :
            o?.totalAmount != null ? Number(o.totalAmount) :
              o?.total != null ? Number(o.total) :
                o?.Total != null ? Number(o.Total) :
                  o?.order_total != null ? Number(o.order_total) :
                    o?.orderTotal != null ? Number(o.orderTotal) : null;
          if (Number.isFinite(t)) totalAmount = (totalAmount ?? 0) + t;
        }

        if (totalAmount == null && items.length) {
          totalAmount = items.reduce((sum, it) => sum + (Number(it.unitPrice) || 0) * (it.quantity || 0), 0);
        }

        const normalized = {
          channel: 'fyndiq',
          channelOrderId: String(channelOrderId),
          platformOrderNumber,
          placedAt,
          totalAmount: Number.isFinite(totalAmount) ? totalAmount : null,
          currency,
          status,
          shippingAddress,
          billingAddress,
          customer,
          items,
          raw: { primary, group },
        };

        const ingestRes = await this.ordersModel.ingest(req, normalized);

        if (ingestRes.created && ingestRes.orderId) {
          await this.applyInventoryFromOrderId(req, ingestRes.orderId).catch((err) => {
            Logger.warn('Inventory sync failed (non-fatal)', err, { orderId: ingestRes.orderId });
          });
        }

        results.push({ channelOrderId: String(channelOrderId), ...ingestRes });
      }

      return res.json({
        ok: true,
        fetched: orders.length,
        ingested: results.length,
        created: results.filter((r) => r.created).length,
        skippedExisting: results.filter((r) => !r.created).length,
        results,
      });
    } catch (error) {
      Logger.error('Fyndiq orders pull error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ error: 'Failed to pull Fyndiq orders', detail: String(error?.message || error) });
    }
  }

  mapFyndiqOrderStatusToHomebase(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('pending') || s.includes('processing') || s.includes('behandlas') || s === 'created') {
      return 'processing';
    }
    if (s.includes('shipped') || s.includes('skickad') || s.includes('sent') || s === 'fulfilled') {
      return 'shipped';
    }
    if (s.includes('delivered') || s.includes('levererad') || s.includes('completed')) {
      return 'delivered';
    }
    if (s.includes('cancelled') || s.includes('annulerad') || s.includes('canceled')) {
      return 'cancelled';
    }
    return 'processing';
  }

  async applyInventoryFromOrderId(req, orderId) {
    const db = Database.get(req);
    const userId = req.session?.user?.id || req.session?.user?.uuid;
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


