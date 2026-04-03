// plugins/cdon-products/controller.js
// CDON connector: settings, product import, tracking, orders.
// Merchants API: https://merchants-api.cdon.com/api/ (docs.cdon.com)
// - Orders: GET /v1/orders/
// - Articles (products): /v2/articles (JSON). Auth: Basic Auth (merchantID + API token).

const { Logger, Context, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const OrdersModel = require('../orders/model');
const {
  mapProductToCdonArticle,
  getCdonArticleInputIssues,
  validateCdonArticlePayload,
} = require('./mapToCdonArticle');
const { fetchCategoriesFromApi: fetchCategoriesFromApiModule } = require('./fetchCategories');
const { getAssetOriginalUrl, normalizeProductImages } = require('../products/productImageAssets');

const CDON_MERCHANTS_API = 'https://merchants-api.cdon.com/api';
const CDON_CATEGORIZATION_API =
  'https://cdonexternalapi-prod-apim.azure-api.net/categorization/api/v1';
const CDON_CURRENCY_BY_MARKET = { SE: 'SEK', DK: 'DKK', FI: 'EUR', NO: 'NOK' };

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
          if (!mod?.default)
            throw new Error('fetch is not available (Node <18) and node-fetch is not installed');
          return mod.default(...args);
        };
  }

  async cdonRequest(
    url,
    { merchantId, apiToken, method = 'GET', headers = {}, body, timeoutMs = 30_000 } = {},
  ) {
    const fetchFn = this.getFetch();
    const auth = this.getCdonAuthHeader(merchantId, apiToken);
    if (!auth && (merchantId != null || apiToken != null)) {
      throw new Error('CDON auth: merchantID and API token must both be non-empty.');
    }
    // Use Headers object so Authorization is sent reliably (plain object can be mishandled by some fetch impls)
    const headersObj = new Headers();
    headersObj.set('Accept', 'application/json');
    if (auth) headersObj.set('Authorization', auth);
    for (const [k, v] of Object.entries(headers)) {
      if (v != null && v !== '') headersObj.set(k, String(v));
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetchFn(url, {
        method,
        headers: headersObj,
        body,
        signal: controller.signal,
        redirect: 'manual',
      });
      clearTimeout(timeoutId);
      let respToUse = resp;
      let text = await resp.text().catch(() => '');
      if ([301, 302, 307, 308].includes(resp.status)) {
        const location = resp.headers.get('Location');
        if (location) {
          const redirectResp = await fetchFn(location, {
            method,
            headers: headersObj,
            body,
            signal: controller.signal,
            redirect: 'manual',
          });
          respToUse = redirectResp;
          text = await redirectResp.text().catch(() => '');
        }
      }
      let json = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }
      return { resp: respToUse, text, json };
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
        const desc = p.description != null ? this.escapeXml(p.description) : '';
        const brand = p.brand != null ? this.escapeXml(p.brand) : '';
        const googleCategory = p.googleCategory != null ? this.escapeXml(p.googleCategory) : '';

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

  // CDON price data (Merchants API; markets se, dk, fi, no)
  // marketsFilter: optional ['se','dk','fi','no'] – only include these market blocks; default all.
  buildPriceXml(
    products,
    marketOverridesByProductId = new Map(),
    marketsFilter = ['se', 'dk', 'fi', 'no'],
  ) {
    const filter =
      Array.isArray(marketsFilter) && marketsFilter.length
        ? marketsFilter.map((m) => String(m).toLowerCase())
        : ['se', 'dk', 'fi', 'no'];
    const ns = 'https://schemas.cdon.com/product/4.0/4.12.2/price';
    const items = products
      .map((p) => {
        const id = this.escapeXml(p.cdonId);
        const pid = String(p?.id || p?.productId || p?.cdonId || '').trim();
        const markets = marketOverridesByProductId.get(pid) || {};
        const basePrice = Number.isFinite(Number(p.priceAmount)) ? Number(p.priceAmount) : null;

        const baseVat = Number.isFinite(Number(p.vatRate)) ? Number(p.vatRate) : null;
        const shippingCost = Number.isFinite(Number(p.shippingCost))
          ? Number(p.shippingCost)
          : null;
        const carrier = p.carrier ? this.escapeXml(p.carrier) : null;
        const shippingMethod = p.shippingMethod ? this.escapeXml(p.shippingMethod) : null;

        const buildMarket = (marketKey, fallbackPrice) => {
          const ov = markets[marketKey] || null;
          const price =
            ov?.priceAmount != null
              ? Number(ov.priceAmount)
              : fallbackPrice != null
                ? Number(fallbackPrice)
                : NaN;
          if (!Number.isFinite(price)) return null;

          const vat = Number.isFinite(Number(ov?.vatRate)) ? Number(ov.vatRate) : baseVat;
          if (
            vat == null ||
            !Number.isFinite(vat) ||
            shippingCost == null ||
            !Number.isFinite(shippingCost) ||
            !carrier ||
            !shippingMethod
          )
            return null;

          const sale = price;
          const original = Number.isFinite(Number(ov?.originalPriceAmount))
            ? Number(ov.originalPriceAmount)
            : sale;
          const saleStr = sale.toFixed(2);
          const originalStr = Math.max(original, sale).toFixed(2);

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
        for (const m of ['se', 'dk', 'fi', 'no']) {
          if (!filter.includes(m)) continue;
          const fallback = m === 'se' ? basePrice : (markets[m]?.priceAmount ?? basePrice);
          const block = buildMarket(m, fallback);
          if (block) blocks.push(block);
        }

        return ['<product>', `  <id>${id}</id>`, ...blocks, '</product>']
          .filter(Boolean)
          .join('\n');
      })
      .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>\n<marketplace xmlns="${ns}">\n${items}\n</marketplace>\n`;
  }

  // CDON availability data (Merchants API; markets se, dk, fi, no)
  // marketsFilter: optional ['se','dk','fi','no'] – only include these market blocks; default all.
  buildAvailabilityXml(
    products,
    marketOverridesByProductId = new Map(),
    marketsFilter = ['se', 'dk', 'fi', 'no'],
  ) {
    const filter =
      Array.isArray(marketsFilter) && marketsFilter.length
        ? marketsFilter.map((m) => String(m).toLowerCase())
        : ['se', 'dk', 'fi', 'no'];
    const ns = 'https://schemas.cdon.com/product/4.0/4.12.2/availability';
    const items = products
      .map((p) => {
        const id = this.escapeXml(p.cdonId);
        const pid = String(p?.id || p?.productId || p?.cdonId || '').trim();
        const markets = marketOverridesByProductId.get(pid) || {};

        const stock = Number.isFinite(Number(p.quantity))
          ? Math.max(0, Math.trunc(Number(p.quantity)))
          : null;
        const minDays = Number.isFinite(Number(p.deliveryMinDays))
          ? Math.max(0, Math.trunc(Number(p.deliveryMinDays)))
          : null;
        const maxDays = Number.isFinite(Number(p.deliveryMaxDays))
          ? Math.max(minDays ?? 0, Math.trunc(Number(p.deliveryMaxDays)))
          : null;

        if (stock == null || minDays == null || maxDays == null) return '';

        const marketStatus = (marketKey) => {
          const ov = markets[marketKey];
          if (ov && typeof ov.active === 'boolean') {
            if (!ov.active) return 'Offline';
          }
          return stock > 0 ? 'Online' : 'Offline';
        };

        const buildMarket = (marketKey) =>
          [
            `  <${marketKey}>`,
            `    <status>${marketStatus(marketKey)}</status>`,
            '    <deliveryTime>',
            `      <min>${minDays}</min>`,
            `      <max>${maxDays}</max>`,
            '    </deliveryTime>',
            `  </${marketKey}>`,
          ].join('\n');

        const blocks = ['se', 'dk', 'fi', 'no'].filter((m) => filter.includes(m)).map(buildMarket);
        return [
          '<product>',
          `  <id>${id}</id>`,
          `  <stock>${stock}</stock>`,
          ...blocks,
          '</product>',
        ].join('\n');
      })
      .filter(Boolean)
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
        const extras = Array.isArray(p.images)
          ? normalizeProductImages(p.images)
              .map((asset) => getAssetOriginalUrl(asset))
              .filter(Boolean)
              .filter((u) => String(u).trim() !== String(p.mainImage || '').trim())
              .slice(0, 10)
              .map((u) => this.escapeXml(u))
          : [];
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
      const settings = inBody.apiKey
        ? {
            apiKey: String(inBody.apiKey || '').trim(),
            apiSecret: String(inBody.apiSecret || '').trim(),
          }
        : await this.model.getSettings(req);

      const merchantId = String(settings?.apiKey ?? '').trim();
      const apiToken = String(settings?.apiSecret ?? '').trim();
      if (!merchantId || !apiToken) {
        return res.status(400).json({
          ok: false,
          error: 'Missing CDON credentials (merchantID and API token required).',
        });
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

  /** Normalize category items to { id, name, path }. id = path from API (e.g. "1.2.16"). No fallbacks. */
  _normalizeCategoryItems(raw) {
    const list = Array.isArray(raw) ? raw : [];
    return list.map((x) => {
      const path = x?.path != null ? String(x.path).trim() : '';
      const name = String(x?.name ?? '').trim();
      return { id: path, name, path };
    });
  }

  // ---- Categories: Merchants API only. API requires market and language (see CDON API docs: v1/categories/{market}/{language}/). ----
  async getCategories(req, res) {
    const market = String(req.query?.market || '').trim();
    const language = String(req.query?.language || '').trim();
    if (!market || !language) {
      return res.status(400).json({
        ok: false,
        error:
          'market and language are required. Use query params: ?market=SE&language=sv-SE (per CDON Merchants API).',
      });
    }
    try {
      const settings = await this.model.getSettings(req);
      const merchantId = String(settings?.apiKey ?? '').trim();
      const apiToken = String(settings?.apiSecret ?? '').trim();
      if (!merchantId || !apiToken) {
        return res.status(400).json({
          ok: false,
          error: 'CDON settings not found. Save merchantID and API token first.',
        });
      }
      const items = await fetchCategoriesFromApiModule(market, language, merchantId, apiToken);
      return res.json({ ok: true, items });
    } catch (error) {
      Logger.error('CDON getCategories error', error, { userId: Context.getUserId(req) });
      const detail = error?.message || String(error);
      if (error?.message?.includes('401') || detail?.includes('credentials')) {
        return res.status(502).json({
          ok: false,
          error:
            'CDON API rejected credentials. Check Merchant ID and API token in CDON Products plugin settings.',
          detail: detail || 'Missing Authorization header',
        });
      }
      return res.status(502).json({ ok: false, error: 'Failed to fetch CDON categories', detail });
    }
  }

  async bulkCreateArticles(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) {
        return res.status(400).json({
          ok: false,
          error: 'CDON settings not found. Save merchantID and API token first.',
        });
      }
      const body = req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : undefined;
      const url = `${CDON_MERCHANTS_API}/v2/articles/bulk`;
      const { resp, text, json } = await this.cdonRequest(url, {
        merchantId: settings.apiKey,
        apiToken: settings.apiSecret,
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      });
      if (json !== null) return res.status(resp.status).json(json);
      return res.status(resp.status).send(text || undefined);
    } catch (error) {
      Logger.error('CDON bulkCreateArticles error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ ok: false, error: 'CDON request failed', detail: error?.message });
    }
  }

  async bulkUpdateArticles(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) {
        return res.status(400).json({
          ok: false,
          error: 'CDON settings not found. Save merchantID and API token first.',
        });
      }
      const body = req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : undefined;
      const url = `${CDON_MERCHANTS_API}/v2/articles/bulk`;
      const { resp, text, json } = await this.cdonRequest(url, {
        merchantId: settings.apiKey,
        apiToken: settings.apiSecret,
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      });
      if (json !== null) return res.status(resp.status).json(json);
      return res.status(resp.status).send(text || undefined);
    } catch (error) {
      Logger.error('CDON bulkUpdateArticles error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ ok: false, error: 'CDON request failed', detail: error?.message });
    }
  }

  async statusesBatch(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) {
        return res.status(400).json({
          ok: false,
          error: 'CDON settings not found. Save merchantID and API token first.',
        });
      }
      const body = req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : undefined;
      const url = `${CDON_MERCHANTS_API}/v1/statuses/batch`;
      const { resp, text, json } = await this.cdonRequest(url, {
        merchantId: settings.apiKey,
        apiToken: settings.apiSecret,
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-id': String(settings.apiKey),
        },
      });
      if (json !== null) return res.status(resp.status).json(json);
      return res.status(resp.status).send(text || undefined);
    } catch (error) {
      Logger.error('CDON statusesBatch error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ ok: false, error: 'CDON request failed', detail: error?.message });
    }
  }

  async statusesSku(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) {
        return res.status(400).json({
          ok: false,
          error: 'CDON settings not found. Save merchantID and API token first.',
        });
      }
      const body = req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : undefined;
      const url = `${CDON_MERCHANTS_API}/v1/statuses/sku`;
      const { resp, text, json } = await this.cdonRequest(url, {
        merchantId: settings.apiKey,
        apiToken: settings.apiSecret,
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-id': String(settings.apiKey),
        },
      });
      if (json !== null) return res.status(resp.status).json(json);
      return res.status(resp.status).send(text || undefined);
    } catch (error) {
      Logger.error('CDON statusesSku error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ ok: false, error: 'CDON request failed', detail: error?.message });
    }
  }

  async getGoogleCategories(req, res) {
    try {
      const fetchFn = this.getFetch();
      const url = `${CDON_CATEGORIZATION_API}/categories/google`;
      const resp = await fetchFn(url, { method: 'GET', headers: { Accept: 'application/json' } });
      const text = await resp.text().catch(() => '');
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      if (!resp.ok) {
        return res
          .status(resp.status)
          .json({ ok: false, error: 'Failed to fetch Google categories', detail: json || text });
      }
      return res.json({ ok: true, endpoint: url, items: json != null ? json : [] });
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
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      if (!resp.ok) {
        return res
          .status(resp.status)
          .json({ ok: false, error: 'Failed to fetch category attributes', detail: json || text });
      }
      return res.json({ ok: true, endpoint: url, items: json });
    } catch (error) {
      Logger.error('CDON getCategoryAttributes error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to fetch category attributes' });
    }
  }

  // ---- Tracking endpoints (read-only) ----

  async getDeliveries(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret)
        return res
          .status(400)
          .json({ error: 'CDON settings not found. Save merchantID and API token first.' });

      const takeRaw = req.query?.take != null ? Number(req.query.take) : 100;
      const take = Number.isFinite(takeRaw)
        ? Math.min(Math.max(Math.trunc(takeRaw), 1), 1000)
        : 100;
      const url = `${CDON_MERCHANTS_API}/deliveries?take=${take}`;

      const { resp, text, json } = await this.cdonRequest(url, {
        merchantId: settings.apiKey,
        apiToken: settings.apiSecret,
        method: 'GET',
      });
      if (!resp.ok) {
        return res
          .status(resp.status)
          .json({ ok: false, error: 'Failed to fetch deliveries', detail: json || text });
      }
      return res.json({ ok: true, endpoint: url, items: json });
    } catch (error) {
      Logger.error('CDON getDeliveries error', error, { userId: Context.getUserId(req) });
      return res.status(502).json({ ok: false, error: 'Failed to fetch CDON deliveries' });
    }
  }

  async getDeliveryStatus(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret)
        return res
          .status(400)
          .json({ error: 'CDON settings not found. Save merchantID and API token first.' });

      const receiptId = String(req.params?.receiptId || '').trim();
      if (!receiptId) return res.status(400).json({ error: 'Missing receiptId' });

      const url = `${CDON_MERCHANTS_API}/deliveries/${encodeURIComponent(receiptId)}`;
      const { resp, text, json } = await this.cdonRequest(url, {
        merchantId: settings.apiKey,
        apiToken: settings.apiSecret,
        method: 'GET',
      });
      if (!resp.ok) {
        return res
          .status(resp.status)
          .json({ ok: false, error: 'Failed to fetch delivery status', detail: json || text });
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
      if (!settings?.apiKey || !settings?.apiSecret)
        return res
          .status(400)
          .json({ error: 'CDON settings not found. Save merchantID and API token first.' });

      const receiptId = String(req.params?.receiptId || '').trim();
      if (!receiptId) return res.status(400).json({ error: 'Missing receiptId' });

      const url = `${CDON_MERCHANTS_API}/deliveries/${encodeURIComponent(receiptId)}/failures`;
      const { resp, text, json } = await this.cdonRequest(url, {
        merchantId: settings.apiKey,
        apiToken: settings.apiSecret,
        method: 'GET',
      });
      if (!resp.ok) {
        return res
          .status(resp.status)
          .json({ ok: false, error: 'Failed to fetch delivery failures', detail: json || text });
      }
      return res.json({ ok: true, endpoint: url, failures: json });
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
        return res
          .status(400)
          .json({ error: 'CDON settings not found. Save merchantID and API token first.' });
      }
      const orderId = String(req.params?.orderId ?? '').trim();
      if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
      const tracking = Array.isArray(req.body?.tracking_information)
        ? req.body.tracking_information
        : [];
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
          detail: (json && json.message) != null ? json.message : text,
        });
      }
      return res.json({ ok: true, endpoint: url, result: json });
    } catch (error) {
      Logger.error('CDON fulfillOrder error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ error: 'CDON fulfill failed', detail: String(error?.message || error) });
    }
  }

  // Merchants API: PUT /v1/orders/{order_id}/cancel
  async cancelOrder(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      const merchantId = String(settings?.apiKey ?? '').trim();
      const apiToken = String(settings?.apiSecret ?? '').trim();
      if (!settings || !merchantId || !apiToken) {
        return res
          .status(400)
          .json({ error: 'CDON settings not found. Save merchantID and API token first.' });
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
          detail: (json && json.message) != null ? json.message : text,
        });
      }
      return res.json({ ok: true, endpoint: url, result: json });
    } catch (error) {
      Logger.error('CDON cancelOrder error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ error: 'CDON cancel failed', detail: String(error?.message || error) });
    }
  }

  // POST /api/cdon-products/products/export
  async exportProducts(req, res) {
    try {
      const mode = String(req.body?.mode || '')
        .trim()
        .toLowerCase();
      const dryRun = req.body?.dryRun === true;
      const diagnose = req.body?.diagnose === true;
      if (mode === 'update_only_strict') {
        return this.exportProductsUpdateOnlyStrict(req, res);
      }

      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) {
        return res
          .status(400)
          .json({ error: 'CDON settings not found. Save merchantID and API token first.' });
      }

      const rawProducts = Array.isArray(req.body?.products) ? req.body.products : null;
      if (!rawProducts || rawProducts.length === 0) {
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

      const diagnoseTrace = diagnose
        ? { productIds: [], overrideRows: [], mapRows: [], perProduct: {}, bulkResponse: null }
        : null;

      // Build normalized product payloads (simple products only, MVP)
      const normalized = [];
      const items = [];
      let expectedSkip = 0;

      for (const p of rawProducts) {
        const productId = String(p?.id || '').trim();
        const title = String(p?.title || '').trim();
        const priceAmount = p?.priceAmount;

        if (!productId || !title || priceAmount == null) {
          if (productId && !dryRun) {
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
        const mpn = p?.mpn != null ? String(p.mpn).trim() : sku || null;

        if (!gtin && !mpn) {
          if (!dryRun) {
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
          }
          items.push({ productId, status: 'error', error: 'Missing GTIN/EAN and MPN' });
          continue;
        }

        // If categories contains a numeric-looking item, treat it as Google category ID for MVP.
        const categories = Array.isArray(p?.categories) ? p.categories : [];
        const googleCategory =
          categories.map((c) => String(c || '').trim()).find((c) => /^[0-9]{1,10}$/.test(c)) ||
          null;

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
          vatRate: p?.vatRate != null ? Number(p.vatRate) : null,
          quantity: p?.quantity != null ? Number(p.quantity) : null,
          mainImage: p?.mainImage != null ? String(p.mainImage).trim() : null,
          images: Array.isArray(p?.images) ? p.images : [],
        });
      }

      if (!normalized.length) {
        const errResponse = {
          ok: false,
          error:
            'No valid products to export (check required fields: id, title, priceAmount, sku or gtin)',
          counts: { requested: rawProducts.length, success: 0, error: items.length },
          items,
        };
        if (diagnoseTrace) errResponse.diagnose = diagnoseTrace;
        return res.status(400).json(errResponse);
      }

      if (diagnoseTrace) diagnoseTrace.productIds = normalized.map((p) => p.productId);

      // Pull per-market overrides (SE/DK/FI) from channel_product_overrides
      const db = Database.get(req);
      const productIds = normalized.map((p) => String(p.productId));
      const overridesByProductId = new Map();

      if (productIds.length) {
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
          WHERE o.channel = 'cdon'
            AND o.product_id::text = ANY($1::text[])
            AND lower(COALESCE(ci.market, o.instance)) IN ('se','dk','fi','no')
          `,
          [productIds],
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
        if (diagnoseTrace) diagnoseTrace.overrideRows = rows.map((r) => ({ ...r }));

        // Merge channel_product_map (enabled): if user enabled product for CDON market in Kanaler
        // and saved, map is updated but overrides may not have active=true yet.
        const mapRows = await db.query(
          `
          SELECT
            m.product_id::text AS product_id,
            LOWER(TRIM(ci.market)) AS market
          FROM channel_product_map m
          LEFT JOIN channel_instances ci ON ci.id = m.channel_instance_id
          WHERE m.channel = 'cdon'
            AND m.enabled = TRUE
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
              active: true,
              priceAmount: null,
              currency: null,
              vatRate: null,
              category: null,
            };
          } else {
            perMarket[market].active = perMarket[market].active || true;
          }
        }
      }

      const mappedArticlesByProductId = new Map();
      if (productIds.length) {
        const articleMapRows = await db.query(
          `
          SELECT
            product_id::text AS product_id,
            external_id,
            cdon_article_id
          FROM channel_product_map
          WHERE channel = 'cdon'
            AND product_id::text = ANY($1::text[])
            AND (
              (external_id IS NOT NULL AND TRIM(external_id) <> '')
              OR (cdon_article_id IS NOT NULL AND TRIM(cdon_article_id) <> '')
            )
          `,
          [productIds],
        );
        for (const row of articleMapRows) {
          const productId = String(row.product_id || '').trim();
          if (!productId || mappedArticlesByProductId.has(productId)) continue;
          mappedArticlesByProductId.set(productId, {
            externalId:
              row.external_id != null && String(row.external_id).trim()
                ? String(row.external_id).trim()
                : null,
            cdonArticleId:
              row.cdon_article_id != null && String(row.cdon_article_id).trim()
                ? String(row.cdon_article_id).trim()
                : null,
          });
        }
      }

      // CDON full export:
      // - unmapped products => POST /v2/articles/bulk (create)
      // - mapped products   => PUT /v2/articles/bulk with update_article
      const defaultLanguage = 'sv-SE';
      const createArticles = [];
      const createMeta = [];
      const updateActions = [];
      const updateMeta = [];
      for (const p of normalized) {
        const raw = rawProducts.find((r) => String(r?.id) === p.productId) || p;
        const overrides = overridesByProductId.get(String(p.productId)) || {};
        const hasActiveTarget = Object.entries(overrides).some(([market, data]) => {
          if (!allowedMarkets.includes(String(market).toLowerCase())) return false;
          return data && data.active === true;
        });
        if (!hasActiveTarget) {
          expectedSkip += 1;
          if (diagnoseTrace) {
            diagnoseTrace.perProduct[p.productId] = {
              skip: 'no_active_channel_market',
              overrides: Object.fromEntries(
                Object.entries(overrides).map(([k, v]) => [k, { ...v }]),
              ),
              marketsFilter,
            };
          }
          items.push({
            productId: p.productId,
            sku: p.sku || null,
            status: 'expected_skip',
            reason: 'no_active_channel_market',
          });
          continue;
        }
        const article = mapProductToCdonArticle(raw, overrides, defaultLanguage);
        if (article) {
          const payloadCheck = validateCdonArticlePayload(article);
          if (!payloadCheck.ok) {
            if (diagnoseTrace) {
              diagnoseTrace.perProduct[p.productId] = {
                skip: 'contract_validation_failed',
                reason: payloadCheck.reason,
                overrides: Object.fromEntries(
                  Object.entries(overrides).map(([k, v]) => [k, { ...v }]),
                ),
              };
            }
            items.push({
              productId: p.productId,
              status: 'error',
              error: `contract_validation_failed:${payloadCheck.reason}`,
            });
            continue;
          }
          if (diagnoseTrace) {
            diagnoseTrace.perProduct[p.productId] = {
              ok: true,
              exportMode: mappedArticlesByProductId.has(String(p.productId))
                ? 'update_article'
                : 'create',
              payloadMarkets: [...(article.markets || [])],
              payloadCategory: article.category || null,
              sku: article.sku,
            };
          }
          const mappedArticle = mappedArticlesByProductId.get(String(p.productId));
          if (mappedArticle) {
            const action = {
              sku: article.sku,
              action: 'update_article',
              body: {
                ...article,
                sku: undefined,
                price: undefined,
                quantity: undefined,
              },
            };
            delete action.body.sku;
            delete action.body.price;
            delete action.body.quantity;
            const actionValidation = this.validateCdonUpdateArticleAction(action);
            if (!actionValidation.ok) {
              items.push({
                productId: p.productId,
                status: 'error',
                error: `contract_validation_failed:${actionValidation.reason}`,
              });
              continue;
            }
            updateActions.push(action);
            updateMeta.push({
              productId: p.productId,
              sku: article.sku,
              externalId: mappedArticle.externalId || article.sku,
              cdonArticleId: mappedArticle.cdonArticleId || null,
            });
          } else {
            createArticles.push(article);
            createMeta.push({ productId: p.productId, sku: article.sku });
          }
        } else {
          const issues = getCdonArticleInputIssues(raw, overrides, defaultLanguage);
          const reason = issues.length ? issues.join(',') : 'mapper_rejected_unknown';
          if (diagnoseTrace) {
            diagnoseTrace.perProduct[p.productId] = {
              skip: 'mapper_rejected',
              reason,
              issues,
              overrides: Object.fromEntries(
                Object.entries(overrides).map(([k, v]) => [k, { ...v }]),
              ),
            };
          }
          items.push({
            productId: p.productId,
            status: 'error',
            error: `mapper_rejected:${reason}`,
          });
        }
      }

      const preflight = {
        requested: rawProducts.length,
        ready: createArticles.length + updateActions.length,
        validation_error: items.filter((x) => x.status === 'error').length,
        expected_skip: expectedSkip,
      };
      if (dryRun) {
        return res.json({
          ok: true,
          channel: 'cdon',
          mode: 'phase2_preflight',
          dryRun: true,
          counts: preflight,
          items,
        });
      }

      if (createArticles.length === 0 && updateActions.length === 0) {
        const errPayload = {
          ok: false,
          error: 'No valid articles to export (mapper rejected all; check required fields)',
          counts: {
            requested: rawProducts.length,
            success: 0,
            error: preflight.validation_error,
            expected_skip: expectedSkip,
          },
          items,
        };
        if (diagnoseTrace) errPayload.diagnose = diagnoseTrace;
        Logger.warn('CDON export: no articles to send', {
          userId: Context.getUserId(req),
          counts: errPayload.counts,
        });
        return res.status(400).json(errPayload);
      }

      const url = `${CDON_MERCHANTS_API}/v2/articles/bulk`;
      const merchantId = String(settings.apiKey).trim();
      const apiToken = String(settings.apiSecret).trim();
      const formatFailed = (failedEntry) => {
        const errors = Array.isArray(failedEntry?.errors) ? failedEntry.errors : [];
        const message = errors
          .map((entry) => String(entry?.message || '').trim())
          .filter(Boolean)
          .join('; ');
        return message || 'CDON action failed';
      };

      let createResp = null;
      let createText = null;
      let createJson = null;
      if (createArticles.length > 0) {
        const createResult = await this.cdonRequest(url, {
          merchantId,
          apiToken,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articles: createArticles }),
        });
        createResp = createResult.resp;
        createText = createResult.text;
        createJson = createResult.json;
        if (!createResp.ok) {
          const message =
            (createJson && createJson.message) != null
              ? createJson.message
              : createText || createResp.statusText;
          Logger.error('CDON articles/bulk create failed', {
            status: createResp.status,
            message,
            userId: Context.getUserId(req),
          });
          return res.status(createResp.status).json({
            ok: false,
            error: `CDON articles bulk create failed (HTTP ${createResp.status})`,
            detail: message,
          });
        }
      }

      let updateResp = null;
      let updateText = null;
      let updateJson = null;
      if (updateActions.length > 0) {
        const updateResult = await this.cdonRequest(url, {
          merchantId,
          apiToken,
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actions: updateActions }),
        });
        updateResp = updateResult.resp;
        updateText = updateResult.text;
        updateJson = updateResult.json;
        if (!updateResp.ok) {
          const message =
            (updateJson && updateJson.message) != null
              ? updateJson.message
              : updateText || updateResp.statusText;
          Logger.error('CDON articles/bulk update failed', {
            status: updateResp.status,
            message,
            userId: Context.getUserId(req),
          });
          return res.status(updateResp.status).json({
            ok: false,
            error: `CDON articles bulk update failed (HTTP ${updateResp.status})`,
            detail: message,
          });
        }
      }

      if (diagnoseTrace) {
        diagnoseTrace.bulkResponse = {
          create:
            createResp != null
              ? { status: createResp.status, ok: createResp.ok, json: createJson }
              : null,
          update:
            updateResp != null
              ? { status: updateResp.status, ok: updateResp.ok, json: updateJson }
              : null,
        };
      }

      const createSuccessBySku = new Map();
      const createFailedBySku = new Map();
      for (const successRow of createJson?.success || []) {
        const skuKey = successRow?.sku != null ? String(successRow.sku).trim() : null;
        const id = successRow?.id != null ? String(successRow.id).trim() : null;
        if (skuKey) createSuccessBySku.set(skuKey, id || null);
      }
      for (const failedRow of createJson?.failed || []) {
        const skuKey = failedRow?.sku != null ? String(failedRow.sku).trim() : null;
        if (skuKey) createFailedBySku.set(skuKey, failedRow);
      }
      for (const { productId, sku } of createMeta) {
        const skuKey = sku || productId;
        if (createSuccessBySku.has(skuKey)) {
          const cdonArticleId = createSuccessBySku.get(skuKey) || null;
          await this.model.upsertChannelMap(req, {
            productId,
            channel: 'cdon',
            enabled: true,
            externalId: skuKey,
            cdonArticleId,
            status: 'synced',
            error: null,
          });
          items.push({ productId, status: 'synced', externalId: skuKey, cdonArticleId });
        } else {
          const failedRow = createFailedBySku.get(skuKey);
          items.push({
            productId,
            status: 'error',
            error: failedRow ? formatFailed(failedRow) : 'CDON create returned no success row',
          });
        }
      }

      const updateSuccessBySku = new Set();
      const updateFailedBySku = new Map();
      for (const successRow of updateJson?.success || []) {
        const skuKey = successRow?.sku != null ? String(successRow.sku).trim() : null;
        const actionName = String(successRow?.action || '').trim();
        if (skuKey && actionName === 'update_article') {
          updateSuccessBySku.add(skuKey);
        }
      }
      for (const failedRow of updateJson?.failed || []) {
        const skuKey = failedRow?.sku != null ? String(failedRow.sku).trim() : null;
        const actionName = String(failedRow?.action || '').trim();
        if (skuKey && actionName === 'update_article') {
          updateFailedBySku.set(skuKey, failedRow);
        }
      }
      for (const { productId, sku, externalId, cdonArticleId } of updateMeta) {
        const skuKey = sku || productId;
        if (updateSuccessBySku.has(skuKey)) {
          await this.model.upsertChannelMap(req, {
            productId,
            channel: 'cdon',
            enabled: true,
            externalId: externalId || skuKey,
            cdonArticleId,
            status: 'synced',
            error: null,
          });
          items.push({
            productId,
            status: 'synced',
            externalId: externalId || skuKey,
            cdonArticleId,
          });
        } else {
          const failedRow = updateFailedBySku.get(skuKey);
          items.push({
            productId,
            status: 'error',
            error: failedRow ? formatFailed(failedRow) : 'CDON update returned no success row',
          });
        }
      }

      const jsonResponse = {
        ok: true,
        endpoint: url,
        counts: {
          requested: rawProducts.length,
          success: items.filter((x) => x.status === 'synced').length,
          error: items.filter((x) => x.status === 'error').length,
          expected_skip: expectedSkip,
        },
        items,
      };
      if (diagnoseTrace) jsonResponse.diagnose = diagnoseTrace;
      Logger.info('CDON export completed', {
        userId: Context.getUserId(req),
        counts: jsonResponse.counts,
      });
      return res.json(jsonResponse);
    } catch (error) {
      Logger.error('CDON export error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ error: 'Export to CDON failed', detail: String(error?.message || error) });
    }
  }

  validateCdonUpdateActionEnvelope(
    action,
    allowedActions = ['update_article_price', 'update_article_quantity'],
  ) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      return { ok: false, reason: 'invalid_action_envelope' };
    }
    const sku = String(action.sku || '').trim();
    if (!sku) return { ok: false, reason: 'missing_sku' };
    const actionName = String(action.action || '').trim();
    if (!allowedActions.includes(actionName)) {
      return { ok: false, reason: 'unsupported_action' };
    }
    if (!action.body || typeof action.body !== 'object' || Array.isArray(action.body)) {
      return { ok: false, reason: 'missing_action_body' };
    }
    return { ok: true };
  }

  validateCdonUpdateArticleAction(action) {
    const envelope = this.validateCdonUpdateActionEnvelope(action, ['update_article']);
    if (!envelope.ok) return envelope;

    const body = action.body || {};
    const status = String(body.status || '')
      .trim()
      .toLowerCase();
    if (!['for sale', 'paused'].includes(status)) {
      return { ok: false, reason: 'invalid_status' };
    }
    const mainImage = String(body.main_image || '').trim();
    if (!mainImage) {
      return { ok: false, reason: 'missing_main_image' };
    }
    const markets = Array.isArray(body.markets) ? body.markets : [];
    if (!markets.length) {
      return { ok: false, reason: 'missing_markets' };
    }
    for (const row of markets) {
      const market = String(row || '')
        .trim()
        .toUpperCase();
      if (!['SE', 'DK', 'FI', 'NO'].includes(market)) {
        return { ok: false, reason: 'invalid_market' };
      }
    }
    const title = Array.isArray(body.title) ? body.title : [];
    if (!title.length) {
      return { ok: false, reason: 'missing_title_rows' };
    }
    const description = Array.isArray(body.description) ? body.description : [];
    if (!description.length) {
      return { ok: false, reason: 'missing_description_rows' };
    }
    const shipping = Array.isArray(body.shipping_time) ? body.shipping_time : [];
    if (!shipping.length) {
      return { ok: false, reason: 'missing_shipping_time_rows' };
    }
    if (body.price !== undefined || body.quantity !== undefined) {
      return { ok: false, reason: 'price_or_quantity_not_allowed' };
    }
    return { ok: true };
  }

  validateCdonUpdateArticlePriceAction(action) {
    const envelope = this.validateCdonUpdateActionEnvelope(action);
    if (!envelope.ok) return envelope;

    const rows = Array.isArray(action.body.price) ? action.body.price : [];
    if (!rows.length) return { ok: false, reason: 'missing_price_rows' };
    for (const row of rows) {
      const market = String(row?.market || '')
        .trim()
        .toUpperCase();
      if (!['SE', 'DK', 'FI', 'NO'].includes(market)) {
        return { ok: false, reason: 'invalid_market' };
      }
      if (!row?.value || typeof row.value !== 'object' || Array.isArray(row.value)) {
        return { ok: false, reason: 'missing_price_value' };
      }
      const amount = Number(row.value.amount_including_vat);
      if (!Number.isFinite(amount) || amount < 0) {
        return { ok: false, reason: 'invalid_amount_including_vat' };
      }
      const currency = String(row.value.currency || '')
        .trim()
        .toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) {
        return { ok: false, reason: 'invalid_currency' };
      }
      if (row.value.vat_rate != null) {
        const vatRate = Number(row.value.vat_rate);
        if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
          return { ok: false, reason: 'invalid_vat_rate' };
        }
      }
    }
    return { ok: true };
  }

  validateCdonUpdateArticleQuantityAction(action) {
    const envelope = this.validateCdonUpdateActionEnvelope(action);
    if (!envelope.ok) return envelope;
    const quantity = Number(action.body.quantity);
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
      return { ok: false, reason: 'invalid_quantity' };
    }
    return { ok: true };
  }

  /**
   * Push stock quantity to CDON for one product (used by orders pushStockToChannels).
   * @param {object} req - request with session
   * @param {{ productId: string, channelSku: string, quantity: number }} opts
   * @returns {{ ok: boolean, error?: string }}
   */
  async syncStock(req, { productId, channelSku, quantity }) {
    const sku = String(channelSku ?? '').trim();
    if (!sku) {
      return { ok: false, error: 'Missing channel SKU for CDON stock sync' };
    }
    const settings = await this.model.getSettings(req);
    if (!settings?.apiKey || !settings?.apiSecret) {
      return { ok: false, error: 'CDON settings not found' };
    }
    const qty = Math.max(0, Math.min(500_000, Math.trunc(Number(quantity))));
    const quantityAction = {
      sku,
      action: 'update_article_quantity',
      body: { quantity: qty },
    };
    const validation = this.validateCdonUpdateArticleQuantityAction(quantityAction);
    if (!validation.ok) {
      return { ok: false, error: validation.reason || 'invalid_quantity' };
    }
    const url = `${CDON_MERCHANTS_API}/v2/articles/bulk`;
    const { resp, text, json } = await this.cdonRequest(url, {
      merchantId: settings.apiKey,
      apiToken: settings.apiSecret,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions: [quantityAction] }),
    });
    if (!resp.ok) {
      const errMsg =
        json?.failed?.[0]?.errors?.[0]?.message || json?.message || text || `HTTP ${resp.status}`;
      return { ok: false, error: errMsg };
    }
    const failed = Array.isArray(json?.failed) ? json.failed : [];
    const failedForSku = failed.find((f) => String(f?.sku || '').trim() === sku);
    if (failedForSku?.errors?.[0]?.message) {
      return { ok: false, error: failedForSku.errors[0].message };
    }
    return { ok: true };
  }

  /**
   * CDON PUT /v2/articles/bulk — up to 50 update_article_quantity actions per HTTP call (sequential chunks).
   * @param {object} req
   * @param {Array<{ sku: string, quantity: number, productId?: string }>} items
   * @returns {{ failures: Array<{ productId?: string, sku: string, error: string }> }}
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
          sku: String(it.sku || ''),
          error: 'CDON settings not found',
        });
      }
      return { failures };
    }
    const url = `${CDON_MERCHANTS_API}/v2/articles/bulk`;
    const chunkSize = 50;
    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize);
      const actions = [];
      for (const it of chunk) {
        const sku = String(it.sku ?? '').trim();
        const qty = Math.max(0, Math.min(500_000, Math.trunc(Number(it.quantity))));
        if (!sku) {
          failures.push({
            productId: it.productId,
            sku: '',
            error: 'Missing channel SKU for CDON stock sync',
          });
          continue;
        }
        const quantityAction = {
          sku,
          action: 'update_article_quantity',
          body: { quantity: qty },
        };
        const validation = this.validateCdonUpdateArticleQuantityAction(quantityAction);
        if (!validation.ok) {
          failures.push({
            productId: it.productId,
            sku,
            error: validation.reason || 'invalid_quantity',
          });
          continue;
        }
        actions.push(quantityAction);
      }
      if (!actions.length) {
        continue;
      }
      const { resp, text, json } = await this.cdonRequest(url, {
        merchantId: settings.apiKey,
        apiToken: settings.apiSecret,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions }),
      });
      if (!resp.ok) {
        const errMsg =
          json?.message || json?.failed?.[0]?.errors?.[0]?.message || text || `HTTP ${resp.status}`;
        for (const a of actions) {
          const row = chunk.find((c) => String(c.sku || '').trim() === a.sku);
          failures.push({
            productId: row?.productId,
            sku: a.sku,
            error: errMsg,
          });
        }
        continue;
      }
      const failed = Array.isArray(json?.failed) ? json.failed : [];
      for (const f of failed) {
        const fsku = String(f?.sku || '').trim();
        const row = chunk.find((c) => String(c.sku || '').trim() === fsku);
        const msg = f?.errors?.[0]?.message || 'CDON bulk quantity failed';
        failures.push({
          productId: row?.productId,
          sku: fsku,
          error: msg,
        });
      }
    }
    return { failures };
  }

  async exportProductsUpdateOnlyStrict(req, res) {
    const settings = await this.model.getSettings(req);
    if (!settings?.apiKey || !settings?.apiSecret) {
      return res
        .status(400)
        .json({ error: 'CDON settings not found. Save merchantID and API token first.' });
    }
    const products = Array.isArray(req.body?.products) ? req.body.products : [];
    if (!products.length) {
      return res.status(400).json({ error: 'Request must include products: []' });
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
          WHERE m.channel = 'cdon'
            AND m.product_id::text = ANY($1::text[])
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
            o.currency
          FROM channel_product_overrides o
          LEFT JOIN channel_instances ci ON ci.id = o.channel_instance_id
          WHERE o.channel = 'cdon'
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
      });
    }

    const report = {
      channel: 'cdon',
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
      const basePrice = Number(p?.priceAmount);
      const hasBasePrice = Number.isFinite(basePrice) && basePrice > 0;
      const baseCurrency = String(p?.currency || '')
        .trim()
        .toUpperCase();
      const mappings = mapsByProduct.get(productId) || [];
      const targetMarkets = mappings.filter((m) => {
        if (m.enabled !== true) return false;
        const market = String(m.market || '')
          .trim()
          .toLowerCase();
        return ['se', 'dk', 'fi', 'no'].includes(market);
      });
      const mappedSkus = mappings
        .filter((m) => m.enabled === true && (m.external_id ?? null) != null)
        .map((m) => String(m.external_id || '').trim())
        .filter(Boolean);
      const mappedSkuSet = new Set(mappedSkus);
      if (mappedSkuSet.size === 0 || targetMarkets.length === 0) {
        report.skipped_no_map += 1;
        report.expected_skip += 1;
        report.rows.push({
          productId,
          sku: null,
          channel: 'cdon',
          instanceKey: null,
          status: 'skipped_no_map',
          reason: 'no_mapped_target',
          classification: 'expected_skip',
        });
        continue;
      }
      if (mappedSkuSet.size !== 1) {
        report.validation_error += 1;
        report.rows.push({
          productId,
          sku: null,
          channel: 'cdon',
          instanceKey: null,
          status: 'validation_error',
          reason: 'conflicting_mapped_skus',
        });
        continue;
      }
      const sku = Array.from(mappedSkuSet)[0];
      if (!sku) {
        report.validation_error += 1;
        report.rows.push({
          productId,
          sku: null,
          channel: 'cdon',
          instanceKey: null,
          status: 'validation_error',
          reason: 'missing_sku',
        });
        continue;
      }

      const quantity = Number(p?.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) {
        report.validation_error += 1;
        report.rows.push({
          productId,
          sku,
          channel: 'cdon',
          instanceKey: null,
          status: 'validation_error',
          reason: 'invalid_quantity',
        });
        continue;
      }

      const priceRows = [];
      const overridesByMarket = overridesByProductAndMarket.get(productId) || new Map();
      let marketValidationFailed = false;
      for (const m of targetMarkets) {
        const marketLower = String(m.market || '')
          .trim()
          .toLowerCase();
        const market = marketLower.toUpperCase();
        const instanceKey = String(m.instance_key || '').trim();
        if (!['SE', 'DK', 'FI', 'NO'].includes(market)) {
          report.validation_error += 1;
          report.rows.push({
            productId,
            sku,
            channel: 'cdon',
            instanceKey: instanceKey || null,
            status: 'validation_error',
            reason: 'missing_market_on_instance',
          });
          marketValidationFailed = true;
          continue;
        }
        const marketOverride = overridesByMarket.get(marketLower);
        const overrideAmountRaw = Number(marketOverride?.priceAmount);
        const overrideAmount =
          Number.isFinite(overrideAmountRaw) && overrideAmountRaw > 0 ? overrideAmountRaw : null;
        const amount = overrideAmount != null ? overrideAmount : hasBasePrice ? basePrice : null;
        const expectedCurrency = CDON_CURRENCY_BY_MARKET[market] || null;
        const overrideCurrency = String(marketOverride?.currency || '')
          .trim()
          .toUpperCase();
        if (overrideCurrency && expectedCurrency && overrideCurrency !== expectedCurrency) {
          report.validation_error += 1;
          report.rows.push({
            productId,
            sku,
            channel: 'cdon',
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
            sku,
            channel: 'cdon',
            instanceKey: instanceKey || null,
            status: 'validation_error',
            reason: 'missing_or_invalid_effective_price',
          });
          marketValidationFailed = true;
          continue;
        }
        const value = {
          amount_including_vat: amount,
          currency,
        };
        priceRows.push({ market, value });
      }

      if (marketValidationFailed || !priceRows.length) continue;

      const priceAction = { sku, action: 'update_article_price', body: { price: priceRows } };
      const quantityAction = {
        sku,
        action: 'update_article_quantity',
        body: { quantity: Math.trunc(quantity) },
      };

      const priceValidation = this.validateCdonUpdateArticlePriceAction(priceAction);
      if (!priceValidation.ok) {
        report.validation_error += 1;
        report.rows.push({
          productId,
          sku,
          channel: 'cdon',
          instanceKey: null,
          status: 'validation_error',
          reason: priceValidation.reason,
        });
        continue;
      }
      const quantityValidation = this.validateCdonUpdateArticleQuantityAction(quantityAction);
      if (!quantityValidation.ok) {
        report.validation_error += 1;
        report.rows.push({
          productId,
          sku,
          channel: 'cdon',
          instanceKey: null,
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

    const url = `${CDON_MERCHANTS_API}/v2/articles/bulk`;
    const { resp, text, json } = await this.cdonRequest(url, {
      merchantId: settings.apiKey,
      apiToken: settings.apiSecret,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions }),
    });

    if (!resp.ok) {
      report.channel_error += validProductIds.size;
      for (const p of products) {
        const productId = String(p?.id || '').trim();
        if (!validProductIds.has(productId)) continue;
        report.rows.push({
          productId,
          sku: String(p?.sku || '').trim() || null,
          channel: 'cdon',
          instanceKey: null,
          status: 'channel_error',
          reason: `channel_error_${resp.status}`,
        });
      }
      return res.status(resp.status).json({ ok: false, ...report, detail: json || text || null });
    }

    const failedBySku = new Map();
    for (const failedRow of json?.failed || []) {
      const skuKey = failedRow?.sku != null ? String(failedRow.sku).trim() : null;
      if (!skuKey) continue;
      const message = Array.isArray(failedRow?.errors)
        ? failedRow.errors
            .map((entry) => String(entry?.message || '').trim())
            .filter(Boolean)
            .join('; ')
        : '';
      const action = String(failedRow?.action || '').trim();
      const existing = failedBySku.get(skuKey) || [];
      existing.push({
        action: action || null,
        message: message || 'CDON strict action failed',
      });
      failedBySku.set(skuKey, existing);
    }

    for (const p of products) {
      const productId = String(p?.id || '').trim();
      if (!validProductIds.has(productId)) continue;
      const mappings = mapsByProduct.get(productId) || [];
      const mappedSkus = mappings
        .filter((m) => m.enabled === true && (m.external_id ?? null) != null)
        .map((m) => String(m.external_id || '').trim())
        .filter(Boolean);
      const skuKey = mappedSkus[0] || String(p?.sku || '').trim() || null;
      const failures = skuKey ? failedBySku.get(skuKey) || [] : [];
      if (failures.length > 0) {
        report.channel_error += 1;
        report.rows.push({
          productId,
          sku: skuKey,
          channel: 'cdon',
          instanceKey: null,
          status: 'channel_error',
          reason: failures.map((entry) => entry.message).join('; '),
        });
        continue;
      }
      report.updated += 1;
      report.rows.push({
        productId,
        sku: skuKey,
        channel: 'cdon',
        instanceKey: null,
        status: 'updated',
        reason: null,
      });
    }

    if (Array.isArray(json?.failed) && json.failed.length > 0) {
      Logger.warn('CDON strict update reported failed actions', {
        failed: json.failed,
        userId: Context.getUserId(req),
      });
    }
    return res.json({ ok: true, ...report });
  }

  // DELETE /api/cdon-products/batch
  // body: { productIds: string[] }
  // Calls CDON Merchants API PUT /v2/articles/bulk with action delete_article (SKU from channel map).
  async batchDelete(req, res) {
    try {
      const productIdsRaw = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
      const productIds = Array.from(
        new Set(productIdsRaw.map((x) => String(x).trim()).filter(Boolean)),
      );

      if (productIds.length === 0) {
        return res.json({ ok: true, deleted: 0, failed: 0, skipped: 0, items: [] });
      }
      if (productIds.length > 500) {
        return res
          .status(400)
          .json({ error: 'Too many productIds (max 500)', code: 'VALIDATION_ERROR' });
      }

      const settings = await this.model.getSettings(req);
      if (!settings?.apiKey || !settings?.apiSecret) {
        return res
          .status(400)
          .json({ error: 'CDON settings not found. Save merchantID and API token first.' });
      }

      const db = Database.get(req);
      const userId = Context.getUserId(req);
      if (!userId) return res.status(401).json({ error: 'User not authenticated' });

      const mapRows =
        productIds.length > 0
          ? await db.query(
              `
              SELECT product_id::text AS product_id, external_id
              FROM channel_product_map
              WHERE channel = 'cdon' AND product_id::text = ANY($1::text[])
              `,
              [productIds],
            )
          : [];
      const externalIdByProductId = new Map();
      for (const r of mapRows) {
        const pid = String(r.product_id);
        const ext = r.external_id != null ? String(r.external_id).trim() : '';
        if (ext) externalIdByProductId.set(pid, ext);
      }

      const items = [];
      const toDelete = []; // { productId, sku }

      for (const pid of productIds) {
        const sku = externalIdByProductId.get(pid);
        if (!sku) {
          await this.model.upsertChannelMap(req, {
            productId: pid,
            channel: 'cdon',
            enabled: false,
            externalId: null,
            status: 'idle',
            error: null,
          });
          items.push({ productId: pid, status: 'skipped', reason: 'no_external_id' });
          continue;
        }
        toDelete.push({ productId: pid, sku });
      }

      if (toDelete.length === 0) {
        return res.json({
          ok: true,
          deleted: 0,
          failed: 0,
          skipped: items.length,
          items,
        });
      }

      const actions = toDelete.map(({ sku }) => ({
        sku,
        action: 'delete_article',
        body: {},
      }));
      const url = `${CDON_MERCHANTS_API}/v2/articles/bulk`;
      const {
        resp,
        text,
        json: resJson,
      } = await this.cdonRequest(url, {
        merchantId: String(settings.apiKey).trim(),
        apiToken: String(settings.apiSecret).trim(),
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions }),
      });

      const successSkus = new Set();
      const failedBySku = new Map();
      if (resp.ok && resJson) {
        const successList = Array.isArray(resJson.success) ? resJson.success : [];
        for (const s of successList) {
          const sku = s?.sku != null ? String(s.sku).trim() : null;
          if (sku) successSkus.add(sku);
        }
        const failedList = Array.isArray(resJson.failed) ? resJson.failed : [];
        for (const f of failedList) {
          const sku = f?.sku != null ? String(f.sku).trim() : null;
          if (!sku) continue;
          const errMsg =
            Array.isArray(f.errors) && f.errors.length
              ? f.errors
                  .map((e) => e?.message || '')
                  .filter(Boolean)
                  .join('; ') || 'Delete failed'
              : 'Delete failed';
          failedBySku.set(sku, errMsg);
        }
      }

      if (!resp.ok) {
        const message =
          (resJson && resJson.message) != null ? resJson.message : text || resp.statusText;
        for (const { productId, sku } of toDelete) {
          await this.model.upsertChannelMap(req, {
            productId,
            channel: 'cdon',
            enabled: false,
            externalId: sku,
            status: 'error',
            error: `API error ${resp.status}: ${String(message).slice(0, 200)}`,
          });
          items.push({
            productId,
            sku,
            status: 'error',
            error: `API ${resp.status}`,
          });
        }
        return res.status(resp.status).json({
          ok: false,
          error: 'CDON delete bulk failed',
          detail: message,
          deleted: 0,
          failed: toDelete.length,
          skipped: items.filter((x) => x.status === 'skipped').length,
          items,
        });
      }

      let deletedCount = 0;
      let failedCount = 0;
      for (const { productId, sku } of toDelete) {
        if (successSkus.has(sku)) {
          await this.model.upsertChannelMap(req, {
            productId,
            channel: 'cdon',
            enabled: false,
            externalId: null,
            status: 'idle',
            error: null,
          });
          items.push({ productId, sku, status: 'deleted' });
          deletedCount += 1;
        } else {
          const errMsg = failedBySku.get(sku) || 'Delete failed';
          await this.model.upsertChannelMap(req, {
            productId,
            channel: 'cdon',
            enabled: false,
            externalId: sku,
            status: 'error',
            error: errMsg,
          });
          items.push({ productId, sku, status: 'error', error: errMsg });
          failedCount += 1;
        }
      }

      return res.json({
        ok: true,
        deleted: deletedCount,
        failed: failedCount,
        skipped: items.filter((x) => x.status === 'skipped').length,
        items,
      });
    } catch (error) {
      Logger.error('CDON batch delete error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ error: 'Delete from CDON failed', detail: String(error?.message || error) });
    }
  }

  // --------- Order import (Merchants API) ---------
  // Doc: GET /v1/orders?state=CREATED|ACCEPTED|FULFILLED|NOT_FULFILLED&limit=100&page=1. Response: array of order objects.

  static CDON_ORDER_OPEN_STATES = ['CREATED', 'ACCEPTED'];

  /**
   * Internal: sync open CDON orders (CREATED, ACCEPTED). Doc: state, limit, page. One API object = one order.
   */
  async syncOpenOrders(req, settingsOverride = null) {
    const settings = settingsOverride || (await this.model.getSettings(req));
    const merchantId = String(settings?.apiKey ?? '').trim();
    const apiToken = String(settings?.apiSecret ?? '').trim();
    if (!settings || !merchantId || !apiToken) {
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
    let pagesFetched = 0;
    for (const state of CdonProductsController.CDON_ORDER_OPEN_STATES) {
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams({ state, limit: String(limit), page: String(page) });
        const url = `${CDON_MERCHANTS_API}/v1/orders?${params.toString()}`;
        const { resp, json } = await this.cdonRequest(url, { merchantId, apiToken, method: 'GET' });
        if (!resp.ok) {
          const detail = (json && json.message) != null ? json.message : resp.statusText;
          return { fetched: allOrders.length, created: -1, error: String(detail).slice(0, 500) };
        }
        const items = Array.isArray(json) ? json : [];
        allOrders.push(...items);
        pagesFetched += 1;
        hasMore = items.length >= limit;
        page += 1;
      }
    }

    const productIdBySku = await this.ordersModel.loadProductIdsByChannelExternalId(
      req,
      'cdon',
      allOrders.map((o) => o?.article_sku),
    );
    const normalizedOrders = [];
    for (const o of allOrders) {
      if (o == null || o.id == null) continue;
      const normalized = await this.normalizeCdonOrderToHomebase(o, req, { productIdBySku });
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
   * GET /v1/orders. Doc: query state (CREATED|ACCEPTED|FULFILLED|NOT_FULFILLED), limit, page. Response: array of order objects.
   */
  async pullOrders(req, res) {
    try {
      const settings = await this.model.getSettings(req);
      const merchantId = String(settings?.apiKey ?? '').trim();
      const apiToken = String(settings?.apiSecret ?? '').trim();
      if (!settings || !merchantId || !apiToken) {
        return res
          .status(400)
          .json({ error: 'CDON settings not found. Save merchantID and API token first.' });
      }

      const limit =
        req.body?.limit != null ? Math.min(Math.max(Number(req.body.limit), 1), 1000) : 100;
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
          const params = new URLSearchParams({ state, limit: String(limit), page: String(page) });
          const url = `${CDON_MERCHANTS_API}/v1/orders?${params.toString()}`;
          const { resp, json } = await this.cdonRequest(url, {
            merchantId,
            apiToken,
            method: 'GET',
          });
          if (!resp.ok) {
            const detail = (json && json.message) != null ? json.message : resp.statusText;
            return res
              .status(resp.status)
              .json({ error: 'Failed to fetch CDON orders', detail: String(detail).slice(0, 500) });
          }
          const items = Array.isArray(json) ? json : [];
          allOrders.push(...items);
          hasMore = items.length >= limit;
          page += 1;
        }
      }

      const productIdBySku = await this.ordersModel.loadProductIdsByChannelExternalId(
        req,
        'cdon',
        allOrders.map((o) => o?.article_sku),
      );
      const normalizedOrders = [];
      const channelOrderIds = [];
      for (const o of allOrders) {
        if (o == null || o.id == null) continue;
        const normalized = await this.normalizeCdonOrderToHomebase(o, req, { productIdBySku });
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
      Logger.error('CDON orders pull error', error, { userId: Context.getUserId(req) });
      return res
        .status(502)
        .json({ error: 'Failed to pull CDON orders', detail: String(error?.message || error) });
    }
  }

  /**
   * Build one normalized order from a single CDON API order object.
   * Doc: id, article_sku, title/article_title, price { amount, vat_amount, vat_rate, currency }, total_price, quantity,
   * shipping_address { first_name, last_name, full_name, street_address, city, postal_code, country, phone_number }, market, state, created_at.
   */
  async normalizeCdonOrderToHomebase(o, req, { productIdBySku = null } = {}) {
    if (o == null || o.id == null) return null;
    const channelOrderId = String(o.id);

    let placedAt = o.created_at != null ? String(o.created_at).trim() : null;
    if (
      placedAt &&
      !placedAt.endsWith('Z') &&
      !placedAt.includes('+') &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(placedAt)
    ) {
      placedAt = placedAt.replace(' ', 'T') + 'Z';
    }

    const price = o.price;
    const totalPrice = o.total_price;
    const currency =
      price && price.currency
        ? String(price.currency).toUpperCase()
        : totalPrice && totalPrice.currency
          ? String(totalPrice.currency).toUpperCase()
          : null;
    const status = this.mapCdonOrderStatusToHomebase(o.state);

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
      channel: 'cdon',
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

  /** Doc: state is CREATED | ACCEPTED | FULFILLED | NOT_FULFILLED only. */
  mapCdonOrderStatusToHomebase(state) {
    const s = String(state || '').toUpperCase();
    if (s === 'CREATED' || s === 'ACCEPTED') return 'processing';
    if (s === 'FULFILLED') return 'delivered';
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

module.exports = CdonProductsController;
