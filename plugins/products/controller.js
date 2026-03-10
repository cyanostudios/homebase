// plugins/products/controller.js

const { Logger, Context, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const XLSX = require('xlsx');
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const lookupsModel = require('./lookupsModel');
const listsModel = require('../../server/core/lists/listsModel');
const { fetchCategoriesFromApi: fetchCdonCategories } = require('../cdon-products/fetchCategories');
const {
  fetchCategoriesFromApi: fetchFyndiqCategories,
} = require('../fyndiq-products/fetchCategories');

const LANGUAGE_TO_MARKET = { 'sv-SE': 'SE', 'da-DK': 'DK', 'fi-FI': 'FI', 'nb-NO': 'NO' };

const IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const IMPORT_MAX_ROWS = 5000;
const SELLO_PAGE_SIZE = 100;

function normalizeHeader(h) {
  return (
    String(h || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[_-]+/g, '')
      // Keep dots so we can parse standard headers like "cdon.se.price"
      // Also strips external suffixes like "#53270".
      .replace(/[^a-z0-9.]+/g, '')
  );
}

function toIntOrUndef(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

function toFloatOrUndef(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function toStrOrUndef(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

function mergeForUpdate(existing, incoming) {
  const merged = { ...existing };

  const setIf = (key, val) => {
    if (val !== undefined && val !== null && !(typeof val === 'string' && val.trim() === '')) {
      merged[key] = val;
    }
  };

  setIf('title', incoming.title);
  setIf('description', incoming.description);
  setIf('status', incoming.status);
  setIf('quantity', incoming.quantity);
  setIf('priceAmount', incoming.priceAmount);
  setIf('currency', incoming.currency);
  setIf('vatRate', incoming.vatRate);
  setIf('brand', incoming.brand);
  setIf('mpn', incoming.mpn);
  setIf('gtin', incoming.gtin);

  // Always keep SKU stable (unique key)
  merged.sku = existing.sku;
  return merged;
}

async function parseCsvBuffer(buffer) {
  return await new Promise((resolve, reject) => {
    const rows = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(
        csvParser({
          mapHeaders: ({ header }) => normalizeHeader(header),
          skipLines: 0,
          strict: false,
        }),
      )
      .on('data', (row) => {
        rows.push(row);
        if (rows.length > IMPORT_MAX_ROWS) {
          stream.destroy(new Error(`Too many rows (max ${IMPORT_MAX_ROWS})`));
        }
      })
      .on('error', (err) => reject(err))
      .on('end', () => resolve(rows));
  });
}

function parseXlsxBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!Array.isArray(json)) return [];

  // Normalize keys to match CSV path
  return json.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row || {})) {
      out[normalizeHeader(k)] = v;
    }
    return out;
  });
}

function sanitizePathSegment(value, fallback = 'item') {
  const raw = String(value ?? '').trim();
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return safe || fallback;
}

function guessExtension(contentType, sourceUrl) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('jpeg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  const cleanUrl = String(sourceUrl || '').split('?')[0];
  const ext = cleanUrl.includes('.') ? cleanUrl.split('.').pop() : '';
  const safe = String(ext || '').toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(safe) ? safe : 'jpg';
}

/** Preferred language order for primary title/description when Swedish is missing. */
const SELLO_LANG_PRIORITY = ['sv', 'fi', 'da', 'nb', 'no', 'en'];

function getSelloTextValue(texts, field, lang) {
  const t = texts?.default?.[lang];
  if (!t || typeof t !== 'object') return '';
  return String(t[field] ?? '').trim();
}

function getSelloStandardNameSv(product) {
  const texts = product?.texts;
  if (!texts || typeof texts !== 'object') return '';

  for (const lang of SELLO_LANG_PRIORITY) {
    const v = getSelloTextValue(texts, 'name', lang);
    if (v) return v;
  }
  for (const [integrationKey, integrationTexts] of Object.entries(texts)) {
    if (integrationKey === 'default') continue;
    if (!integrationTexts || typeof integrationTexts !== 'object') continue;
    for (const lang of SELLO_LANG_PRIORITY) {
      const v = String(integrationTexts?.[lang]?.name ?? '').trim();
      if (v) return v;
    }
  }
  return '';
}

function getSelloStandardDescriptionSv(product) {
  const texts = product?.texts;
  if (!texts || typeof texts !== 'object') return '';

  for (const lang of SELLO_LANG_PRIORITY) {
    const v = getSelloTextValue(texts, 'description', lang);
    if (v) return v;
  }
  for (const [integrationKey, integrationTexts] of Object.entries(texts)) {
    if (integrationKey === 'default') continue;
    if (!integrationTexts || typeof integrationTexts !== 'object') continue;
    for (const lang of SELLO_LANG_PRIORITY) {
      const v = String(integrationTexts?.[lang]?.description ?? '').trim();
      if (v) return v;
    }
  }
  return '';
}

function toFiniteNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toPositiveNumberOrNull(v) {
  const n = toFiniteNumberOrNull(v);
  if (n == null) return null;
  return n > 0 ? n : null;
}

function getSelloPriceEntry(product, integrationId) {
  const prices = product?.prices;
  if (!prices || typeof prices !== 'object') return null;
  const key = String(integrationId || '').trim();
  if (!key) return null;
  const entry = prices[key];
  if (!entry || typeof entry !== 'object') return null;
  return entry;
}

function getSelloStorePriceForInstance(product, integrationId, market) {
  const entry = getSelloPriceEntry(product, integrationId);
  if (!entry) return null;

  const marketToLang = { se: 'sv', dk: 'da', fi: 'fi', no: 'nb' };
  const normalizedMarket = String(market || '')
    .trim()
    .toLowerCase();
  const lang = marketToLang[normalizedMarket] || null;
  if (lang) {
    const localized = toPositiveNumberOrNull(entry?.[lang]?.store);
    if (localized != null) return localized;
  }

  const defaultStore = toPositiveNumberOrNull(entry?.store);
  if (defaultStore != null) return defaultStore;

  if (!lang) {
    const svStore = toPositiveNumberOrNull(entry?.sv?.store);
    if (svStore != null) return svStore;
  }
  return null;
}

function getSelloCurrencyForIntegration(product, integrationId) {
  const entry = getSelloPriceEntry(product, integrationId);
  const currency = String(entry?.currency || '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function normalizeSelloCategoryId(value) {
  if (value === null || value === undefined) return null;
  const id = String(value).trim();
  if (!id || id === '0') return null;
  return id ? id : null;
}

function getSelloCategoryForIntegration(product, integrationId) {
  const all = getSelloCategoriesForIntegration(product, integrationId);
  return all.length ? all[0] : null;
}

function getSelloCategoriesForIntegration(product, integrationId) {
  const categories = product?.categories;
  if (!categories || typeof categories !== 'object') return [];
  const key = String(integrationId || '').trim();
  if (!key) return [];
  const rows = Array.isArray(categories[key]) ? categories[key] : [];
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const id =
      row && typeof row === 'object' && !Array.isArray(row)
        ? normalizeSelloCategoryId(row.id)
        : normalizeSelloCategoryId(row);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function getSelloAllCategoryIds(product) {
  const categories = product?.categories;
  if (!categories || typeof categories !== 'object') return [];
  const out = [];
  const seen = new Set();
  for (const rows of Object.values(categories)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const id =
        row && typeof row === 'object' && !Array.isArray(row)
          ? normalizeSelloCategoryId(row.id)
          : normalizeSelloCategoryId(row);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Extract textsExtended (name, description, titleSeo, metaDesc, metaKeywords, bulletpoints) from Sello texts per market. */
function getSelloTextsExtended(product) {
  const texts = product?.texts;
  if (!texts || typeof texts !== 'object') return null;
  const defaultTexts = texts.default;
  if (!defaultTexts || typeof defaultTexts !== 'object') return null;
  const langToMarket = { sv: 'se', da: 'dk', fi: 'fi', no: 'no', nb: 'no' };
  const out = {};
  for (const [lang, t] of Object.entries(defaultTexts)) {
    if (!t || typeof t !== 'object') continue;
    const market = langToMarket[lang] || (lang === 'en' ? 'se' : null);
    if (!market || out[market]) continue;
    const name = String(t.name ?? '').trim();
    const description = String(t.description ?? '').trim();
    const titleSeo = String(t.title ?? '').trim();
    const metaDesc = String(t.meta_description ?? '').trim();
    const metaKeywords = String(t.meta_keywords ?? '').trim();
    const bp = t.bulletpoints;
    const bulletpoints = Array.isArray(bp) ? bp.filter(Boolean).map(String) : [];
    if (name || description || titleSeo || metaDesc || metaKeywords || bulletpoints.length > 0) {
      out[market] = {
        ...(name && { name }),
        ...(description && { description }),
        ...(titleSeo && { titleSeo }),
        ...(metaDesc && { metaDesc }),
        ...(metaKeywords && { metaKeywords }),
        ...(bulletpoints.length > 0 && { bulletpoints }),
      };
    }
  }
  return Object.keys(out).length ? out : null;
}

/** Extract EAN from Sello properties (property "EAN"). */
function getSelloEan(product) {
  const props = product?.properties;
  if (!Array.isArray(props)) return null;
  for (const p of props) {
    const name = String(p?.property ?? '')
      .trim()
      .toUpperCase();
    if (name !== 'EAN') continue;
    const v = p?.value;
    if (v && typeof v === 'object') {
      const val = String(v?.default ?? v?.sv ?? '').trim();
      if (val) return val;
    }
    break;
  }
  return null;
}

/** Extract GTIN from Sello properties (property "GTIN"). */
function getSelloGtin(product) {
  const props = product?.properties;
  if (!Array.isArray(props)) return null;
  for (const p of props) {
    const name = String(p?.property ?? '')
      .trim()
      .toUpperCase();
    if (name !== 'GTIN') continue;
    const v = p?.value;
    if (v && typeof v === 'object') {
      const val = String(v?.default ?? v?.sv ?? '').trim();
      if (val) return val;
    }
    break;
  }
  return null;
}

/** Extract value from Sello product properties by property name. */
function getSelloPropertyValue(product, propertyIds) {
  const props = product?.properties;
  if (!Array.isArray(props)) return null;
  const ids = Array.isArray(propertyIds) ? propertyIds : [propertyIds];
  const idsLower = ids.map((id) => String(id).toLowerCase());
  for (const p of props) {
    const name = String(p?.property ?? '')
      .trim()
      .toLowerCase();
    if (!name) continue;
    if (idsLower.includes(name)) {
      const v = p?.value;
      if (v && typeof v === 'object') {
        const sv = String(v?.sv ?? v?.default ?? '').trim();
        if (sv) return sv;
      }
      break;
    }
  }
  return null;
}

/** Channel preset colors (CDON, Fyndiq, WooCommerce). Lowercase for match. */
const CHANNEL_COLOR_PRESETS = new Set([
  'red',
  'blue',
  'green',
  'orange',
  'yellow',
  'purple',
  'pink',
  'gold',
  'silver',
  'multicolor',
  'white',
  'gray',
  'black',
  'turquoise',
  'brown',
  'beige',
  'transparent',
]);

/** CDON preset size values (lowercase). */
const CDON_SIZE_PRESETS = new Set(['one size', 'xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl']);

/** Extract color text from Sello product properties (Color, Färg, ColorText, Färgtext). */
function getSelloColorFromProperties(product) {
  return getSelloPropertyValue(product, ['color', 'färg', 'colortext', 'färgtext']);
}

/** Extract color preset code if Sello Color value matches channel list; else null. */
function getSelloColorPreset(product) {
  const v = getSelloPropertyValue(product, ['color', 'färg']);
  if (!v) return null;
  const lower = String(v).trim().toLowerCase();
  if (CHANNEL_COLOR_PRESETS.has(lower)) return lower;
  return null;
}

/** Size from Sello property "Size" or "Storlek". Preset if matches CDON list. */
function getSelloSize(product) {
  const v = getSelloPropertyValue(product, ['size', 'storlek']);
  if (!v) return null;
  const lower = String(v).trim().toLowerCase();
  if (CDON_SIZE_PRESETS.has(lower)) return lower;
  return null;
}

/** Size fritext from Sello property "Size" or "Storlek". */
function getSelloSizeText(product) {
  return getSelloPropertyValue(product, ['size', 'storlek']);
}

/** Material (fritext) from Sello property "Material". */
function getSelloMaterial(product) {
  return getSelloPropertyValue(product, ['material']);
}

/** Pattern preset from Sello property "ColorPattern" (för CDON/Fyndiq). */
function getSelloPattern(product) {
  return getSelloPropertyValue(product, ['colorpattern', 'pattern']);
}

/** Pattern fritext from Sello property "Mönster" när preset saknas. */
function getSelloPatternText(product) {
  return getSelloPropertyValue(product, ['mönster', 'pattern_text']);
}

/** Model (fritext) from Sello property "Model" or "Modell" – för gruppering per modell. */
function getSelloModel(product) {
  return getSelloPropertyValue(product, ['model', 'modell']);
}

const MARKETS_FOR_SHIPPING = ['SE', 'DK', 'FI', 'NO'];

/**
 * Parse one delivery_times entry: { min, max } -> { min, max } | null.
 */
function parseSelloDeliveryEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const min = entry.min != null ? Math.floor(Number(entry.min)) : null;
  const max = entry.max != null ? Math.floor(Number(entry.max)) : null;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max < 1 || min > max)
    return null;
  return { min, max };
}

/**
 * Build shipping_time array for CDON/Fyndiq from Sello delivery_times.
 * Sello: delivery_times = { SE: { min, max }, DK: { min, max }, ... }.
 * Only uses per-market values; Sello default is ignored so products without
 * explicit per-market shipping fall back to plugin settings. Clamped to 1–20.
 * @param {Object} product - Sello product
 * @returns {Array<{ market: string, min: number, max: number }> | null}
 */
function buildShippingTimeFromSello(product) {
  const dt = product?.delivery_times;
  if (!dt || typeof dt !== 'object') return null;
  const out = [];
  for (const market of MARKETS_FOR_SHIPPING) {
    const entry = parseSelloDeliveryEntry(dt[market]);
    if (!entry) continue;
    const min = Math.max(1, Math.min(20, entry.min));
    const max = Math.max(1, Math.min(20, Math.max(min, entry.max)));
    out.push({ market, min, max });
  }
  return out.length > 0 ? out : null;
}

function buildImportedChannelSpecificCategories(product, instancesByIntegration) {
  const integrations =
    product?.integrations && typeof product.integrations === 'object' ? product.integrations : {};
  const cdonMarkets = {};
  const fyndiqMarkets = {};

  for (const [integrationIdRaw, stateRaw] of Object.entries(integrations)) {
    const integrationId = String(integrationIdRaw || '').trim();
    if (!integrationId) continue;
    const state = stateRaw && typeof stateRaw === 'object' ? stateRaw : {};
    const categoryIds = getSelloCategoriesForIntegration(product, integrationId);
    if (!categoryIds.length) continue;
    const instances = instancesByIntegration.get(integrationId) || [];
    for (const inst of instances) {
      const market = String(inst.market || '')
        .trim()
        .toLowerCase();
      if (!['se', 'dk', 'fi', 'no'].includes(market)) continue;
      if (inst.channel === 'cdon') {
        cdonMarkets[market] = {
          category: categoryIds[0],
          active: state.active === true,
        };
      } else if (inst.channel === 'fyndiq') {
        fyndiqMarkets[market] = {
          categories: categoryIds,
          active: state.active === true,
        };
      }
    }
  }

  const shippingTime = buildShippingTimeFromSello(product);
  const shippingByMarket = {};
  if (shippingTime && Array.isArray(shippingTime)) {
    for (const st of shippingTime) {
      const mk = String(st.market || '').toLowerCase();
      if (['se', 'dk', 'fi', 'no'].includes(mk)) {
        shippingByMarket[mk] = { shippingMin: st.min, shippingMax: st.max };
      }
    }
  }
  for (const mk of ['se', 'dk', 'fi', 'no']) {
    const ship = shippingByMarket[mk];
    if (ship) {
      if (cdonMarkets[mk]) Object.assign(cdonMarkets[mk], ship);
      else cdonMarkets[mk] = { category: null, active: false, ...ship };
      if (fyndiqMarkets[mk]) Object.assign(fyndiqMarkets[mk], ship);
      else fyndiqMarkets[mk] = { categories: [], active: false, ...ship };
    }
  }
  const out = {};
  out.cdon = {
    category: null,
    markets: cdonMarkets,
    ...(shippingTime && { shipping_time: shippingTime }),
  };
  out.fyndiq = {
    categories: [],
    markets: fyndiqMarkets,
    ...(shippingTime && { shipping_time: shippingTime }),
  };
  return out;
}

class ProductController {
  constructor(model, selloModel) {
    this.model = model;
    this.selloModel = selloModel || null;
  }

  async getSelloSettings(req, res) {
    try {
      if (!this.selloModel) return res.status(501).json({ error: 'Sello settings not available' });
      const settings = await this.selloModel.getSettings(req);
      return res.json(settings || null);
    } catch (error) {
      Logger.error('Get Sello settings error', error, { userId: req.session?.user?.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to fetch Sello settings' });
    }
  }

  async putSelloSettings(req, res) {
    try {
      if (!this.selloModel) return res.status(501).json({ error: 'Sello settings not available' });
      const saved = await this.selloModel.upsertSettings(req, req.body || {});
      return res.json(saved);
    } catch (error) {
      Logger.error('Save Sello settings error', error, { userId: req.session?.user?.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: error?.message || 'Failed to save Sello settings' });
    }
  }

  async getBrands(req, res) {
    try {
      const items = await lookupsModel.getAll(req, 'brands');
      res.json({ items });
    } catch (err) {
      if (err instanceof AppError)
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      Logger.error('getBrands failed', err);
      res.status(500).json({ error: 'Failed to fetch brands' });
    }
  }

  async createBrand(req, res) {
    try {
      const { name } = req.body || {};
      const item = await lookupsModel.create(req, 'brands', name);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof AppError)
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      Logger.error('createBrand failed', err);
      res.status(500).json({ error: 'Failed to create brand' });
    }
  }

  async getSuppliers(req, res) {
    try {
      const items = await lookupsModel.getAll(req, 'suppliers');
      res.json({ items });
    } catch (err) {
      if (err instanceof AppError)
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      Logger.error('getSuppliers failed', err);
      res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
  }

  async createSupplier(req, res) {
    try {
      const { name } = req.body || {};
      const item = await lookupsModel.create(req, 'suppliers', name);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof AppError)
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      Logger.error('createSupplier failed', err);
      res.status(500).json({ error: 'Failed to create supplier' });
    }
  }

  async getManufacturers(req, res) {
    try {
      const items = await lookupsModel.getAll(req, 'manufacturers');
      res.json({ items });
    } catch (err) {
      if (err instanceof AppError)
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      Logger.error('getManufacturers failed', err);
      res.status(500).json({ error: 'Failed to fetch manufacturers' });
    }
  }

  async createManufacturer(req, res) {
    try {
      const { name } = req.body || {};
      const item = await lookupsModel.create(req, 'manufacturers', name);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof AppError)
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      Logger.error('createManufacturer failed', err);
      res.status(500).json({ error: 'Failed to create manufacturer' });
    }
  }

  async upsertChannelOverride(
    req,
    { productId, channel, instance, active, priceAmount, currency, vatRate, category },
  ) {
    const { Database } = require('@homebase/core');
    const db = Database.get(req);
    const userId = req.session?.user?.id;
    if (!userId) return;

    const channelKey = String(channel).toLowerCase();
    const instanceKey = String(instance || '').trim();
    if (!instanceKey) return;

    // Ensure instance exists (future-proof: multiple stores / markets)
    const inferredMarket =
      (channelKey === 'cdon' || channelKey === 'fyndiq') &&
      ['se', 'dk', 'fi', 'no'].includes(instanceKey.toLowerCase())
        ? instanceKey.toLowerCase()
        : null;

    const instRows = await db.query(
      `
      INSERT INTO channel_instances (user_id, channel, instance_key, market, label, credentials, enabled, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, channel, instance_key) DO UPDATE SET
        market = COALESCE(channel_instances.market, EXCLUDED.market),
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
      `,
      [userId, channelKey, instanceKey, inferredMarket],
    );
    const channelInstanceId = instRows?.[0]?.id;

    const sql = `
      INSERT INTO channel_product_overrides
        (user_id, product_id, channel, instance, channel_instance_id, active, price_amount, currency, vat_rate, category, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, product_id, channel, instance) DO UPDATE SET
        channel_instance_id = COALESCE(EXCLUDED.channel_instance_id, channel_product_overrides.channel_instance_id),
        active = EXCLUDED.active,
        price_amount = EXCLUDED.price_amount,
        currency = EXCLUDED.currency,
        vat_rate = EXCLUDED.vat_rate,
        category = CASE WHEN $11 = true THEN EXCLUDED.category ELSE channel_product_overrides.category END,
        updated_at = CURRENT_TIMESTAMP
    `;

    await db.query(sql, [
      userId,
      String(productId),
      channelKey,
      instanceKey,
      channelInstanceId || null,
      !!active,
      priceAmount != null && Number.isFinite(Number(priceAmount)) ? Number(priceAmount) : null,
      currency ? String(currency) : null,
      vatRate != null && Number.isFinite(Number(vatRate)) ? Number(vatRate) : null,
      category != null && String(category).trim() ? String(category).trim() : null,
      category !== undefined,
    ]);
  }

  parseSelloOverridesFromRow(r) {
    // r is already normalized by normalizeHeader()
    const entries = Object.entries(r || {});
    const out = [];

    // Standard template format: "<channel>.<instance>.<field>"
    // Examples:
    // - cdon.se.price, cdon.se.active, cdon.se.category
    // - fyndiq.fi.price, fyndiq.fi.active, fyndiq.fi.category
    // - woocommerce.shopA.price, woocommerce.shopA.active, woocommerce.shopA.categories
    for (const [k, v] of entries) {
      const m = String(k).match(/^([a-z0-9]+)\.([a-z0-9]+)\.(price|active|category|categories)$/);
      if (!m) continue;
      const channel = m[1];
      const instance = m[2];
      const field = m[3];

      // Find existing aggregate for (channel, instance)
      let rec = out.find((x) => x.channel === channel && x.instance === instance);
      if (!rec) {
        rec = { channel, instance, active: false, priceAmount: null, category: null };
        out.push(rec);
      }

      if (field === 'price') rec.priceAmount = v;
      if (field === 'active')
        rec.active =
          Number(v) === 1 || String(v).trim() === '1' || String(v).toLowerCase() === 'true';
      if (field === 'category' || field === 'categories') rec.category = v;
    }

    // CDON: cdonseprice55616, cdonseactive55616, cdondkprice..., cdonfiprice...
    const cdonMarkets = ['se', 'dk', 'fi'];
    for (const m of cdonMarkets) {
      const priceKey = entries.find(([k]) => k.startsWith(`cdon${m}price`))?.[0];
      const activeKey = entries.find(([k]) => k.startsWith(`cdon${m}active`))?.[0];
      if (!priceKey && !activeKey) continue;

      const priceRaw = r[priceKey] ?? null;
      const activeRaw = r[activeKey] ?? null;

      out.push({
        channel: 'cdon',
        instance: m, // market instance
        priceAmount: priceRaw,
        active:
          Number(activeRaw) === 1 ||
          String(activeRaw).trim() === '1' ||
          String(activeRaw).toLowerCase() === 'true',
      });
    }

    // Fyndiq: fyndiq3price53270, fyndiq3active53270 (instance is the numeric code)
    for (const [k, v] of entries) {
      const m = k.match(/^fyndiq3price(\d+)$/);
      if (!m) continue;
      const code = m[1];
      const activeKey = `fyndiq3active${code}`;
      out.push({
        channel: 'fyndiq',
        instance: code,
        priceAmount: v,
        active:
          Number(r[activeKey]) === 1 ||
          String(r[activeKey]).trim() === '1' ||
          String(r[activeKey]).toLowerCase() === 'true',
      });
    }

    // WooCommerce: woocommerceprice55051 (store instance code)
    for (const [k, v] of entries) {
      const m = k.match(/^woocommerceprice(\d+)$/);
      if (!m) continue;
      const code = m[1];
      out.push({
        channel: 'woocommerce',
        instance: code,
        priceAmount: v,
        active: true,
      });
    }

    return out;
  }

  // Helper: map PG 23505 unique violation to { field, message }
  mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;

    const constraint = String(error.constraint || '').toLowerCase();
    const detail = String(error.detail || '');
    const match = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
    const cols = match ? match[1].split(',').map((s) => s.trim()) : [];
    const val = match ? match[2] : undefined;

    const hasCol = (name) => constraint.includes(name) || cols.includes(name);

    if (hasCol('sku')) {
      return {
        field: 'sku',
        message: val ? `SKU "${val}" already exists` : 'SKU already exists',
      };
    }

    return { field: 'general', message: 'Unique constraint violated' };
  }

  requireSku(req, res) {
    const data = req.body || {};
    const sku = String(data.sku || '').trim();
    if (!sku) {
      res.status(400).json({ error: 'SKU is required', code: 'VALIDATION_ERROR' });
      return null;
    }
    return data;
  }

  // ---- Lists (products namespace) ----

  async getLists(req, res) {
    try {
      const listsModel = require('../../server/core/lists/listsModel');
      const data = await listsModel.getLists(req, 'products');
      return res.json(data);
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to fetch lists' });
    }
  }

  async createList(req, res) {
    try {
      const listsModel = require('../../server/core/lists/listsModel');
      const name = req.body?.name ?? '';
      const data = await listsModel.createList(req, 'products', name);
      return res.status(201).json(data);
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to create list' });
    }
  }

  async renameList(req, res) {
    try {
      const listsModel = require('../../server/core/lists/listsModel');
      const name = req.body?.name ?? '';
      const data = await listsModel.renameList(req, 'products', req.params.id, name);
      return res.json(data);
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to rename list' });
    }
  }

  async deleteList(req, res) {
    try {
      const listsModel = require('../../server/core/lists/listsModel');
      await listsModel.deleteList(req, 'products', req.params.id);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to delete list' });
    }
  }

  async setProductList(req, res) {
    try {
      const productId = req.params.id;
      const listId = req.body?.listId ?? null;
      const product = await this.model.setProductList(req, productId, listId);
      return res.json(product);
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to set product list' });
    }
  }

  // ---- CRUD ----

  async getAll(req, res) {
    try {
      const products = await this.model.getAll(req);
      return res.json(products);
    } catch (error) {
      Logger.error('Get products error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({ error: 'Failed to fetch products' });
    }
  }

  async create(req, res) {
    try {
      const data = this.requireSku(req, res);
      if (!data) return;

      const product = await this.model.create(req, data);
      return res.json(product);
    } catch (error) {
      Logger.error('Create product error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        const mapped = this.mapUniqueViolation(error);
        if (mapped) {
          return res.status(409).json({ errors: [mapped] });
        }
        return res.status(error.statusCode).json(error.toJSON());
      }

      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      return res.status(500).json({ error: 'Failed to create product' });
    }
  }

  async getStats(req, res) {
    try {
      const productId = String(req.params?.id || '').trim();
      const range = String(req.query?.range || '30d').toLowerCase();
      if (!productId) {
        return res.status(400).json({ error: 'Product ID required', code: 'VALIDATION_ERROR' });
      }
      const stats = await this.model.getProductStats(req, productId, range);
      return res.json(stats);
    } catch (error) {
      Logger.error('Get product stats error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to fetch product stats' });
    }
  }

  async update(req, res) {
    try {
      const data = this.requireSku(req, res);
      if (!data) return;

      const product = await this.model.update(req, req.params.id, data);
      return res.json(product);
    } catch (error) {
      Logger.error('Update product error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        if (error.code === 'NOT_FOUND') {
          return res.status(404).json(error.toJSON());
        }
        const mapped = this.mapUniqueViolation(error);
        if (mapped) {
          return res.status(409).json({ errors: [mapped] });
        }
        return res.status(error.statusCode).json(error.toJSON());
      }

      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      return res.status(500).json({ error: 'Failed to update product' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      return res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      Logger.error('Delete product error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        if (error.code === 'NOT_FOUND') {
          return res.status(404).json(error.toJSON());
        }
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({ error: 'Failed to delete product' });
    }
  }

  // ---- Batch update ----
  // PATCH /api/products/batch
  // body: { ids: string[], updates: { priceAmount?: number, quantity?: number, status?: string, vatRate?: number, currency?: string } }
  async batchUpdate(req, res) {
    try {
      const idsRaw = req.body?.ids;
      const updates = req.body?.updates || {};
      if (!Array.isArray(idsRaw)) {
        return res
          .status(400)
          .json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const ids = Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)));
      if (!ids.length) {
        return res.json({ ok: true, updatedCount: 0, updatedIds: [] });
      }
      if (ids.length > 500) {
        return res
          .status(400)
          .json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }

      const result = await this.model.batchUpdate(req, ids, updates);
      return res.json({
        ok: true,
        updatedCount: result.updatedCount ?? 0,
        updatedIds: result.updatedIds ?? [],
      });
    } catch (error) {
      Logger.error('Batch update products error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to batch update products' });
    }
  }

  // ---- Bulk delete ----
  // DELETE /api/products/batch
  // body: { ids: string[] }
  async bulkDelete(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res
          .status(400)
          .json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const ids = Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)));

      if (!ids.length) {
        return res.json({ ok: true, requested: 0, deleted: 0 });
      }

      if (ids.length > 500) {
        return res
          .status(400)
          .json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }

      const result = await this.model.bulkDelete(req, ids);

      const deleted =
        typeof result?.deletedCount === 'number'
          ? result.deletedCount
          : Array.isArray(result?.deletedIds)
            ? result.deletedIds.length
            : 0;

      return res.json({
        ok: true,
        requested: ids.length,
        deleted,
        deletedIds: result?.deletedIds || [],
      });
    } catch (error) {
      Logger.error('Bulk delete error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({ error: 'Bulk delete failed' });
    }
  }

  // ---- Import ----
  // POST /api/products/import (multipart/form-data)
  // fields: mode = 'update-only' | 'create-only' | 'upsert'
  // file: file
  async import(req, res) {
    try {
      const modeRaw = String(req.body?.mode || 'upsert')
        .trim()
        .toLowerCase();
      const mode =
        modeRaw === 'update-only' || modeRaw === 'create-only' || modeRaw === 'upsert'
          ? modeRaw
          : null;
      if (!mode) {
        return res.status(400).json({
          error: 'Invalid mode (use update-only, create-only, or upsert)',
          code: 'VALIDATION_ERROR',
        });
      }

      const file = req.file;
      if (!file || !file.buffer) {
        return res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });
      }
      if (file.size > IMPORT_MAX_FILE_BYTES) {
        return res.status(400).json({
          error: `File too large (max ${Math.round(IMPORT_MAX_FILE_BYTES / 1024 / 1024)}MB)`,
          code: 'VALIDATION_ERROR',
        });
      }

      const originalName = String(file.originalname || '').toLowerCase();
      const isCsv =
        file.mimetype === 'text/csv' ||
        file.mimetype === 'application/csv' ||
        originalName.endsWith('.csv');
      const isXlsx =
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        originalName.endsWith('.xlsx');
      if (!isCsv && !isXlsx) {
        return res
          .status(400)
          .json({ error: 'Unsupported file type (use .csv or .xlsx)', code: 'VALIDATION_ERROR' });
      }

      const rawRows = isCsv ? await parseCsvBuffer(file.buffer) : parseXlsxBuffer(file.buffer);
      if (rawRows.length > IMPORT_MAX_ROWS) {
        return res
          .status(400)
          .json({ error: `Too many rows (max ${IMPORT_MAX_ROWS})`, code: 'VALIDATION_ERROR' });
      }

      const result = {
        ok: true,
        mode,
        totalRows: rawRows.length,
        created: 0,
        updated: 0,
        skippedMissingSku: [],
        skippedInvalid: [],
        conflicts: [],
        notFound: [],
        rows: [],
      };

      for (let i = 0; i < rawRows.length; i++) {
        const rowNum = i + 1;
        const r = rawRows[i] || {};

        // Expected normalized keys (no spaces/underscores):
        // Default import: sku, title, description, quantity, priceamount, currency, vatrate, status, brand, mpn, gtin
        // Sello export: sku, standardnamesv, standarddescriptionsv, tax, brand, manufacturerno, propertygtin/propertyean,
        // plus per-channel columns like cdonseprice####, cdonseactive####, fyndiq3price####, fyndiq3active####.
        const sku = toStrOrUndef(r.sku);
        if (!sku) {
          result.skippedMissingSku.push({ row: rowNum });
          result.rows.push({ row: rowNum, action: 'skipped', reason: 'missing_sku' });
          continue;
        }

        const isSello =
          r.standardnamesv != null || r.standarddescriptionsv != null || r.manufacturerno != null;
        const selloVat = toFloatOrUndef(r.tax);
        const selloGtin = toStrOrUndef(r.propertygtin) || toStrOrUndef(r.propertyean);
        const selloMpn = toStrOrUndef(r.manufacturerno);

        // Base fields (Sello takes precedence when present)
        const incoming = {
          sku,
          title: isSello
            ? toStrOrUndef(r.standardnamesv) || toStrOrUndef(r.title)
            : toStrOrUndef(r.title),
          description: isSello
            ? toStrOrUndef(r.standarddescriptionsv) || toStrOrUndef(r.description)
            : toStrOrUndef(r.description),
          status: toStrOrUndef(r.status),
          quantity: toIntOrUndef(r.quantity),
          priceAmount: toFloatOrUndef(r.priceamount),
          currency: toStrOrUndef(r.currency),
          vatRate: isSello && selloVat != null ? selloVat : toFloatOrUndef(r.vatrate),
          brand: toStrOrUndef(r.brand),
          mpn: isSello ? selloMpn || undefined : toStrOrUndef(r.mpn),
          gtin: isSello ? selloGtin || undefined : toStrOrUndef(r.gtin),
        };

        // Basic bounds / normalization (security + sanity)
        if (incoming.title && incoming.title.length > 255)
          incoming.title = incoming.title.slice(0, 255);
        if (incoming.currency) incoming.currency = incoming.currency.toUpperCase();
        if (incoming.quantity !== undefined && incoming.quantity < 0) incoming.quantity = 0;
        if (incoming.priceAmount !== undefined && incoming.priceAmount < 0)
          incoming.priceAmount = 0;
        if (incoming.vatRate !== undefined && (incoming.vatRate < 0 || incoming.vatRate > 50)) {
          incoming.vatRate = undefined;
        }

        const existing = await this.model.getBySku(req, sku);

        if (mode === 'update-only') {
          if (!existing) {
            result.notFound.push({ row: rowNum, sku });
            result.rows.push({ row: rowNum, sku, action: 'skipped', reason: 'sku_not_found' });
            continue;
          }
          const merged = mergeForUpdate(existing, incoming);
          const saved = await this.model.update(req, existing.id, merged);
          result.updated++;
          result.rows.push({ row: rowNum, sku, action: 'updated', id: saved?.id });
          continue;
        }

        if (mode === 'create-only') {
          if (existing) {
            result.conflicts.push({ row: rowNum, sku, existingId: existing.id });
            result.rows.push({
              row: rowNum,
              sku,
              action: 'skipped',
              reason: 'sku_conflict',
              id: existing.id,
            });
            continue;
          }
          const title = incoming.title;
          if (!title) {
            result.skippedInvalid.push({ row: rowNum, sku, reason: 'missing_title' });
            result.rows.push({ row: rowNum, sku, action: 'skipped', reason: 'missing_title' });
            continue;
          }
          const payload = {
            sku,
            mpn: incoming.mpn ?? '',
            title,
            description: incoming.description ?? '',
            status: incoming.status ?? 'for sale',
            quantity: incoming.quantity ?? 0,
            priceAmount: incoming.priceAmount ?? 0,
            currency: incoming.currency ?? 'SEK',
            vatRate: incoming.vatRate ?? 25,
            brand: incoming.brand ?? '',
            mpn: incoming.mpn ?? '',
            gtin: incoming.gtin ?? '',
            images: [],
            categories: [],
            mainImage: '',
          };
          const created = await this.model.create(req, payload);

          // Sello-style per-channel overrides (price/active per channel instance)
          if (isSello) {
            const overrides = this.parseSelloOverridesFromRow(r);
            for (const o of overrides) {
              // market default currencies for CDON
              const currency =
                o.channel === 'cdon'
                  ? o.instance === 'se'
                    ? 'SEK'
                    : o.instance === 'dk'
                      ? 'DKK'
                      : o.instance === 'fi'
                        ? 'EUR'
                        : null
                  : (incoming.currency ?? null);

              await this.upsertChannelOverride(req, {
                productId: created?.id,
                channel: o.channel,
                instance: o.instance,
                active: o.active,
                priceAmount: o.priceAmount,
                currency,
                vatRate: incoming.vatRate ?? 25,
              });
            }
          }

          result.created++;
          result.rows.push({ row: rowNum, sku, action: 'created', id: created?.id });
          continue;
        }

        // upsert
        if (existing) {
          const merged = mergeForUpdate(existing, incoming);
          const saved = await this.model.update(req, existing.id, merged);

          if (isSello) {
            const overrides = this.parseSelloOverridesFromRow(r);
            for (const o of overrides) {
              const currency =
                o.channel === 'cdon'
                  ? o.instance === 'se'
                    ? 'SEK'
                    : o.instance === 'dk'
                      ? 'DKK'
                      : o.instance === 'fi'
                        ? 'EUR'
                        : null
                  : (incoming.currency ?? null);

              await this.upsertChannelOverride(req, {
                productId: saved?.id ?? existing.id,
                channel: o.channel,
                instance: o.instance,
                active: o.active,
                priceAmount: o.priceAmount,
                currency,
                vatRate: incoming.vatRate ?? 25,
              });
            }
          }

          result.updated++;
          result.rows.push({ row: rowNum, sku, action: 'updated', id: saved?.id });
        } else {
          const title = incoming.title;
          if (!title) {
            result.skippedInvalid.push({ row: rowNum, sku, reason: 'missing_title' });
            result.rows.push({ row: rowNum, sku, action: 'skipped', reason: 'missing_title' });
            continue;
          }
          const payload = {
            sku,
            mpn: incoming.mpn ?? '',
            title,
            description: incoming.description ?? '',
            status: incoming.status ?? 'for sale',
            quantity: incoming.quantity ?? 0,
            priceAmount: incoming.priceAmount ?? 0,
            currency: incoming.currency ?? 'SEK',
            vatRate: incoming.vatRate ?? 25,
            brand: incoming.brand ?? '',
            mpn: incoming.mpn ?? '',
            gtin: incoming.gtin ?? '',
            images: [],
            categories: [],
            mainImage: '',
          };
          const created = await this.model.create(req, payload);

          if (isSello) {
            const overrides = this.parseSelloOverridesFromRow(r);
            for (const o of overrides) {
              const currency =
                o.channel === 'cdon'
                  ? o.instance === 'se'
                    ? 'SEK'
                    : o.instance === 'dk'
                      ? 'DKK'
                      : o.instance === 'fi'
                        ? 'EUR'
                        : null
                  : (incoming.currency ?? null);

              await this.upsertChannelOverride(req, {
                productId: created?.id,
                channel: o.channel,
                instance: o.instance,
                active: o.active,
                priceAmount: o.priceAmount,
                currency,
                vatRate: incoming.vatRate ?? 25,
              });
            }
          }

          result.created++;
          result.rows.push({ row: rowNum, sku, action: 'created', id: created?.id });
        }
      }

      return res.json(result);
    } catch (error) {
      Logger.error('Import products error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      return res.status(500).json({ error: 'Failed to import products' });
    }
  }

  async downloadSelloImages(req, sku, images) {
    const userId = Context.getUserId(req);
    if (!userId) return { urls: [], downloaded: 0, failed: 0 };

    const imageItems = Array.isArray(images) ? images : [];
    if (!imageItems.length) return { urls: [], downloaded: 0, failed: 0 };

    const fetchFn =
      typeof fetch === 'function'
        ? fetch
        : async (...args) => {
            const mod = await import('node-fetch').catch(() => null);
            if (!mod?.default)
              throw new Error('fetch is not available (Node <18) and node-fetch is not installed');
            return mod.default(...args);
          };

    const safeSku = sanitizePathSegment(sku, 'product');
    const rootDir = path.join(
      process.cwd(),
      'server',
      'uploads',
      'files',
      'sello-import',
      String(userId),
      safeSku,
    );
    await fs.mkdir(rootDir, { recursive: true });

    const urls = [];
    let downloaded = 0;
    let failed = 0;

    for (let i = 0; i < imageItems.length; i += 1) {
      const sourceUrl = String(imageItems[i]?.url_large || '').trim();
      if (!sourceUrl) continue;
      try {
        const resp = await fetchFn(sourceUrl, { method: 'GET' });
        if (!resp.ok) {
          failed += 1;
          continue;
        }
        const arrayBuffer = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const hash = crypto
          .createHash('sha1')
          .update(`${sourceUrl}:${i}`)
          .digest('hex')
          .slice(0, 12);
        const ext = guessExtension(resp.headers.get('content-type'), sourceUrl);
        const fileName = `${String(i + 1).padStart(2, '0')}-${hash}.${ext}`;
        const fullPath = path.join(rootDir, fileName);
        await fs.writeFile(fullPath, buffer);
        downloaded += 1;
        urls.push(`/api/files/raw/sello-import/${userId}/${safeSku}/${fileName}`);
      } catch (_err) {
        failed += 1;
      }
    }

    return { urls, downloaded, failed };
  }

  async importFromSelloApi(req, res) {
    try {
      if (!this.selloModel) return res.status(501).json({ error: 'Sello settings not available' });

      const apiKey = await this.selloModel.getApiKeyForJobs(req);
      const startOffset = Number.isFinite(Number(req.body?.startOffset))
        ? Math.max(0, Math.trunc(Number(req.body.startOffset)))
        : 0;
      let offset = startOffset;
      let total = null;
      const maxProducts = Number.isFinite(Number(req.body?.maxProducts))
        ? Math.max(1, Math.trunc(Number(req.body.maxProducts)))
        : null;
      const maxPages = Number.isFinite(Number(req.body?.maxPages))
        ? Math.max(1, Math.trunc(Number(req.body.maxPages)))
        : null;
      let pagesFetched = 0;
      const summary = {
        ok: true,
        startOffset,
        requested: 0,
        created: 0,
        updated: 0,
        skipped_invalid: 0,
        image_downloaded: 0,
        image_failed: 0,
        overrides_updated: 0,
        rows: [],
      };
      const db = Database.get(req);
      const userId = Context.getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const channelInstances = await db.query(
        `
        SELECT id, channel, instance_key, market, sello_integration_id, enabled
        FROM channel_instances
        WHERE user_id = $1
          AND sello_integration_id IS NOT NULL
          AND TRIM(sello_integration_id) <> ''
        `,
        [userId],
      );
      const instanceRows = Array.isArray(channelInstances) ? channelInstances : [];
      const instancesByIntegration = new Map();
      for (const row of instanceRows) {
        const integrationId = String(row.sello_integration_id || '').trim();
        if (!integrationId) continue;
        if (!instancesByIntegration.has(integrationId))
          instancesByIntegration.set(integrationId, []);
        instancesByIntegration.get(integrationId).push({
          id: Number(row.id),
          channel: String(row.channel || '')
            .trim()
            .toLowerCase(),
          instanceKey: String(row.instance_key || '').trim(),
          market:
            String(row.market || '')
              .trim()
              .toLowerCase() || null,
          enabled: row.enabled === true,
        });
      }

      const selloProductIds = Array.isArray(req.body?.selloProductIds)
        ? req.body.selloProductIds.map((x) => String(x).trim()).filter(Boolean)
        : null;

      if (selloProductIds && selloProductIds.length > 0) {
        let groupsByGroupId = new Map();
        try {
          const listPath = `/v5/products?size=100&${selloProductIds
            .map((id) => `filter[id][]=${encodeURIComponent(id)}`)
            .join('&')}`;
          const listRes = await this.selloModel.fetchSelloJson({ apiKey, path: listPath });
          const groups = Array.isArray(listRes?.groups) ? listRes.groups : [];
          for (const g of groups) {
            const gid = g.id ?? g.group_id;
            if (gid != null) {
              groupsByGroupId.set(String(gid), {
                mainProduct: g.main_product,
                type:
                  g.type && ['color', 'size', 'model'].includes(String(g.type).toLowerCase())
                    ? String(g.type).toLowerCase()
                    : null,
              });
            }
          }
        } catch {
          groupsByGroupId = new Map();
        }
        const selloIdToHomebaseId = new Map();
        for (const productId of selloProductIds) {
          let raw;
          try {
            raw = await this.selloModel.fetchSelloJson({
              apiKey,
              path: `/v5/products/${encodeURIComponent(productId)}`,
            });
          } catch (err) {
            summary.skipped_invalid += 1;
            summary.rows.push({
              sku: productId,
              status: 'skipped_invalid',
              reason: 'sello_fetch_failed',
              sourceCreatedAt: null,
            });
            continue;
          }
          if (!raw || typeof raw !== 'object') {
            summary.skipped_invalid += 1;
            summary.rows.push({
              sku: productId,
              status: 'skipped_invalid',
              reason: 'sello_empty_response',
              sourceCreatedAt: null,
            });
            continue;
          }
          summary.requested += 1;
          const sku = String(raw?.id ?? '').trim();
          const title = getSelloStandardNameSv(raw);
          const description = getSelloStandardDescriptionSv(raw);
          if (!sku) {
            summary.skipped_invalid += 1;
            summary.rows.push({
              sku: null,
              status: 'skipped_invalid',
              reason: 'missing_sku',
              sourceCreatedAt: raw?.created_at || null,
            });
            continue;
          }
          if (!title) {
            summary.skipped_invalid += 1;
            summary.rows.push({
              sku,
              status: 'skipped_invalid',
              reason: 'missing_title',
              sourceCreatedAt: raw?.created_at || null,
            });
            continue;
          }
          const imageResult = await this.downloadSelloImages(req, sku, raw?.images);
          summary.image_downloaded += imageResult.downloaded;
          summary.image_failed += imageResult.failed;
          const categoryIds = getSelloAllCategoryIds(raw);
          const importedChannelSpecific = buildImportedChannelSpecificCategories(
            raw,
            instancesByIntegration,
          );
          const textsExtended = getSelloTextsExtended(raw);
          if (textsExtended) {
            importedChannelSpecific.textsExtended = textsExtended;
          }
          const selloList = await listsModel.findOrCreateListForSelloFolder(
            req,
            'products',
            raw?.folder_id,
            raw?.folder_name,
          );
          const selloBrand = await lookupsModel.findOrCreateBrandForSello(
            req,
            raw?.brand_id,
            raw?.brand_name,
          );
          let selloManufacturer = null;
          let manufacturerIdRaw = raw?.manufacturer ?? raw?.manufacturer_id;
          if (
            manufacturerIdRaw != null &&
            typeof manufacturerIdRaw === 'object' &&
            manufacturerIdRaw.id != null
          ) {
            manufacturerIdRaw = manufacturerIdRaw.id;
          }
          const manufacturerName = (raw?.manufacturer_name ?? '').trim() || null;
          if (manufacturerIdRaw != null && this.selloModel) {
            try {
              const mfr = await this.selloModel.fetchManufacturer(apiKey, manufacturerIdRaw);
              const mfrName = mfr?.name || manufacturerName;
              selloManufacturer = await lookupsModel.findOrCreateManufacturerForSello(
                req,
                String(manufacturerIdRaw),
                mfrName,
              );
            } catch {
              selloManufacturer = await lookupsModel.findOrCreateManufacturerForSello(
                req,
                String(manufacturerIdRaw),
                manufacturerName,
              );
            }
          } else if (manufacturerName) {
            selloManufacturer = await lookupsModel.findOrCreateManufacturerForSello(
              req,
              '',
              manufacturerName,
            );
          }
          const upsertResult = await this.model.upsertFromSelloProduct(req, {
            selloId: sku,
            privateName: (() => {
              const v = raw?.private_name ?? raw?.product?.private_name;
              return v != null ? String(v).trim() : null;
            })(),
            merchantSku: raw?.private_reference != null ? String(raw.private_reference) : null,
            title,
            description,
            quantity: raw?.quantity,
            priceAmount: undefined,
            vatRate: raw?.tax,
            mainImage: imageResult.urls[0] || null,
            images: imageResult.urls,
            categories: categoryIds,
            channelSpecific: Object.keys(importedChannelSpecific).length
              ? importedChannelSpecific
              : undefined,
            ean: getSelloEan(raw),
            gtin: getSelloGtin(raw),
            brand: selloBrand?.name ?? raw?.brand_name,
            brandId: selloBrand?.id,
            manufacturerId: selloManufacturer?.id ?? undefined,
            purchasePrice: raw?.purchase_price != null ? Number(raw.purchase_price) : undefined,
            color: getSelloColorPreset(raw),
            colorText: getSelloColorPreset(raw) ? null : (getSelloColorFromProperties(raw) ?? null),
            size: getSelloSize(raw),
            sizeText: getSelloSize(raw) ? null : (getSelloSizeText(raw) ?? null),
            material: getSelloMaterial(raw),
            pattern: getSelloPattern(raw),
            patternText: getSelloPattern(raw) ? null : (getSelloPatternText(raw) ?? null),
            model: getSelloModel(raw) || undefined,
            lagerplats: raw?.stock_location != null ? String(raw.stock_location).trim() : undefined,
            condition: raw?.condition === 'used' ? 'used' : 'new',
            groupId: raw?.group_id != null ? String(raw.group_id) : undefined,
            volume: raw?.volume != null ? Number(raw.volume) : undefined,
            volumeUnit: raw?.volume_unit != null ? String(raw.volume_unit).trim() : undefined,
            weight: raw?.weight != null ? Number(raw.weight) : undefined,
            notes: raw?.notes != null ? String(raw.notes).trim() : undefined,
            sourceCreatedAt: raw?.created_at != null ? String(raw.created_at).trim() : undefined,
            quantitySold:
              raw?.sold != null && Number.isFinite(Number(raw.sold)) ? Number(raw.sold) : undefined,
            lastSoldAt: raw?.last_sold != null ? String(raw.last_sold).trim() : undefined,
          });
          const createdProductId = String(upsertResult?.product?.id || '').trim();
          const groupIdRaw = raw?.group_id != null ? String(raw.group_id) : null;
          if (createdProductId && groupIdRaw) selloIdToHomebaseId.set(sku, { groupId: groupIdRaw });
          if (createdProductId && selloList?.id) {
            await this.model.setProductList(req, createdProductId, selloList.id);
          }
          if (createdProductId) {
            const integrations =
              raw?.integrations && typeof raw.integrations === 'object' ? raw.integrations : {};
            for (const [integrationIdRaw, statesRaw] of Object.entries(integrations)) {
              const integrationId = String(integrationIdRaw || '').trim();
              if (!integrationId) continue;
              const targetInstances = instancesByIntegration.get(integrationId) || [];
              if (!targetInstances.length) continue;
              const state = statesRaw && typeof statesRaw === 'object' ? statesRaw : {};
              const active = state.active === true;
              const currency = getSelloCurrencyForIntegration(raw, integrationId);
              const catIds = getSelloCategoriesForIntegration(raw, integrationId);
              const firstCategoryId = catIds.length ? catIds[0] : null;
              for (const inst of targetInstances) {
                const perInstancePrice = getSelloStorePriceForInstance(
                  raw,
                  integrationId,
                  inst.market,
                );
                let overrideCategory;
                if (inst.channel === 'woocommerce') {
                  overrideCategory = catIds.length ? JSON.stringify(catIds) : null;
                } else if (inst.channel === 'cdon' || inst.channel === 'fyndiq') {
                  overrideCategory = firstCategoryId;
                }
                await this.upsertChannelOverride(req, {
                  productId: createdProductId,
                  channel: inst.channel,
                  instance: inst.instanceKey,
                  active,
                  priceAmount: perInstancePrice,
                  currency,
                  vatRate: raw?.tax,
                  category: overrideCategory,
                });
                summary.overrides_updated += 1;
              }
            }
          }
          if (upsertResult.created) {
            summary.created += 1;
            summary.rows.push({
              sku,
              status: 'created',
              reason: null,
              sourceCreatedAt: raw?.created_at || null,
            });
          } else {
            summary.updated += 1;
            summary.rows.push({
              sku,
              status: 'updated',
              reason: null,
              sourceCreatedAt: raw?.created_at || null,
            });
          }
        }
        for (const [selloId, { groupId }] of selloIdToHomebaseId) {
          if (!groupId) continue;
          const groupInfo = groupsByGroupId.get(groupId);
          if (!groupInfo) continue;
          const mainSelloId = String(groupInfo.mainProduct ?? '');
          const isMain = selloId === mainSelloId;
          const parentProductId = isMain ? null : mainSelloId;
          await this.model.updateProductGroupRelation(req, selloId, {
            parentProductId,
            groupVariationType: groupInfo.type,
          });
        }
        return res.json(summary);
      }

      while (true) {
        if (maxPages != null && pagesFetched >= maxPages) break;
        if (maxProducts != null && summary.requested >= maxProducts) break;
        const page = await this.selloModel.fetchSelloJson({
          apiKey,
          path: '/v5/products',
          query: { size: SELLO_PAGE_SIZE, offset },
        });
        pagesFetched += 1;
        const products = Array.isArray(page?.products) ? page.products : [];
        if (total == null && Number.isFinite(Number(page?.duration?.total_count))) {
          total = Number(page.duration.total_count);
        }
        if (!products.length) break;

        for (const raw of products) {
          if (maxProducts != null && summary.requested >= maxProducts) break;
          summary.requested += 1;
          const sku = String(raw?.id ?? '').trim();
          const title = getSelloStandardNameSv(raw);
          const description = getSelloStandardDescriptionSv(raw);
          if (!sku) {
            summary.skipped_invalid += 1;
            summary.rows.push({
              sku: null,
              status: 'skipped_invalid',
              reason: 'missing_sku',
              sourceCreatedAt: raw?.created_at || null,
            });
            continue;
          }
          if (!title) {
            summary.skipped_invalid += 1;
            summary.rows.push({
              sku,
              status: 'skipped_invalid',
              reason: 'missing_title',
              sourceCreatedAt: raw?.created_at || null,
            });
            continue;
          }

          const imageResult = await this.downloadSelloImages(req, sku, raw?.images);
          summary.image_downloaded += imageResult.downloaded;
          summary.image_failed += imageResult.failed;
          const categoryIds = getSelloAllCategoryIds(raw);
          const importedChannelSpecific = buildImportedChannelSpecificCategories(
            raw,
            instancesByIntegration,
          );
          const textsExtended = getSelloTextsExtended(raw);
          if (textsExtended) {
            importedChannelSpecific.textsExtended = textsExtended;
          }
          const selloList = await listsModel.findOrCreateListForSelloFolder(
            req,
            'products',
            raw?.folder_id,
            raw?.folder_name,
          );
          const selloBrand = await lookupsModel.findOrCreateBrandForSello(
            req,
            raw?.brand_id,
            raw?.brand_name,
          );
          let selloManufacturer = null;
          let manufacturerIdRaw = raw?.manufacturer ?? raw?.manufacturer_id;
          if (
            manufacturerIdRaw != null &&
            typeof manufacturerIdRaw === 'object' &&
            manufacturerIdRaw.id != null
          ) {
            manufacturerIdRaw = manufacturerIdRaw.id;
          }
          const manufacturerName = (raw?.manufacturer_name ?? '').trim() || null;
          if (manufacturerIdRaw != null && this.selloModel) {
            try {
              const mfr = await this.selloModel.fetchManufacturer(apiKey, manufacturerIdRaw);
              const mfrName = mfr?.name || manufacturerName;
              selloManufacturer = await lookupsModel.findOrCreateManufacturerForSello(
                req,
                String(manufacturerIdRaw),
                mfrName,
              );
            } catch {
              selloManufacturer = await lookupsModel.findOrCreateManufacturerForSello(
                req,
                String(manufacturerIdRaw),
                manufacturerName,
              );
            }
          } else if (manufacturerName) {
            selloManufacturer = await lookupsModel.findOrCreateManufacturerForSello(
              req,
              '',
              manufacturerName,
            );
          }
          const upsertResult = await this.model.upsertFromSelloProduct(req, {
            selloId: sku,
            privateName: (() => {
              const v = raw?.private_name ?? raw?.product?.private_name;
              return v != null ? String(v).trim() : null;
            })(),
            merchantSku: raw?.private_reference != null ? String(raw.private_reference) : null,
            title,
            description,
            quantity: raw?.quantity,
            priceAmount: undefined,
            vatRate: raw?.tax,
            mainImage: imageResult.urls[0] || null,
            images: imageResult.urls,
            categories: categoryIds,
            channelSpecific: Object.keys(importedChannelSpecific).length
              ? importedChannelSpecific
              : undefined,
            ean: getSelloEan(raw),
            gtin: getSelloGtin(raw),
            brand: selloBrand?.name ?? raw?.brand_name,
            brandId: selloBrand?.id,
            manufacturerId: selloManufacturer?.id ?? undefined,
            purchasePrice: raw?.purchase_price != null ? Number(raw.purchase_price) : undefined,
            color: getSelloColorPreset(raw),
            colorText: getSelloColorPreset(raw) ? null : (getSelloColorFromProperties(raw) ?? null),
            size: getSelloSize(raw),
            sizeText: getSelloSize(raw) ? null : (getSelloSizeText(raw) ?? null),
            material: getSelloMaterial(raw),
            pattern: getSelloPattern(raw),
            patternText: getSelloPattern(raw) ? null : (getSelloPatternText(raw) ?? null),
            model: getSelloModel(raw) || undefined,
            lagerplats: raw?.stock_location != null ? String(raw.stock_location).trim() : undefined,
            condition: raw?.condition === 'used' ? 'used' : 'new',
            groupId: raw?.group_id != null ? String(raw.group_id) : undefined,
            volume: raw?.volume != null ? Number(raw.volume) : undefined,
            volumeUnit: raw?.volume_unit != null ? String(raw.volume_unit).trim() : undefined,
            weight: raw?.weight != null ? Number(raw.weight) : undefined,
            notes: raw?.notes != null ? String(raw.notes).trim() : undefined,
            sourceCreatedAt: raw?.created_at != null ? String(raw.created_at).trim() : undefined,
            quantitySold:
              raw?.sold != null && Number.isFinite(Number(raw.sold)) ? Number(raw.sold) : undefined,
            lastSoldAt: raw?.last_sold != null ? String(raw.last_sold).trim() : undefined,
          });
          const productId = String(upsertResult?.product?.id || '').trim();
          if (productId && selloList?.id) {
            await this.model.setProductList(req, productId, selloList.id);
          }
          if (productId) {
            const integrations =
              raw?.integrations && typeof raw.integrations === 'object' ? raw.integrations : {};
            for (const [integrationIdRaw, statesRaw] of Object.entries(integrations)) {
              const integrationId = String(integrationIdRaw || '').trim();
              if (!integrationId) continue;
              const targetInstances = instancesByIntegration.get(integrationId) || [];
              if (!targetInstances.length) continue;

              const state = statesRaw && typeof statesRaw === 'object' ? statesRaw : {};
              const active = state.active === true;
              const currency = getSelloCurrencyForIntegration(raw, integrationId);
              const categoryIds = getSelloCategoriesForIntegration(raw, integrationId);
              const firstCategoryId = categoryIds.length ? categoryIds[0] : null;

              for (const inst of targetInstances) {
                const perInstancePrice = getSelloStorePriceForInstance(
                  raw,
                  integrationId,
                  inst.market,
                );
                let overrideCategory;
                if (inst.channel === 'woocommerce') {
                  if (categoryIds.length) overrideCategory = JSON.stringify(categoryIds);
                  else overrideCategory = null;
                } else if (inst.channel === 'cdon' || inst.channel === 'fyndiq') {
                  overrideCategory = firstCategoryId;
                }
                await this.upsertChannelOverride(req, {
                  productId,
                  channel: inst.channel,
                  instance: inst.instanceKey,
                  active,
                  priceAmount: perInstancePrice,
                  currency,
                  vatRate: raw?.tax,
                  category: overrideCategory,
                });
                summary.overrides_updated += 1;
              }
            }
          }
          if (upsertResult.created) {
            summary.created += 1;
            summary.rows.push({
              sku,
              status: 'created',
              reason: null,
              sourceCreatedAt: raw?.created_at || null,
            });
          } else {
            summary.updated += 1;
            summary.rows.push({
              sku,
              status: 'updated',
              reason: null,
              sourceCreatedAt: raw?.created_at || null,
            });
          }
        }

        offset += products.length;
        if (products.length < SELLO_PAGE_SIZE) break;
        if (total != null && offset >= total) break;
      }

      return res.json(summary);
    } catch (error) {
      Logger.error('Sello import error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to import products from Sello' });
    }
  }

  async upsertChannelProductMap(
    req,
    { productId, channel, channelInstanceId, enabled, externalId, status, reason },
  ) {
    const db = Database.get(req);
    const userId = Context.getUserId(req);
    if (!userId) return;

    await db.query(
      `
      INSERT INTO channel_product_map
        (user_id, product_id, channel, channel_instance_id, enabled, external_id, last_synced_at, last_sync_status, last_error, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, product_id, channel, channel_instance_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        external_id = EXCLUDED.external_id,
        last_synced_at = CURRENT_TIMESTAMP,
        last_sync_status = EXCLUDED.last_sync_status,
        last_error = EXCLUDED.last_error,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        userId,
        String(productId),
        String(channel),
        Number(channelInstanceId),
        !!enabled,
        externalId != null ? String(externalId) : null,
        status || 'synced',
        reason || null,
      ],
    );
  }

  async buildChannelMapFromSello(req, res) {
    try {
      if (!this.selloModel) return res.status(501).json({ error: 'Sello settings not available' });
      const apiKey = await this.selloModel.getApiKeyForJobs(req);
      const db = Database.get(req);
      const userId = Context.getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const integrationsList = await this.selloModel.fetchSelloJson({
        apiKey,
        path: '/v5/integrations',
      });
      const validIntegrationIds = new Set(
        (Array.isArray(integrationsList) ? integrationsList : [])
          .map((x) => String(x?.id ?? '').trim())
          .filter(Boolean),
      );
      const startOffset = Number.isFinite(Number(req.body?.startOffset))
        ? Math.max(0, Math.trunc(Number(req.body.startOffset)))
        : 0;
      let offset = startOffset;
      let total = null;
      const maxProducts = Number.isFinite(Number(req.body?.maxProducts))
        ? Math.max(1, Math.trunc(Number(req.body.maxProducts)))
        : null;
      const maxPages = Number.isFinite(Number(req.body?.maxPages))
        ? Math.max(1, Math.trunc(Number(req.body.maxPages)))
        : null;
      let pagesFetched = 0;
      let productsProcessed = 0;
      const summary = {
        ok: true,
        startOffset,
        requested: 0,
        updated: 0,
        skipped_no_product: 0,
        skipped_no_map: 0,
        expected_skip: 0,
        validation_error: 0,
        deviations: [],
      };

      const instances = await db.query(
        `
        SELECT id, channel, instance_key, sello_integration_id
        FROM channel_instances
        WHERE user_id = $1
        `,
        [userId],
      );
      const instancesByIntegration = new Map();
      for (const row of instances) {
        const integrationId = String(row.sello_integration_id || '').trim();
        if (!integrationId) continue;
        if (!instancesByIntegration.has(integrationId))
          instancesByIntegration.set(integrationId, []);
        instancesByIntegration.get(integrationId).push({
          id: Number(row.id),
          channel: String(row.channel || '').toLowerCase(),
          instanceKey: String(row.instance_key || ''),
        });
      }

      while (true) {
        if (maxPages != null && pagesFetched >= maxPages) break;
        if (maxProducts != null && productsProcessed >= maxProducts) break;
        const page = await this.selloModel.fetchSelloJson({
          apiKey,
          path: '/v5/products',
          query: { size: SELLO_PAGE_SIZE, offset },
        });
        pagesFetched += 1;
        const products = Array.isArray(page?.products) ? page.products : [];
        if (total == null && Number.isFinite(Number(page?.duration?.total_count))) {
          total = Number(page.duration.total_count);
        }
        if (!products.length) break;

        const skuList = products.map((p) => String(p?.id ?? '').trim()).filter(Boolean);
        const homebaseRows = skuList.length
          ? await db.query(
              `SELECT id::text AS id, sku FROM products WHERE user_id = $1 AND sku = ANY($2::text[])`,
              [userId, skuList],
            )
          : [];
        const productIdBySku = new Map(homebaseRows.map((r) => [String(r.sku), String(r.id)]));

        for (const raw of products) {
          if (maxProducts != null && productsProcessed >= maxProducts) break;
          productsProcessed += 1;
          const sku = String(raw?.id ?? '').trim();
          if (!sku) continue;
          const productId = productIdBySku.get(sku);
          if (!productId) {
            summary.skipped_no_product += 1;
            continue;
          }

          const integrations =
            raw?.integrations && typeof raw.integrations === 'object' ? raw.integrations : {};
          for (const [integrationIdRaw, stateRaw] of Object.entries(integrations)) {
            const integrationId = String(integrationIdRaw || '').trim();
            if (!integrationId) continue;
            const state = stateRaw && typeof stateRaw === 'object' ? stateRaw : {};
            const active = state.active === true;
            if (!active) continue;

            summary.requested += 1;
            if (!validIntegrationIds.has(integrationId)) {
              summary.validation_error += 1;
              summary.deviations.push({
                productId,
                sku,
                channel: null,
                instanceKey: null,
                reason: `unknown_integration_id:${integrationId}`,
              });
              continue;
            }

            const targetInstances = instancesByIntegration.get(integrationId) || [];
            if (!targetInstances.length) {
              summary.skipped_no_map += 1;
              summary.expected_skip += 1;
              summary.deviations.push({
                productId,
                sku,
                channel: null,
                instanceKey: null,
                reason: `missing_sello_integration_map:${integrationId}`,
                classification: 'expected_skip',
              });
              continue;
            }
            const externalId = String(state.item_id ?? '').trim();
            const hasExternalId = !!externalId;

            if (active && !hasExternalId) {
              summary.validation_error += targetInstances.length;
              for (const inst of targetInstances) {
                summary.deviations.push({
                  productId,
                  sku,
                  channel: inst.channel,
                  instanceKey: inst.instanceKey,
                  reason: 'active_without_item_id',
                });
              }
              continue;
            }

            for (const inst of targetInstances) {
              await this.upsertChannelProductMap(req, {
                productId,
                channel: inst.channel,
                channelInstanceId: inst.id,
                enabled: active && hasExternalId,
                externalId: hasExternalId ? externalId : null,
                status: 'synced',
                reason: null,
              });
              summary.updated += 1;
            }
          }
        }

        offset += products.length;
        if (products.length < SELLO_PAGE_SIZE) break;
        if (total != null && offset >= total) break;
      }

      return res.json(summary);
    } catch (error) {
      Logger.error('Sello map build error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to build channel map from Sello' });
    }
  }

  /**
   * GET /api/products/category-cache?key=...
   * Returns cached channel categories. For cdon:categories:{lang} and fyndiq:categories:{lang},
   * on-demand fetch and cache on miss (user_id NULL). Woo: no on-demand.
   */
  async getCategoryCache(req, res) {
    const key = String(req.query?.key ?? '').trim();
    if (!key) {
      return res.status(400).json({ error: 'Query parameter key is required.' });
    }
    const prefix = key.split(':')[0]?.toLowerCase();
    if (prefix !== 'cdon' && prefix !== 'fyndiq' && prefix !== 'woo') {
      return res.status(400).json({ error: 'Key must start with cdon:, fyndiq:, or woo:.' });
    }
    const db = Database.get(req);
    const userId = Context.getUserId(req);
    if (userId == null) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    let row;
    if (prefix === 'woo') {
      const r = await db.query(
        'SELECT payload, fetched_at FROM category_cache WHERE cache_key = $1 AND user_id = $2',
        [key, userId],
      );
      row = (Array.isArray(r) ? r[0] : r?.rows?.[0]) ?? null;
    } else {
      const r = await db.query(
        'SELECT payload, fetched_at FROM category_cache WHERE cache_key = $1 AND user_id IS NULL',
        [key],
      );
      row = (Array.isArray(r) ? r[0] : r?.rows?.[0]) ?? null;
    }

    if (!row && (prefix === 'cdon' || prefix === 'fyndiq')) {
      const match = key.match(/^(cdon|fyndiq):categories:(.+)$/);
      if (match) {
        const lang = String(match[2] || '').trim();
        const market = LANGUAGE_TO_MARKET[lang];
        if (market && (prefix === 'cdon' || prefix === 'fyndiq')) {
          try {
            let items = [];
            if (prefix === 'cdon') {
              const credsRows = await db.query(
                'SELECT api_key, api_secret FROM cdon_settings WHERE user_id = $1 LIMIT 1',
                [userId],
              );
              const c = credsRows?.[0];
              if (!c?.api_key || !c?.api_secret) {
                return res.status(502).json({
                  error: 'CDON credentials missing',
                  detail: 'Configure CDON in settings',
                });
              }
              items = await fetchCdonCategories(market, lang, c.api_key, c.api_secret);
            } else {
              const credsRows = await db.query(
                'SELECT api_key, api_secret FROM fyndiq_settings WHERE user_id = $1 LIMIT 1',
                [userId],
              );
              const c = credsRows?.[0];
              if (!c?.api_key || !c?.api_secret) {
                return res.status(502).json({
                  error: 'Fyndiq credentials missing',
                  detail: 'Configure Fyndiq in settings',
                });
              }
              const marketLower = market.toLowerCase();
              items = await fetchFyndiqCategories(marketLower, lang, c.api_key, c.api_secret);
            }
            const payload = Array.isArray(items) ? items : [];
            const fetchedAt = new Date();
            const up = await db.query(
              'UPDATE category_cache SET payload = $2, fetched_at = $3 WHERE cache_key = $1 AND user_id IS NULL',
              [key, JSON.stringify(payload), fetchedAt],
            );
            if (!up.rowCount || up.rowCount === 0) {
              await db.query(
                'INSERT INTO category_cache (cache_key, user_id, payload, fetched_at) VALUES ($1, NULL, $2::jsonb, $3)',
                [key, JSON.stringify(payload), fetchedAt],
              );
            }
            return res.json({
              items: payload,
              fetchedAt: fetchedAt.toISOString(),
            });
          } catch (err) {
            Logger.error('Category cache on-demand fetch failed', { key, error: err?.message });
            return res.status(502).json({
              error: 'Failed to fetch categories',
              detail: err?.message ?? String(err),
            });
          }
        }
      }
    }

    if (!row) {
      return res.status(404).json({ error: 'No cache entry for this key.' });
    }
    const items = Array.isArray(row.payload) ? row.payload : [];
    return res.json({
      items,
      fetchedAt: row.fetched_at ? new Date(row.fetched_at).toISOString() : null,
    });
  }
}

module.exports = ProductController;
