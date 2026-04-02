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

const WooCommerceModel = require('../woocommerce-products/model');
const WooCommerceController = require('../woocommerce-products/controller');
const CredentialsCrypto = require('../../server/core/services/security/CredentialsCrypto');
const CdonProductsController = require('../cdon-products/controller');
const CdonProductsModel = require('../cdon-products/model');
const FyndiqProductsController = require('../fyndiq-products/controller');
const FyndiqProductsModel = require('../fyndiq-products/model');

const LANGUAGE_TO_MARKET = { 'sv-SE': 'SE', 'da-DK': 'DK', 'fi-FI': 'FI', 'nb-NO': 'NO' };

const stockPushQueue = require('./stockPushQueue');
const batchSyncMutex = require('./batchSyncMutex');
const productImportLock = require('./productImportLock');
const batchSyncStarterQueue = require('./batchSyncStarterQueue');
const { runBatchSyncJob } = require('./batchSyncJobRunner');

const IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const IMPORT_MAX_ROWS = 5000;
/** Max ids per PATCH/DELETE batch (aligned with catalog list page size cap). */
const PRODUCTS_BATCH_MAX_IDS = 250;
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

/** Sello column mapping only when column issello is 1 (opt-in per row). */
function isSelloImportRow(r) {
  const v = r?.issello;
  if (v === undefined || v === null || v === '') return false;
  if (typeof v === 'number' && Number.isFinite(v)) return v === 1;
  const s = String(v).trim();
  return s === '1';
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
  if (
    incoming.channelSpecific !== undefined &&
    incoming.channelSpecific !== null &&
    typeof incoming.channelSpecific === 'object' &&
    !Array.isArray(incoming.channelSpecific)
  ) {
    merged.channelSpecific = incoming.channelSpecific;
  }

  // Always keep SKU stable (unique key)
  merged.sku = existing.sku;
  return merged;
}

/** Per-market Texter columns: title.se, description.se, title.dk, … (normalized header keys keep the dot). */
const IMPORT_TEXT_MARKETS = ['se', 'dk', 'fi', 'no'];

function importDescPlainNonEmpty(htmlOrText) {
  const s = String(htmlOrText ?? '').trim();
  if (!s) return false;
  return (
    s
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim().length > 0
  );
}

function buildTextsExtendedPatchFromImportRow(r) {
  const patch = {};
  for (const mk of IMPORT_TEXT_MARKETS) {
    const tk = `title.${mk}`;
    const dk = `description.${mk}`;
    const hasTk = Object.prototype.hasOwnProperty.call(r, tk);
    const hasDk = Object.prototype.hasOwnProperty.call(r, dk);
    if (!hasTk && !hasDk) continue;
    const nameRaw = hasTk ? r[tk] : undefined;
    const descRaw = hasDk ? r[dk] : undefined;
    const hasName = nameRaw !== undefined && nameRaw !== null && String(nameRaw).trim() !== '';
    const hasDesc = descRaw !== undefined && descRaw !== null && String(descRaw).trim() !== '';
    if (!hasName && !hasDesc) continue;
    const entry = {};
    if (hasName) entry.name = String(nameRaw).trim().slice(0, 255);
    if (hasDesc) entry.description = String(descRaw).trim();
    patch[mk] = entry;
  }
  return patch;
}

function mergeTextsExtendedForImport(existing, patch) {
  const ex =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  for (const [mk, fields] of Object.entries(patch)) {
    if (!fields || typeof fields !== 'object') continue;
    ex[mk] = { ...(ex[mk] || {}), ...fields };
  }
  return ex;
}

function mergeChannelSpecificForImport(existingCs, textsExtendedMerged, options = {}) {
  const base =
    existingCs && typeof existingCs === 'object' && !Array.isArray(existingCs) ? { ...existingCs } : {};
  base.textsExtended = textsExtendedMerged;
  if (options.textsStandard !== undefined && options.textsStandard !== null) {
    base.textsStandard = options.textsStandard;
  }
  return base;
}

function normalizeImportTextsStandard(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (['se', 'dk', 'fi', 'no'].includes(s)) return s;
  return null;
}

/**
 * Standard marknad för list-titel/beskrivning: alltid se om kolumnen textsStandard saknas eller är ogiltig.
 * Om textsStandard sätts (t.ex. fi) måste den marknadens texter vara kompletta efter sammanslagning.
 */
function resolveStandardMarketPrimary(mergedTe, explicitRaw) {
  const standardMk = normalizeImportTextsStandard(explicitRaw) ?? 'se';
  const tx = mergedTe?.[standardMk];
  const name = String(tx?.name ?? '').trim();
  const desc = String(tx?.description ?? '');
  if (!name || !importDescPlainNonEmpty(desc)) {
    return { ok: false, code: 'standard_market_texts_incomplete', market: standardMk };
  }
  return {
    ok: true,
    standardMk,
    title: name.slice(0, 255),
    description: desc,
  };
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

/** Sello prices[integrationId].regular (per market/lang) → Fyndiq original_price. */
function getSelloRegularPriceForInstance(product, integrationId, market) {
  const entry = getSelloPriceEntry(product, integrationId);
  if (!entry) return null;

  const marketToLang = { se: 'sv', dk: 'da', fi: 'fi', no: 'nb' };
  const normalizedMarket = String(market || '')
    .trim()
    .toLowerCase();
  const lang = marketToLang[normalizedMarket] || null;
  const marketUpper = normalizedMarket ? normalizedMarket.toUpperCase() : null;
  if (lang) {
    const localized = toPositiveNumberOrNull(entry?.[lang]?.regular);
    if (localized != null) return localized;
  }
  if (marketUpper && entry?.[marketUpper]) {
    const v = toPositiveNumberOrNull(entry[marketUpper].regular);
    if (v != null) return v;
  }
  const defaultRegular = toPositiveNumberOrNull(entry?.regular);
  if (defaultRegular != null) return defaultRegular;
  if (!lang) {
    const svRegular = toPositiveNumberOrNull(entry?.sv?.regular);
    if (svRegular != null) return svRegular;
  }
  return null;
}

/** Sello prices[integrationId].campaign (per market/lang) → WooCommerce sale_price (Reapris). */
function getSelloCampaignPriceForInstance(product, integrationId, market) {
  const entry = getSelloPriceEntry(product, integrationId);
  if (!entry) return null;

  const marketToLang = { se: 'sv', dk: 'da', fi: 'fi', no: 'nb' };
  const normalizedMarket = String(market || '')
    .trim()
    .toLowerCase();
  const lang = marketToLang[normalizedMarket] || null;
  if (lang) {
    const localized = toPositiveNumberOrNull(entry?.[lang]?.campaign);
    if (localized != null) return localized;
  }
  const defaultCampaign = toPositiveNumberOrNull(entry?.campaign);
  if (defaultCampaign != null) return defaultCampaign;
  if (!lang) {
    const svCampaign = toPositiveNumberOrNull(entry?.sv?.campaign);
    if (svCampaign != null) return svCampaign;
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

/**
 * Read first non-empty primitive string from Sello property `value` (SELLO-API.md: locale keys).
 * Order is fixed; no extra keys, no nested unwrapping.
 */
function readSelloPropertyValueObject(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    return s || null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = ['default', 'sv', 'en', 'da', 'fi', 'no', 'nb'];
  for (const k of keys) {
    const raw = value[k];
    if (raw == null || typeof raw === 'object') continue;
    const s = String(raw).trim();
    if (s) return s;
  }
  return null;
}

/** Extract value from Sello product properties by exact property id (case-insensitive match only). */
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
      return readSelloPropertyValueObject(p?.value);
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

/**
 * Fyndiq-mönster preset: Sello property id `FyndiqPattern` (channel-specific; se faktisk GET /v5/products/{id}).
 * `ColorPattern` finns i category recommended list; äldre/vissa produkter kan använda `Pattern`.
 */
function getSelloPattern(product) {
  return getSelloPropertyValue(product, ['fyndiqpattern', 'colorpattern', 'pattern']);
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
 * explicit per-market shipping fall back to plugin settings. Clamped to 1–21 (Fyndiq max).
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
    const min = Math.max(1, Math.min(21, entry.min));
    const max = Math.max(1, Math.min(21, Math.max(min, entry.max)));
    out.push({ market, min, max });
  }
  return out.length > 0 ? out : null;
}

function buildImportedChannelSpecificCategories(product, instancesByIntegration) {
  const integrations =
    product?.integrations && typeof product.integrations === 'object' ? product.integrations : {};
  const cdonMarkets = {};
  const fyndiqMarkets = {};
  let cdonCategory = null;
  let fyndiqCategories = [];

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
        cdonCategory = categoryIds[0];
        cdonMarkets[market] = { active: state.active === true };
      } else if (inst.channel === 'fyndiq') {
        if (market === 'se') fyndiqCategories = categoryIds;
        fyndiqMarkets[market] = { active: state.active === true };
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
      else cdonMarkets[mk] = { active: false, ...ship };
      if (fyndiqMarkets[mk]) Object.assign(fyndiqMarkets[mk], ship);
      else fyndiqMarkets[mk] = { active: false, ...ship };
    }
  }
  const out = {};
  out.cdon = {
    category: cdonCategory,
    markets: cdonMarkets,
    ...(shippingTime && { shipping_time: shippingTime }),
  };
  out.fyndiq = {
    categories: fyndiqCategories,
    markets: fyndiqMarkets,
    ...(shippingTime && { shipping_time: shippingTime }),
  };
  return out;
}

/**
 * Same merge/dedup rules as single-product stock channel resolution (map + overrides).
 * @param {Array<{ channel: any, enabled: any, external_id: any, channel_instance_id: any }>} mapRows
 * @param {Array<{ channel: any, enabled: any, external_id: any, channel_instance_id: any }>} overrideRows
 */
function mergeStockChannelRows(mapRows, overrideRows) {
  const seen = new Set();
  const rows = [];
  for (const r of [...mapRows, ...overrideRows]) {
    const ch = String(r.channel || '')
      .trim()
      .toLowerCase();
    if (!ch) continue;
    const isUniversalStock = ch === 'cdon' || ch === 'fyndiq';
    const key = isUniversalStock ? `${ch}:` : `${ch}:${r.channel_instance_id ?? ''}`;
    if (seen.has(key)) {
      if (isUniversalStock && r.channel_instance_id == null) {
        const idx = rows.findIndex(
          (x) =>
            String(x.channel || '')
              .trim()
              .toLowerCase() === ch,
        );
        if (idx >= 0 && rows[idx].channel_instance_id != null) rows[idx] = r;
      }
      continue;
    }
    seen.add(key);
    rows.push(r);
  }
  return rows;
}

class ProductController {
  constructor(model, selloModel) {
    this.model = model;
    this.selloModel = selloModel || null;
    this.wooController = new WooCommerceController(new WooCommerceModel());
    this.cdonModel = new CdonProductsModel();
    this.cdonController = new CdonProductsController(this.cdonModel);
    this.fyndiqModel = new FyndiqProductsModel();
    this.fyndiqController = new FyndiqProductsController(this.fyndiqModel);
  }

  /**
   * Resolve WooCommerce external_id via API lookup when Sello returns item_id=null.
   * Tries V{productId} (variant) then productId (standalone). Returns null on failure.
   */
  async resolveWooExternalIdForSelloImport(req, productId, channelInstanceId) {
    try {
      const wooReq = { ...req, query: { instanceId: String(channelInstanceId) } };
      const wooInst = await this.wooController._getInstanceOrThrow(wooReq);
      const creds = wooInst.credentials || {};
      const base = this.wooController.normalizeBaseUrl(creds.storeUrl);
      const wooSettings = {
        storeUrl: creds.storeUrl,
        consumerKey: creds.consumerKey,
        consumerSecret: creds.consumerSecret,
        useQueryAuth: creds.useQueryAuth,
      };
      let existing = await this.wooController.findWooProductBySku(
        base,
        `V${productId}`,
        wooSettings,
      );
      if (!existing?.id) {
        existing = await this.wooController.findWooProductBySku(
          base,
          String(productId),
          wooSettings,
        );
      }
      return existing?.id ? String(existing.id) : null;
    } catch {
      return null;
    }
  }

  /**
   * Push product quantity to all enabled channels (Woo, CDON, Fyndiq).
   * @param {object} req
   * @param {{ productId: string, sku: string, quantity: number, sourceChannel: string|null, queueRole?: 'batch'|'order', skipQueue?: boolean }} opts
   */
  async pushStockToChannels(
    req,
    { productId, sku, quantity, sourceChannel, queueRole, skipQueue },
  ) {
    const tenantId = req.session?.tenantId;
    if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

    const role = queueRole === 'batch' ? 'batch' : 'order';
    const run = async () => {
      await this._pushStockToChannelsCore(req, { productId, sku, quantity, sourceChannel });
    };
    if (skipQueue) {
      return run();
    }
    if (role === 'batch') {
      return stockPushQueue.enqueueBatch(tenantId, run);
    }
    return stockPushQueue.enqueueOrder(tenantId, run);
  }

  async _pushStockToChannelsCore(req, { productId, sku, quantity, sourceChannel }) {
    const db = Database.get(req);
    const tenantId = req.session?.tenantId;
    if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

    const pid = String(productId ?? '').trim();
    if (!pid) return;

    const mapRows = await db.query(
      `SELECT channel, enabled, external_id, channel_instance_id
       FROM channel_product_map
       WHERE product_id::text = $1
         AND (enabled = TRUE OR external_id IS NOT NULL)`,
      [pid],
    );
    const overrideRows = await db.query(
      `SELECT o.channel, o.active AS enabled, m.external_id, o.channel_instance_id
       FROM channel_product_overrides o
       INNER JOIN channel_product_map m
         ON m.product_id::text = o.product_id::text
         AND m.channel = o.channel
         AND (m.channel_instance_id IS NOT DISTINCT FROM o.channel_instance_id)
       WHERE o.product_id::text = $1
         AND o.active = TRUE
         AND o.channel_instance_id IS NOT NULL
         AND m.external_id IS NOT NULL`,
      [pid],
    );
    const seen = new Set();
    const rows = [];
    for (const r of [...mapRows, ...overrideRows]) {
      const ch = String(r.channel || '')
        .trim()
        .toLowerCase();
      if (!ch) continue;
      // CDON/Fyndiq: stock push is universal (one API call updates all markets). Use one row per channel, prefer NULL.
      const isUniversalStock = ch === 'cdon' || ch === 'fyndiq';
      const key = isUniversalStock ? `${ch}:` : `${ch}:${r.channel_instance_id ?? ''}`;
      if (seen.has(key)) {
        if (isUniversalStock && r.channel_instance_id == null) {
          const idx = rows.findIndex(
            (x) =>
              String(x.channel || '')
                .trim()
                .toLowerCase() === ch,
          );
          if (idx >= 0 && rows[idx].channel_instance_id != null) rows[idx] = r;
        }
        continue;
      }
      seen.add(key);
      rows.push(r);
    }

    for (const r of rows) {
      const channel = String(r.channel || '')
        .trim()
        .toLowerCase();
      if (!channel || channel === sourceChannel) continue;

      if (channel === 'woocommerce') {
        const channelInstanceId =
          r.channel_instance_id != null ? String(r.channel_instance_id) : null;
        await this.wooController.syncStock(req, {
          productId: String(productId),
          sku,
          quantity,
          externalId: r.external_id != null ? String(r.external_id) : null,
          channelInstanceId,
        });
        continue;
      }

      if (channel === 'cdon') {
        const externalId = r.external_id != null ? String(r.external_id).trim() : null;
        const result = await this.cdonController.syncStock(req, {
          productId: String(productId),
          channelSku: String(productId),
          quantity,
        });
        if (result.ok) {
          await this.cdonModel.upsertChannelMap(req, {
            productId,
            channel: 'cdon',
            enabled: true,
            externalId: externalId ?? String(productId),
            status: 'success',
            error: null,
          });
        } else {
          await this.cdonModel.upsertChannelMap(req, {
            productId,
            channel: 'cdon',
            enabled: true,
            externalId: externalId ?? String(productId),
            status: 'error',
            error: result.error || 'Stock sync failed',
          });
          await this.cdonModel.logChannelError(req, {
            channel: 'cdon',
            productId,
            payload: { sku, quantity },
            response: null,
            message: result.error || 'Stock sync failed',
          });
        }
        continue;
      }

      if (channel === 'fyndiq') {
        const externalId = r.external_id != null ? String(r.external_id).trim() : '';
        if (!externalId) continue;
        const result = await this.fyndiqController.syncStock(req, {
          productId: String(productId),
          articleId: externalId,
          quantity,
        });
        if (result.ok) {
          await this.fyndiqModel.upsertChannelMap(req, {
            productId,
            channel: 'fyndiq',
            enabled: true,
            externalId,
            status: 'success',
            error: null,
          });
        } else {
          await this.fyndiqModel.upsertChannelMap(req, {
            productId,
            channel: 'fyndiq',
            enabled: true,
            externalId,
            status: 'error',
            error: result.error || 'Stock sync failed',
          });
          await this.fyndiqModel.logChannelError(req, {
            channel: 'fyndiq',
            productId,
            payload: { sku, quantity },
            response: null,
            message: result.error || 'Stock sync failed',
          });
        }
      }
    }
  }

  /**
   * Resolve channel rows for stock push (same rules as _pushStockToChannelsCore).
   * @returns {Promise<Array<{ channel: string, external_id: any, channel_instance_id: any }>>}
   */
  async resolveStockChannelRows(req, productId) {
    const db = Database.get(req);
    const pid = String(productId ?? '').trim();
    if (!pid) return [];

    const mapRows = await db.query(
      `SELECT channel, enabled, external_id, channel_instance_id
       FROM channel_product_map
       WHERE product_id::text = $1
         AND (enabled = TRUE OR external_id IS NOT NULL)`,
      [pid],
    );
    const overrideRows = await db.query(
      `SELECT o.channel, o.active AS enabled, m.external_id, o.channel_instance_id
       FROM channel_product_overrides o
       INNER JOIN channel_product_map m
         ON m.product_id::text = o.product_id::text
         AND m.channel = o.channel
         AND (m.channel_instance_id IS NOT DISTINCT FROM o.channel_instance_id)
       WHERE o.product_id::text = $1
         AND o.active = TRUE
         AND o.channel_instance_id IS NOT NULL
         AND m.external_id IS NOT NULL`,
      [pid],
    );
    return mergeStockChannelRows(mapRows, overrideRows);
  }

  /**
   * Batch prefetch: same rows as {@link resolveStockChannelRows} per id, two SQL round-trips total.
   * @param {object} req
   * @param {string[]} ids
   * @returns {Promise<Map<string, Array<{ channel: string, external_id: any, channel_instance_id: any }>>>}
   */
  async resolveStockChannelRowsForIds(req, ids) {
    const db = Database.get(req);
    const idList = [
      ...new Set((ids || []).map((id) => String(id ?? '').trim()).filter(Boolean)),
    ];
    if (!idList.length) return new Map();

    const mapRowsRaw = await db.query(
      `SELECT product_id::text AS product_id, channel, enabled, external_id, channel_instance_id
       FROM channel_product_map
       WHERE product_id::text = ANY($1::text[])
         AND (enabled = TRUE OR external_id IS NOT NULL)`,
      [idList],
    );
    const overrideRowsRaw = await db.query(
      `SELECT o.product_id::text AS product_id, o.channel, o.active AS enabled, m.external_id, o.channel_instance_id
       FROM channel_product_overrides o
       INNER JOIN channel_product_map m
         ON m.product_id::text = o.product_id::text
         AND m.channel = o.channel
         AND (m.channel_instance_id IS NOT DISTINCT FROM o.channel_instance_id)
       WHERE o.product_id::text = ANY($1::text[])
         AND o.active = TRUE
         AND o.channel_instance_id IS NOT NULL
         AND m.external_id IS NOT NULL`,
      [idList],
    );

    function slim(r) {
      return {
        channel: r.channel,
        enabled: r.enabled,
        external_id: r.external_id,
        channel_instance_id: r.channel_instance_id,
      };
    }

    const mapByPid = new Map();
    for (const r of mapRowsRaw) {
      const pid = String(r.product_id);
      if (!mapByPid.has(pid)) mapByPid.set(pid, []);
      mapByPid.get(pid).push(slim(r));
    }
    const overrideByPid = new Map();
    for (const r of overrideRowsRaw) {
      const pid = String(r.product_id);
      if (!overrideByPid.has(pid)) overrideByPid.set(pid, []);
      overrideByPid.get(pid).push(slim(r));
    }

    const result = new Map();
    for (const pid of idList) {
      result.set(pid, mergeStockChannelRows(mapByPid.get(pid) || [], overrideByPid.get(pid) || []));
    }
    return result;
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
    {
      productId,
      channel,
      instance,
      active,
      priceAmount,
      currency,
      vatRate,
      category,
      saleAmount,
      originalPriceAmount,
    },
  ) {
    const { Database } = require('@homebase/core');
    const db = Database.get(req);
    const tenantId = req.session?.tenantId;
    if (!tenantId) return;

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
      INSERT INTO channel_instances (channel, instance_key, market, label, credentials, enabled, created_at, updated_at)
      VALUES ($1, $2, $3, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (channel, instance_key) DO UPDATE SET
        market = COALESCE(channel_instances.market, EXCLUDED.market),
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
      `,
      [channelKey, instanceKey, inferredMarket],
    );
    const channelInstanceId = instRows?.[0]?.id;

    const salePrice =
      saleAmount != null && Number.isFinite(Number(saleAmount)) && Number(saleAmount) > 0
        ? Number(saleAmount)
        : null;
    const originalPrice =
      originalPriceAmount != null &&
      Number.isFinite(Number(originalPriceAmount)) &&
      Number(originalPriceAmount) > 0
        ? Number(originalPriceAmount)
        : null;

    const sql = `
      INSERT INTO channel_product_overrides
        (product_id, channel, instance, channel_instance_id, active, price_amount, currency, vat_rate, category, sale_price, original_price, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (product_id, channel, instance) DO UPDATE SET
        channel_instance_id = COALESCE(EXCLUDED.channel_instance_id, channel_product_overrides.channel_instance_id),
        active = EXCLUDED.active,
        price_amount = EXCLUDED.price_amount,
        currency = EXCLUDED.currency,
        vat_rate = EXCLUDED.vat_rate,
        category = CASE WHEN $12 = true THEN EXCLUDED.category ELSE channel_product_overrides.category END,
        sale_price = COALESCE(EXCLUDED.sale_price, channel_product_overrides.sale_price),
        original_price = COALESCE(EXCLUDED.original_price, channel_product_overrides.original_price),
        updated_at = CURRENT_TIMESTAMP
    `;

    await db.query(sql, [
      String(productId),
      channelKey,
      instanceKey,
      channelInstanceId || null,
      !!active,
      priceAmount != null && Number.isFinite(Number(priceAmount)) ? Number(priceAmount) : null,
      currency ? String(currency) : null,
      vatRate != null && Number.isFinite(Number(vatRate)) ? Number(vatRate) : null,
      category != null && String(category).trim() ? String(category).trim() : null,
      salePrice,
      originalPrice,
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
      const ALLOWED_LIMITS = new Set([25, 50, 100, 150, 200, 250]);
      const limitRaw = req.query?.limit != null ? Number(req.query.limit) : 100;
      const limit = ALLOWED_LIMITS.has(limitRaw) ? limitRaw : 100;
      const offset = req.query?.offset != null ? Math.max(0, Number(req.query.offset)) : 0;
      const sort = req.query?.sort ? String(req.query.sort) : 'id';
      const order = req.query?.order ? String(req.query.order) : 'asc';
      const q =
        req.query?.q != null && String(req.query.q).trim() !== '' ? String(req.query.q) : null;
      const list =
        req.query?.list != null && String(req.query.list).trim() !== ''
          ? String(req.query.list).trim()
          : 'all';

      const { items, total } = await this.model.list(req, {
        limit,
        offset: Number.isFinite(offset) ? offset : 0,
        sort,
        order,
        q,
        list,
      });
      return res.json({ items, total });
    } catch (error) {
      Logger.error('Get products error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({ error: 'Failed to fetch products' });
    }
  }

  async getCount(req, res) {
    try {
      const count = await this.model.countForUser(req);
      return res.json({ count });
    } catch (error) {
      Logger.error('Get product count error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      return res.status(500).json({ error: 'Failed to count products' });
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

  // ---- Batch sync job (async) ----
  // PATCH /api/products/batch — body { ids, updates } eller { ids, changes }
  async batchUpdate(req, res) {
    return this.startBatchSyncJob(req, res);
  }

  async startBatchSyncJob(req, res) {
    try {
      const tenantId = req.session?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant not resolved', code: 'UNAUTHORIZED' });
      }

      const idsRaw = req.body?.ids;
      const changes = req.body?.changes ?? req.body?.updates ?? {};
      if (!Array.isArray(idsRaw)) {
        return res
          .status(400)
          .json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const ids = Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)));
      if (!ids.length) {
        return res.status(202).json({ ok: true, jobId: null, accepted: true, message: 'noop' });
      }
      if (ids.length > PRODUCTS_BATCH_MAX_IDS) {
        return res.status(400).json({
          error: `Too many ids (max ${PRODUCTS_BATCH_MAX_IDS} per request)`,
          code: 'VALIDATION_ERROR',
        });
      }
      if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
        return res.status(400).json({
          error: 'changes (or updates) must be an object',
          code: 'VALIDATION_ERROR',
        });
      }

      const chMeta = changes.__batchChannel;
      const patchKeys = Object.keys(changes).filter((k) => k !== '__batchChannel');
      const hasChannelTargets =
        chMeta &&
        typeof chMeta === 'object' &&
        Array.isArray(chMeta.channelTargets) &&
        chMeta.channelTargets.length > 0;
      const hasChannelOverrides =
        chMeta &&
        typeof chMeta === 'object' &&
        Array.isArray(chMeta.channelOverridesToSave) &&
        chMeta.channelOverridesToSave.length > 0;
      if (patchKeys.length === 0 && !hasChannelTargets && !hasChannelOverrides) {
        return res.status(400).json({
          error: 'Inga ändringar att spara (varken produktfält eller kanaler).',
          code: 'VALIDATION_ERROR',
        });
      }

      const userId = Context.getUserId(req);
      const jobRow = await this.model.insertProductBatchSyncJob(req, {
        productIds: ids,
        changes,
        userId,
        triggerSource: 'batch',
      });
      const jobId = String(jobRow.id);

      const importQueued = productImportLock.isActive(tenantId);

      const starter = () => {
        if (!batchSyncMutex.acquire(tenantId, jobId)) {
          void this.model.deleteProductBatchSyncJob(req, jobId);
          Logger.warn('Batch job dropped: mutex race', { tenantId, jobId });
          return;
        }
        setImmediate(() => {
          runBatchSyncJob(this, req, jobId).catch((err) => {
            Logger.error('Batch sync job runner failed', err, { jobId });
            batchSyncMutex.releaseIfMatches(tenantId, jobId);
            batchSyncStarterQueue.onBatchFinished(tenantId);
          });
        });
      };

      batchSyncStarterQueue.enqueue(tenantId, starter);

      return res.status(202).json({
        ok: true,
        jobId,
        accepted: true,
        totalProducts: ids.length,
        queuedAfterImport: importQueued,
      });
    } catch (error) {
      Logger.error('Start batch sync job error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to start batch sync job' });
    }
  }

  formatBatchSyncJobRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      totalProducts: row.total_products,
      processedDb: row.processed_db,
      processedChannels: row.processed_channels,
      productIds: row.product_ids,
      changes: row.changes,
      errors: row.errors,
      createdByUserId: row.created_by_user_id,
      triggerSource: row.trigger_source,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }

  async listBatchSyncJobs(req, res) {
    try {
      const rows = await this.model.listProductBatchSyncJobs(req, 50);
      return res.json({ jobs: rows.map((r) => this.formatBatchSyncJobRow(r)) });
    } catch (error) {
      Logger.error('List batch sync jobs error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to list batch sync jobs' });
    }
  }

  async getBatchSyncJob(req, res) {
    try {
      const jobId = String(req.params?.jobId || '').trim();
      if (!jobId) {
        return res.status(400).json({ error: 'jobId required', code: 'VALIDATION_ERROR' });
      }
      const row = await this.model.getProductBatchSyncJob(req, jobId);
      if (!row) {
        return res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' });
      }
      return res.json({ job: this.formatBatchSyncJobRow(row) });
    } catch (error) {
      Logger.error('Get batch sync job error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to fetch batch sync job' });
    }
  }

  // ---- Group products (variant group) ----
  // POST /api/products/group
  // body: { productIds: string[], groupVariationType: 'color'|'size'|'model', mainProductId?: string }
  async setProductGroup(req, res) {
    try {
      const productIds = req.body?.productIds;
      const groupVariationType = req.body?.groupVariationType;
      const mainProductId = req.body?.mainProductId ?? null;
      if (!Array.isArray(productIds)) {
        return res
          .status(400)
          .json({ error: 'productIds[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }
      const result = await this.model.setProductGroup(
        req,
        productIds,
        groupVariationType,
        mainProductId,
      );
      return res.json({
        ok: true,
        updatedCount: result.updatedCount,
        mainProductId: result.mainProductId,
        groupVariationType: result.groupVariationType,
      });
    } catch (error) {
      Logger.error('Set product group error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to group products' });
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

      if (ids.length > PRODUCTS_BATCH_MAX_IDS) {
        return res.status(400).json({
          error: `Too many ids (max ${PRODUCTS_BATCH_MAX_IDS} per request)`,
          code: 'VALIDATION_ERROR',
        });
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
    let tenantIdForImportLock = null;
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

      tenantIdForImportLock = req.session?.tenantId || null;
      if (tenantIdForImportLock) {
        productImportLock.begin(tenantIdForImportLock);
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
        // Default import (issello not 1): sku, quantity, …
        //   Texter: title.se, description.se, … → textsExtended (importerat ersätter per fält/marknad vid merge).
        //   Standard för title/description + textsStandard: se om textsStandard-kolumn saknas; annars värdet där (fi kräver kompletta FI-texter).
        //   Generiska title / description används inte.
        // Sello-style row: issello=1, then standardnamesv, standarddescriptionsv, tax, manufacturerno, propertygtin/propertyean,
        // plus per-channel columns like cdonseprice####, cdonseactive####, fyndiq3price####, fyndiq3active####.
        const sku = toStrOrUndef(r.sku);
        if (!sku) {
          result.skippedMissingSku.push({ row: rowNum });
          result.rows.push({ row: rowNum, action: 'skipped', reason: 'missing_sku' });
          continue;
        }

        const isSello = isSelloImportRow(r);
        const selloVat = toFloatOrUndef(r.tax);
        const selloGtin = toStrOrUndef(r.propertygtin) || toStrOrUndef(r.propertyean);
        const selloMpn = toStrOrUndef(r.manufacturerno);

        // Base fields (Sello column names when issello=1). Non-Sello: title/description från landsspecifika kolumner nedan.
        const incoming = {
          sku,
          title: isSello
            ? toStrOrUndef(r.standardnamesv) || toStrOrUndef(r.title)
            : undefined,
          description: isSello
            ? toStrOrUndef(r.standarddescriptionsv) || toStrOrUndef(r.description)
            : undefined,
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

        if (!isSello) {
          const textsPatch = buildTextsExtendedPatchFromImportRow(r);
          const hasTextPatch = Object.keys(textsPatch).length > 0;
          if (hasTextPatch) {
            const existingTe =
              existing?.channelSpecific?.textsExtended &&
              typeof existing.channelSpecific.textsExtended === 'object'
                ? existing.channelSpecific.textsExtended
                : {};
            const mergedTe = mergeTextsExtendedForImport(existingTe, textsPatch);
            const resolved = resolveStandardMarketPrimary(mergedTe, r.textsstandard);
            if (!resolved.ok) {
              result.skippedInvalid.push({
                row: rowNum,
                sku,
                reason: resolved.code,
                market: resolved.market,
              });
              result.rows.push({
                row: rowNum,
                sku,
                action: 'skipped',
                reason: resolved.code,
                market: resolved.market,
              });
              continue;
            }
            incoming.title = resolved.title;
            incoming.description = resolved.description;
            incoming.channelSpecific = mergeChannelSpecificForImport(
              existing?.channelSpecific ?? null,
              mergedTe,
              { textsStandard: resolved.standardMk },
            );
          } else {
            incoming.title = undefined;
            incoming.description = undefined;
          }
        }

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
            const reason = isSello ? 'missing_title' : 'missing_market_texts';
            result.skippedInvalid.push({ row: rowNum, sku, reason });
            result.rows.push({ row: rowNum, sku, action: 'skipped', reason });
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
            ...(incoming.channelSpecific ? { channelSpecific: incoming.channelSpecific } : {}),
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
            const reason = isSello ? 'missing_title' : 'missing_market_texts';
            result.skippedInvalid.push({ row: rowNum, sku, reason });
            result.rows.push({ row: rowNum, sku, action: 'skipped', reason });
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
            ...(incoming.channelSpecific ? { channelSpecific: incoming.channelSpecific } : {}),
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
    } finally {
      if (tenantIdForImportLock) {
        productImportLock.end(tenantIdForImportLock);
      }
    }
  }

  /**
   * Build image URLs from Sello API response. Sello may return images as:
   * - array of { url_large, url_small } (GET product list/single)
   * - array of plain URL strings
   * - or other shapes; we accept url_large, url_small, url, image.
   * Used at import so we store public Sello URLs; CDON/Fyndiq/WooCommerce can fetch them when we export.
   * TODO: When done with Sello phase, switch to proper storage (download to server or cloud).
   */
  getSelloImageUrls(images) {
    const imageItems = Array.isArray(images) ? images : [];
    const urls = [];
    for (let i = 0; i < imageItems.length; i += 1) {
      const item = imageItems[i];
      let u = '';
      if (typeof item === 'string') {
        u = item.trim();
      } else if (item && typeof item === 'object') {
        u = String(item.url_large ?? item.url_small ?? item.url ?? item.image ?? '').trim();
      }
      if (u && (u.startsWith('http://') || u.startsWith('https://'))) urls.push(u);
    }
    return { urls, downloaded: urls.length, failed: 0 };
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
      const tenantId = req.session?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

      const channelInstances = await db.query(
        `
        SELECT id, channel, instance_key, market, sello_integration_id, enabled
        FROM channel_instances
        WHERE sello_integration_id IS NOT NULL
          AND TRIM(sello_integration_id) <> ''
        `,
        [],
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
              const productCount = Array.isArray(g.products) ? g.products.length : 0;
              groupsByGroupId.set(String(gid), {
                mainProduct: g.main_product,
                type:
                  g.type && ['color', 'size', 'model'].includes(String(g.type).toLowerCase())
                    ? String(g.type).toLowerCase()
                    : null,
                productCount,
              });
            }
          }
        } catch {
          groupsByGroupId = new Map();
        }
        const groupsMap = groupsByGroupId;
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
          const imageResult = this.getSelloImageUrls(raw?.images);
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
          const groupIdRaw = raw?.group_id != null ? String(raw.group_id) : null;
          const groupInfo = groupIdRaw && groupsMap ? groupsMap.get(groupIdRaw) : null;
          const isMultiProductGroup = groupInfo && (groupInfo.productCount ?? 0) > 1;
          if (
            isMultiProductGroup &&
            groupInfo?.type &&
            ['color', 'size', 'model'].includes(String(groupInfo.type).toLowerCase())
          ) {
            const vp = [String(groupInfo.type).toLowerCase()];
            importedChannelSpecific.cdon.variational_properties = vp;
            importedChannelSpecific.fyndiq.variational_properties = vp;
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
            groupId: isMultiProductGroup && raw?.group_id != null ? String(raw.group_id) : null,
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
          if (createdProductId && groupIdRaw) {
            selloIdToHomebaseId.set(sku, { groupId: groupIdRaw, isMultiProductGroup });
          }
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
              const channelsDone = new Set();
              for (const inst of targetInstances) {
                const perInstancePrice = getSelloStorePriceForInstance(
                  raw,
                  integrationId,
                  inst.market,
                );
                const saleAmount =
                  inst.channel === 'woocommerce'
                    ? getSelloCampaignPriceForInstance(raw, integrationId, inst.market)
                    : null;
                const originalPriceAmount =
                  inst.channel === 'fyndiq'
                    ? getSelloRegularPriceForInstance(raw, integrationId, inst.market)
                    : null;
                let overrideCategory;
                if (inst.channel === 'woocommerce') {
                  overrideCategory = catIds.length ? JSON.stringify(catIds) : null;
                }
                // CDON/Fyndiq: category lives in channelSpecific only, not in overrides.
                await this.upsertChannelOverride(req, {
                  productId: createdProductId,
                  channel: inst.channel,
                  instance: inst.instanceKey,
                  active,
                  priceAmount: perInstancePrice,
                  currency,
                  vatRate: raw?.tax,
                  category: overrideCategory,
                  saleAmount,
                  originalPriceAmount,
                });
                summary.overrides_updated += 1;
                let externalId = String(state?.item_id ?? '').trim();
                if (!externalId && inst.channel === 'woocommerce' && active) {
                  const resolved = await this.resolveWooExternalIdForSelloImport(
                    req,
                    createdProductId,
                    inst.id,
                  );
                  if (resolved) externalId = resolved;
                }
                if (inst.channel === 'cdon' || inst.channel === 'fyndiq') {
                  const itemId = String(state?.item_id ?? '').trim();
                  if (!itemId || channelsDone.has(inst.channel)) continue;
                  channelsDone.add(inst.channel);
                  if (inst.channel === 'cdon') {
                    await this.upsertChannelProductMap(req, {
                      productId: createdProductId,
                      channel: 'cdon',
                      channelInstanceId: null,
                      enabled: active,
                      externalId: sku,
                      cdonArticleId: itemId,
                      status: 'synced',
                      reason: null,
                    });
                  } else {
                    await this.upsertChannelProductMap(req, {
                      productId: createdProductId,
                      channel: 'fyndiq',
                      channelInstanceId: null,
                      enabled: active,
                      externalId: itemId,
                      status: 'synced',
                      reason: null,
                    });
                  }
                } else if (externalId) {
                  await this.upsertChannelProductMap(req, {
                    productId: createdProductId,
                    channel: inst.channel,
                    channelInstanceId: inst.id,
                    enabled: active,
                    externalId,
                    status: 'synced',
                    reason: null,
                  });
                }
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
        for (const [selloId, { groupId, isMultiProductGroup: multi }] of selloIdToHomebaseId) {
          if (!groupId) continue;
          const groupInfo = groupsByGroupId.get(groupId);
          if (!groupInfo) continue;
          const parentProductId = multi
            ? selloId === String(groupInfo.mainProduct ?? '')
              ? null
              : String(groupInfo.mainProduct ?? '')
            : null;
          const groupVariationType = multi ? groupInfo.type : null;
          await this.model.updateProductGroupRelation(req, selloId, {
            parentProductId,
            groupVariationType,
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

        const pageGroups = Array.isArray(page?.groups) ? page.groups : [];
        const pageGroupsByGroupId = new Map();
        for (const g of pageGroups) {
          const gid = g.id ?? g.group_id;
          if (gid != null) {
            const productCount = Array.isArray(g.products) ? g.products.length : 0;
            pageGroupsByGroupId.set(String(gid), {
              mainProduct: g.main_product,
              type:
                g.type && ['color', 'size', 'model'].includes(String(g.type).toLowerCase())
                  ? String(g.type).toLowerCase()
                  : null,
              productCount,
            });
          }
        }

        const groupsMap = pageGroupsByGroupId;
        const pageProductIdToGroupId = new Map();
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

          const imageResult = this.getSelloImageUrls(raw?.images);
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
          const groupIdRaw = raw?.group_id != null ? String(raw.group_id) : null;
          const groupInfo = groupIdRaw && groupsMap ? groupsMap.get(groupIdRaw) : null;
          const isMultiProductGroup = groupInfo && (groupInfo.productCount ?? 0) > 1;
          if (
            isMultiProductGroup &&
            groupInfo?.type &&
            ['color', 'size', 'model'].includes(String(groupInfo.type).toLowerCase())
          ) {
            const vp = [String(groupInfo.type).toLowerCase()];
            importedChannelSpecific.cdon.variational_properties = vp;
            importedChannelSpecific.fyndiq.variational_properties = vp;
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
            groupId: isMultiProductGroup && raw?.group_id != null ? String(raw.group_id) : null,
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
          if (productId && groupIdRaw && groupInfo) {
            pageProductIdToGroupId.set(productId, {
              groupId: groupIdRaw,
              isMultiProductGroup,
            });
          }
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
                const saleAmount =
                  inst.channel === 'woocommerce'
                    ? getSelloCampaignPriceForInstance(raw, integrationId, inst.market)
                    : null;
                const originalPriceAmount =
                  inst.channel === 'fyndiq'
                    ? getSelloRegularPriceForInstance(raw, integrationId, inst.market)
                    : null;
                let overrideCategory;
                if (inst.channel === 'woocommerce') {
                  if (categoryIds.length) overrideCategory = JSON.stringify(categoryIds);
                  else overrideCategory = null;
                }
                // CDON/Fyndiq: category lives in channelSpecific only, not in overrides.
                await this.upsertChannelOverride(req, {
                  productId,
                  channel: inst.channel,
                  instance: inst.instanceKey,
                  active,
                  priceAmount: perInstancePrice,
                  currency,
                  vatRate: raw?.tax,
                  category: overrideCategory,
                  saleAmount,
                  originalPriceAmount,
                });
                summary.overrides_updated += 1;
                let externalId = String(state?.item_id ?? '').trim();
                if (!externalId && inst.channel === 'woocommerce' && active) {
                  const resolved = await this.resolveWooExternalIdForSelloImport(
                    req,
                    productId,
                    inst.id,
                  );
                  if (resolved) externalId = resolved;
                }
                if (externalId) {
                  await this.upsertChannelProductMap(req, {
                    productId,
                    channel: inst.channel,
                    channelInstanceId: inst.id,
                    enabled: active,
                    externalId,
                    status: 'synced',
                    reason: null,
                  });
                }
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
        for (const [productId, { groupId, isMultiProductGroup: multi }] of pageProductIdToGroupId) {
          const groupInfo = groupsMap.get(groupId);
          if (!groupInfo) continue;
          const parentProductId = multi
            ? productId === String(groupInfo.mainProduct ?? '')
              ? null
              : String(groupInfo.mainProduct ?? '')
            : null;
          const groupVariationType = multi ? groupInfo.type : null;
          await this.model.updateProductGroupRelation(req, productId, {
            parentProductId,
            groupVariationType,
          });
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
    { productId, channel, channelInstanceId, enabled, externalId, cdonArticleId, status, reason },
  ) {
    const db = Database.get(req);
    const userId = Context.getUserId(req);
    if (!userId) return;

    const instId =
      channelInstanceId != null && channelInstanceId !== '' ? Number(channelInstanceId) : null;

    await db.query(
      `
      INSERT INTO channel_product_map
        (product_id, channel, channel_instance_id, enabled, external_id, cdon_article_id, last_synced_at, last_sync_status, last_error, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (product_id, channel, channel_instance_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        external_id = EXCLUDED.external_id,
        cdon_article_id = EXCLUDED.cdon_article_id,
        last_synced_at = CURRENT_TIMESTAMP,
        last_sync_status = EXCLUDED.last_sync_status,
        last_error = EXCLUDED.last_error,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        String(productId),
        String(channel),
        instId,
        !!enabled,
        externalId != null ? String(externalId) : null,
        cdonArticleId != null ? String(cdonArticleId) : null,
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
      const tenantId = req.session?.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });
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
        WHERE TRUE
        `,
        [],
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

      const selloProductIds = Array.isArray(req.body?.selloProductIds)
        ? [...new Set(req.body.selloProductIds.map((x) => String(x).trim()).filter(Boolean))]
        : null;

      const fetchProducts = async () => {
        if (selloProductIds && selloProductIds.length > 0) {
          const listPath = `/v5/products?size=100&${selloProductIds
            .map((id) => `filter[id][]=${encodeURIComponent(id)}`)
            .join('&')}`;
          const listRes = await this.selloModel.fetchSelloJson({ apiKey, path: listPath });
          return {
            products: Array.isArray(listRes?.products) ? listRes.products : [],
            total: null,
          };
        }
        const page = await this.selloModel.fetchSelloJson({
          apiKey,
          path: '/v5/products',
          query: { size: SELLO_PAGE_SIZE, offset },
        });
        const pageTotal =
          total == null && Number.isFinite(Number(page?.duration?.total_count))
            ? Number(page.duration.total_count)
            : null;
        if (pageTotal != null) total = pageTotal;
        return {
          products: Array.isArray(page?.products) ? page.products : [],
          total: pageTotal,
        };
      };

      while (true) {
        if (maxPages != null && pagesFetched >= maxPages) break;
        if (maxProducts != null && productsProcessed >= maxProducts) break;
        const { products } = await fetchProducts();
        pagesFetched += 1;
        if (!products.length) break;

        const selloIdList = products.map((p) => String(p?.id ?? '').trim()).filter(Boolean);
        const homebaseRows = selloIdList.length
          ? await db.query(
              `SELECT id::text AS id, sku FROM products
               WHERE sku = ANY($1::text[]) OR id::text = ANY($1::text[])`,
              [selloIdList],
            )
          : [];
        const productIdBySelloId = new Map();
        const productSkuByProductId = new Map();
        for (const r of homebaseRows) {
          productIdBySelloId.set(String(r.id), String(r.id));
          if (r.sku) productIdBySelloId.set(String(r.sku), String(r.id));
          productSkuByProductId.set(String(r.id), r.sku || null);
        }

        for (const raw of products) {
          if (maxProducts != null && productsProcessed >= maxProducts) break;
          productsProcessed += 1;
          const selloId = String(raw?.id ?? '').trim();
          if (!selloId) continue;
          const productId = productIdBySelloId.get(selloId);
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
                sku: selloId,
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
                sku: selloId,
                channel: null,
                instanceKey: null,
                reason: `missing_sello_integration_map:${integrationId}`,
                classification: 'expected_skip',
              });
              continue;
            }
            const itemId = String(state.item_id ?? '').trim();
            const hasItemId = !!itemId;

            if (active && !hasItemId) {
              summary.validation_error += targetInstances.length;
              for (const inst of targetInstances) {
                summary.deviations.push({
                  productId,
                  sku: selloId,
                  channel: inst.channel,
                  instanceKey: inst.instanceKey,
                  reason: 'active_without_item_id',
                });
              }
              continue;
            }

            const cdonInsts = targetInstances.filter((i) => i.channel === 'cdon');
            const fyndiqInsts = targetInstances.filter((i) => i.channel === 'fyndiq');
            const wooInsts = targetInstances.filter((i) => i.channel === 'woocommerce');
            const productSku = productSkuByProductId.get(productId) || selloId;

            if (cdonInsts.length && hasItemId) {
              await this.upsertChannelProductMap(req, {
                productId,
                channel: 'cdon',
                channelInstanceId: null,
                enabled: active,
                externalId: productSku,
                cdonArticleId: itemId,
                status: 'synced',
                reason: null,
              });
              summary.updated += 1;
            }
            if (fyndiqInsts.length && hasItemId) {
              await this.upsertChannelProductMap(req, {
                productId,
                channel: 'fyndiq',
                channelInstanceId: null,
                enabled: active,
                externalId: itemId,
                status: 'synced',
                reason: null,
              });
              summary.updated += 1;
            }
            for (const inst of wooInsts) {
              await this.upsertChannelProductMap(req, {
                productId,
                channel: inst.channel,
                channelInstanceId: inst.id,
                enabled: active && hasItemId,
                externalId: hasItemId ? itemId : null,
                status: 'synced',
                reason: null,
              });
              summary.updated += 1;
            }
          }
        }

        offset += products.length;
        if (selloProductIds && selloProductIds.length > 0) break;
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
   * on-demand fetch and cache on miss (tenant-scoped singleton row). Woo: no on-demand.
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
        'SELECT payload, fetched_at FROM category_cache WHERE cache_key = $1',
        [key],
      );
      row = (Array.isArray(r) ? r[0] : r?.rows?.[0]) ?? null;
    } else {
      const r = await db.query(
        'SELECT payload, fetched_at FROM category_cache WHERE cache_key = $1',
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
                'SELECT api_key, api_secret FROM cdon_settings LIMIT 1',
                [],
              );
              const c = credsRows?.[0];
              const cdonApiKey = c?.api_key ? CredentialsCrypto.decrypt(c.api_key) : '';
              const cdonApiSecret = c?.api_secret ? CredentialsCrypto.decrypt(c.api_secret) : '';
              if (!cdonApiKey || !cdonApiSecret) {
                return res.status(502).json({
                  error: 'CDON credentials missing',
                  detail: 'Configure CDON in settings',
                });
              }
              items = await fetchCdonCategories(market, lang, cdonApiKey, cdonApiSecret);
            } else {
              const credsRows = await db.query(
                'SELECT api_key, api_secret FROM fyndiq_settings LIMIT 1',
                [],
              );
              const c = credsRows?.[0];
              const fyndiqApiKey = c?.api_key ? CredentialsCrypto.decrypt(c.api_key) : '';
              const fyndiqApiSecret = c?.api_secret ? CredentialsCrypto.decrypt(c.api_secret) : '';
              if (!fyndiqApiKey || !fyndiqApiSecret) {
                return res.status(502).json({
                  error: 'Fyndiq credentials missing',
                  detail: 'Configure Fyndiq in settings',
                });
              }
              const marketLower = market.toLowerCase();
              items = await fetchFyndiqCategories(marketLower, lang, fyndiqApiKey, fyndiqApiSecret);
            }
            const payload = Array.isArray(items) ? items : [];
            const fetchedAt = new Date();
            const up = await db.query(
              'UPDATE category_cache SET payload = $2, fetched_at = $3 WHERE cache_key = $1',
              [key, JSON.stringify(payload), fetchedAt],
            );
            if (!up.rowCount || up.rowCount === 0) {
              await db.query(
                'INSERT INTO category_cache (cache_key, payload, fetched_at) VALUES ($1, $2::jsonb, $3)',
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
