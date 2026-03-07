// plugins/products/lookupsModel.js
// Brands, suppliers, manufacturers lookup tables

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

function getUserId(req) {
  return req.session?.user?.id;
}

async function getAll(req, table) {
  const db = Database.get(req);
  const userId = getUserId(req);
  if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

  const validTables = ['brands', 'suppliers', 'manufacturers'];
  if (!validTables.includes(table)) {
    throw new AppError('Invalid lookup table', 400, AppError.CODES.VALIDATION_ERROR);
  }

  const rows = await db.query(
    `SELECT id, name, created_at FROM ${table} WHERE user_id = $1 ORDER BY name`,
    [userId],
  );
  return (rows || []).map((r) => ({ id: String(r.id), name: r.name || '', createdAt: r.created_at }));
}

async function create(req, table, name) {
  const db = Database.get(req);
  const userId = getUserId(req);
  if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

  const validTables = ['brands', 'suppliers', 'manufacturers'];
  if (!validTables.includes(table)) {
    throw new AppError('Invalid lookup table', 400, AppError.CODES.VALIDATION_ERROR);
  }

  const n = String(name || '').trim();
  if (!n) throw new AppError('Name is required', 400, AppError.CODES.VALIDATION_ERROR);

  const result = await db.query(
    `INSERT INTO ${table} (user_id, name) VALUES ($1, $2)
     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, created_at`,
    [userId, n],
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
  const userId = getUserId(req);
  if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

  const sid = String(selloBrandId ?? '').trim();
  const fname = String(brandName ?? '').trim();
  if (!sid && !fname) return null;

  if (sid) {
    const byId = await db.query(
      `SELECT id, name FROM brands WHERE user_id = $1 AND import_brand_id = $2 LIMIT 1`,
      [userId, sid],
    );
    if (byId && byId.length > 0) {
      return { id: String(byId[0].id), name: byId[0].name ?? '' };
    }
  }
  if (fname) {
    const byName = await db.query(
      `SELECT id, name, import_brand_id FROM brands WHERE user_id = $1 AND name = $2 LIMIT 1`,
      [userId, fname],
    );
    if (byName && byName.length > 0) {
      const row = byName[0];
      if (sid && !row.import_brand_id) {
        await db.query(
          `UPDATE brands SET import_brand_id = $1 WHERE id = $2 AND user_id = $3`,
          [sid, row.id, userId],
        );
      }
      return { id: String(row.id), name: row.name ?? '' };
    }
  }
  const result = await db.query(
    `INSERT INTO brands (user_id, name, import_brand_id) VALUES ($1, $2, $3)
     RETURNING id, name`,
    [userId, fname || `Sello märke ${sid}`, sid || null],
  );
  const r = result[0];
  return { id: String(r.id), name: r.name ?? '' };
}

module.exports = {
  getAll,
  create,
  findOrCreateBrandForSello,
};
