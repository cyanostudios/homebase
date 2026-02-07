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
        const detail = (json && json.message) ? String(json.message) : resp.statusText;
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
    if (placedAt && !placedAt.endsWith('Z') && !placedAt.includes('+') && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(placedAt)) {
      placedAt = placedAt.replace(' ', 'T') + 'Z';
    }

    const price = o.price || o.total_price;
    const currency = (price && price.currency) ? String(price.currency).toUpperCase() : 'SEK';
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
    const unitPriceInclVat = (Number.isFinite(amount) && Number.isFinite(vatAmount)) ? (amount + vatAmount) / (qty || 1) : null;
    const vatRatePct = Number.isFinite(vatRateDoc) ? (vatRateDoc <= 1 ? vatRateDoc * 100 : vatRateDoc) : null;

    const totalPrice = o.total_price;
    const totalAmount = (totalPrice && totalPrice.amount != null && totalPrice.vat_amount != null)
      ? Number(totalPrice.amount) + Number(totalPrice.vat_amount)
      : (Number.isFinite(unitPriceInclVat) && qty > 0 ? unitPriceInclVat * qty : null);

    const userId = req.session?.user?.id || req.session?.user?.uuid;
    const db = Database.get(req);
    const sku = o.article_sku != null ? String(o.article_sku).trim() : null;
    let platformProductId = null;
    if (userId && sku) {
      const mapRes = await db.query(
        `SELECT id::text AS product_id FROM products WHERE user_id = $1 AND sku = $2 LIMIT 1`,
        [userId, sku],
      );
      if (mapRes.length) platformProductId = String(mapRes[0].product_id);
    }

    const title = (o.title != null || o.article_title != null) ? String(o.title || o.article_title).trim() : null;
    const items = [{
      sku: sku || null,
      productId: platformProductId,
      title: title || null,
      quantity: Math.trunc(qty),
      unitPrice: Number.isFinite(unitPriceInclVat) ? unitPriceInclVat : null,
      vatRate: Number.isFinite(vatRatePct) ? vatRatePct : null,
      raw: o,
    }];

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

      const limit = req.body?.perPage != null ? Math.min(Math.max(Number(req.body.perPage), 1), 1000) : 100;
      // Default: only active (open) orders. Send body.state = ['CREATED','FULFILLED'] to include shipped.
      const states = req.body?.state != null
        ? (Array.isArray(req.body.state) ? req.body.state : [req.body.state])
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
            const detail = (json && json.message) ? String(json.message) : resp.statusText;
            return res.status(resp.status).json({ error: 'Failed to fetch Fyndiq orders', detail: String(detail).slice(0, 500) });
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
      return res.status(502).json({ error: 'Failed to pull Fyndiq orders', detail: String(error?.message || error) });
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


