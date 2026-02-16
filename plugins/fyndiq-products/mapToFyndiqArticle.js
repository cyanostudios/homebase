// plugins/fyndiq-products/mapToFyndiqArticle.js
// Builds a Fyndiq Merchants API create/update article payload from product + overrides + default language.
// Uses only fields and shapes from docs/FYNDIQ_API_DOCUMENTATION.md. No guessing.

const DEFAULT_CURRENCY_BY_MARKET = { SE: 'SEK', DK: 'DKK', FI: 'EUR', NO: 'NOK' };

/**
 * Build one Fyndiq article payload (single article, possibly multiple markets).
 * @param {Object} product - Base product: id, sku, mpn, title, description, status, quantity, priceAmount, currency, vatRate, mainImage, images, categories, brand, gtin, channelSpecific?.fyndiq
 * @param {Object} overridesByMarket - Per-market overrides: { se?: { priceAmount, currency, vatRate, category, active }, ... } (keys lower case)
 * @param {string} defaultLanguage - Default language code e.g. 'sv-SE' (used for title/description when no per-language data)
 * @param {string[]} marketsFilter - Markets to include e.g. ['se','dk','fi'] (lower case)
 * @returns {Object|null} Fyndiq API article body or null if required fields missing
 */
function mapProductToFyndiqArticle(product, overridesByMarket, defaultLanguage, marketsFilter = ['se', 'dk', 'fi']) {
  const sku = product?.sku != null ? String(product.sku).trim() : '';
  const title = product?.title != null ? String(product.title).trim() : '';
  const mainImage = product?.mainImage != null ? String(product.mainImage).trim() : '';
  const quantity = product?.quantity != null && Number.isFinite(Number(product.quantity)) ? Math.max(0, Math.floor(Number(product.quantity))) : null;
  const status = product?.status === 'paused' ? 'paused' : 'for sale';

  if (!sku || !title || !mainImage) return null;
  if (quantity == null || quantity < 0) return null;

  const fyndiq = product?.channelSpecific?.fyndiq && typeof product.channelSpecific.fyndiq === 'object' ? product.channelSpecific.fyndiq : {};
  const markets = (marketsFilter || ['se', 'dk', 'fi']).map((m) => String(m).toUpperCase());

  // Title: use per-language from channelSpecific or single default-language entry from product
  let titleArr = fyndiq.title && Array.isArray(fyndiq.title) ? fyndiq.title : null;
  if (!titleArr || titleArr.length === 0) {
    const lang = defaultLanguage || 'sv-SE';
    const value = title || '';
    if (value.length >= 5 && value.length <= 150) titleArr = [{ language: lang, value }];
    else if (value) titleArr = [{ language: lang, value: value.slice(0, 150) }];
  }
  if (!titleArr || titleArr.length === 0) return null;

  // Description: same rule (Fyndiq requires 10–4096 chars; no padding/guessing)
  let descriptionArr = fyndiq.description && Array.isArray(fyndiq.description) ? fyndiq.description : null;
  if (!descriptionArr || descriptionArr.length === 0) {
    const lang = defaultLanguage || 'sv-SE';
    const raw = product?.description != null ? String(product.description) : '';
    const value = raw.slice(0, 4096);
    if (value.length >= 10) descriptionArr = [{ language: lang, value }];
    else return null;
  }
  if (!descriptionArr || descriptionArr.length === 0) return null;

  // Price per market (required)
  const basePrice = product?.priceAmount != null && Number.isFinite(Number(product.priceAmount)) ? Number(product.priceAmount) : null;
  const baseCurrency = (product?.currency || 'SEK').toString().toUpperCase();
  const price = [];
  for (const m of markets) {
    const mk = m.toLowerCase();
    const ov = overridesByMarket && overridesByMarket[mk];
    const amount = ov?.priceAmount != null && Number.isFinite(Number(ov.priceAmount)) ? Number(ov.priceAmount) : basePrice;
    const currency = (ov?.currency || baseCurrency || DEFAULT_CURRENCY_BY_MARKET[m] || 'SEK').toString().toUpperCase();
    if (amount != null && amount >= 0) price.push({ market: m, value: { amount, currency } });
  }
  if (price.length === 0) return null;

  // Shipping time per market (required by Fyndiq)
  const shippingTimeFromFyndiq = fyndiq.shipping_time && Array.isArray(fyndiq.shipping_time) ? fyndiq.shipping_time : [];
  const shippingTimeMap = new Map(shippingTimeFromFyndiq.map((s) => [String(s.market).toUpperCase(), s]));
  const shipping_time = [];
  for (const m of markets) {
    const existing = shippingTimeMap.get(m);
    const min = existing?.min != null ? Math.max(1, Math.min(9, Math.floor(Number(existing.min)))) : 1;
    const max = existing?.max != null ? Math.max(1, Math.min(9, Math.floor(Number(existing.max)))) : 3;
    shipping_time.push({ market: m, min, max });
  }

  // Categories: required. From channelSpecific.fyndiq.categories only; no fallback.
  const categories = Array.isArray(fyndiq.categories) ? fyndiq.categories.filter((c) => c != null && String(c).trim()).map((c) => String(c).trim()) : [];
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

  if (fyndiq.parent_sku != null && String(fyndiq.parent_sku).trim()) payload.parent_sku = String(fyndiq.parent_sku).trim();
  if (fyndiq.legacy_product_id != null) payload.legacy_product_id = Number(fyndiq.legacy_product_id);
  if (Array.isArray(product?.images) && product.images.length) payload.images = product.images.filter(Boolean).slice(0, 10).map((u) => String(u));
  if (product?.brand != null && String(product.brand).trim()) payload.brand = String(product.brand).trim().slice(0, 50);
  if (product?.gtin != null && String(product.gtin).trim()) payload.gtin = String(product.gtin).trim().slice(0, 13);
  if (fyndiq.delivery_type && Array.isArray(fyndiq.delivery_type) && fyndiq.delivery_type.length) payload.delivery_type = fyndiq.delivery_type;
  if (fyndiq.kn_number != null && String(fyndiq.kn_number).trim()) payload.kn_number = String(fyndiq.kn_number).trim().slice(0, 48);
  if (fyndiq.properties && Array.isArray(fyndiq.properties) && fyndiq.properties.length) payload.properties = fyndiq.properties;
  if (fyndiq.variational_properties && Array.isArray(fyndiq.variational_properties)) payload.variational_properties = fyndiq.variational_properties;

  return payload;
}

module.exports = { mapProductToFyndiqArticle };
