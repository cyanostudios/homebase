// plugins/clubdesk/infoContactModel.js
const { Database, Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const BLURB_MAX_LENGTH = 500;
const MAX_INFO_CONTACTS_PER_USER = 50;

class InfoContactModel {
  static BLURB_MAX_LENGTH = BLURB_MAX_LENGTH;
  static MAX_INFO_CONTACTS_PER_USER = MAX_INFO_CONTACTS_PER_USER;

  normalizeContactId(raw) {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      throw new AppError('contactId is required', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'contactId', message: 'contactId must be a positive integer' },
      ]);
    }
    return n;
  }

  normalizeBlurb(blurb) {
    if (blurb == null || blurb === '') return '';
    return String(blurb)
      .replace(/<[^>]*>/g, '')
      .trim()
      .slice(0, BLURB_MAX_LENGTH);
  }

  contactDisplayName(row) {
    const company = String(row.company_name ?? '').trim();
    if (company) return company;
    let persons = row.contact_persons;
    if (typeof persons === 'string') {
      try {
        persons = JSON.parse(persons);
      } catch {
        persons = [];
      }
    }
    if (Array.isArray(persons) && persons.length > 0) {
      const first = persons[0] || {};
      const name = String(first.name || first.fullName || '').trim();
      if (name) return name;
    }
    return `Kontakt ${row.contact_id || row.id}`;
  }

  transformRow(row) {
    return {
      id: String(row.id),
      contactId: String(row.contact_id),
      blurb: row.blurb ?? '',
      sortOrder: Number(row.sort_order) || 1,
      contact: {
        id: String(row.contact_id),
        companyName: row.company_name ?? '',
        email: row.email ?? '',
        phone: row.phone ?? '',
        displayName: this.contactDisplayName(row),
      },
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    };
  }

  /** Public whitelist projection (no internal notes / org numbers). */
  transformPublicRow(row) {
    return {
      id: String(row.id),
      name: this.contactDisplayName(row),
      phone: String(row.phone ?? '').trim() || null,
      email: String(row.email ?? '').trim() || null,
      blurb: String(row.blurb ?? '').trim() || null,
    };
  }

  async assertOwnedContact(db, userId, contactId) {
    const rows = await db.query(
      `
        SELECT id
        FROM contacts
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      `,
      [contactId, userId],
    );
    if (!rows.length) {
      throw new AppError('Contact not found', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'contactId', message: 'contact not found or not owned' },
      ]);
    }
  }

  mapUniqueViolation(error) {
    const code = error?.code || error?.details?.errorCode;
    if (code !== '23505') return null;
    return new AppError('Contact already on Info list', 409, AppError.CODES.CONFLICT, [
      { field: 'contactId', message: 'this contact is already on the Info list' },
    ]);
  }

  listSelectSql() {
    return `
      SELECT
        ic.id,
        ic.user_id,
        ic.contact_id,
        ic.blurb,
        ic.sort_order,
        ic.created_at,
        ic.updated_at,
        c.company_name,
        c.email,
        c.phone,
        c.contact_persons
      FROM clubdesk_info_contacts ic
      INNER JOIN contacts c ON c.id = ic.contact_id
    `;
  }

  async getAll(req) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const rows = await db.query(
      `
        ${this.listSelectSql()}
        WHERE ic.user_id = $1
        ORDER BY ic.sort_order ASC, ic.id ASC
      `,
      [userId],
    );
    return rows.map((row) => this.transformRow(row));
  }

  async getById(req, id) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const rowId = Number(id);
    if (!Number.isInteger(rowId) || rowId <= 0) return null;
    const rows = await db.query(
      `
        ${this.listSelectSql()}
        WHERE ic.id = $1 AND ic.user_id = $2
      `,
      [rowId, userId],
    );
    if (!rows[0]) return null;
    return this.transformRow(rows[0]);
  }

  async create(req, data = {}) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const contactId = this.normalizeContactId(data.contactId ?? data.contact_id);
    const blurb = this.normalizeBlurb(data.blurb);

    const countRows = await db.query(
      `SELECT COUNT(*)::int AS c FROM clubdesk_info_contacts WHERE user_id = $1`,
      [userId],
    );
    if ((countRows[0]?.c ?? 0) >= MAX_INFO_CONTACTS_PER_USER) {
      throw new AppError('Contact list limit reached', 400, AppError.CODES.VALIDATION_ERROR, [
        {
          field: 'general',
          message: `at most ${MAX_INFO_CONTACTS_PER_USER} Info contacts allowed`,
        },
      ]);
    }

    await this.assertOwnedContact(db, userId, contactId);

    const sortRows = await db.query(
      `
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next
        FROM clubdesk_info_contacts
        WHERE user_id = $1
      `,
      [userId],
    );
    const sortOrder = Number(sortRows[0]?.next) || 1;

    try {
      const rows = await db.query(
        `
          INSERT INTO clubdesk_info_contacts (user_id, contact_id, blurb, sort_order)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [userId, contactId, blurb, sortOrder],
      );
      const created = await this.getById(req, rows[0].id);
      Logger.info('Clubdesk Info contact created', { id: rows[0].id, userId, contactId });
      return created;
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
    const rowId = Number(id);
    if (!Number.isInteger(rowId) || rowId <= 0) {
      throw new AppError('Info contact not found', 404, AppError.CODES.NOT_FOUND);
    }

    const existing = await db.query(
      `SELECT id, contact_id FROM clubdesk_info_contacts WHERE id = $1 AND user_id = $2`,
      [rowId, userId],
    );
    if (!existing[0]) {
      throw new AppError('Info contact not found', 404, AppError.CODES.NOT_FOUND);
    }

    const nextContactId =
      data.contactId !== undefined || data.contact_id !== undefined
        ? this.normalizeContactId(data.contactId ?? data.contact_id)
        : Number(existing[0].contact_id);
    const nextBlurb = data.blurb !== undefined ? this.normalizeBlurb(data.blurb) : undefined;

    if (nextContactId !== Number(existing[0].contact_id)) {
      await this.assertOwnedContact(db, userId, nextContactId);
    }

    try {
      if (nextBlurb !== undefined) {
        await db.query(
          `
            UPDATE clubdesk_info_contacts
            SET contact_id = $1,
                blurb = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND user_id = $4
          `,
          [nextContactId, nextBlurb, rowId, userId],
        );
      } else {
        await db.query(
          `
            UPDATE clubdesk_info_contacts
            SET contact_id = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3
          `,
          [nextContactId, rowId, userId],
        );
      }
      const updated = await this.getById(req, rowId);
      Logger.info('Clubdesk Info contact updated', { id: rowId, userId });
      return updated;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const mapped = this.mapUniqueViolation(error);
      if (mapped) throw mapped;
      throw error;
    }
  }

  async remove(req, id) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const rowId = Number(id);
    if (!Number.isInteger(rowId) || rowId <= 0) {
      throw new AppError('Info contact not found', 404, AppError.CODES.NOT_FOUND);
    }
    const rows = await db.query(
      `
        DELETE FROM clubdesk_info_contacts
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `,
      [rowId, userId],
    );
    if (!rows[0]) {
      throw new AppError('Info contact not found', 404, AppError.CODES.NOT_FOUND);
    }
    Logger.info('Clubdesk Info contact deleted', { id: rowId, userId });
    return { id: String(rows[0].id) };
  }

  async reorder(req, orderedIds) {
    const db = Database.get(req);
    const userId = db.getUserId();
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new AppError('orderedIds is required', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'orderedIds', message: 'orderedIds must be a non-empty array' },
      ]);
    }
    const ids = orderedIds.map((id) => Number(id));
    if (ids.some((n) => !Number.isInteger(n) || n <= 0)) {
      throw new AppError('Invalid orderedIds', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'orderedIds', message: 'each id must be a positive integer' },
      ]);
    }

    await db.transaction(async (tx) => {
      const existing = await tx.query(`SELECT id FROM clubdesk_info_contacts WHERE user_id = $1`, [
        userId,
      ]);
      const existingSet = new Set(existing.map((r) => Number(r.id)));
      if (ids.length !== existingSet.size || ids.some((id) => !existingSet.has(id))) {
        throw new AppError(
          'orderedIds must match existing rows',
          400,
          AppError.CODES.VALIDATION_ERROR,
          [
            {
              field: 'orderedIds',
              message: 'orderedIds must include every Info contact exactly once',
            },
          ],
        );
      }
      for (let i = 0; i < ids.length; i += 1) {
        await tx.query(
          `
            UPDATE clubdesk_info_contacts
            SET sort_order = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3
          `,
          [i + 1, ids[i], userId],
        );
      }
    });

    return this.getAll(req);
  }
}

module.exports = InfoContactModel;
