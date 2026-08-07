// plugins/clubdesk/swishProfileModel.js
const { Database, Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const SWISH_MESSAGE_MAX_LENGTH = 50;
const SWISH_MOBILE = /^07\d{8}$/;
const SWISH_CORPORATE = /^123\d{7}$/;
const MAX_PROFILES_PER_USER = 50;

function normalizeSwishNumber(input) {
  let s = String(input ?? '').replace(/[\s-]/g, '');
  if (s.startsWith('+46')) {
    s = `0${s.slice(3)}`;
  } else if (/^46\d{9}$/.test(s)) {
    s = `0${s.slice(2)}`;
  }
  return s;
}

function isValidSwishNumber(normalized) {
  return SWISH_MOBILE.test(normalized) || SWISH_CORPORATE.test(normalized);
}

class SwishProfileModel {
  static MAX_PROFILES_PER_USER = MAX_PROFILES_PER_USER;
  static SWISH_MESSAGE_MAX_LENGTH = SWISH_MESSAGE_MAX_LENGTH;

  normalizePayee(payee) {
    const normalized = normalizeSwishNumber(payee);
    if (!normalized) {
      throw new AppError('Swish number is required', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'payee', message: 'payee is required' },
      ]);
    }
    if (!isValidSwishNumber(normalized)) {
      throw new AppError('Invalid Swish number', 400, AppError.CODES.VALIDATION_ERROR, [
        {
          field: 'payee',
          message: 'Invalid Swish number (expected 07XXXXXXXX or 123XXXXXXX)',
        },
      ]);
    }
    return normalized;
  }

  normalizeMessage(message) {
    if (message == null || message === '') return '';
    return String(message)
      .replace(/<[^>]*>/g, '')
      .replace(/;/g, ' ')
      .trim()
      .slice(0, SWISH_MESSAGE_MAX_LENGTH);
  }

  /**
   * @param {unknown} raw
   * @returns {number[]}
   */
  normalizePriceListIds(raw) {
    if (raw == null) return [];
    if (!Array.isArray(raw)) {
      throw new AppError('priceListIds must be an array', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'priceListIds', message: 'priceListIds must be an array' },
      ]);
    }
    if (raw.length > 500) {
      throw new AppError('too many priceListIds', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'priceListIds', message: 'at most 500 priceListIds' },
      ]);
    }
    const ids = [];
    const seen = new Set();
    for (const value of raw) {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isInteger(n) || n <= 0) {
        throw new AppError('Invalid priceListId', 400, AppError.CODES.VALIDATION_ERROR, [
          { field: 'priceListIds', message: 'each priceListId must be a positive integer' },
        ]);
      }
      if (seen.has(n)) continue;
      seen.add(n);
      ids.push(n);
    }
    return ids;
  }

  transformRow(row, priceListIds = []) {
    return {
      id: String(row.id),
      payee: row.payee ?? '',
      message: row.message ?? '',
      sortOrder: Number(row.sort_order) || 1,
      priceListIds: priceListIds.map((id) => String(id)),
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    };
  }

  /**
   * Raw pool when given Database.get() — junction table has no user_id, so the
   * adapter must not inject `AND user_id = $n` (same pattern as priceListModel.queryChild).
   * Transaction `tx.query` is already raw.
   */
  async queryChild(dbOrTx, sql, params) {
    if (typeof dbOrTx.getPool === 'function') {
      const result = await dbOrTx.getPool().query(sql, params);
      return result.rows;
    }
    return dbOrTx.query(sql, params);
  }

  async loadPriceListIds(dbOrTx, profileId) {
    const rows = await this.queryChild(
      dbOrTx,
      `
        SELECT price_list_id
        FROM clubdesk_swish_profile_price_lists
        WHERE profile_id = $1
        ORDER BY price_list_id ASC
      `,
      [profileId],
    );
    return rows.map((r) => Number(r.price_list_id));
  }

  async assertOwnedPriceLists(dbOrTx, userId, priceListIds) {
    if (priceListIds.length === 0) return;
    const rows = await dbOrTx.query(
      `
        SELECT id
        FROM clubdesk_price_lists
        WHERE user_id = $1 AND id = ANY($2::int[])
      `,
      [userId, priceListIds],
    );
    const found = new Set(rows.map((r) => Number(r.id)));
    const missing = priceListIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new AppError('Unknown price list', 400, AppError.CODES.VALIDATION_ERROR, [
        {
          field: 'priceListIds',
          message: `price list(s) not found or not owned: ${missing.join(', ')}`,
        },
      ]);
    }
  }

  async assertPriceListsAvailable(dbOrTx, priceListIds, excludeProfileId = null) {
    if (priceListIds.length === 0) return;
    const rows = await this.queryChild(
      dbOrTx,
      `
        SELECT price_list_id, profile_id
        FROM clubdesk_swish_profile_price_lists
        WHERE price_list_id = ANY($1::int[])
          AND ($2::int IS NULL OR profile_id <> $2)
      `,
      [priceListIds, excludeProfileId],
    );
    if (rows.length > 0) {
      const conflictIds = rows.map((r) => Number(r.price_list_id));
      throw new AppError(
        'Price list already linked to another Swish profile',
        409,
        AppError.CODES.CONFLICT,
        [
          {
            field: 'priceListIds',
            message: `price list(s) already linked: ${conflictIds.join(', ')}`,
          },
        ],
      );
    }
  }

  async replaceLinks(tx, profileId, priceListIds) {
    // tx.query is raw (no tenant inject); junction has no user_id column.
    await tx.query(`DELETE FROM clubdesk_swish_profile_price_lists WHERE profile_id = $1`, [
      profileId,
    ]);
    for (const priceListId of priceListIds) {
      await tx.query(
        `
          INSERT INTO clubdesk_swish_profile_price_lists (profile_id, price_list_id)
          VALUES ($1, $2)
        `,
        [profileId, priceListId],
      );
    }
  }

  mapUniqueViolation(error) {
    const code = error?.code || error?.details?.errorCode;
    if (code !== '23505') return null;
    const detail = String(error.detail || error?.details?.errorDetail || '');
    if (/price_list_id/i.test(detail) || /idx_clubdesk_swish_pl_price_list/i.test(detail)) {
      return new AppError(
        'Price list already linked to another Swish profile',
        409,
        AppError.CODES.CONFLICT,
        [{ field: 'priceListIds', message: 'a price list can only link to one Swish profile' }],
      );
    }
    return new AppError('Unique constraint violated', 409, AppError.CODES.CONFLICT, [
      { field: 'general', message: 'Unique constraint violated' },
    ]);
  }

  async getAll(req) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const rows = await db.query(
      `
        SELECT id, user_id, payee, message, sort_order, created_at, updated_at
        FROM clubdesk_swish_profiles
        WHERE user_id = $1
        ORDER BY sort_order ASC, id ASC
      `,
      [userId],
    );
    const result = [];
    for (const row of rows) {
      const priceListIds = await this.loadPriceListIds(db, row.id);
      result.push(this.transformRow(row, priceListIds));
    }
    return result;
  }

  async getById(req, id) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const profileId = Number(id);
    if (!Number.isInteger(profileId) || profileId <= 0) return null;
    const rows = await db.query(
      `
        SELECT id, user_id, payee, message, sort_order, created_at, updated_at
        FROM clubdesk_swish_profiles
        WHERE id = $1 AND user_id = $2
      `,
      [profileId, userId],
    );
    if (!rows[0]) return null;
    const priceListIds = await this.loadPriceListIds(db, profileId);
    return this.transformRow(rows[0], priceListIds);
  }

  async create(req, data = {}) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const payee = this.normalizePayee(data.payee);
    const message = this.normalizeMessage(data.message);
    const priceListIds = this.normalizePriceListIds(data.priceListIds);

    const countRows = await db.query(
      `SELECT COUNT(*)::int AS c FROM clubdesk_swish_profiles WHERE user_id = $1`,
      [userId],
    );
    if ((countRows[0]?.c ?? 0) >= MAX_PROFILES_PER_USER) {
      throw new AppError('Profile limit reached', 400, AppError.CODES.VALIDATION_ERROR, [
        {
          field: 'general',
          message: `at most ${MAX_PROFILES_PER_USER} Swish profiles allowed`,
        },
      ]);
    }

    await this.assertOwnedPriceLists(db, userId, priceListIds);
    await this.assertPriceListsAvailable(db, priceListIds, null);

    const sortRows = await db.query(
      `
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next
        FROM clubdesk_swish_profiles
        WHERE user_id = $1
      `,
      [userId],
    );
    const sortOrder = Number(sortRows[0]?.next) || 1;

    try {
      const created = await db.transaction(async (tx) => {
        const rows = await tx.query(
          `
            INSERT INTO clubdesk_swish_profiles (user_id, payee, message, sort_order)
            VALUES ($1, $2, $3, $4)
            RETURNING id, user_id, payee, message, sort_order, created_at, updated_at
          `,
          [userId, payee, message, sortOrder],
        );
        const row = rows[0];
        await this.replaceLinks(tx, row.id, priceListIds);
        return row;
      });
      Logger.info('Clubdesk Swish profile created', { profileId: created.id, userId });
      return this.transformRow(created, priceListIds);
    } catch (error) {
      if (error instanceof AppError) throw error;
      const mapped = this.mapUniqueViolation(error);
      if (mapped) throw mapped;
      throw error;
    }
  }

  async update(req, id, data = {}) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const profileId = Number(id);
    if (!Number.isInteger(profileId) || profileId <= 0) {
      throw new AppError('Profile not found', 404, AppError.CODES.NOT_FOUND);
    }

    const existing = await db.query(
      `
        SELECT id, user_id, payee, message, sort_order, created_at, updated_at
        FROM clubdesk_swish_profiles
        WHERE id = $1 AND user_id = $2
      `,
      [profileId, userId],
    );
    if (!existing[0]) {
      throw new AppError('Profile not found', 404, AppError.CODES.NOT_FOUND);
    }

    const payee = data.payee !== undefined ? this.normalizePayee(data.payee) : existing[0].payee;
    const message =
      data.message !== undefined
        ? this.normalizeMessage(data.message)
        : (existing[0].message ?? '');
    const priceListIds =
      data.priceListIds !== undefined
        ? this.normalizePriceListIds(data.priceListIds)
        : await this.loadPriceListIds(db, profileId);

    await this.assertOwnedPriceLists(db, userId, priceListIds);
    await this.assertPriceListsAvailable(db, priceListIds, profileId);

    try {
      const updated = await db.transaction(async (tx) => {
        const rows = await tx.query(
          `
            UPDATE clubdesk_swish_profiles
            SET payee = $1,
                message = $2,
                updated_at = NOW()
            WHERE id = $3 AND user_id = $4
            RETURNING id, user_id, payee, message, sort_order, created_at, updated_at
          `,
          [payee, message, profileId, userId],
        );
        await this.replaceLinks(tx, profileId, priceListIds);
        return rows[0];
      });
      return this.transformRow(updated, priceListIds);
    } catch (error) {
      if (error instanceof AppError) throw error;
      const mapped = this.mapUniqueViolation(error);
      if (mapped) throw mapped;
      throw error;
    }
  }

  async delete(req, id) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const profileId = Number(id);
    if (!Number.isInteger(profileId) || profileId <= 0) {
      throw new AppError('Profile not found', 404, AppError.CODES.NOT_FOUND);
    }
    const rows = await db.query(
      `
        DELETE FROM clubdesk_swish_profiles
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `,
      [profileId, userId],
    );
    if (!rows[0]) {
      throw new AppError('Profile not found', 404, AppError.CODES.NOT_FOUND);
    }
    return { id: String(rows[0].id) };
  }
}

module.exports = SwishProfileModel;
