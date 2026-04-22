// plugins/products/lookupsModel.js
// Brands, suppliers, manufacturers lookup tables

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

function getTenantId(req) {
  return req.session?.tenantId;
}

async function getAll(req, table) {
  const db = Database.get(req);
  const tenantId = getTenantId(req);
  if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

  const validTables = ['brands', 'suppliers', 'manufacturers'];
  if (!validTables.includes(table)) {
    throw new AppError('Invalid lookup table', 400, AppError.CODES.VALIDATION_ERROR);
  }

  const rows = await db.query(`SELECT id, name, created_at FROM ${table} ORDER BY name`, []);
  return (rows || []).map((r) => ({
    id: String(r.id),
    name: r.name || '',
    createdAt: r.created_at,
  }));
}

/**
 * Facet search for the catalog filter builder (lazy-loaded; not used on every page).
 * @param {object} req
 * @param {'brand' | 'supplier' | 'manufacturer'} field
 * @param {string} [q]
 * @param {number} [limit] max 500
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
async function listForCatalogFacet(req, field, q, limit) {
  const db = Database.get(req);
  const tenantId = getTenantId(req);
  if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

  const byField = { brand: 'brands', supplier: 'suppliers', manufacturer: 'manufacturers' };
  const table = byField[field];
  if (!table) {
    throw new AppError('Invalid facet field', 400, AppError.CODES.VALIDATION_ERROR);
  }

  const lim = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const params = [];
  let where = '';
  const qtrim = q != null && String(q).trim() !== '' ? String(q).trim() : null;
  if (qtrim) {
    params.push(`%${qtrim}%`);
    where = `WHERE name ILIKE $1`;
  }
  params.push(lim);
  const limIdx = params.length;
  const rows = await db.query(
    `SELECT id, name FROM ${table} ${where} ORDER BY name ASC LIMIT $${limIdx}`,
    params,
  );
  return (rows || []).map((r) => ({ id: String(r.id), name: r.name || '' }));
}

async function create(req, table, name) {
  const db = Database.get(req);
  const tenantId = getTenantId(req);
  if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

  const validTables = ['brands', 'suppliers', 'manufacturers'];
  if (!validTables.includes(table)) {
    throw new AppError('Invalid lookup table', 400, AppError.CODES.VALIDATION_ERROR);
  }

  const n = String(name || '').trim();
  if (!n) throw new AppError('Name is required', 400, AppError.CODES.VALIDATION_ERROR);

  const result = await db.query(
    `INSERT INTO ${table} (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, created_at`,
    [n],
  );
  const row = result[0];
  return { id: String(row.id), name: row.name || '', createdAt: row.created_at };
}

/**
 * Find or create brand for Sello import. Maps brand_id ↔ brand (same id+name linkage as Homebase).
 * Handles name changes and duplicate names during import.
 * @param {object} req
 * @param {string} selloBrandId - Sello brand_id
 * @param {string} brandName - Sello brand_name
 * @returns {Promise<{ id: string, name: string } | null>} Brand or null if both empty
 */
async function findOrCreateBrandForSello(req, selloBrandId, brandName) {
  const db = Database.get(req);
  const tenantId = getTenantId(req);
  if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

  let sid = String(selloBrandId ?? '').trim();
  const fname = String(brandName ?? '').trim();
  if (sid === '0' || sid === '') sid = '';
  if (!sid && !fname) return null;

  if (sid) {
    const byId = await db.query(`SELECT id, name FROM brands WHERE import_brand_id = $1 LIMIT 1`, [
      sid,
    ]);
    if (byId && byId.length > 0) {
      return { id: String(byId[0].id), name: byId[0].name ?? '' };
    }
  }
  if (fname) {
    const byName = await db.query(
      `SELECT id, name, import_brand_id FROM brands WHERE name = $1 LIMIT 1`,
      [fname],
    );
    if (byName && byName.length > 0) {
      const row = byName[0];
      if (sid && !row.import_brand_id) {
        await db.query(`UPDATE brands SET import_brand_id = $1 WHERE id = $2`, [sid, row.id]);
      }
      return { id: String(row.id), name: row.name ?? '' };
    }
  }
  const result = await db.query(
    `INSERT INTO brands (name, import_brand_id) VALUES ($1, $2)
     RETURNING id, name`,
    [fname || `Sello märke ${sid}`, sid || null],
  );
  const r = result[0];
  return { id: String(r.id), name: r.name ?? '' };
}

/**
 * Find or create manufacturer for Sello import. Maps manufacturer id ↔ manufacturer name.
 * Requires import_manufacturer_id column on manufacturers (migration 065).
 * @param {object} req
 * @param {string} selloManufacturerId - Sello manufacturer id
 * @param {string} manufacturerName - Manufacturer name (from Sello API or fallback)
 * @returns {Promise<{ id: string, name: string } | null>} Manufacturer or null if both empty
 */
async function findOrCreateManufacturerForSello(req, selloManufacturerId, manufacturerName) {
  const db = Database.get(req);
  const tenantId = getTenantId(req);
  if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);

  const sid = String(selloManufacturerId ?? '').trim();
  const fname = String(manufacturerName ?? '').trim();
  if (!sid && !fname) return null;

  if (sid) {
    const byId = await db.query(
      `SELECT id, name FROM manufacturers WHERE import_manufacturer_id = $1 LIMIT 1`,
      [sid],
    );
    if (byId && byId.length > 0) {
      return { id: String(byId[0].id), name: byId[0].name ?? '' };
    }
  }
  if (fname) {
    const byName = await db.query(
      `SELECT id, name, import_manufacturer_id FROM manufacturers WHERE name = $1 LIMIT 1`,
      [fname],
    );
    if (byName && byName.length > 0) {
      const row = byName[0];
      if (sid && !row.import_manufacturer_id) {
        await db.query(`UPDATE manufacturers SET import_manufacturer_id = $1 WHERE id = $2`, [
          sid,
          row.id,
        ]);
      }
      return { id: String(row.id), name: row.name ?? '' };
    }
  }
  const result = await db.query(
    `INSERT INTO manufacturers (name, import_manufacturer_id) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET import_manufacturer_id = COALESCE(manufacturers.import_manufacturer_id, EXCLUDED.import_manufacturer_id)
     RETURNING id, name`,
    [fname || `Sello tillverkare ${sid}`, sid || null],
  );
  const r = result[0];
  return { id: String(r.id), name: r.name ?? '' };
}

module.exports = {
  getAll,
  create,
  listForCatalogFacet,
  findOrCreateBrandForSello,
  findOrCreateManufacturerForSello,
};
