// plugins/cdon-products/mapToCdonArticle.js
// Builds a CDON Merchants API v2 article payload (for bulk create/update) from product + overrides + default language.
// Uses only fields and shapes from docs/CDON_API_DOCUMENTATION.md. No guessing.

const DEFAULT_CURRENCY_BY_MARKET = { SE: 'SEK', DK: 'DKK', FI: 'EUR', NO: 'NOK' };

const MARKET_TO_LANG = { SE: 'sv-SE', DK: 'da-DK', FI: 'fi-FI', NO: 'nb-NO' };

const SKU_MIN = 1;
const SKU_MAX = 64;

function isValidUrl(s) {
  if (typeof s !== 'string' || !s.trim()) return false;
  const t = s.trim();
  return (t.startsWith('http://') || t.startsWith('https://')) && t.length > 8;
}

function normalizeCategory(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s === '0') return null;
  return s;
}

/**
 * Build one CDON article payload for POST/PUT v2/articles/bulk.
 * @param {Object} product - Base product: id, sku, mpn, title, description, status, quantity, priceAmount, currency, vatRate, mainImage, images, categories, brand, gtin, channelSpecific?.cdon
 * @param {Object} overridesByMarket - Per-market overrides: { se?: { priceAmount, currency, vatRate, category }, ... } (keys lower case)
 * @param {string} defaultLanguage - Default language e.g. 'sv-SE'
 * @param {string[]} marketsFilter - e.g. ['se','dk','fi']
 * @returns {Object|null} CDON article object or null if required fields missing
 */
function mapProductToCdonArticle(
  product,
  overridesByMarket,
  defaultLanguage,
  marketsFilter = ['se', 'dk', 'fi'],
) {
  const sku = product?.id != null ? String(product.id).trim() : '';
  const title = product?.title != null ? String(product.title).trim() : '';
  const mainImage = product?.mainImage != null ? String(product.mainImage).trim() : '';
  const quantity =
    product?.quantity != null && Number.isFinite(Number(product.quantity))
      ? Math.max(0, Math.floor(Number(product.quantity)))
      : null;
  const status = product?.status === 'paused' ? 'paused' : 'for sale';

  if (!sku || sku.length < SKU_MIN || sku.length > SKU_MAX) return null;
  if (!title || !mainImage) return null;
  if (!isValidUrl(mainImage)) return null;
  if (quantity == null || quantity < 0) return null;

  const cdon =
    product?.channelSpecific?.cdon && typeof product.channelSpecific.cdon === 'object'
      ? product.channelSpecific.cdon
      : {};
  const markets = (marketsFilter || ['se', 'dk', 'fi']).map((m) => String(m).toUpperCase());

  // Title: per-language from cdon.title, textsExtended, or single default from product
  const textsExtended = product?.channelSpecific?.textsExtended;
  const standardMarket = ['se', 'dk', 'fi', 'no'].includes(
    String(product?.channelSpecific?.textsStandard || '').toLowerCase(),
  )
    ? String(product.channelSpecific.textsStandard).toLowerCase()
    : 'se';
  const standardText = textsExtended?.[standardMarket];
  let titleArr = cdon.title && Array.isArray(cdon.title) ? cdon.title : null;
  if (!titleArr || titleArr.length === 0) {
    if (textsExtended && typeof textsExtended === 'object') {
      const arr = [];
      const seen = new Set();
      for (const m of markets) {
        const mk = m.toLowerCase();
        const lang = MARKET_TO_LANG[m] || defaultLanguage || 'sv-SE';
        if (seen.has(lang)) continue;
        const t = textsExtended[mk];
        // No fallback to product.title when both market and standard are empty (per user rule)
        const value = (t?.name || standardText?.name || '').slice(0, 150);
        if (value.length >= 5) {
          seen.add(lang);
          arr.push({ language: lang, value });
        }
      }
      if (arr.length > 0) titleArr = arr;
    }
    if (!titleArr || titleArr.length === 0) {
      const lang = defaultLanguage || 'sv-SE';
      const value = (title || '').slice(0, 150);
      if (value.length >= 5) titleArr = [{ language: lang, value }];
    }
  }
  if (!titleArr || titleArr.length === 0) return null;

  // Description (CDON 10–4096 chars; no padding/guessing)
  let descriptionArr =
    cdon.description && Array.isArray(cdon.description) ? cdon.description : null;
  if (!descriptionArr || descriptionArr.length === 0) {
    const baseDesc = product?.description != null ? String(product.description) : '';
    if (textsExtended && typeof textsExtended === 'object') {
      const arr = [];
      const seen = new Set();
      for (const m of markets) {
        const mk = m.toLowerCase();
        const lang = MARKET_TO_LANG[m] || defaultLanguage || 'sv-SE';
        if (seen.has(lang)) continue;
        const t = textsExtended[mk];
        // No fallback to product.description when both market and standard are empty (per user rule)
        const value = (t?.description || standardText?.description || '').slice(0, 4096);
        if (value.length >= 10) {
          seen.add(lang);
          arr.push({ language: lang, value });
        }
      }
      if (arr.length > 0) descriptionArr = arr;
    }
    if (!descriptionArr || descriptionArr.length === 0) {
      const lang = defaultLanguage || 'sv-SE';
      const value = baseDesc.slice(0, 4096);
      if (value.length >= 10) descriptionArr = [{ language: lang, value }];
      else return null;
    }
  }
  if (!descriptionArr || descriptionArr.length === 0) return null;

  // Price per market (required). CDON: amount_including_vat, currency, vat_rate (optional)
  const basePrice =
    product?.priceAmount != null && Number.isFinite(Number(product.priceAmount))
      ? Number(product.priceAmount)
      : null;
  const baseCurrency = (product?.currency || 'SEK').toString().toUpperCase();
  const baseVat =
    product?.vatRate != null && Number.isFinite(Number(product.vatRate))
      ? Number(product.vatRate)
      : null;
  const price = [];
  for (const m of markets) {
    const mk = m.toLowerCase();
    const ov = overridesByMarket && overridesByMarket[mk];
    const amount =
      ov?.priceAmount != null && Number.isFinite(Number(ov.priceAmount))
        ? Number(ov.priceAmount)
        : basePrice;
    const currency = (ov?.currency || baseCurrency || DEFAULT_CURRENCY_BY_MARKET[m] || 'SEK')
      .toString()
      .toUpperCase();
    const vatRate = ov?.vatRate != null ? Number(ov.vatRate) : baseVat;
    if (amount != null && amount > 0) {
      const value = { amount_including_vat: amount, currency };
      if (vatRate != null && Number.isFinite(vatRate)) value.vat_rate = vatRate;
      price.push({ market: m, value });
    }
  }
  if (price.length === 0) return null;

  // Shipping time per market (required)
  const shippingTimeFromCdon =
    cdon.shipping_time && Array.isArray(cdon.shipping_time) ? cdon.shipping_time : [];
  const shippingTimeMap = new Map(
    shippingTimeFromCdon.map((s) => [String(s.market).toUpperCase(), s]),
  );
  const shipping_time = [];
  for (const m of markets) {
    const existing = shippingTimeMap.get(m);
    const min =
      existing?.min != null ? Math.max(1, Math.min(10, Math.floor(Number(existing.min)))) : 1;
    const max =
      existing?.max != null ? Math.max(1, Math.min(10, Math.floor(Number(existing.max)))) : 3;
    shipping_time.push({ market: m, min, max });
  }

  const payload = {
    sku,
    status,
    quantity,
    main_image: mainImage,
    markets,
    title: titleArr,
    description: descriptionArr,
    price,
    shipping_time,
  };

  // Category: explicit from active market overrides only (no fallback).
  const activeCategories = [];
  const seenCats = new Set();
  for (const m of markets) {
    const mk = m.toLowerCase();
    const ov = overridesByMarket && overridesByMarket[mk];
    if (!ov || ov.active !== true) continue;
    const cat = normalizeCategory(ov.category);
    if (!cat) continue;
    if (seenCats.has(cat)) continue;
    seenCats.add(cat);
    activeCategories.push(cat);
  }
  if (activeCategories.length === 0) return null;
  if (activeCategories.length !== 1) return null;
  payload.category = activeCategories[0];

  if (product?.parentProductId != null && String(product.parentProductId).trim())
    payload.parent_sku = String(product.parentProductId).trim();
  if (product?.brand != null && String(product.brand).trim())
    payload.brand = String(product.brand).trim();
  if (product?.gtin != null && String(product.gtin).trim())
    payload.gtin = String(product.gtin).trim();
  if (product?.mpn != null && String(product.mpn).trim()) payload.mpn = String(product.mpn).trim();
  if (Array.isArray(product?.images) && product.images.length) {
    const trimmed = product.images.filter(Boolean).map((u) => String(u).trim());
    const invalid = trimmed.find((u) => !isValidUrl(u));
    if (invalid !== undefined) return null;
    payload.images = trimmed;
  }
  if (cdon.unique_selling_points && Array.isArray(cdon.unique_selling_points))
    payload.unique_selling_points = cdon.unique_selling_points;
  if (cdon.specifications && Array.isArray(cdon.specifications))
    payload.specifications = cdon.specifications;
  if (cdon.classifications && Array.isArray(cdon.classifications))
    payload.classifications = cdon.classifications;
  if (cdon.delivery_type && Array.isArray(cdon.delivery_type))
    payload.delivery_type = cdon.delivery_type;
  if (cdon.kn_number != null && String(cdon.kn_number).trim())
    payload.kn_number = String(cdon.kn_number).trim();
  if (cdon.shipped_from != null && String(cdon.shipped_from).trim())
    payload.shipped_from = String(cdon.shipped_from).trim();
  if (cdon.manufacturer != null && String(cdon.manufacturer).trim())
    payload.manufacturer = String(cdon.manufacturer).trim();
  if (cdon.availability_dates && Array.isArray(cdon.availability_dates))
    payload.availability_dates = cdon.availability_dates;
  if (cdon.properties && Array.isArray(cdon.properties)) payload.properties = cdon.properties;
  if (cdon.variational_properties && Array.isArray(cdon.variational_properties))
    payload.variational_properties = cdon.variational_properties;

  return payload;
}

function getCdonArticleInputIssues(
  product,
  overridesByMarket,
  defaultLanguage,
  marketsFilter = ['se', 'dk', 'fi'],
) {
  const issues = [];
  const sku = product?.id != null ? String(product.id).trim() : '';
  const title = product?.title != null ? String(product.title).trim() : '';
  const mainImage = product?.mainImage != null ? String(product.mainImage).trim() : '';
  const quantity =
    product?.quantity != null && Number.isFinite(Number(product.quantity))
      ? Math.max(0, Math.floor(Number(product.quantity)))
      : null;
  if (!sku) issues.push('missing_sku');
  else if (sku.length < SKU_MIN || sku.length > SKU_MAX) issues.push('invalid_sku_length');
  if (!title) issues.push('missing_title');
  if (!mainImage) issues.push('missing_main_image');
  else if (!isValidUrl(mainImage)) issues.push('invalid_main_image_url');
  if (quantity == null || quantity < 0) issues.push('invalid_quantity');

  const cdon =
    product?.channelSpecific?.cdon && typeof product.channelSpecific.cdon === 'object'
      ? product.channelSpecific.cdon
      : {};
  const titleArr = cdon.title && Array.isArray(cdon.title) ? cdon.title : null;
  if ((!titleArr || titleArr.length === 0) && title && title.length < 5) {
    issues.push('invalid_title_length');
  }

  const descriptionArr =
    cdon.description && Array.isArray(cdon.description) ? cdon.description : null;
  const rawDescription = product?.description != null ? String(product.description) : '';
  if (
    (!descriptionArr || descriptionArr.length === 0) &&
    rawDescription.slice(0, 4096).length < 10
  ) {
    issues.push('missing_or_short_description');
  }

  const markets = (marketsFilter || ['se', 'dk', 'fi']).map((m) => String(m).toUpperCase());
  const basePrice =
    product?.priceAmount != null && Number.isFinite(Number(product.priceAmount))
      ? Number(product.priceAmount)
      : null;
  const hasPositiveMarketPrice = markets.some((m) => {
    const mk = m.toLowerCase();
    const ov = overridesByMarket && overridesByMarket[mk];
    const amount =
      ov?.priceAmount != null && Number.isFinite(Number(ov.priceAmount))
        ? Number(ov.priceAmount)
        : basePrice;
    return Number.isFinite(amount) && amount > 0;
  });
  if (!hasPositiveMarketPrice) issues.push('missing_positive_price');

  const images = Array.isArray(product?.images) ? product.images : [];
  const invalidImage = images.find(
    (u) => u != null && String(u).trim() && !isValidUrl(String(u).trim()),
  );
  if (invalidImage) issues.push('invalid_images_url');

  const activeCategories = [];
  const seenCats = new Set();
  for (const m of markets) {
    const mk = m.toLowerCase();
    const ov = overridesByMarket && overridesByMarket[mk];
    if (!ov || ov.active !== true) continue;
    const cat = normalizeCategory(ov.category);
    if (!cat) continue;
    if (seenCats.has(cat)) continue;
    seenCats.add(cat);
    activeCategories.push(cat);
  }
  if (activeCategories.length === 0) issues.push('missing_category');
  if (activeCategories.length > 1) issues.push('conflicting_active_market_categories');

  return issues;
}

function validateCdonArticlePayload(article) {
  if (!article || typeof article !== 'object' || Array.isArray(article)) {
    return { ok: false, reason: 'invalid_article_object' };
  }
  const sku = String(article.sku || '').trim();
  if (!sku) return { ok: false, reason: 'missing_sku' };
  if (sku.length < SKU_MIN || sku.length > SKU_MAX)
    return { ok: false, reason: 'invalid_sku_length' };
  const status = String(article.status || '')
    .trim()
    .toLowerCase();
  if (!['for sale', 'paused'].includes(status)) return { ok: false, reason: 'invalid_status' };
  const quantity = Number(article.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) return { ok: false, reason: 'invalid_quantity' };
  const mainImage = String(article.main_image || '').trim();
  if (!mainImage) return { ok: false, reason: 'missing_main_image' };
  if (!isValidUrl(mainImage)) return { ok: false, reason: 'invalid_main_image_url' };

  const markets = Array.isArray(article.markets) ? article.markets : [];
  if (!markets.length) return { ok: false, reason: 'missing_markets' };
  const VALID_MARKETS = ['SE', 'DK', 'FI', 'NO'];
  for (const m of markets) {
    const market = String(m || '')
      .trim()
      .toUpperCase();
    if (!VALID_MARKETS.includes(market)) return { ok: false, reason: 'invalid_market' };
  }

  const title = Array.isArray(article.title) ? article.title : [];
  if (!title.length) return { ok: false, reason: 'missing_title_rows' };
  for (const row of title) {
    const value = String(row?.value || '').trim();
    if (value.length < 5 || value.length > 150) return { ok: false, reason: 'invalid_title_value' };
  }

  const description = Array.isArray(article.description) ? article.description : [];
  if (!description.length) return { ok: false, reason: 'missing_description_rows' };
  for (const row of description) {
    const value = String(row?.value || '').trim();
    if (value.length < 10 || value.length > 4096)
      return { ok: false, reason: 'invalid_description_value' };
  }

  const price = Array.isArray(article.price) ? article.price : [];
  if (!price.length) return { ok: false, reason: 'missing_price_rows' };
  for (const row of price) {
    const market = String(row?.market || '')
      .trim()
      .toUpperCase();
    if (!VALID_MARKETS.includes(market)) return { ok: false, reason: 'invalid_price_market' };
    const amount = Number(row?.value?.amount_including_vat);
    if (!Number.isFinite(amount) || amount <= 0)
      return { ok: false, reason: 'invalid_amount_including_vat' };
    const currency = String(row?.value?.currency || '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, reason: 'invalid_currency' };
  }

  const shipping = Array.isArray(article.shipping_time) ? article.shipping_time : [];
  if (!shipping.length) return { ok: false, reason: 'missing_shipping_time_rows' };
  for (const row of shipping) {
    const market = String(row?.market || '')
      .trim()
      .toUpperCase();
    if (!VALID_MARKETS.includes(market))
      return { ok: false, reason: 'invalid_shipping_time_market' };
    const min = Number(row?.min);
    const max = Number(row?.max);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 10 || min > max) {
      return { ok: false, reason: 'invalid_shipping_time_range' };
    }
  }

  const category = String(article.category || '').trim();
  if (!category) return { ok: false, reason: 'missing_category' };

  const images = Array.isArray(article.images) ? article.images : [];
  const invalidImg = images.find(
    (u) => u != null && String(u).trim() && !isValidUrl(String(u).trim()),
  );
  if (invalidImg) return { ok: false, reason: 'invalid_images_url' };

  return { ok: true };
}

module.exports = { mapProductToCdonArticle, getCdonArticleInputIssues, validateCdonArticlePayload };
