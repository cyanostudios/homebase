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

/** CDON/Fyndiq: volume mL/L, weight g/kg, shoe_size_eu. Values string 1–50. */
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
  if (weight != null && weight >= 0) {
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

  // Title: per language from textsExtended (per marknad) + textsStandard, else products.title. UI sätter bara textsExtended per land, ingen kanalspecifik titel.
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

  // CDON portal uses Sello group_id as "Huvudartikel SKU"; use groupId when present, else parentProductId.
  const parentSku =
    product?.groupId != null && String(product.groupId).trim()
      ? String(product.groupId).trim()
      : product?.parentProductId != null && String(product.parentProductId).trim()
        ? String(product.parentProductId).trim()
        : null;
  if (parentSku) payload.parent_sku = parentSku;
  if (product?.brand != null && String(product.brand).trim())
    payload.brand = String(product.brand).trim();
  if (product?.gtin != null && String(product.gtin).trim())
    payload.gtin = String(product.gtin).trim();
  if (product?.mpn != null && String(product.mpn).trim()) payload.mpn = String(product.mpn).trim();
  if (product?.sku != null && String(product.sku).trim())
    payload.internal_note = String(product.sku).trim();
  if (Array.isArray(product?.images) && product.images.length) {
    const trimmed = product.images.filter(Boolean).map((u) => String(u).trim());
    const invalid = trimmed.find((u) => !isValidUrl(u));
    if (invalid !== undefined) return null;
    payload.images = trimmed;
  }
  if (textsExtended && typeof textsExtended === 'object') {
    const uspArr = [];
    const seen = new Set();
    for (const m of markets) {
      const mk = m.toLowerCase();
      const lang = MARKET_TO_LANG[m] || defaultLanguage || 'sv-SE';
      if (seen.has(lang)) continue;
      const t = textsExtended[mk];
      const bp = t?.bulletpoints ?? standardText?.bulletpoints;
      let points = [];
      if (Array.isArray(bp)) {
        points = bp
          .filter(Boolean)
          .map(String)
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (typeof bp === 'string' && bp.trim()) {
        points = bp
          .split(/\n/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (points.length > 0) {
        seen.add(lang);
        uspArr.push({ language: lang, value: points });
      }
    }
    if (uspArr.length > 0) payload.unique_selling_points = uspArr;
  }
  // Specifications: always include Identifikation → Tillverkarens artikelnummer from MPN; merge with cdon.specifications if present
  const mpnValue = product?.mpn != null ? String(product.mpn).trim() : null;
  const MPN_ATTR_BY_LANG = {
    'sv-SE': 'Tillverkarens artikelnummer',
    'da-DK': 'Producentens artikelnummer',
    'fi-FI': 'Valmistajan tuotenumero',
    'nb-NO': 'Producentens artikkelnummer',
  };
  const identSection = (lang) => {
    const attrName = MPN_ATTR_BY_LANG[lang];
    if (!attrName) return null;
    return {
      name: 'Identifikation',
      value: [{ name: attrName, value: mpnValue, description: null }],
    };
  };
  const existingSpecs =
    cdon.specifications && Array.isArray(cdon.specifications) ? cdon.specifications : [];
  if (mpnValue) {
    const langSet = new Set();
    const specArr = [];
    for (const m of markets) {
      const lang = MARKET_TO_LANG[m] || defaultLanguage || 'sv-SE';
      if (langSet.has(lang)) continue;
      const attrName = MPN_ATTR_BY_LANG[lang];
      if (!attrName) continue;
      langSet.add(lang);
      const ident = identSection(lang);
      if (!ident) continue;
      const existingForLang = existingSpecs.find((s) => s.language === lang);
      const sections = [ident];
      if (existingForLang && Array.isArray(existingForLang.value)) {
        for (const sec of existingForLang.value) {
          if (sec && sec.name !== 'Identifikation') sections.push(sec);
        }
      }
      specArr.push({ language: lang, value: sections });
    }
    for (const ex of existingSpecs) {
      if (ex && ex.language && !langSet.has(ex.language)) {
        const ident = identSection(ex.language);
        if (!ident) continue;
        langSet.add(ex.language);
        const sections = [ident];
        if (Array.isArray(ex.value)) {
          for (const sec of ex.value) {
            if (sec && sec.name !== 'Identifikation') sections.push(sec);
          }
        }
        specArr.push({ language: ex.language, value: sections });
      }
    }
    if (specArr.length) payload.specifications = specArr;
  } else if (existingSpecs.length) {
    payload.specifications = existingSpecs;
  }

  // Classifications: CONDITION derived from product.condition (new→NEW, used→USED, refurb→REFURB)
  const condMap = { new: 'NEW', used: 'USED', refurb: 'REFURB' };
  const cond = condMap[product?.condition] ?? 'NEW';
  payload.classifications = [{ name: 'CONDITION', value: cond }];
  if (cdon.delivery_type && Array.isArray(cdon.delivery_type))
    payload.delivery_type = cdon.delivery_type;
  if (product?.knNumber != null && String(product.knNumber).trim())
    payload.kn_number = String(product.knNumber).trim().slice(0, 48);
  if (cdon.shipped_from != null && String(cdon.shipped_from).trim())
    payload.shipped_from = String(cdon.shipped_from).trim();

  // Manufacturer: CDON expects object { name, address? }. Single source: product.manufacturerName (from manufacturer_id).
  const manufacturerName =
    product?.manufacturerName != null && String(product.manufacturerName).trim()
      ? String(product.manufacturerName).trim().slice(0, 255)
      : null;
  if (manufacturerName) {
    payload.manufacturer = { name: manufacturerName };
  }
  if (cdon.availability_dates && Array.isArray(cdon.availability_dates))
    payload.availability_dates = cdon.availability_dates;
  const numericalProps = buildNumericalProperties(product);
  if (cdon.properties && Array.isArray(cdon.properties)) {
    payload.properties = mergeProperties(numericalProps, cdon.properties);
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
  if (cdon.variational_properties && Array.isArray(cdon.variational_properties)) {
    payload.variational_properties = cdon.variational_properties;
  } else if (
    product?.parentProductId != null &&
    product?.groupVariationType &&
    ['color', 'size', 'model'].includes(String(product.groupVariationType).toLowerCase())
  ) {
    payload.variational_properties = [String(product.groupVariationType).toLowerCase()];
  }

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
