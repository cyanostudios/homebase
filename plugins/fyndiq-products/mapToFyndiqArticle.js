// plugins/fyndiq-products/mapToFyndiqArticle.js
// Builds a Fyndiq Merchants API create/update article payload from product + overrides + default language.
// Uses only fields and shapes from docs/FYNDIQ_API_DOCUMENTATION.md. No guessing.

const DEFAULT_CURRENCY_BY_MARKET = { SE: 'SEK', DK: 'DKK', FI: 'EUR', NO: 'NOK' };

const MARKET_TO_LANG = { SE: 'sv-SE', DK: 'da-DK', FI: 'fi-FI', NO: 'nb-NO' };

const SKU_MIN = 1;
const SKU_MAX = 64;

function isValidUrl(s) {
  if (typeof s !== 'string' || !s.trim()) return false;
  const t = s.trim();
  return (t.startsWith('http://') || t.startsWith('https://')) && t.length > 8;
}

/** Fyndiq/CDON: volume mL/L, weight g/kg, shoe_size_eu. Values string 1–50. */
function buildNumericalProperties(product) {
  const out = [];
  const vol =
    product?.volume != null && Number.isFinite(Number(product.volume))
      ? Number(product.volume)
      : null;
  const volUnit =
    product?.volumeUnit != null ? String(product.volumeUnit).trim().toLowerCase() : '';
  if (vol != null && vol >= 0) {
    if (volUnit === 'ml') out.push({ name: 'volume_ml', value: String(vol).slice(0, 50) });
    else if (volUnit === 'l') out.push({ name: 'volume_l', value: String(vol).slice(0, 50) });
  }
  const weight =
    product?.weight != null && Number.isFinite(Number(product.weight))
      ? Number(product.weight)
      : null;
  if (weight != null && weight > 0) {
    const weightUnit = (product?.channelSpecific?.weightUnit ?? 'g')
      .toString()
      .trim()
      .toLowerCase();
    if (weightUnit === 'kg') {
      out.push({ name: 'weight_kg', value: String(weight).slice(0, 50) });
    } else {
      out.push({ name: 'weight_g', value: String(weight).slice(0, 50) });
    }
  }
  const shoeEu =
    product?.channelSpecific?.shoeSizeEu ??
    product?.shoeSizeEu ??
    (product?.shoe_size_eu != null ? String(product.shoe_size_eu).trim() : null);
  if (shoeEu != null && String(shoeEu).trim()) {
    out.push({ name: 'shoe_size_eu', value: String(shoeEu).trim().slice(0, 50) });
  }
  return out;
}

function mergeProperties(numericalProps, existingProps) {
  const names = new Set(existingProps.map((p) => p?.name).filter(Boolean));
  const merged = [...existingProps];
  for (const p of numericalProps) {
    if (p?.name && !names.has(p.name)) {
      merged.push(p);
      names.add(p.name);
    }
  }
  return merged;
}

function parseOverrideCategories(value) {
  if (value == null) return [];
  const raw = String(value).trim();
  if (!raw || raw === '0') return [];
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((x) => String(x || '').trim()).filter((x) => x && x !== '0');
    } catch {
      return [];
    }
  }
  return [raw];
}

/**
 * Build one Fyndiq article payload (single article, possibly multiple markets).
 * @param {Object} product - Base product: id, sku, mpn, title, description, status, quantity, priceAmount, currency, vatRate, mainImage, images, categories, brand, gtin, channelSpecific?.fyndiq
 * @param {Object} overridesByMarket - Per-market overrides: { se?: { priceAmount, currency, vatRate, category, active, originalPrice }, ... } (keys lower case)
 * @param {string} defaultLanguage - Default language code e.g. 'sv-SE' (used for title/description when no per-language data)
 * @param {string[]} marketsFilter - Markets to include e.g. ['se','dk','fi'] (lower case)
 * @returns {Object|null} Fyndiq API article body or null if required fields missing
 */
function mapProductToFyndiqArticle(
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

  const fyndiq =
    product?.channelSpecific?.fyndiq && typeof product.channelSpecific.fyndiq === 'object'
      ? product.channelSpecific.fyndiq
      : {};
  const markets = (marketsFilter || ['se', 'dk', 'fi']).map((m) => String(m).toUpperCase());

  // Title: per language from textsExtended (per marknad) + textsStandard, else products.title. UI sätter bara textsExtended per land.
  const textsExtended = product?.channelSpecific?.textsExtended;
  const standardMarket = ['se', 'dk', 'fi', 'no'].includes(
    String(product?.channelSpecific?.textsStandard || '').toLowerCase(),
  )
    ? String(product.channelSpecific.textsStandard).toLowerCase()
    : 'se';
  const standardText = textsExtended?.[standardMarket];
  let titleArr = null;
  if (textsExtended && typeof textsExtended === 'object') {
    const arr = [];
    const seen = new Set();
    for (const m of markets) {
      const mk = m.toLowerCase();
      const lang = MARKET_TO_LANG[m] || defaultLanguage || 'sv-SE';
      if (seen.has(lang)) continue;
      const t = textsExtended[mk];
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
  if (!titleArr || titleArr.length === 0) return null;

  // Description: per language from textsExtended + textsStandard, else products.description.
  const baseDesc = product?.description != null ? String(product.description) : '';
  let descriptionArr = null;
  if (textsExtended && typeof textsExtended === 'object') {
    const arr = [];
    const seen = new Set();
    for (const m of markets) {
      const mk = m.toLowerCase();
      const lang = MARKET_TO_LANG[m] || defaultLanguage || 'sv-SE';
      if (seen.has(lang)) continue;
      const t = textsExtended[mk];
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
  if (!descriptionArr || descriptionArr.length === 0) return null;

  // Price per market (required)
  const basePrice =
    product?.priceAmount != null && Number.isFinite(Number(product.priceAmount))
      ? Number(product.priceAmount)
      : null;
  const baseCurrency = (product?.currency || 'SEK').toString().toUpperCase();
  const price = [];
  for (const m of markets) {
    const mk = m.toLowerCase();
    const ov = overridesByMarket && overridesByMarket[mk];
    const amount =
      ov?.priceAmount != null && Number.isFinite(Number(ov.priceAmount))
        ? Number(ov.priceAmount)
        : basePrice;
    // Fyndiq requires market-specific currency (DKK for DK, EUR for FI, SEK for SE). Use override currency if set, else market default.
    const currencyRaw = ov?.currency != null && String(ov.currency).trim() ? String(ov.currency).trim() : (DEFAULT_CURRENCY_BY_MARKET[m] || baseCurrency);
    const currency = currencyRaw.toString().toUpperCase();
    if (amount != null && amount > 0) price.push({ market: m, value: { amount, currency } });
  }
  if (price.length === 0) return null;

  // original_price per market (Fyndiq: "price before sell on Fyndiq") from overrides.originalPrice
  const original_price = [];
  for (const m of markets) {
    const mk = m.toLowerCase();
    const ov = overridesByMarket && overridesByMarket[mk];
    if (!ov || ov.active !== true) continue;
    const amount =
      ov.originalPrice != null &&
      Number.isFinite(Number(ov.originalPrice)) &&
      Number(ov.originalPrice) > 0
        ? Number(ov.originalPrice)
        : null;
    if (amount == null) continue;
    const currencyRaw = ov.currency != null && String(ov.currency).trim() ? String(ov.currency).trim() : (DEFAULT_CURRENCY_BY_MARKET[m] || baseCurrency);
    const currency = currencyRaw.toString().toUpperCase();
    original_price.push({ market: m, value: { amount, currency } });
  }

  // Shipping time per market (required by Fyndiq)
  const shippingTimeFromFyndiq =
    fyndiq.shipping_time && Array.isArray(fyndiq.shipping_time) ? fyndiq.shipping_time : [];
  const shippingTimeMap = new Map(
    shippingTimeFromFyndiq.map((s) => [String(s.market).toUpperCase(), s]),
  );
  const shipping_time = [];
  for (const m of markets) {
    const existing = shippingTimeMap.get(m);
    const min =
      existing?.min != null ? Math.max(1, Math.min(21, Math.floor(Number(existing.min)))) : 1;
    const max =
      existing?.max != null ? Math.max(1, Math.min(21, Math.floor(Number(existing.max)))) : 3;
    shipping_time.push({ market: m, min, max });
  }

  // Categories: explicit from active market overrides only (no fallback).
  const categories = [];
  const seenCategories = new Set();
  for (const m of markets) {
    const mk = m.toLowerCase();
    const ov = overridesByMarket && overridesByMarket[mk];
    if (!ov || ov.active !== true) continue;
    const marketCategories = parseOverrideCategories(ov.category);
    for (const cat of marketCategories) {
      if (seenCategories.has(cat)) continue;
      seenCategories.add(cat);
      categories.push(cat);
    }
  }
  if (categories.length === 0) return null;

  const payload = {
    sku,
    status,
    quantity,
    categories,
    main_image: mainImage,
    markets,
    title: titleArr,
    description: descriptionArr,
    price,
    shipping_time,
  };
  if (original_price.length > 0) payload.original_price = original_price;

  if (product?.parentProductId != null && String(product.parentProductId).trim())
    payload.parent_sku = String(product.parentProductId).trim();
  if (fyndiq.legacy_product_id != null)
    payload.legacy_product_id = Number(fyndiq.legacy_product_id);
  if (Array.isArray(product?.images) && product.images.length) {
    const trimmed = product.images
      .filter(Boolean)
      .map((u) => String(u).trim())
      .filter((u) => u !== mainImage)
      .slice(0, 10);
    const invalid = trimmed.find((u) => !isValidUrl(u));
    if (invalid !== undefined) return null;
    if (trimmed.length) payload.images = trimmed;
  }
  if (product?.brand != null && String(product.brand).trim())
    payload.brand = String(product.brand).trim().slice(0, 50);
  if (product?.gtin != null && String(product.gtin).trim())
    payload.gtin = String(product.gtin).trim().slice(0, 13);
  if (fyndiq.delivery_type && Array.isArray(fyndiq.delivery_type) && fyndiq.delivery_type.length)
    payload.delivery_type = fyndiq.delivery_type;
  if (product?.knNumber != null && String(product.knNumber).trim())
    payload.kn_number = String(product.knNumber).trim().slice(0, 48);
  if (product?.sku != null && String(product.sku).trim())
    payload.internal_note = String(product.sku).trim();
  const numericalProps = buildNumericalProperties(product);
  if (fyndiq.properties && Array.isArray(fyndiq.properties) && fyndiq.properties.length) {
    payload.properties = mergeProperties(numericalProps, fyndiq.properties);
  } else if (
    product?.parentProductId != null &&
    String(product.parentProductId).trim() &&
    product?.groupVariationType &&
    ['color', 'size', 'model'].includes(String(product.groupVariationType).toLowerCase())
  ) {
    const vt = String(product.groupVariationType).toLowerCase();
    const lang = defaultLanguage || 'sv-SE';
    const props = [];
    if (vt === 'color') {
      const v = (product.color || product.colorText || '').trim();
      if (v) props.push({ name: 'color', value: v.slice(0, 100), language: lang });
    } else if (vt === 'size') {
      const v = (product.size || product.sizeText || '').trim();
      if (v) props.push({ name: 'size', value: v.slice(0, 100), language: lang });
    } else if (vt === 'model') {
      const v = (product.model || '').trim();
      if (v) props.push({ name: 'model', value: v.slice(0, 100), language: lang });
    }
    if (props.length > 0) payload.properties = mergeProperties(numericalProps, props);
  } else if (numericalProps.length > 0) {
    payload.properties = numericalProps;
  }
  if (fyndiq.variational_properties && Array.isArray(fyndiq.variational_properties)) {
    payload.variational_properties = fyndiq.variational_properties;
  } else if (
    product?.parentProductId != null &&
    product?.groupVariationType &&
    ['color', 'size', 'model'].includes(String(product.groupVariationType).toLowerCase())
  ) {
    payload.variational_properties = [String(product.groupVariationType).toLowerCase()];
  }

  return payload;
}

function getFyndiqArticleInputIssues(
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

  const markets = (marketsFilter || ['se', 'dk', 'fi']).map((m) => String(m).toUpperCase());
  const textsExtended = product?.channelSpecific?.textsExtended;
  const standardMarket = ['se', 'dk', 'fi', 'no'].includes(
    String(product?.channelSpecific?.textsStandard || '').toLowerCase(),
  )
    ? String(product.channelSpecific.textsStandard).toLowerCase()
    : 'se';
  const standardText = textsExtended?.[standardMarket];
  let hasValidTitle = title.length >= 5;
  if (!hasValidTitle && textsExtended && typeof textsExtended === 'object') {
    for (const m of markets) {
      const mk = m.toLowerCase();
      const t = textsExtended[mk];
      const value = (t?.name || standardText?.name || '').slice(0, 150);
      if (value.length >= 5) {
        hasValidTitle = true;
        break;
      }
    }
  }
  if (!hasValidTitle) issues.push('invalid_title_length');

  const rawDescription = product?.description != null ? String(product.description) : '';
  let hasValidDescription = rawDescription.slice(0, 4096).length >= 10;
  if (!hasValidDescription && textsExtended && typeof textsExtended === 'object') {
    for (const m of markets) {
      const mk = m.toLowerCase();
      const t = textsExtended[mk];
      const value = (t?.description || standardText?.description || '').slice(0, 4096);
      if (value.length >= 10) {
        hasValidDescription = true;
        break;
      }
    }
  }
  if (!hasValidDescription) issues.push('missing_or_short_description');
  let categoryCount = 0;
  for (const m of markets) {
    const mk = m.toLowerCase();
    const ov = overridesByMarket && overridesByMarket[mk];
    if (!ov || ov.active !== true) continue;
    const cats = parseOverrideCategories(ov.category);
    if (cats.length === 0) issues.push(`missing_category_for_market:${mk}`);
    categoryCount += cats.length;
  }
  if (categoryCount === 0) issues.push('missing_categories');
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

  return issues;
}

function validateFyndiqArticlePayload(article) {
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

  const categories = Array.isArray(article.categories) ? article.categories : [];
  if (!categories.length) return { ok: false, reason: 'missing_categories' };

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
    const amount = Number(row?.value?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'invalid_amount' };
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
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 21 || min > max) {
      return { ok: false, reason: 'invalid_shipping_time_range' };
    }
  }

  const images = Array.isArray(article.images) ? article.images : [];
  const invalidImg = images.find(
    (u) => u != null && String(u).trim() && !isValidUrl(String(u).trim()),
  );
  if (invalidImg) return { ok: false, reason: 'invalid_images_url' };

  return { ok: true };
}

module.exports = {
  mapProductToFyndiqArticle,
  getFyndiqArticleInputIssues,
  validateFyndiqArticlePayload,
};
