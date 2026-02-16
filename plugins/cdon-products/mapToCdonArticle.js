// plugins/cdon-products/mapToCdonArticle.js
// Builds a CDON Merchants API v2 article payload (for bulk create/update) from product + overrides + default language.
// Uses only fields and shapes from docs/CDON_API_DOCUMENTATION.md. No guessing.

const DEFAULT_CURRENCY_BY_MARKET = { SE: 'SEK', DK: 'DKK', FI: 'EUR', NO: 'NOK' };

/**
 * Build one CDON article payload for POST/PUT v2/articles/bulk.
 * @param {Object} product - Base product: id, sku, mpn, title, description, status, quantity, priceAmount, currency, vatRate, mainImage, images, categories, brand, gtin, channelSpecific?.cdon
 * @param {Object} overridesByMarket - Per-market overrides: { se?: { priceAmount, currency, vatRate, category }, ... } (keys lower case)
 * @param {string} defaultLanguage - Default language e.g. 'sv-SE'
 * @param {string[]} marketsFilter - e.g. ['se','dk','fi']
 * @returns {Object|null} CDON article object or null if required fields missing
 */
function mapProductToCdonArticle(product, overridesByMarket, defaultLanguage, marketsFilter = ['se', 'dk', 'fi']) {
  const sku = product?.sku != null ? String(product.sku).trim() : (product?.id != null ? String(product.id).trim() : '');
  const title = product?.title != null ? String(product.title).trim() : '';
  const mainImage = product?.mainImage != null ? String(product.mainImage).trim() : '';
  const quantity = product?.quantity != null && Number.isFinite(Number(product.quantity)) ? Math.max(0, Math.floor(Number(product.quantity))) : null;
  const status = product?.status === 'paused' ? 'paused' : 'for sale';

  if (!sku || !title || !mainImage) return null;
  if (quantity == null || quantity < 0) return null;

  const cdon = product?.channelSpecific?.cdon && typeof product.channelSpecific.cdon === 'object' ? product.channelSpecific.cdon : {};
  const markets = (marketsFilter || ['se', 'dk', 'fi']).map((m) => String(m).toUpperCase());

  // Title: per-language from channelSpecific or single default from product
  let titleArr = cdon.title && Array.isArray(cdon.title) ? cdon.title : null;
  if (!titleArr || titleArr.length === 0) {
    const lang = defaultLanguage || 'sv-SE';
    const value = (title || '').slice(0, 150);
    if (value.length >= 5) titleArr = [{ language: lang, value }];
  }
  if (!titleArr || titleArr.length === 0) return null;

  // Description (CDON 10–4096 chars; no padding/guessing)
  let descriptionArr = cdon.description && Array.isArray(cdon.description) ? cdon.description : null;
  if (!descriptionArr || descriptionArr.length === 0) {
    const lang = defaultLanguage || 'sv-SE';
    const raw = product?.description != null ? String(product.description) : '';
    const value = raw.slice(0, 4096);
    if (value.length >= 10) descriptionArr = [{ language: lang, value }];
    else return null;
  }
  if (!descriptionArr || descriptionArr.length === 0) return null;

  // Price per market (required). CDON: amount_including_vat, currency, vat_rate (optional)
  const basePrice = product?.priceAmount != null && Number.isFinite(Number(product.priceAmount)) ? Number(product.priceAmount) : null;
  const baseCurrency = (product?.currency || 'SEK').toString().toUpperCase();
  const baseVat = product?.vatRate != null && Number.isFinite(Number(product.vatRate)) ? Number(product.vatRate) : null;
  const price = [];
  for (const m of markets) {
    const mk = m.toLowerCase();
    const ov = overridesByMarket && overridesByMarket[mk];
    const amount = ov?.priceAmount != null && Number.isFinite(Number(ov.priceAmount)) ? Number(ov.priceAmount) : basePrice;
    const currency = (ov?.currency || baseCurrency || DEFAULT_CURRENCY_BY_MARKET[m] || 'SEK').toString().toUpperCase();
    const vatRate = ov?.vatRate != null ? Number(ov.vatRate) : baseVat;
    if (amount != null && amount >= 0) {
      const value = { amount_including_vat: amount, currency };
      if (vatRate != null && Number.isFinite(vatRate)) value.vat_rate = vatRate;
      price.push({ market: m, value });
    }
  }
  if (price.length === 0) return null;

  // Shipping time per market (required)
  const shippingTimeFromCdon = cdon.shipping_time && Array.isArray(cdon.shipping_time) ? cdon.shipping_time : [];
  const shippingTimeMap = new Map(shippingTimeFromCdon.map((s) => [String(s.market).toUpperCase(), s]));
  const shipping_time = [];
  for (const m of markets) {
    const existing = shippingTimeMap.get(m);
    const min = existing?.min != null ? Math.max(1, Math.min(9, Math.floor(Number(existing.min)))) : 1;
    const max = existing?.max != null ? Math.max(1, Math.min(9, Math.floor(Number(existing.max)))) : 3;
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

  // Optional: category (CDON uses single category for bulk). From channelSpecific only; no fallback.
  if (cdon.category != null && String(cdon.category).trim()) payload.category = String(cdon.category).trim();

  if (product?.brand != null && String(product.brand).trim()) payload.brand = String(product.brand).trim();
  if (product?.gtin != null && String(product.gtin).trim()) payload.gtin = String(product.gtin).trim();
  if (product?.mpn != null && String(product.mpn).trim()) payload.mpn = String(product.mpn).trim();
  if (Array.isArray(product?.images) && product.images.length) payload.images = product.images.filter(Boolean).map((u) => String(u));
  if (cdon.unique_selling_points && Array.isArray(cdon.unique_selling_points)) payload.unique_selling_points = cdon.unique_selling_points;
  if (cdon.specifications && Array.isArray(cdon.specifications)) payload.specifications = cdon.specifications;
  if (cdon.classifications && Array.isArray(cdon.classifications)) payload.classifications = cdon.classifications;
  if (cdon.delivery_type && Array.isArray(cdon.delivery_type)) payload.delivery_type = cdon.delivery_type;
  if (cdon.kn_number != null && String(cdon.kn_number).trim()) payload.kn_number = String(cdon.kn_number).trim();
  if (cdon.shipped_from != null && String(cdon.shipped_from).trim()) payload.shipped_from = String(cdon.shipped_from).trim();
  if (cdon.manufacturer != null && String(cdon.manufacturer).trim()) payload.manufacturer = String(cdon.manufacturer).trim();
  if (cdon.availability_dates && Array.isArray(cdon.availability_dates)) payload.availability_dates = cdon.availability_dates;
  if (cdon.properties && Array.isArray(cdon.properties)) payload.properties = cdon.properties;
  if (cdon.variational_properties && Array.isArray(cdon.variational_properties)) payload.variational_properties = cdon.variational_properties;

  return payload;
}

module.exports = { mapProductToCdonArticle };
