// plugins/cdon-products/controller.js
// CDON connector: settings, product import, tracking, orders.
// Merchants API: https://merchants-api.cdon.com/api/ (docs.cdon.com)
// - Orders: GET /v1/orders/
// - Articles (products): /v2/articles (JSON). Auth: Basic Auth (merchantID + API token).

const { Logger, Context, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const OrdersModel = require('../orders/model');

const CDON_MERCHANTS_API = 'https://merchants-api.cdon.com/api';
const CDON_CATEGORIZATION_API = 'https://cdonexternalapi-prod-apim.azure-api.net/categorization/api/v1';

class CdonProductsController {
  constructor(model) {
    this.model = model;
    this.ordersModel = new OrdersModel();
  }

  // --------- CDON helpers ---------
  // Merchants API (docs.cdon.com): Basic Auth with merchantID and API token only.

  getCdonAuthHeader(merchantId, apiToken) {
    const id = String(merchantId ?? '').trim();
    const token = String(apiToken ?? '').trim();
    if (!id || !token) return '';
    const credentials = Buffer.from(`${id}:${token}`, 'utf8').toString('base64');
    return `Basic ${credentials}`;
  }

  getFetch() {
    // Node 18+ has global fetch; fallback to node-fetch if needed.
    return typeof fetch === 'function'
      ? fetch
      : async (...args) => {
        const mod = await import('node-fetch').catch(() => null);
        if (!mod?.default) throw new Error('fetch is not available (Node <18) and node-fetch is not installed');
        return mod.default(...args);
      };
  }

  async cdonRequest(url, { merchantId, apiToken, method = 'GET', headers = {}, body, timeoutMs = 30_000 } = {}) {
    const fetchFn = this.getFetch();
    const auth = this.getCdonAuthHeader(merchantId, apiToken);
    if (!auth && (merchantId != null || apiToken != null)) {
      throw new Error('CDON auth: merchantID and API token must both be non-empty.');
    }
    const finalHeaders = {
      Accept: 'application/json',
      ...(auth ? { Authorization: auth } : {}),
      ...headers,
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetchFn(url, {
        method,
        headers: finalHeaders,
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const text = await resp.text().catch(() => '');

      let json = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }
      return { resp, text, json };
    } catch (e) {
      clearTimeout(timeoutId);
      const code = e.cause?.code ?? e.code;
      const hint =
        code === 'ENOTFOUND'
          ? ' DNS lookup failed – check network (merchants-api.cdon.com).'
          : code === 'ECONNREFUSED'
            ? ' Connection refused – firewall or API unreachable.'
            : code === 'ETIMEDOUT' || e.name === 'AbortError'
              ? ' Request timed out – try again or check network.'
              : '';
      throw new Error(`CDON API request failed: ${e.message}${hint}`);
    }
  }

  // Best-effort: receipt may be returned as JSON or plain text
  extractReceipt({ json, text }) {
    if (json && typeof json === 'object') {
      const candidates = [
        json.receiptId,
        json.receipt,
        json.id,
        json.ReceiptId,
        json.Receipt,
      ].filter(Boolean);
      if (candidates.length) return String(candidates[0]);
    }
    const t = String(text || '').trim();
    if (/^[a-f0-9]{32}$/i.test(t)) return t;
    return null;
  }

  // Minimal XML escaping for text nodes
  escapeXml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // CDON product data (Merchants API / docs.cdon.com)
  buildProductXml(products) {
    const ns = 'https://schemas.cdon.com/product/4.0/4.12.2/product';
    const items = products
      .map((p) => {
        const id = this.escapeXml(p.cdonId);
        const gtin = p.gtin ? `<gtin>${this.escapeXml(p.gtin)}</gtin>` : '';
        const mpn = p.mpn ? `<mpn>${this.escapeXml(p.mpn)}</mpn>` : '';
        const sku = p.sku ? `<sku>${this.escapeXml(p.sku)}</sku>` : '';
        const title = this.escapeXml(p.title);
        const desc = this.escapeXml(p.description || p.title);
        const brand = this.escapeXml(p.brand || 'Generic');
        const googleCategory = this.escapeXml(p.googleCategory || '1480'); // default fallback

        return [
          '<product>',
          '  <identity>',
          `    <id>${id}</id>`,
          gtin ? `    ${gtin}` : '',
          mpn ? `    ${mpn}` : '',
          sku ? `    ${sku}` : '',
          '  </identity>',
          '  <title><default>' + title + '</default></title>',
          '  <description><default>' + desc + '</default></description>',
          '  <category><google>' + googleCategory + '</google></category>',
          '  <brand>' + brand + '</brand>',
          '</product>',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>\n<marketplace xmlns="${ns}">\n${items}\n</marketplace>\n`;
  }

  // CDON price data (Merchants API; markets se, dk, fi)
  // marketsFilter: optional ['se','dk','fi'] – only include these market blocks; default all.
  buildPriceXml(products, marketOverridesByProductId = new Map(), marketsFilter = ['se', 'dk', 'fi']) {
    const filter = Array.isArray(marketsFilter) && marketsFilter.length
      ? marketsFilter.map((m) => String(m).toLowerCase())
      : ['se', 'dk', 'fi'];
    const ns = 'https://schemas.cdon.com/product/4.0/4.12.2/price';
    const items = products
      .map((p) => {
        const id = this.escapeXml(p.cdonId);
        const pid = String(p?.id || p?.productId || p?.cdonId || '').trim();
        const markets = marketOverridesByProductId.get(pid) || {};
        const basePrice = Number.isFinite(Number(p.priceAmount)) ? Number(p.priceAmount) : null;

        const baseVat = Number.isFinite(Number(p.vatRate)) ? Number(p.vatRate) : 25;
        const shippingCost = Number.isFinite(Number(p.shippingCost)) ? Number(p.shippingCost) : 29;
        const carrier = p.carrier ? this.escapeXml(p.carrier) : 'PostNord';
        const shippingMethod = p.shippingMethod ? this.escapeXml(p.shippingMethod) : 'PickupPoint';

        const buildMarket = (marketKey, fallbackPrice) => {
          const ov = markets[marketKey] || null;
          const price = ov?.priceAmount != null ? Number(ov.priceAmount) : (fallbackPrice != null ? Number(fallbackPrice) : NaN);
          if (!Number.isFinite(price)) return null;

          const sale = price;
          const original = Number.isFinite(Number(ov?.originalPriceAmount)) ? Number(ov.originalPriceAmount) : sale;
          const saleStr = sale.toFixed(2);
          const originalStr = Math.max(original, sale).toFixed(2);
          const vat = Number.isFinite(Number(ov?.vatRate)) ? Number(ov.vatRate) : baseVat;

          return [
            `  <${marketKey}>`,
            `    <salePrice>${saleStr}</salePrice>`,
            `    <originalPrice>${originalStr}</originalPrice>`,
            '    <isShippedFromEU>true</isShippedFromEU>',
            `    <shippingMethod>${shippingMethod}</shippingMethod>`,
            `    <carrier>${carrier}</carrier>`,
            `    <shippingCost>${shippingCost}</shippingCost>`,
            `    <vat>${vat}</vat>`,
            `  </${marketKey}>`,
          ].join('\n');
        };

        const blocks = [];
        for (const m of ['se', 'dk', 'fi']) {
          if (!filter.includes(m)) continue;
          const fallback = m === 'se' ? basePrice : (markets[m]?.priceAmount ?? basePrice);
          const block = buildMarket(m, fallback);
          if (block) blocks.push(block);
        }

        return [
          '<product>',
          `  <id>${id}</id>`,
          ...blocks,
          '</product>',
        ].filter(Boolean).join('\n');
      })
      .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>\n<marketplace xmlns="${ns}">\n${items}\n</marketplace>\n`;
  }

  // CDON availability data (Merchants API; markets se, dk, fi)
  // marketsFilter: optional ['se','dk','fi'] – only include these market blocks; default all.
  buildAvailabilityXml(products, marketOverridesByProductId = new Map(), marketsFilter = ['se', 'dk', 'fi']) {
    const filter = Array.isArray(marketsFilter) && marketsFilter.length
      ? marketsFilter.map((m) => String(m).toLowerCase())
      : ['se', 'dk', 'fi'];
    const ns = 'https://schemas.cdon.com/product/4.0/4.12.2/availability';
    const items = products
      .map((p) => {
        const id = this.escapeXml(p.cdonId);
        const pid = String(p?.id || p?.productId || p?.cdonId || '').trim();
        const markets = marketOverridesByProductId.get(pid) || {};

        const stock = Number.isFinite(Number(p.quantity)) ? Math.max(0, Math.trunc(Number(p.quantity))) : 0;
        const minDays = Number.isFinite(Number(p.deliveryMinDays)) ? Math.max(0, Math.trunc(Number(p.deliveryMinDays))) : 1;
        const maxDays = Number.isFinite(Number(p.deliveryMaxDays))
          ? Math.max(minDays, Math.trunc(Number(p.deliveryMaxDays)))
          : Math.max(minDays, 3);

        const marketStatus = (marketKey) => {
          const ov = markets[marketKey];
          if (ov && typeof ov.active === 'boolean') {
            if (!ov.active) return 'Offline';
          }
          return stock > 0 ? 'Online' : 'Offline';
        };

        const buildMarket = (marketKey) => [
          `  <${marketKey}>`,
          `    <status>${marketStatus(marketKey)}</status>`,
          '    <deliveryTime>',
          `      <min>${minDays}</min>`,
          `      <max>${maxDays}</max>`,
          '    </deliveryTime>',
          `  </${marketKey}>`,
        ].join('\n');

        const blocks = ['se', 'dk', 'fi'].filter((m) => filter.includes(m)).map(buildMarket);
        return [
          '<product>',
          `  <id>${id}</id>`,
          `  <stock>${stock}</stock>`,
          ...blocks,
          '</product>',
        ].join('\n');
      })
      .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>\n<marketplace xmlns="${ns}">\n${items}\n</marketplace>\n`;
  }

  // CDON media data (Merchants API)
  buildMediaXml(products) {
    const ns = 'https://schemas.cdon.com/product/4.0/4.12.2/media';
    const items = products
      .filter((p) => !!p.mainImage)
      .map((p) => {
        const id = this.escapeXml(p.cdonId);
        const main = this.escapeXml(p.mainImage);
        const extras = Array.isArray(p.images) ? p.images.filter(Boolean).slice(0, 10).map((u) => this.escapeXml(u)) : [];
        return [
          '<product>',
          `  <id>${id}</id>`,
          '  <images>',
          `    <main>${main}</main>`,
          ...extras.map((u) => `    <extra>${u}</extra>`),
          '  </images>',
          '</product>',
        ].join('\n');
      })
      .join('\n');

    if (!items) return null;
    return `<?xml version="1.0" encoding="utf-8"?>\n<marketplace xmlns="${ns}">\n${items}\n</marketplace>\n`;
  }

  async getSettings(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      return res.json(settings || null);
    } catch (error) {
      Logger.error('Get CDON settings error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to fetch CDON settings' });
    }
  }

  async putSettings(req, res) {
    try {
      const saved = await this.model.upsertSettings(req, req.body || {});
      return res.json(saved);
    } catch (error) {
      Logger.error('Save CDON settings error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      const message = error?.message || 'Failed to save CDON settings';
      return res.status(500).json({ error: message });
    }
  }

  async testConnection(req, res) {
    try {
      const inBody = req.body || {};
      const settings = inBody.apiKey ? {
        apiKey: String(inBody.apiKey || '').trim(),
        apiSecret: String(inBody.apiSecret || '').trim(),
      } : await this.model.getSettings(req);

      const merchantId = String(settings?.apiKey ?? '').trim();
      const apiToken = String(settings?.apiSecret ?? '').trim();
      if (!merchantId || !apiToken) {
        return res.status(400).json({ ok: false, error: 'Missing CDON credentials (merchantID and API token required).' });
      }

      // Merchants API: GET /v1/orders?state=CREATED&limit=10&page=1 (docs.cdon.com)
      const params = new URLSearchParams({ state: 'CREATED', limit: '10', page: '1' });
      const url = `${CDON_MERCHANTS_API}/v1/orders?${params.toString()}`;
      const { resp, text } = await this.cdonRequest(url, { merchantId, apiToken, method: 'GET' });

      if (resp.status === 401 || resp.status === 403) {
        return res.status(401).json({
          ok: false,
          status: resp.status,
          error:
            'CDON auth rejected. Use Basic Auth: merchantID and API token from CDON Admin (API / Integration).',
        });
      }
      if (!resp.ok) {
        const detail = text ? String(text).slice(0, 500) : null;
        return res.status(resp.status).json({
          ok: false,
          status: resp.status,
          error: `CDON Orders API error (HTTP ${resp.status})${detail ? ': ' + detail : ''}`,
          detail,
        });
      }

      return res.json({
        ok: true,
        status: resp.status,
        endpoint: url,
        message: 'CDON API reachable and token accepted.',
        detail: text ? String(text).slice(0, 500) : null,
      });
    } catch (error) {
      Logger.error('CDON test connection error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to test CDON connection' });
    }
  }

  // ---- Categorization API (external, public) ----
  async getCategories(req, res) {
    try {
      const fetchFn = this.getFetch();
      const url = `${CDON_CATEGORIZATION_API}/categories`;
      const resp = await fetchFn(url, { method: 'GET', headers: { Accept: 'application/json' } });
      const text = await resp.text().catch(() => '');
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      if (!resp.ok) {
        return res.status(resp.status).json({ ok: false, error: 'Failed to fetch CDON categories', detail: json || text });
      }
      return res.json({ ok: true, endpoint: url, items: json ?? [] });
    } catch (error) {
      Logger.error('CDON getCategories error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to fetch CDON categories' });
    }
  }

  async getGoogleCategories(req, res) {
    try {
      const fetchFn = this.getFetch();
      const url = `${CDON_CATEGORIZATION_API}/categories/google`;
      const resp = await fetchFn(url, { method: 'GET', headers: { Accept: 'application/json' } });
      const text = await resp.text().catch(() => '');
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      if (!resp.ok) {
        return res.status(resp.status).json({ ok: false, error: 'Failed to fetch Google categories', detail: json || text });
      }
      return res.json({ ok: true, endpoint: url, items: json ?? [] });
    } catch (error) {
      Logger.error('CDON getGoogleCategories error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to fetch Google categories' });
    }
  }

  async getCategoryAttributes(req, res) {
    try {
      const fetchFn = this.getFetch();
      const categoryId = String(req.params?.categoryId || '').trim();
      if (!categoryId) return res.status(400).json({ ok: false, error: 'Missing categoryId' });
      const url = `${CDON_CATEGORIZATION_API}/categories/${encodeURIComponent(categoryId)}/attributes`;
      const resp = await fetchFn(url, { method: 'GET', headers: { Accept: 'application/json' } });
      const text = await resp.text().catch(() => '');
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      if (!resp.ok) {
        return res.status(resp.status).json({ ok: false, error: 'Failed to fetch category attributes', detail: json || text });
      }
      return res.json({ ok: true, endpoint: url, items: json ?? [] });
    } catch (error) {
      Logger.error('CDON getCategoryAttributes error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to fetch category attributes' });
    }
  }

  // ---- Tracking endpoints (read-only) ----

  async getDeliveries(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) return res.status(400).json({ error: 'CDON settings not found. Save merchantID and API token first.' });

      const takeRaw = req.query?.take != null ? Number(req.query.take) : 100;
      const take = Number.isFinite(takeRaw) ? Math.min(Math.max(Math.trunc(takeRaw), 1), 1000) : 100;
      const url = `${CDON_MERCHANTS_API}/deliveries?take=${take}`;

      const { resp, text, json } = await this.cdonRequest(url, { merchantId: settings.apiKey, apiToken: settings.apiSecret, method: 'GET' });
      if (!resp.ok) {
        return res.status(resp.status).json({ ok: false, error: 'Failed to fetch deliveries', detail: json || text });
      }
      return res.json({ ok: true, endpoint: url, items: json ?? null });
    } catch (error) {
      Logger.error('CDON getDeliveries error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to fetch CDON deliveries' });
    }
  }

  async getDeliveryStatus(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) return res.status(400).json({ error: 'CDON settings not found. Save merchantID and API token first.' });

      const receiptId = String(req.params?.receiptId || '').trim();
      if (!receiptId) return res.status(400).json({ error: 'Missing receiptId' });

      const url = `${CDON_MERCHANTS_API}/deliveries/${encodeURIComponent(receiptId)}`;
      const { resp, text, json } = await this.cdonRequest(url, { merchantId: settings.apiKey, apiToken: settings.apiSecret, method: 'GET' });
      if (!resp.ok) {
        return res.status(resp.status).json({ ok: false, error: 'Failed to fetch delivery status', detail: json || text });
      }
      return res.json({ ok: true, endpoint: url, status: json ?? null });
    } catch (error) {
      Logger.error('CDON getDeliveryStatus error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to fetch CDON delivery status' });
    }
  }

  async getDeliveryFailures(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) return res.status(400).json({ error: 'CDON settings not found. Save merchantID and API token first.' });

      const receiptId = String(req.params?.receiptId || '').trim();
      if (!receiptId) return res.status(400).json({ error: 'Missing receiptId' });

      const url = `${CDON_MERCHANTS_API}/deliveries/${encodeURIComponent(receiptId)}/failures`;
      const { resp, text, json } = await this.cdonRequest(url, { merchantId: settings.apiKey, apiToken: settings.apiSecret, method: 'GET' });
      if (!resp.ok) {
        return res.status(resp.status).json({ ok: false, error: 'Failed to fetch delivery failures', detail: json || text });
      }
      return res.json({ ok: true, endpoint: url, failures: json ?? null });
    } catch (error) {
      Logger.error('CDON getDeliveryFailures error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to fetch CDON delivery failures' });
    }
  }

  // Merchants API: PUT /v1/orders/{order_id}/fulfill (ship order + tracking)
  async fulfillOrder(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      const merchantId = String(settings?.apiKey ?? '').trim();
      const apiToken = String(settings?.apiSecret ?? '').trim();
      if (!settings || !merchantId || !apiToken) {
        return res.status(400).json({ error: 'CDON settings not found. Save merchantID and API token first.' });
      }
      const orderId = String(req.params?.orderId ?? '').trim();
      if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
      const tracking = Array.isArray(req.body?.tracking_information) ? req.body.tracking_information : [];
      const body = { tracking_information: tracking };
      const url = `${CDON_MERCHANTS_API}/v1/orders/${encodeURIComponent(orderId)}/fulfill`;
      const { resp, text, json } = await this.cdonRequest(url, {
        merchantId,
        apiToken,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        return res.status(resp.status).json({
          ok: false,
          error: `CDON fulfill failed (HTTP ${resp.status})`,
          detail: (json && (json.message ?? json.error ?? json.description)) || text,
        });
      }
      return res.json({ ok: true, endpoint: url, result: json ?? null });
    } catch (error) {
      Logger.error('CDON fulfillOrder error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ error: 'CDON fulfill failed', detail: String(error?.message || error) });
    }
  }

  // Merchants API: PUT /v1/orders/{order_id}/cancel
  async cancelOrder(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      const merchantId = String(settings?.apiKey ?? '').trim();
      const apiToken = String(settings?.apiSecret ?? '').trim();
      if (!settings || !merchantId || !apiToken) {
        return res.status(400).json({ error: 'CDON settings not found. Save merchantID and API token first.' });
      }
      const orderId = String(req.params?.orderId ?? '').trim();
      if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
      const url = `${CDON_MERCHANTS_API}/v1/orders/${encodeURIComponent(orderId)}/cancel`;
      const { resp, text, json } = await this.cdonRequest(url, {
        merchantId,
        apiToken,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        return res.status(resp.status).json({
          ok: false,
          error: `CDON cancel failed (HTTP ${resp.status})`,
          detail: (json && (json.message ?? json.error ?? json.description)) || text,
        });
      }
      return res.json({ ok: true, endpoint: url, result: json ?? null });
    } catch (error) {
      Logger.error('CDON cancelOrder error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ error: 'CDON cancel failed', detail: String(error?.message || error) });
    }
  }

  // POST /api/cdon-products/products/export
  async exportProducts(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) {
        return res.status(400).json({ error: 'CDON settings not found. Save merchantID and API token first.' });
      }

      const rawProducts = Array.isArray(req.body?.products) ? req.body.products : null;
      if (!rawProducts || rawProducts.length === 0) {
        return res.status(400).json({ error: 'Request must include products: []' });
      }

      const allowedMarkets = ['se', 'dk', 'fi'];
      let marketsFilter = allowedMarkets;
      if (Array.isArray(req.body?.markets) && req.body.markets.length > 0) {
        const normalized = req.body.markets.map((m) => String(m).toLowerCase()).filter((m) => allowedMarkets.includes(m));
        if (normalized.length) marketsFilter = normalized;
      }

      // Build normalized product payloads (simple products only, MVP)
      const normalized = [];
      const items = [];

      for (const p of rawProducts) {
        const productId = String(p?.id || '').trim();
        const title = String(p?.title || '').trim();
        const priceAmount = p?.priceAmount;

        if (!productId || !title || priceAmount == null) {
          if (productId) {
            await this.model.upsertChannelMap(req, {
              productId,
              channel: 'cdon',
              enabled: true,
              externalId: null,
              status: 'error',
              error: 'Missing required fields (id/title/priceAmount)',
            });
            await this.model.logChannelError(req, {
              channel: 'cdon',
              productId,
              payload: p,
              response: null,
              message: 'Missing required fields (id/title/priceAmount)',
            });
            items.push({ productId, status: 'error', error: 'Missing required fields' });
          }
          continue;
        }

        // CDON accepts either GTIN/EAN or MPN depending on category/brand rules.
        // Our platform doesn't have a dedicated MPN field yet, so we treat SKU as MPN fallback.
        const gtin = p?.gtin != null ? String(p.gtin).trim() : '';
        const sku = p?.sku != null ? String(p.sku).trim() : '';
        const mpn = p?.mpn != null ? String(p.mpn).trim() : (sku || null);

        if (!gtin && !mpn) {
          await this.model.upsertChannelMap(req, {
            productId,
            channel: 'cdon',
            enabled: true,
            externalId: null,
            status: 'error',
            error: 'Missing required identifier (GTIN/EAN or MPN)',
          });
          await this.model.logChannelError(req, {
            channel: 'cdon',
            productId,
            payload: p,
            response: null,
            message: 'Missing required identifier (GTIN/EAN or MPN)',
          });
          items.push({ productId, status: 'error', error: 'Missing GTIN/EAN and MPN' });
          continue;
        }

        // If categories contains a numeric-looking item, treat it as Google category ID for MVP.
        const categories = Array.isArray(p?.categories) ? p.categories : [];
        const googleCategory = categories
          .map((c) => String(c || '').trim())
          .find((c) => /^[0-9]{1,10}$/.test(c)) || null;

        normalized.push({
          productId,
          cdonId: productId,
          sku: sku || null,
          gtin: gtin || null,
          mpn,
          title,
          description: p?.description != null ? String(p.description).trim() : null,
          brand: p?.brand != null ? String(p.brand).trim() : null,
          googleCategory,
          priceAmount: Number(p.priceAmount),
          vatRate: p?.vatRate != null ? Number(p.vatRate) : 25,
          quantity: p?.quantity != null ? Number(p.quantity) : 0,
          mainImage: p?.mainImage != null ? String(p.mainImage).trim() : null,
          images: Array.isArray(p?.images) ? p.images : [],
        });
      }

      if (!normalized.length) {
        return res.status(400).json({
          ok: false,
          error: 'No valid products to export (check required fields: id, title, priceAmount, sku or gtin)',
          counts: { requested: rawProducts.length, success: 0, error: items.length },
          items,
        });
      }

      // Pull per-market overrides (SE/DK/FI) from channel_product_overrides
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      const productIds = normalized.map((p) => String(p.productId));
      const overridesByProductId = new Map();

      if (userId && productIds.length) {
        const rows = await db.query(
          `
          SELECT
            o.product_id::text AS product_id,
            COALESCE(ci.market, o.instance) AS market,
            o.active,
            o.price_amount,
            o.currency,
            o.vat_rate,
            o.category
          FROM channel_product_overrides o
          LEFT JOIN channel_instances ci
            ON ci.id = o.channel_instance_id
          WHERE o.user_id = $1
            AND o.channel = 'cdon'
            AND o.product_id::text = ANY($2::text[])
            AND lower(COALESCE(ci.market, o.instance)) IN ('se','dk','fi')
          `,
          [userId, productIds],
        );

        for (const r of rows) {
          const pid = String(r.product_id);
          const inst = String(r.market).toLowerCase();
          if (!overridesByProductId.has(pid)) overridesByProductId.set(pid, {});
          overridesByProductId.get(pid)[inst] = {
            active: !!r.active,
            priceAmount: r.price_amount != null ? Number(r.price_amount) : null,
            currency: r.currency || null,
            vatRate: r.vat_rate != null ? Number(r.vat_rate) : null,
            category: r.category || null,
          };
        }
      }

      // Merchants API: POST /v2/articles/bulk (JSON body)
      const marketsUpper = marketsFilter.map((m) => m.toUpperCase());
      const articles = normalized.map((p) => {
        const overrides = overridesByProductId.get(String(p.productId)) || {};
        const price = marketsUpper.map((market) => {
          const ov = overrides[market.toLowerCase()];
          const amount = ov?.priceAmount != null ? Number(ov.priceAmount) : p.priceAmount;
          const currency = ov?.currency || (market === 'SE' ? 'SEK' : market === 'DK' ? 'DKK' : 'SEK');
          const vatRate = ov?.vatRate != null ? Number(ov.vatRate) : p.vatRate;
          return {
            market,
            value: {
              amount_including_vat: amount,
              currency,
              vat_rate: vatRate >= 1 ? vatRate / 100 : vatRate,
            },
          };
        });
        const shipping_time = marketsUpper.map((market) => ({ market, min: 1, max: 5 }));
        const title = [
          { language: 'sv-SE', value: p.title || '' },
          { language: 'en-US', value: p.title || '' },
        ];
        const description = [
          { language: 'sv-SE', value: (p.description || p.title || '').slice(0, 5000) },
          { language: 'en-US', value: (p.description || p.title || '').slice(0, 5000) },
        ];
        return {
          sku: p.sku || p.productId,
          status: 'for sale',
          quantity: Math.max(0, Math.floor(p.quantity)),
          main_image: p.mainImage || null,
          markets: marketsUpper,
          price,
          shipping_time,
          title,
          description,
          category: String(p.googleCategory || overrides['se']?.category || overrides['dk']?.category || '1124'),
        };
      });

      const url = `${CDON_MERCHANTS_API}/v2/articles/bulk`;
      const merchantId = String(settings.apiKey).trim();
      const apiToken = String(settings.apiSecret).trim();
      const bulkBody = { articles };
      const { resp, text, json: resJson } = await this.cdonRequest(url, {
        merchantId,
        apiToken,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkBody),
      });

      if (!resp.ok) {
        const message = (resJson && (resJson.message ?? resJson.error ?? resJson.description)) || text || resp.statusText;
        Logger.error('CDON articles/bulk failed', { status: resp.status, message, userId: Context.getUserId(req) });
        return res.status(resp.status).json({
          ok: false,
          error: `CDON articles bulk failed (HTTP ${resp.status})`,
          detail: message,
        });
      }

      for (const p of normalized) {
        await this.model.upsertChannelMap(req, {
          productId: p.productId,
          channel: 'cdon',
          enabled: true,
          externalId: p.sku || p.productId,
          status: 'synced',
          error: null,
        });
        items.push({ productId: p.productId, status: 'synced', externalId: p.sku || p.productId });
      }

      return res.json({
        ok: true,
        endpoint: url,
        counts: { requested: rawProducts.length, success: normalized.length, error: items.filter((x) => x.status === 'error').length },
        items,
      });
    } catch (error) {
      Logger.error('CDON export error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ error: 'Export to CDON failed', detail: String(error?.message || error) });
    }
  }

  // DELETE /api/cdon-products/batch
  // body: { productIds: string[] }
  async batchDelete(req, res) {
    try {
      const productIdsRaw = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
      const productIds = Array.from(new Set(productIdsRaw.map((x) => String(x).trim()).filter(Boolean)));

      if (productIds.length === 0) {
        return res.json({ ok: true, deleted: 0, items: [] });
      }
      if (productIds.length > 500) {
        return res.status(400).json({ error: 'Too many productIds (max 500)', code: 'VALIDATION_ERROR' });
      }

      const items = [];
      for (const pid of productIds) {
        await this.model.upsertChannelMap(req, {
          productId: pid,
          channel: 'cdon',
          enabled: false,
          externalId: null,
          status: 'idle',
          error: null,
        });
        items.push({ productId: pid, status: 'deleted' });
      }

      return res.json({
        ok: true,
        deleted: items.length,
        items,
      });
    } catch (error) {
      Logger.error('CDON batch delete error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ error: 'Delete from CDON failed', detail: String(error?.message || error) });
    }
  }

  // --------- Order import (Merchants API) ---------
  // GET /v1/orders?state=... Valid states per CDON: CREATED (ny), ACCEPTED (accepterad), FULFILLED (hanterad/skickad), NOT_FULFILLED (avbokad/återbetald). CANCELLED is not valid.

  static CDON_ORDER_STATES = ['CREATED', 'ACCEPTED', 'NOT_FULFILLED', 'FULFILLED'];
  /** Only these are synced incrementally (open orders). NOT_FULFILLED/FULFILLED skipped. */
  static CDON_ORDER_OPEN_STATES = ['CREATED', 'ACCEPTED'];
  static CDON_ORDER_MARKETS = ['SE', 'DK', 'FI'];

  /**
   * Internal: sync open CDON orders only (CREATED, ACCEPTED), with full pagination.
   * Used by OrderSyncService. Returns { fetched, created, error? }.
   */
  async syncOpenOrders(req) {
    const settings = await this.model.getSettings(req);
    const merchantId = String(settings?.apiKey ?? '').trim();
    const apiToken = String(settings?.apiSecret ?? '').trim();
    if (!settings || !merchantId || !apiToken) {
      return { fetched: 0, created: 0 };
    }

    const limit = 100;
    const base = `${CDON_MERCHANTS_API}/v1/orders`;
    const allOrderPayloads = [];

    for (const state of CdonProductsController.CDON_ORDER_OPEN_STATES) {
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams({ state, limit: String(limit), page: String(page) });
        const url = `${base}?${params.toString()}`;
        const { resp, text, json } = await this.cdonRequest(url, {
          merchantId,
          apiToken,
          method: 'GET',
        });
        if (!resp.ok) {
          const detail = (json && (json.message ?? json.error ?? json.description)) ?? text ?? resp.statusText;
          return { fetched: allOrderPayloads.length, created: -1, error: String(detail).slice(0, 500) };
        }

        let payloads = [];
        if (Array.isArray(json)) payloads = json;
        else if (json?.orders) payloads = Array.isArray(json.orders) ? json.orders : [json.orders];
        else if (json?.data) payloads = Array.isArray(json.data) ? json.data : [json.data];
        else if (json?.OrderDetails !== undefined) payloads = [json];

        allOrderPayloads.push(...payloads);
        hasMore = payloads.length >= limit;
        page += 1;
      }
    }

    const groupKey = (o) => (o?.id != null ? `id:${o.id}` : null);
    const byGroup = new Map();
    for (const row of allOrderPayloads) {
      const raw = row?.OrderDetails ?? row;
      if (!raw) continue;
      const key = groupKey(raw);
      if (key == null) continue;
      if (!byGroup.has(key)) {
        byGroup.set(key, {
          id: String(raw.id),
          market: raw.market,
          state: raw.state,
          created_at: raw.created_at,
          shipping_address: raw.shipping_address,
          tracking_information: raw.tracking_information,
          total_price: null,
          order_rows: [],
        });
      }
      const order = byGroup.get(key);
      order.order_rows.push(raw);
      const lineAmount = raw.total_price?.amount ?? raw.price?.amount ?? raw.total_price ?? raw.price ?? 0;
      const amt = Number(lineAmount);
      if (Number.isFinite(amt)) {
        order.total_price = order.total_price ?? { amount: 0, currency: raw.total_price?.currency ?? raw.price?.currency ?? 'SEK' };
        order.total_price.amount += amt;
      }
    }
    const orderList = Array.from(byGroup.values());
    const seen = new Set();
    let orders = orderList.filter((o) => {
      const key = o?.id ?? o?.OrderKey ?? o?.OrderId ?? o?.orderId;
      if (key == null) return false;
      const k = String(key);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    orders = orders.filter((o) => {
      const market = String(o?.market ?? o?.Market ?? '').toUpperCase();
      if (!market) return true;
      return CdonProductsController.CDON_ORDER_MARKETS.includes(market);
    });

    const userId = req.session?.user?.id || req.session?.user?.uuid;
    const db = Database.get(req);
    let created = 0;
    for (const o of orders) {
      const normalized = await this.normalizeCdonOrderToHomebase(o, userId, db);
      if (!normalized) continue;
      const ingestRes = await this.ordersModel.ingest(req, normalized);
      if (ingestRes.created) created += 1;
      if (ingestRes.created && ingestRes.orderId) {
        await this.applyInventoryFromOrderId(req, ingestRes.orderId).catch(() => {});
      }
    }
    return { fetched: orders.length, created };
  }

  async pullOrders(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      const merchantId = String(settings?.apiKey ?? '').trim();
      const apiToken = String(settings?.apiSecret ?? '').trim();
      if (!settings || !merchantId || !apiToken) {
        return res.status(400).json({ error: 'CDON settings not found. Save merchantID and API token first.' });
      }

      const limit = Math.min(Math.max(Number(req.body?.limit) || 100, 1), 1000);
      const base = `${CDON_MERCHANTS_API}/v1/orders`;
      const allOrderPayloads = [];

      for (const state of CdonProductsController.CDON_ORDER_STATES) {
        const params = new URLSearchParams({ state, limit: String(limit), page: '1' });
        const url = `${base}?${params.toString()}`;
        const { resp, text, json } = await this.cdonRequest(url, {
          merchantId,
          apiToken,
          method: 'GET',
        });

        if (!resp.ok) {
          const detail =
            (json && (json.message ?? json.error ?? json.description ?? json.Message ?? json.ErrorDescription)) ??
            (typeof text === 'string' && text ? text : null) ??
            resp.statusText ??
            `HTTP ${resp.status}`;
          const detailStr = String(detail).slice(0, 400);
          Logger.warn('CDON orders fetch failed', {
            userId: req.session?.user?.id ?? req.session?.user?.uuid,
            state,
            status: resp.status,
            textLen: (text && text.length) || 0,
            textSample: typeof text === 'string' ? text.slice(0, 300) : '',
            jsonKeys: json && typeof json === 'object' ? Object.keys(json) : null,
          });
          const hint =
            resp.status === 401 || resp.status === 403
              ? ' Use Basic Auth: merchantID and API token from CDON Admin (API / Integration).'
              : '';
          const msg = `Failed to fetch CDON orders (state=${state}) (HTTP ${resp.status}): ${detailStr}${hint}`;
          return res.status(resp.status).json({ error: msg, detail: detailStr });
        }

        let payloads = [];
        if (Array.isArray(json)) {
          payloads = json;
        } else if (json && (Array.isArray(json.orders) || json.orders)) {
          payloads = Array.isArray(json.orders) ? json.orders : [json.orders];
        } else if (json && (Array.isArray(json.data) || json.data)) {
          payloads = Array.isArray(json.data) ? json.data : [json.data];
        } else if (json && (json.OrderDetails || json.OrderDetails === undefined)) {
          payloads = [json];
        }
        allOrderPayloads.push(...payloads);
      }

      // Group CDON orders by CDON order id only. No fallbacks.
      const groupKey = (o) => (o?.id != null ? `id:${o.id}` : null);

      const byGroup = new Map();
      for (const row of allOrderPayloads) {
        const raw = row?.OrderDetails ?? row;
        if (!raw) continue;
        const key = groupKey(raw);
        if (key == null) continue;
        if (!byGroup.has(key)) {
          byGroup.set(key, {
            id: String(raw.id),
            market: raw.market,
            state: raw.state,
            created_at: raw.created_at,
            shipping_address: raw.shipping_address,
            tracking_information: raw.tracking_information,
            total_price: null,
            order_rows: [],
          });
        }
        const order = byGroup.get(key);
        order.order_rows.push(raw);

        // Accumulate total price if it's a flat line item format
        const lineAmount = raw.total_price?.amount ?? raw.price?.amount ?? raw.total_price ?? raw.price ?? 0;
        const amt = Number(lineAmount);
        if (Number.isFinite(amt)) {
          order.total_price = order.total_price ?? { amount: 0, currency: raw.total_price?.currency ?? raw.price?.currency ?? 'SEK' };
          order.total_price.amount += amt;
          if (raw.total_price?.currency || raw.price?.currency) order.total_price.currency = raw.total_price?.currency ?? raw.price?.currency;
        }
      }
      const orderList = Array.from(byGroup.values());

      const seen = new Set();
      let orders = orderList.filter((o) => {
        const key = o?.OrderKey ?? o?.OrderId ?? o?.orderId ?? o?.id ?? o?.OrderNumber ?? o?.orderNumber;
        if (key == null) return false;
        const k = String(key);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      // Client-side market filter: keep only SE, DK, FI; keep orders with no market info
      orders = orders.filter((o) => {
        const market = String(
          o?.market ?? o?.Market ?? o?.country_code ?? o?.CountryCode ?? o?.countryCode ?? ''
        ).toUpperCase();
        if (!market) return true;
        return CdonProductsController.CDON_ORDER_MARKETS.includes(market);
      });
      const userId = req.session?.user?.id || req.session?.user?.uuid;
      const db = Database.get(req);
      const results = [];

      for (const o of orders) {
        const normalized = await this.normalizeCdonOrderToHomebase(o, userId, db);
        if (!normalized) continue;

        const ingestRes = await this.ordersModel.ingest(req, normalized);
        if (ingestRes.created && ingestRes.orderId) {
          await this.applyInventoryFromOrderId(req, ingestRes.orderId).catch((err) => {
            Logger.warn('Inventory sync failed (non-fatal)', err, { orderId: ingestRes.orderId });
          });
        }
        results.push({ channelOrderId: normalized.channelOrderId, ...ingestRes });
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
      Logger.error('CDON orders pull error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ error: 'Failed to pull CDON orders', detail: String(error?.message || error) });
    }
  }

  /**
   * Normalize CDON order (Merchants API or legacy) to homebase shape.
   * Merchants API: id, market, state, created_at, shipping_address (first_name, last_name, street_address, city, postal_code, country, phone_number), total_price { amount, currency }, order_rows or flat article_* per line.
   */
  async normalizeCdonOrderToHomebase(o, userId, db) {
    // CDON Merchants API: use only id as order identifier. No fallbacks.
    const channelOrderId = o?.id != null ? String(o.id) : null;
    if (channelOrderId == null) return null;

    const ci = o?.CustomerInfo ?? o?.customer_info ?? o?.customerInfo ?? {};
    const ship = ci?.ShippingAddress ?? ci?.shipping_address ?? ci?.shippingAddress ?? o?.shipping_address ?? {};
    const bill = ci?.BillingAddress ?? ci?.billing_address ?? ci?.billingAddress ?? o?.billing_address ?? {};
    const phones = ci?.Phones ?? ci?.phones ?? {};
    const email =
      ci?.EmailAddress ?? ci?.email_address ?? ci?.emailAddress ?? ci?.email ?? null;
    const shipName = ship?.Name ?? ship?.name ?? ship?.first_name ?? ship?.firstName ?? null;
    const shipLastName = ship?.last_name ?? ship?.lastName ?? null;
    const phone =
      ship?.phone_number ?? ship?.phoneNumber ??
      phones?.PhoneMobile ?? phones?.phone_mobile ?? phones?.phoneMobile ??
      phones?.PhoneWork ?? phones?.phone_work ?? phones?.phoneWork ??
      phones?.mobile ?? phones?.work ??
      null;

    const totalPriceObj = o?.total_price ?? o?.totalPrice;
    const orderLevelTotal =
      totalPriceObj != null && typeof totalPriceObj === 'object' && totalPriceObj.amount != null
        ? Number(totalPriceObj.amount)
        : Number(o?.TotalAmount ?? o?.total_amount ?? o?.totalAmount ?? NaN);
    const currency =
      (totalPriceObj?.currency ?? o?.CurrencyCode ?? o?.currency_code ?? o?.currencyCode ?? o?.currency ?? 'SEK').toString().toUpperCase();
    let placedAt = o?.CreatedDateUtc ?? o?.created_date_utc ?? o?.createdDateUtc ?? null;
    if (placedAt) {
      placedAt = String(placedAt).trim();
      if (placedAt && !placedAt.endsWith('Z') && !placedAt.includes('+') && !placedAt.includes('GMT')) {
        placedAt += 'Z';
      }
    } else {
      placedAt = o?.OrderDate ?? o?.order_date ?? o?.orderDate ?? o?.created_at ?? null;
    }

    const normalized = {
      channel: 'cdon',
      channelOrderId,
      platformOrderNumber: channelOrderId,
      placedAt,
      totalAmount: Number.isFinite(orderLevelTotal) ? orderLevelTotal : null,
      currency: currency || 'SEK',
      status: this.mapCdonOrderStatusToHomebase(o?.State ?? o?.state),
      shippingAddress:
        ship && typeof ship === 'object' && Object.keys(ship).length
          ? {
            ...ship,
            name: shipName ?? ship?.name ?? ship?.Name ?? ([ship?.first_name, ship?.last_name].filter(Boolean).join(' ').trim() || undefined),
            street_address: ship?.street_address ?? ship?.streetAddress ?? ship?.StreetAddress ?? ship?.Street,
            postal_code: ship?.postal_code ?? ship?.postalCode ?? ship?.PostalCode ?? ship?.ZipCode,
            city: ship?.city ?? ship?.City,
            country: ship?.country ?? ship?.Country,
          }
          : null,
      billingAddress:
        bill && typeof bill === 'object' && Object.keys(bill).length
          ? { ...bill, name: bill?.Name ?? bill?.name ?? bill?.first_name ?? bill?.firstName }
          : null,
      customer: {
        email: email ? String(email).trim() : null,
        firstName: shipName ? String(shipName).trim() : null,
        lastName: shipLastName ? String(shipLastName).trim() : null,
        phone: phone ? String(phone).trim() : null,
      },
      items: [],
      raw: o,
    };

    let lineItems = [];
    const rows = o?.order_rows ?? o?.OrderRows ?? o?.orderRows ?? o?.lines ?? o?.Lines ??
      o?.items ?? o?.Items ?? o?.line_items ?? o?.lineItems ?? o?.LineItems ??
      o?.rows ?? o?.Rows ?? o?.order_lines ?? o?.orderLines ?? o?.OrderLines;
    if (Array.isArray(rows) && rows.length > 0) lineItems = rows;
    else if (o?.article_id != null || o?.article_sku != null) lineItems = [o];
    for (const li of lineItems) {
      const qty = Number(li?.Quantity ?? li?.quantity ?? li?.qty ?? li?.Qty ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const productId = li?.ProductId ?? li?.product_id ?? li?.productId ?? li?.article_sku ?? li?.sku ?? li?.article_id ?? null;
      const sku = productId != null ? String(productId).trim() : null;

      let platformProductId = null;
      if (userId && (sku || (li?.mpn ?? li?.Mpn))) {
        const mapRes = await db.query(
          `SELECT id FROM products WHERE user_id = $1 AND (sku = $2 OR mpn = $3) LIMIT 1`,
          [userId, sku || null, li?.mpn ?? li?.Mpn ?? null],
        );
        if (mapRes.length) platformProductId = String(mapRes[0].id);
      }

      // CDON: price.amount + price.vat_amount = line total incl VAT (support says amount is incl; some responses send amount ex VAT). When both present, use amount+vat_amount so ex-VAT amount (319.20) + vat (79.80) = 399.
      const priceObj = li?.price ?? li?.Price;
      const totalPriceLine = li?.total_price ?? li?.totalPrice ?? li?.TotalPrice;
      const amountFromPrice = priceObj != null && typeof priceObj === 'object'
        ? (priceObj.amount ?? priceObj.Amount ?? priceObj.value ?? priceObj.Value)
        : typeof priceObj === 'number' && Number.isFinite(priceObj)
          ? priceObj
          : typeof priceObj === 'string' && priceObj.trim() !== ''
            ? Number(priceObj)
            : null;
      const vatAmountFromPrice = priceObj != null && typeof priceObj === 'object'
        ? (priceObj.vat_amount ?? priceObj.vatAmount ?? priceObj.VatAmount)
        : null;
      const amt = amountFromPrice != null ? Number(amountFromPrice) : null;
      const vatAmt = vatAmountFromPrice != null && Number.isFinite(Number(vatAmountFromPrice)) ? Number(vatAmountFromPrice) : null;
      const lineTotalFromPrice =
        amt != null && vatAmt != null ? amt + vatAmt : amountFromPrice;
      const amountFromTotalPrice = totalPriceLine != null && typeof totalPriceLine === 'object'
        ? (totalPriceLine.amount ?? totalPriceLine.Amount ?? totalPriceLine.value ?? totalPriceLine.Value)
        : typeof totalPriceLine === 'number'
          ? totalPriceLine
          : typeof totalPriceLine === 'string' && totalPriceLine.trim() !== ''
            ? Number(totalPriceLine)
            : null;
      const vatAmountFromTotalPrice = totalPriceLine != null && typeof totalPriceLine === 'object'
        ? (totalPriceLine.vat_amount ?? totalPriceLine.vatAmount ?? totalPriceLine.VatAmount)
        : null;
      const amtT = amountFromTotalPrice != null ? Number(amountFromTotalPrice) : null;
      const vatAmtT = vatAmountFromTotalPrice != null && Number.isFinite(Number(vatAmountFromTotalPrice)) ? Number(vatAmountFromTotalPrice) : null;
      const lineTotalFromTotalPrice =
        amtT != null && vatAmtT != null ? amtT + vatAmtT : amountFromTotalPrice;
      const lineTotalFromDoc = lineTotalFromPrice ?? lineTotalFromTotalPrice;
      const debitedAmount = li?.debited_amount ?? li?.DebitedAmount;
      const lineTotalFromOther =
        lineTotalFromDoc == null
          ? (li?.line_total ?? li?.lineTotal ?? li?.LineTotal ??
            li?.total ?? li?.Total ?? li?.row_total ?? li?.RowTotal ??
            debitedAmount ??
            li?.article_price ?? li?.ArticlePrice ??
            li?.amount ?? li?.Amount)
          : null;
      const lineAmountRaw = lineTotalFromDoc ?? lineTotalFromOther;
      const lineAmount = lineAmountRaw != null && Number.isFinite(Number(lineAmountRaw)) ? Number(lineAmountRaw) : null;
      const lineAmountSourceIsDebitedAmount = lineTotalFromDoc == null && lineAmount != null && debitedAmount != null && Number(lineAmountRaw) === Number(debitedAmount);
      const unitPriceFromTotal = lineAmount != null && qty > 0 ? lineAmount / qty : null;
      const unitPriceRaw =
        li?.PricePerUnit ?? li?.price_per_unit ?? li?.pricePerUnit ??
        li?.unit_price ?? li?.unitPrice ?? li?.UnitPrice ??
        (typeof li?.price === 'number' ? li.price / qty : null) ??
        (typeof li?.total_price === 'number' ? li.total_price / qty : null) ??
        (li?.Price != null ? Number(li.Price) / (qty || 1) : null);
      const unitPrice =
        lineTotalFromDoc != null
          ? unitPriceFromTotal
          : (unitPriceRaw != null ? Number(unitPriceRaw) : unitPriceFromTotal);
      const hasAmountInclVat =
        (lineTotalFromPrice != null && priceObj != null) ||
        (lineTotalFromTotalPrice != null && totalPriceLine != null) ||
        li?.amount_including_vat != null ||
        li?.price_including_vat != null ||
        lineAmountSourceIsDebitedAmount;
      // Doc: price.vat_rate (decimal 0.25), price.vat_amount; store vat_rate as percentage (25).
      const vatRaw =
        (priceObj && typeof priceObj === 'object' ? (priceObj.vat_rate ?? priceObj.vatRate ?? priceObj.VatRate) : null) ??
        (totalPriceLine && typeof totalPriceLine === 'object' ? (totalPriceLine.vat_rate ?? totalPriceLine.vatRate ?? totalPriceLine.VatRate) : null) ??
        li?.article_vat_rate ??
        li?.vat_percentage ?? li?.vatPercentage ?? li?.VatPercentage ?? li?.vat_rate ?? li?.vat ??
        li?.tax_rate ?? li?.taxRate ?? o?.vat_percentage ?? o?.vat_rate ?? o?.vat ?? o?.VatPercentage ?? o?.VatRate;
      let vatRate = vatRaw != null ? Number(vatRaw) : null;
      if (Number.isFinite(vatRate) && vatRate > 0 && vatRate <= 1) {
        vatRate = vatRate * 100;
      }
      const title =
        li?.ProductName ?? li?.product_name ?? li?.productName ?? li?.article_title ?? li?.article_title ?? li?.Name ?? li?.name ?? li?.title ?? null;

      // CDON: price.amount is always INCLUDING VAT — use as-is. Only convert to incl when we got the value from other fields (no price.amount) and we have vat_rate from CDON.
      let unitPriceToStore = unitPrice != null && Number.isFinite(unitPrice) ? unitPrice : null;
      if (
        unitPriceToStore != null &&
        !hasAmountInclVat &&
        Number.isFinite(vatRate) &&
        vatRate > 0
      ) {
        unitPriceToStore = unitPriceToStore * (1 + vatRate / 100);
      }

      normalized.items.push({
        sku,
        productId: platformProductId,
        title: title ? String(title).trim() : null,
        quantity: Math.trunc(qty),
        unitPrice: unitPriceToStore,
        vatRate: Number.isFinite(vatRate) ? vatRate : null,
        raw: li,
      });
    }

    // CDON: order total = sum of line totals (price.amount is incl VAT). Always overwrite with line sum when we have items so we never show order-level total that might be ex-VAT.
    const lineTotalSum = normalized.items.reduce((sum, it) => {
      const p = it.unitPrice != null && Number.isFinite(it.unitPrice) ? it.unitPrice : 0;
      const q = Number(it.quantity) || 0;
      return sum + p * q;
    }, 0);
    if (normalized.items.length > 0 && Number.isFinite(lineTotalSum)) {
      normalized.totalAmount = lineTotalSum > 0 ? Math.round(lineTotalSum * 100) / 100 : (normalized.totalAmount ?? 0);
    }

    return normalized;
  }

  // CDON GET /v1/orders valid states: CREATED (ny), ACCEPTED (accepterad), FULFILLED (hanterad/skickad), NOT_FULFILLED (avbokad/återbetald). CANCELLED is not valid.
  mapCdonOrderStatusToHomebase(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'NOT_FULFILLED' || s === 'CANCELLED' || s.includes('CANCEL') || s.includes('RETURNED')) return 'cancelled';
    // UI only exposes Delivered; treat shipped and delivered as the same internal status.
    if (s === 'FULFILLED' || s.includes('DELIVERED') || s.includes('SHIPPED')) return 'delivered';
    if (s === 'CREATED' || s === 'ACCEPTED') return 'processing';
    const lower = s.toLowerCase();
    if (lower.includes('cancelled') || lower.includes('annulerad') || lower.includes('returned')) return 'cancelled';
    if (lower.includes('delivered') || lower.includes('levererad')) return 'delivered';
    if (lower.includes('shipped') || lower.includes('skickad') || lower.includes('sent')) return 'delivered';
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

module.exports = CdonProductsController;

