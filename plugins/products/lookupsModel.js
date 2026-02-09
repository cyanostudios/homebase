// plugins/products/lookupsModel.js
// Brands, suppliers, manufacturers lookup tables

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

function getUserId(req) {
  return req.session?.user?.id || req.session?.user?.uuid;
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

module.exports = {
  getAll,
  create,
};
