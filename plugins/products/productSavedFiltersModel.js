// plugins/products/productSavedFiltersModel.js
// Persisted catalog filter views per tenant DB.

const { Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const catalogFilterSchema = require('./catalogFilterSchema');

function getTenantId(req) {
  return req.session?.tenantId;
}

/**
 * @param {object} def
 */
function validateDefinitionShape(def) {
  if (def == null || typeof def !== 'object' || Array.isArray(def)) {
    throw new AppError('Invalid definition', 400, AppError.CODES.VALIDATION_ERROR);
  }
  if (def.q != null && typeof def.q !== 'string') {
    throw new AppError('Invalid definition', 400, AppError.CODES.VALIDATION_ERROR);
  }
  if (def.searchIn != null && typeof def.searchIn !== 'string') {
    throw new AppError('Invalid definition', 400, AppError.CODES.VALIDATION_ERROR);
  }
  if (def.list != null && typeof def.list !== 'string') {
    throw new AppError('Invalid definition', 400, AppError.CODES.VALIDATION_ERROR);
  }
  if (def.filters != null) {
    catalogFilterSchema.parseAndNormalizeFilters(def.filters);
  }
  const s = JSON.stringify(def);
  if (s.length > 120_000) {
    throw new AppError('Definition too large', 400, AppError.CODES.VALIDATION_ERROR);
  }
}

/**
 * @param {object} req
 */
async function list(req) {
  const db = Database.get(req);
  if (!getTenantId(req)) {
    throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
  }
  const rows = await db.query(
    `SELECT id, name, definition, created_at, updated_at
     FROM product_saved_filters
     ORDER BY lower(name) ASC`,
    [],
  );
  return (rows || []).map((r) => ({
    id: String(r.id),
    name: r.name || '',
    definition: r.definition,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * @param {object} req
 * @param {string} name
 * @param {object} definition
 */
async function create(req, name, definition) {
  const db = Database.get(req);
  if (!getTenantId(req)) {
    throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
  }
  const n = String(name || '').trim();
  if (!n) {
    throw new AppError('Name is required', 400, AppError.CODES.VALIDATION_ERROR);
  }
  validateDefinitionShape(definition);
  try {
    const result = await db.query(
      `INSERT INTO product_saved_filters (name, definition)
       VALUES ($1, $2::jsonb)
       RETURNING id, name, definition, created_at, updated_at`,
      [n, JSON.stringify(definition)],
    );
    const r = result[0];
    return {
      id: String(r.id),
      name: r.name || '',
      definition: r.definition,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  } catch (e) {
    if (e && e.code === '23505') {
      throw new AppError(
        'A saved view with this name already exists',
        409,
        AppError.CODES.CONFLICT,
      );
    }
    throw e;
  }
}

/**
 * @param {object} req
 * @param {string} id
 * @param {{ name?: string, definition?: object }} updates
 */
async function update(req, id, updates) {
  const db = Database.get(req);
  if (!getTenantId(req)) {
    throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
  }
  const sid = String(id || '').trim();
  if (!/^\d+$/.test(sid)) {
    throw new AppError('Invalid id', 400, AppError.CODES.VALIDATION_ERROR);
  }
  if (updates.definition != null) {
    validateDefinitionShape(updates.definition);
  }
  if (updates.name != null) {
    const n = String(updates.name).trim();
    if (!n) {
      throw new AppError('Name is required', 400, AppError.CODES.VALIDATION_ERROR);
    }
  }
  if (updates.name == null && updates.definition == null) {
    throw new AppError('Nothing to update', 400, AppError.CODES.VALIDATION_ERROR);
  }
  const sets = [];
  const params = [];
  if (updates.name != null) {
    params.push(String(updates.name).trim());
    sets.push(`name = $${params.length}`);
  }
  if (updates.definition != null) {
    params.push(JSON.stringify(updates.definition));
    sets.push(`definition = $${params.length}::jsonb`);
  }
  sets.push('updated_at = NOW()');
  params.push(sid);
  const idIdx = params.length;
  let sql = `UPDATE product_saved_filters SET ${sets.join(', ')} WHERE id = $${idIdx}::int RETURNING id, name, definition, created_at, updated_at`;
  try {
    const result = await db.query(sql, params);
    if (!result || result.length === 0) {
      throw new AppError('Saved view not found', 404, AppError.CODES.NOT_FOUND);
    }
    const r = result[0];
    return {
      id: String(r.id),
      name: r.name || '',
      definition: r.definition,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  } catch (e) {
    if (e && e.code === '23505') {
      throw new AppError(
        'A saved view with this name already exists',
        409,
        AppError.CODES.CONFLICT,
      );
    }
    throw e;
  }
}

/**
 * @param {object} req
 * @param {string} id
 */
async function remove(req, id) {
  const db = Database.get(req);
  if (!getTenantId(req)) {
    throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
  }
  const sid = String(id || '').trim();
  if (!/^\d+$/.test(sid)) {
    throw new AppError('Invalid id', 400, AppError.CODES.VALIDATION_ERROR);
  }
  const result = await db.query(
    `DELETE FROM product_saved_filters WHERE id = $1::int RETURNING id`,
    [sid],
  );
  if (!result || result.length === 0) {
    throw new AppError('Saved view not found', 404, AppError.CODES.NOT_FOUND);
  }
  return { ok: true };
}

module.exports = {
  list,
  create,
  update,
  remove,
};
