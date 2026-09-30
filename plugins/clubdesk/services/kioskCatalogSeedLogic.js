// plugins/clubdesk/services/kioskCatalogSeedLogic.js
// Pure merge / match helpers for kiosk master catalog seed (testable without DB).

function isEmptyField(value) {
  return value === undefined || value === null || value === '';
}

function trimOrEmpty(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function parseSeedNumeric(value) {
  const raw = trimOrEmpty(value);
  if (!raw) return null;
  const num = parseFloat(raw.replace(',', '.'));
  return Number.isNaN(num) ? null : num;
}

function parseSeedDate(value) {
  const raw = trimOrEmpty(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

/**
 * @param {object} seedRow
 * @returns {object} snake_case column updates (only non-empty seed values)
 */
function mapSeedToColumnValues(seedRow) {
  const out = {};
  const catalogKey = trimOrEmpty(seedRow.catalog_key);
  if (catalogKey) out.catalog_key = catalogKey;

  const category = trimOrEmpty(seedRow.category);
  if (category) out.category = category;

  const packageSize = trimOrEmpty(seedRow.size);
  if (packageSize) out.package_size = packageSize;

  const packageUnit = trimOrEmpty(seedRow.unit);
  if (packageUnit) out.package_unit = packageUnit;

  const articleNumber = trimOrEmpty(seedRow.article_number);
  if (articleNumber) out.article_number = articleNumber;

  const productName = trimOrEmpty(seedRow.product_name);
  if (productName) out.article_name = productName;

  const brand = trimOrEmpty(seedRow.brand);
  if (brand) out.brand = brand;

  const description = trimOrEmpty(seedRow.product_description);
  if (description) out.description = description;

  const featuredImage = trimOrEmpty(seedRow.image_url);
  if (featuredImage) out.featured_image_url = featuredImage;

  const catalogSource = trimOrEmpty(seedRow.source);
  if (catalogSource) out.catalog_source = catalogSource;

  const ingredients = trimOrEmpty(seedRow.ingredients);
  if (ingredients) out.ingredients = ingredients;

  const allergens = trimOrEmpty(seedRow.allergens);
  if (allergens) out.allergens = allergens;

  const netContent = trimOrEmpty(seedRow.net_content);
  if (netContent) out.net_content = netContent;

  const countryOfOrigin = trimOrEmpty(seedRow.country_of_origin);
  if (countryOfOrigin) out.country_of_origin = countryOfOrigin;

  const countryOfManufacture = trimOrEmpty(seedRow.country_of_manufacture);
  if (countryOfManufacture) out.country_of_manufacture = countryOfManufacture;

  const supplier = trimOrEmpty(seedRow.supplier);
  if (supplier) out.supplier = supplier;

  const dataStatus = trimOrEmpty(seedRow.data_status);
  if (dataStatus) out.data_status = dataStatus;

  const gtin = trimOrEmpty(seedRow.gtin);
  if (gtin) out.gtin = gtin;

  const verifiedAt = parseSeedDate(seedRow.verified_at);
  if (verifiedAt) out.verified_at = verifiedAt;

  const nutritionMap = [
    ['energy_kcal_100g', 'energy_kcal_100g'],
    ['fat_g_100g', 'fat_g_100g'],
    ['saturated_fat_g_100g', 'saturated_fat_g_100g'],
    ['carbohydrate_g_100g', 'carbohydrate_g_100g'],
    ['sugar_g_100g', 'sugar_g_100g'],
    ['protein_g_100g', 'protein_g_100g'],
    ['salt_g_100g', 'salt_g_100g'],
  ];
  for (const [seedKey, col] of nutritionMap) {
    const num = parseSeedNumeric(seedRow[seedKey]);
    if (num != null) out[col] = num;
  }

  return out;
}

/**
 * Build UPDATE SET fragments: fill target column only when empty and seed has value.
 * @param {object} existingRow - DB row (snake_case)
 * @param {object} seedMapped - from mapSeedToColumnValues
 * @returns {{ updates: object, skippedBrand: boolean }}
 */
function buildFillEmptyUpdates(existingRow, seedMapped) {
  const updates = {};
  let skippedBrand = false;

  for (const [col, seedValue] of Object.entries(seedMapped)) {
    if (seedValue === undefined) continue;
    const current = existingRow[col];
    if (!isEmptyField(current)) continue;
    updates[col] = seedValue;
  }

  if (updates.brand !== undefined) {
    const articleName = !isEmptyField(existingRow.article_name)
      ? existingRow.article_name
      : updates.article_name;
    if (articleName && updates.brand !== undefined) {
      // Caller checks DB conflict; flag for tests when brand would be skipped externally.
      skippedBrand = false;
    }
  }

  return { updates, skippedBrand };
}

/**
 * @param {object[]} activeRowsSameName - active rows with matching lower(article_name)
 * @param {string} seedCatalogKey
 */
function shouldSkipSeedRowDueToNameKeyConflict(activeRowsSameName, seedCatalogKey) {
  const key = trimOrEmpty(seedCatalogKey);
  if (!key) return false;
  return activeRowsSameName.some((row) => {
    const rowKey = trimOrEmpty(row.catalog_key);
    return rowKey && rowKey !== key;
  });
}

/**
 * @param {object[]} keylessActiveSameName
 */
function pickNameFallbackRow(keylessActiveSameName) {
  if (!keylessActiveSameName.length) return null;
  return keylessActiveSameName.reduce((min, row) => (row.id < min.id ? row : min));
}

module.exports = {
  isEmptyField,
  trimOrEmpty,
  parseSeedNumeric,
  parseSeedDate,
  mapSeedToColumnValues,
  buildFillEmptyUpdates,
  shouldSkipSeedRowDueToNameKeyConflict,
  pickNameFallbackRow,
};
