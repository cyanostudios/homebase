// plugins/clubdesk/services/kioskCatalogSeed.js
// Dedicated kiosk master catalog seed (not importItems).

const fs = require('fs');
const path = require('path');
const { Logger } = require('@homebase/core');
const InventoryModel = require('../inventoryModel');
const { normalizeGtin, slugifyBase } = require('../inventoryModel');
const {
  isEmptyField,
  trimOrEmpty,
  mapSeedToColumnValues,
  buildFillEmptyUpdates,
  shouldSkipSeedRowDueToNameKeyConflict,
  pickNameFallbackRow,
} = require('./kioskCatalogSeedLogic');

const SEED_FILE = path.join(
  __dirname,
  '../seeds/kiosk_master_catalog_sverige_berikad_verifierad.json',
);

function loadKioskCatalogRows() {
  const raw = fs.readFileSync(SEED_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Kiosk catalog seed must be a JSON array');
  }
  return parsed;
}

function normalizeSeedGtin(value) {
  const raw = trimOrEmpty(value);
  if (!raw) return null;
  return normalizeGtin(raw);
}

async function queryRows(client, sql, params) {
  const result = await client.query(sql, params);
  return result.rows || [];
}

async function findByCatalogKey(client, userId, catalogKey) {
  const rows = await queryRows(
    client,
    `
      SELECT *
      FROM clubdesk_inventory_items
      WHERE user_id = $1 AND catalog_key = $2
      ORDER BY id ASC
      LIMIT 1
    `,
    [userId, catalogKey],
  );
  return rows[0] || null;
}

async function findActiveRowsByName(client, userId, productName) {
  return queryRows(
    client,
    `
      SELECT *
      FROM clubdesk_inventory_items
      WHERE user_id = $1
        AND archived_at IS NULL
        AND lower(article_name) = lower($2)
      ORDER BY id ASC
    `,
    [userId, productName],
  );
}

async function wouldBrandConflict(client, userId, itemId, articleName, brand) {
  const rows = await queryRows(
    client,
    `
      SELECT id
      FROM clubdesk_inventory_items
      WHERE user_id = $1
        AND archived_at IS NULL
        AND id <> $2
        AND lower(article_name) = lower($3)
        AND lower(brand) = lower($4)
      LIMIT 1
    `,
    [userId, itemId, articleName, brand],
  );
  return rows.length > 0;
}

async function applyFillEmptyUpdate(client, userId, itemId, existingRow, updates) {
  if (!Object.keys(updates).length) return false;

  const cols = [];
  const params = [];
  let idx = 1;

  for (const [col, value] of Object.entries(updates)) {
    cols.push(`${col} = $${idx}`);
    params.push(value);
    idx += 1;
  }
  cols.push('updated_at = CURRENT_TIMESTAMP');
  params.push(itemId, userId);

  await client.query(
    `
      UPDATE clubdesk_inventory_items
      SET ${cols.join(', ')}
      WHERE id = $${idx} AND user_id = $${idx + 1}
    `,
    params,
  );
  return true;
}

async function ensureUniqueSlug(client, userId, desiredSlug, excludeId = null) {
  const model = new InventoryModel();
  const dbAdapter = {
    query: (sql, params) => queryRows(client, sql, params),
  };
  return model.ensureUniqueSlug(dbAdapter, userId, desiredSlug, excludeId);
}

async function insertDraftFromSeed(client, userId, seedRow, seedMapped) {
  const productName = trimOrEmpty(seedRow.product_name);
  if (!productName) {
    return { action: 'skipped', reason: 'missing_product_name' };
  }

  const brand = trimOrEmpty(seedRow.brand);
  const slug = await ensureUniqueSlug(client, userId, slugifyBase(productName));

  const sortRows = await queryRows(
    client,
    `
      SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next
      FROM clubdesk_inventory_items
      WHERE user_id = $1
    `,
    [userId],
  );
  const sortOrder = Number(sortRows[0]?.next ?? 1);

  let gtin = '';
  try {
    const normalized = normalizeSeedGtin(seedRow.gtin);
    gtin = normalized ?? '';
  } catch {
    gtin = '';
  }

  await client.query(
    `
      INSERT INTO clubdesk_inventory_items (
        user_id,
        article_name,
        brand,
        description,
        material,
        purchase_price,
        recommended_price,
        sale_price,
        currency,
        comment,
        tags,
        slug,
        featured_image_url,
        publication_status,
        featured,
        sort_order,
        catalog_key,
        category,
        package_size,
        package_unit,
        gtin,
        article_number,
        ingredients,
        allergens,
        energy_kcal_100g,
        fat_g_100g,
        saturated_fat_g_100g,
        carbohydrate_g_100g,
        sugar_g_100g,
        protein_g_100g,
        salt_g_100g,
        net_content,
        country_of_origin,
        country_of_manufacture,
        supplier,
        catalog_source,
        verified_at,
        data_status
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11::jsonb, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22,
        $23, $24,
        $25, $26, $27, $28, $29, $30, $31,
        $32, $33, $34, $35,
        $36, $37, $38
      )
    `,
    [
      userId,
      productName,
      brand,
      seedMapped.description ?? null,
      '',
      null,
      null,
      null,
      'SEK',
      null,
      '[]',
      slug,
      seedMapped.featured_image_url ?? null,
      'draft',
      false,
      sortOrder,
      trimOrEmpty(seedRow.catalog_key),
      seedMapped.category ?? '',
      seedMapped.package_size ?? '',
      seedMapped.package_unit ?? '',
      gtin,
      seedMapped.article_number ?? '',
      seedMapped.ingredients ?? null,
      seedMapped.allergens ?? null,
      seedMapped.energy_kcal_100g ?? null,
      seedMapped.fat_g_100g ?? null,
      seedMapped.saturated_fat_g_100g ?? null,
      seedMapped.carbohydrate_g_100g ?? null,
      seedMapped.sugar_g_100g ?? null,
      seedMapped.protein_g_100g ?? null,
      seedMapped.salt_g_100g ?? null,
      seedMapped.net_content ?? '',
      seedMapped.country_of_origin ?? '',
      seedMapped.country_of_manufacture ?? '',
      seedMapped.supplier ?? '',
      seedMapped.catalog_source ?? '',
      seedMapped.verified_at ?? null,
      seedMapped.data_status ?? '',
    ],
  );

  return { action: 'inserted' };
}

async function mergeSeedIntoExisting(client, userId, existingRow, seedRow) {
  let seedMapped = mapSeedToColumnValues(seedRow);

  if (seedMapped.gtin) {
    try {
      seedMapped.gtin = normalizeSeedGtin(seedRow.gtin);
      if (seedMapped.gtin == null) delete seedMapped.gtin;
    } catch {
      delete seedMapped.gtin;
    }
  }

  const { updates: rawUpdates } = buildFillEmptyUpdates(existingRow, seedMapped);
  const updates = { ...rawUpdates };

  if (updates.brand !== undefined) {
    const articleName = !isEmptyField(existingRow.article_name)
      ? existingRow.article_name
      : updates.article_name || existingRow.article_name;
    const conflict = await wouldBrandConflict(
      client,
      userId,
      existingRow.id,
      articleName,
      updates.brand,
    );
    if (conflict) {
      delete updates.brand;
    }
  }

  const changed = await applyFillEmptyUpdate(client, userId, existingRow.id, existingRow, updates);
  return changed ? { action: 'updated' } : { action: 'unchanged' };
}

async function processSeedRow(client, userId, seedRow) {
  const catalogKey = trimOrEmpty(seedRow.catalog_key);
  const productName = trimOrEmpty(seedRow.product_name);

  if (!catalogKey && !productName) {
    return { action: 'skipped', reason: 'missing_identity' };
  }

  if (catalogKey) {
    const byKey = await findByCatalogKey(client, userId, catalogKey);
    if (byKey) {
      return mergeSeedIntoExisting(client, userId, byKey, seedRow);
    }
  }

  if (productName) {
    const activeSameName = await findActiveRowsByName(client, userId, productName);

    if (shouldSkipSeedRowDueToNameKeyConflict(activeSameName, catalogKey)) {
      return { action: 'skipped', reason: 'name_owned_by_other_catalog_key' };
    }

    const keyless = activeSameName.filter((row) => isEmptyField(row.catalog_key));
    const fallback = pickNameFallbackRow(keyless);
    if (fallback) {
      return mergeSeedIntoExisting(client, userId, fallback, seedRow);
    }
  }

  const seedMapped = mapSeedToColumnValues(seedRow);
  return insertDraftFromSeed(client, userId, seedRow, seedMapped);
}

/**
 * @param {import('pg').PoolClient|{ query: Function }} client
 * @param {number} userId - tenant owner user id
 */
async function runKioskCatalogSeed(client, userId) {
  const rows = loadKioskCatalogRows();
  const stats = {
    total: rows.length,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
  };

  for (const seedRow of rows) {
    const result = await processSeedRow(client, userId, seedRow);
    if (result.action === 'inserted') stats.inserted += 1;
    else if (result.action === 'updated') stats.updated += 1;
    else if (result.action === 'unchanged') stats.unchanged += 1;
    else stats.skipped += 1;
  }

  Logger.info('Kiosk catalog seed completed', { userId, ...stats });
  return stats;
}

module.exports = {
  SEED_FILE,
  loadKioskCatalogRows,
  runKioskCatalogSeed,
  processSeedRow,
  mergeSeedIntoExisting,
  mapSeedToColumnValues,
  buildFillEmptyUpdates,
};
