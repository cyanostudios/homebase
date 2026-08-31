// plugins/garments/model.js
const crypto = require('crypto');
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const {
  registerPublicShareRoute,
  unregisterPublicShareRoute,
  RESOURCE_GARMENT_LIST,
  resolvePublicShareTenantFromToken,
} = require('../../server/core/services/publicShareRouting');
const {
  resolveTenantConnectionStringForShare,
} = require('../../server/core/utils/shareRoutingHelper');

function parseJsonb(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeCheckboxColumns(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((col, index) => {
      if (!col || typeof col !== 'object') return null;
      const id = String(col.id || '').trim();
      const label = String(col.label || '').trim();
      if (!id || !label) return null;
      const sortOrder =
        typeof col.sort_order === 'number'
          ? col.sort_order
          : typeof col.sortOrder === 'number'
            ? col.sortOrder
            : index;
      const groupRaw = col.group != null ? String(col.group).trim() : '';
      const normalized = { id, label, sortOrder };
      if (groupRaw) {
        normalized.group = groupRaw;
      }
      return normalized;
    })
    .filter(Boolean);
}

function normalizeCheckboxValues(raw, allowedIds) {
  const src = parseJsonb(raw, {});
  if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
  const out = {};
  for (const id of allowedIds) {
    if (Object.prototype.hasOwnProperty.call(src, id)) {
      out[id] = Boolean(src[id]);
    }
  }
  return out;
}

function parseCtSizes(raw) {
  const src = parseJsonb(raw, {});
  if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
  const out = {};
  for (const [key, value] of Object.entries(src)) {
    if (typeof value === 'string') {
      out[String(key)] = value;
    }
  }
  return out;
}

function parseCtAudiences(raw) {
  const src = parseJsonb(raw, {});
  if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
  const out = {};
  for (const [key, value] of Object.entries(src)) {
    if (typeof value === 'string') {
      out[String(key)] = value;
    }
  }
  return out;
}

const INVENTORY_CHECKBOX_STATUSES = [
  { suffix: 'ordered', label: 'Ordered' },
  { suffix: 'delivered', label: 'Delivered' },
  { suffix: 'handed_out', label: 'Handed out' },
];

function inventoryCheckboxPrefix(itemId) {
  return `inv_${itemId}_`;
}

function buildInventoryCheckboxColumns(itemId, articleName, startSortOrder) {
  return INVENTORY_CHECKBOX_STATUSES.map((status, index) => ({
    id: `inv_${itemId}_${status.suffix}`,
    label: status.label,
    group: articleName,
    sortOrder: startSortOrder + index,
  }));
}

function inventoryColumnIdsForItem(itemId) {
  return INVENTORY_CHECKBOX_STATUSES.map((status) => `inv_${itemId}_${status.suffix}`);
}

/**
 * Column ids accepted on person checkbox_values: list checkbox_columns plus
 * inv_* ids for currently assigned inventory (client may synthesize those when
 * join rows exist but checkbox_columns were never updated).
 */
async function resolveAllowedCheckboxIds(pool, listId, checkboxColumns) {
  const ids = new Set(
    (checkboxColumns || []).map((col) => col.id).filter((id) => typeof id === 'string' && id),
  );
  const lid = parseInt(String(listId), 10);
  if (Number.isNaN(lid)) {
    return Array.from(ids);
  }
  const assigned = await pool.query(
    `SELECT item_id FROM garment_list_inventory_items WHERE list_id = $1`,
    [lid],
  );
  for (const row of assigned.rows) {
    for (const colId of inventoryColumnIdsForItem(row.item_id)) {
      ids.add(colId);
    }
  }
  return Array.from(ids);
}

function parseOptionalContactId(data) {
  const raw = data?.contactId ?? data?.contact_id;
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalTeamId(data) {
  const raw = data?.teamId ?? data?.team_id;
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

class GarmentsModel {
  generateShareToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /** Raw tenant pool — use for child tables without user_id (persons, shares). */
  _pool(req) {
    if (!req?.tenantPool) {
      throw new Error('Tenant pool not found in request. Ensure auth middleware is applied.');
    }
    return req.tenantPool;
  }

  // ─── Lists ───────────────────────────────────────────────────────────────

  async getLists(req, { teamId } = {}) {
    try {
      const db = Database.get(req);
      const params = [];
      // Include user_id so Database adapter does not re-append a tenant filter
      // that would break the person_count subquery.
      let sql = `
        SELECT
          gl.*,
          (SELECT COUNT(*)::int FROM garment_list_persons p WHERE p.list_id = gl.id) AS person_count
        FROM garment_lists gl
        WHERE gl.user_id = $1
      `;
      params.push(db.getUserId());
      if (teamId != null && teamId !== '') {
        params.push(parseInt(String(teamId), 10));
        sql += ` AND gl.team_id = $${params.length}`;
      }
      sql += ` ORDER BY gl.updated_at DESC`;
      const rows = await db.query(sql, params);
      const lists = rows.map((row) => this.transformListRow(row));
      return this.enrichListsWithInventoryAssignments(req, lists);
    } catch (error) {
      Logger.error('Failed to fetch garment lists', error);
      throw new AppError('Failed to fetch lists', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /** Distinct garment lists that include a person row linked to the given contact. */
  async getListsForContact(req, contactId) {
    try {
      const db = Database.get(req);
      const cid = parseInt(String(contactId), 10);
      if (Number.isNaN(cid)) {
        return [];
      }
      const rows = await db.query(
        `
        SELECT
          gl.*,
          (SELECT COUNT(*)::int FROM garment_list_persons p WHERE p.list_id = gl.id) AS person_count
        FROM garment_lists gl
        WHERE gl.user_id = $1
          AND EXISTS (
            SELECT 1
            FROM garment_list_persons glp
            WHERE glp.list_id = gl.id AND glp.contact_id = $2
          )
        ORDER BY gl.updated_at DESC
        `,
        [db.getUserId(), cid],
      );
      const lists = rows.map((row) => this.transformListRow(row));
      return this.enrichListsWithInventoryAssignments(req, lists);
    } catch (error) {
      Logger.error('Failed to fetch garment lists for contact', error, { contactId });
      throw new AppError('Failed to fetch lists', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getListById(req, listId, { includePersons = true } = {}) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(listId), 10);
      if (Number.isNaN(id)) return null;
      const userId = db.getUserId();
      const rows = await db.query(
        `
        SELECT
          gl.*,
          (SELECT COUNT(*)::int FROM garment_list_persons p WHERE p.list_id = gl.id) AS person_count
        FROM garment_lists gl
        WHERE gl.id = $1 AND gl.user_id = $2
        `,
        [id, userId],
      );
      if (!rows.length) return null;
      const list = this.transformListRow(rows[0]);
      const [enriched] = await this.enrichListsWithInventoryAssignments(req, [list]);
      const healed = await this.ensureAssignedInventoryCheckboxColumns(req, enriched);
      if (includePersons) {
        healed.persons = await this.getPersonsForList(req, id);
      }
      return healed;
    } catch (error) {
      Logger.error('Failed to get garment list', error, { listId });
      throw new AppError('Failed to get list', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Persist inv_* checkbox columns when join rows exist but columns were never written
   * (e.g. legacy assign / migration). Keeps server allow-list in sync with the matrix UI.
   */
  async ensureAssignedInventoryCheckboxColumns(req, list) {
    const assignedIds = (list.assignedInventoryItemIds || [])
      .map((id) => parseInt(String(id), 10))
      .filter((id) => !Number.isNaN(id));
    if (!assignedIds.length) {
      return list;
    }

    const existingIds = new Set(list.checkboxColumns.map((col) => col.id));
    const missingItemIds = assignedIds.filter((itemId) =>
      inventoryColumnIdsForItem(itemId).some((colId) => !existingIds.has(colId)),
    );
    if (!missingItemIds.length) {
      return list;
    }

    let checkboxColumns = [...list.checkboxColumns];
    let maxColSort = checkboxColumns.reduce((max, col) => Math.max(max, col.sortOrder ?? 0), -1);

    for (const itemId of missingItemIds) {
      const inventory = await this.getInventoryById(req, itemId);
      const articleName = inventory?.articleName?.trim() || `Item ${itemId}`;
      const newColumns = buildInventoryCheckboxColumns(itemId, articleName, maxColSort + 1).filter(
        (col) => !existingIds.has(col.id),
      );
      if (!newColumns.length) {
        continue;
      }
      checkboxColumns = [...checkboxColumns, ...newColumns];
      newColumns.forEach((col) => existingIds.add(col.id));
      maxColSort += newColumns.length;
    }

    if (checkboxColumns.length === list.checkboxColumns.length) {
      return list;
    }

    const pool = this._pool(req);
    const lid = parseInt(String(list.id), 10);
    await pool.query(
      `
      UPDATE garment_lists
      SET checkbox_columns = $1::jsonb, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [JSON.stringify(checkboxColumns), lid],
    );

    return { ...list, checkboxColumns };
  }

  async createList(req, data) {
    try {
      const db = Database.get(req);
      const checkboxColumns = normalizeCheckboxColumns(
        data.checkboxColumns ?? data.checkbox_columns,
      );
      const teamId =
        data.teamId != null && data.teamId !== ''
          ? parseInt(String(data.teamId), 10)
          : data.team_id != null && data.team_id !== ''
            ? parseInt(String(data.team_id), 10)
            : null;

      const record = await db.insert('garment_lists', {
        name: String(data.name || '').trim(),
        team_id: Number.isFinite(teamId) ? teamId : null,
        checkbox_columns: JSON.stringify(checkboxColumns),
      });
      Logger.info('Garment list created', { listId: record.id });
      return this.getListById(req, record.id);
    } catch (error) {
      Logger.error('Failed to create garment list', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create list', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateList(req, listId, data) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(listId), 10);
      const existing = await this.getListById(req, id, { includePersons: false });
      if (!existing) {
        throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
      }

      const name = data.name !== undefined ? String(data.name || '').trim() : existing.name;
      const teamId =
        data.teamId !== undefined
          ? data.teamId == null || data.teamId === ''
            ? null
            : parseInt(String(data.teamId), 10)
          : data.team_id !== undefined
            ? data.team_id == null || data.team_id === ''
              ? null
              : parseInt(String(data.team_id), 10)
            : existing.teamId
              ? parseInt(String(existing.teamId), 10)
              : null;

      let checkboxColumns = existing.checkboxColumns;
      if (data.checkboxColumns !== undefined || data.checkbox_columns !== undefined) {
        checkboxColumns = normalizeCheckboxColumns(data.checkboxColumns ?? data.checkbox_columns);
      }

      const prevIds = new Set(existing.checkboxColumns.map((c) => c.id));
      const nextIds = new Set(checkboxColumns.map((c) => c.id));
      const removedIds = [...prevIds].filter((cid) => !nextIds.has(cid));

      const pool = req.tenantPool;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `
          UPDATE garment_lists
          SET name = $1, team_id = $2, checkbox_columns = $3::jsonb, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          `,
          [name, Number.isFinite(teamId) ? teamId : null, JSON.stringify(checkboxColumns), id],
        );

        if (removedIds.length) {
          const persons = await client.query(
            `SELECT id, checkbox_values FROM garment_list_persons WHERE list_id = $1`,
            [id],
          );
          for (const person of persons.rows) {
            const values = parseJsonb(person.checkbox_values, {});
            let changed = false;
            for (const rid of removedIds) {
              if (Object.prototype.hasOwnProperty.call(values, rid)) {
                delete values[rid];
                changed = true;
              }
            }
            if (changed) {
              await client.query(
                `UPDATE garment_list_persons SET checkbox_values = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [JSON.stringify(values), person.id],
              );
            }
          }
        }
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      Logger.info('Garment list updated', { listId: id });
      return this.getListById(req, id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update garment list', error, { listId });
      throw new AppError('Failed to update list', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteList(req, listId) {
    try {
      const pool = this._pool(req);
      const db = Database.get(req);
      const id = parseInt(String(listId), 10);
      const existing = await this.getListById(req, id, { includePersons: false });
      if (!existing) {
        throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
      }
      const shares = await pool.query(
        `SELECT share_token FROM garment_list_shares WHERE list_id = $1`,
        [id],
      );
      for (const row of shares.rows) {
        try {
          await unregisterPublicShareRoute(row.share_token);
        } catch (err) {
          Logger.warn('Failed to unregister garment list share route', {
            listId: id,
            error: err?.message,
          });
        }
      }
      const userId = db.getUserId();
      const rows = await db.query(
        `DELETE FROM garment_lists WHERE id = $1 AND user_id = $2 RETURNING id`,
        [id, userId],
      );
      if (!rows.length) {
        throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
      }
      Logger.info('Garment list deleted', { listId: id });
      return { id: String(id) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete garment list', error, { listId });
      throw new AppError('Failed to delete list', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ─── Persons ─────────────────────────────────────────────────────────────

  async getPersonsForList(req, listId) {
    const pool = this._pool(req);
    const id = parseInt(String(listId), 10);
    const listResult = await pool.query(
      `SELECT checkbox_columns FROM garment_lists WHERE id = $1`,
      [id],
    );
    const checkboxColumns = normalizeCheckboxColumns(
      parseJsonb(listResult.rows[0]?.checkbox_columns, []),
    );
    const allowedIds = await resolveAllowedCheckboxIds(pool, id, checkboxColumns);
    const result = await pool.query(
      `
      SELECT * FROM garment_list_persons
      WHERE list_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [id],
    );
    return result.rows.map((row) => this.transformPersonRow(row, allowedIds));
  }

  async createPerson(req, listId, data) {
    try {
      const pool = this._pool(req);
      const id = parseInt(String(listId), 10);
      const list = await this.getListById(req, id, { includePersons: false });
      if (!list) {
        throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
      }
      const allowedIds = await resolveAllowedCheckboxIds(pool, id, list.checkboxColumns);
      const checkboxValues = normalizeCheckboxValues(
        data.checkboxValues ?? data.checkbox_values ?? {},
        allowedIds,
      );
      const maxOrder = await pool.query(
        `SELECT COALESCE(MAX(sort_order), -1) AS m FROM garment_list_persons WHERE list_id = $1`,
        [id],
      );
      const sortOrder =
        data.sortOrder != null
          ? parseInt(String(data.sortOrder), 10)
          : (maxOrder.rows[0]?.m ?? -1) + 1;
      const contactId = parseOptionalContactId(data);
      const teamId = parseOptionalTeamId(data);

      const record = await pool.query(
        `
        INSERT INTO garment_list_persons (
          list_id, name, shirt_size, shorts_size, socks_size, jersey_number,
          jersey_name, initials, comment, checkbox_values, sort_order, contact_id, team_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13)
        RETURNING *
        `,
        [
          id,
          String(data.name || '').trim(),
          data.shirtSize ?? data.shirt_size ?? null,
          data.shortsSize ?? data.shorts_size ?? null,
          data.socksSize ?? data.socks_size ?? null,
          data.jerseyNumber ?? data.jersey_number ?? null,
          data.jerseyName ?? data.jersey_name ?? null,
          data.initials ?? null,
          data.comment ?? null,
          JSON.stringify(checkboxValues),
          sortOrder,
          contactId,
          teamId,
        ],
      );
      await pool.query(`UPDATE garment_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
        id,
      ]);
      return this.transformPersonRow(record.rows[0], allowedIds);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create garment list person', error, { listId });
      throw new AppError('Failed to create person', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updatePerson(req, listId, personId, data) {
    try {
      const pool = this._pool(req);
      const lid = parseInt(String(listId), 10);
      const pid = parseInt(String(personId), 10);
      const list = await this.getListById(req, lid, { includePersons: false });
      if (!list) {
        throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
      }
      const allowedIds = await resolveAllowedCheckboxIds(pool, lid, list.checkboxColumns);
      const existingResult = await pool.query(
        `SELECT * FROM garment_list_persons WHERE id = $1 AND list_id = $2`,
        [pid, lid],
      );
      if (!existingResult.rows.length) {
        throw new AppError('Person not found', 404, AppError.CODES.NOT_FOUND);
      }
      const existing = existingResult.rows[0];
      const checkboxValues =
        data.checkboxValues !== undefined || data.checkbox_values !== undefined
          ? normalizeCheckboxValues(data.checkboxValues ?? data.checkbox_values, allowedIds)
          : normalizeCheckboxValues(existing.checkbox_values, allowedIds);

      const contactId =
        data.contactId !== undefined || data.contact_id !== undefined
          ? parseOptionalContactId(data)
          : existing.contact_id != null
            ? Number(existing.contact_id)
            : null;

      const teamId =
        data.teamId !== undefined || data.team_id !== undefined
          ? parseOptionalTeamId(data)
          : existing.team_id != null
            ? Number(existing.team_id)
            : null;

      const rows = await pool.query(
        `
        UPDATE garment_list_persons SET
          name = $1,
          shirt_size = $2,
          shorts_size = $3,
          socks_size = $4,
          jersey_number = $5,
          jersey_name = $6,
          initials = $7,
          comment = $8,
          checkbox_values = $9::jsonb,
          sort_order = $10,
          contact_id = $11,
          team_id = $12,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $13 AND list_id = $14
        RETURNING *
        `,
        [
          data.name !== undefined ? String(data.name || '').trim() : existing.name,
          data.shirtSize !== undefined
            ? data.shirtSize
            : data.shirt_size !== undefined
              ? data.shirt_size
              : existing.shirt_size,
          data.shortsSize !== undefined
            ? data.shortsSize
            : data.shorts_size !== undefined
              ? data.shorts_size
              : existing.shorts_size,
          data.socksSize !== undefined
            ? data.socksSize
            : data.socks_size !== undefined
              ? data.socks_size
              : existing.socks_size,
          data.jerseyNumber !== undefined
            ? data.jerseyNumber
            : data.jersey_number !== undefined
              ? data.jersey_number
              : existing.jersey_number,
          data.jerseyName !== undefined
            ? data.jerseyName
            : data.jersey_name !== undefined
              ? data.jersey_name
              : existing.jersey_name,
          data.initials !== undefined ? data.initials : existing.initials,
          data.comment !== undefined ? data.comment : existing.comment,
          JSON.stringify(checkboxValues),
          data.sortOrder !== undefined
            ? parseInt(String(data.sortOrder), 10)
            : data.sort_order !== undefined
              ? parseInt(String(data.sort_order), 10)
              : existing.sort_order,
          contactId,
          teamId,
          pid,
          lid,
        ],
      );
      await pool.query(`UPDATE garment_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
        lid,
      ]);
      return this.transformPersonRow(rows.rows[0], allowedIds);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update garment list person', error, { listId, personId });
      throw new AppError('Failed to update person', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deletePerson(req, listId, personId) {
    try {
      const pool = this._pool(req);
      const lid = parseInt(String(listId), 10);
      const pid = parseInt(String(personId), 10);
      const rows = await pool.query(
        `DELETE FROM garment_list_persons WHERE id = $1 AND list_id = $2 RETURNING id`,
        [pid, lid],
      );
      if (!rows.rows.length) {
        throw new AppError('Person not found', 404, AppError.CODES.NOT_FOUND);
      }
      await pool.query(`UPDATE garment_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
        lid,
      ]);
      return { id: String(pid) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete garment list person', error, { listId, personId });
      throw new AppError('Failed to delete person', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ─── Shares ──────────────────────────────────────────────────────────────

  async createShare(req, listId, validUntil) {
    try {
      const pool = req.tenantPool;
      const id = parseInt(String(listId), 10);
      const list = await this.getListById(req, id, { includePersons: false });
      if (!list) {
        throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
      }

      const shareToken = this.generateShareToken();
      const result = await pool.query(
        `
        INSERT INTO garment_list_shares (list_id, share_token, valid_until)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [id, shareToken, validUntil],
      );
      const shareId = result.rows[0].id;
      const createdToken = result.rows[0].share_token;
      const tenantConnectionString = await resolveTenantConnectionStringForShare(req);
      if (!tenantConnectionString) {
        await pool.query('DELETE FROM garment_list_shares WHERE id = $1', [shareId]);
        throw new AppError(
          'Failed to register public share link (no tenant connection)',
          500,
          AppError.CODES.INTERNAL_ERROR,
        );
      }
      try {
        await registerPublicShareRoute(createdToken, RESOURCE_GARMENT_LIST, tenantConnectionString);
      } catch (routeErr) {
        Logger.error('public_share_routing register failed', routeErr, {
          listId: id,
          tokenPrefix: createdToken.substring(0, 8),
        });
        await pool.query('DELETE FROM garment_list_shares WHERE id = $1', [shareId]);
        throw new AppError(
          'Failed to register public share link',
          500,
          AppError.CODES.DATABASE_ERROR,
        );
      }

      return this.transformShareRow(result.rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create garment list share', error, { listId });
      throw new AppError('Failed to create share', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getSharesForList(req, listId) {
    try {
      const pool = this._pool(req);
      const id = parseInt(String(listId), 10);
      const list = await this.getListById(req, id, { includePersons: false });
      if (!list) {
        throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
      }
      const result = await pool.query(
        `SELECT * FROM garment_list_shares WHERE list_id = $1 ORDER BY created_at DESC`,
        [id],
      );
      return result.rows.map((row) => this.transformShareRow(row));
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to get garment list shares', error, { listId });
      throw new AppError('Failed to get shares', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async revokeShare(req, shareId) {
    try {
      const pool = req.tenantPool;
      const id = parseInt(String(shareId), 10);
      const result = await pool.query(`DELETE FROM garment_list_shares WHERE id = $1 RETURNING *`, [
        id,
      ]);
      if (!result.rows.length) {
        throw new AppError('Share not found', 404, AppError.CODES.NOT_FOUND);
      }
      try {
        await unregisterPublicShareRoute(result.rows[0].share_token);
      } catch (err) {
        Logger.warn('Failed to unregister garment list share route on revoke', {
          shareId: id,
          error: err?.message,
        });
      }
      return this.transformShareRow(result.rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to revoke garment list share', error, { shareId });
      throw new AppError('Failed to revoke share', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getListByShareToken(req, shareToken) {
    try {
      await resolvePublicShareTenantFromToken(req, RESOURCE_GARMENT_LIST, shareToken);
      if (!req.tenantPool) return null;
      const pool = req.tenantPool;

      const result = await pool.query(
        `
        SELECT
          gl.*,
          gs.accessed_count,
          gs.valid_until AS share_valid_until
        FROM garment_lists gl
        JOIN garment_list_shares gs ON gl.id = gs.list_id
        WHERE gs.share_token = $1 AND gs.valid_until > NOW()
        `,
        [shareToken],
      );
      if (!result.rows.length) return null;

      const row = result.rows[0];
      await pool.query(
        `
        UPDATE garment_list_shares
        SET accessed_count = accessed_count + 1, last_accessed_at = NOW()
        WHERE share_token = $1
        `,
        [shareToken],
      );

      const list = this.transformListRow(row);
      const [enriched] = await this.enrichListsWithInventoryAssignments(req, [list]);
      const healed = await this.ensureAssignedInventoryCheckboxColumns(req, enriched);
      healed.persons = await this.getPersonsForList(req, healed.id);
      // Public: strip comments (PII)
      healed.persons = healed.persons.map((p) => ({ ...p, comment: null }));
      healed.shareValidUntil = row.share_valid_until;
      healed.accessedCount = (row.accessed_count || 0) + 1;
      return healed;
    } catch (error) {
      Logger.error('Failed to get garment list by share token', error, {
        shareToken: String(shareToken || '').substring(0, 10),
      });
      throw new AppError('Failed to get list by share token', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ─── Inventory ───────────────────────────────────────────────────────────

  async getInventory(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `SELECT * FROM garment_inventory_items ORDER BY article_name ASC, brand ASC`,
        [],
      );
      const items = rows.map((row) => this.transformInventoryRow(row));
      if (!items.length) return items;

      const pool = this._pool(req);
      const ids = items.map((item) => parseInt(item.id, 10));
      const variantResult = await pool.query(
        `
        SELECT * FROM garment_inventory_variants
        WHERE item_id = ANY($1::int[])
        ORDER BY sort_order ASC, id ASC
        `,
        [ids],
      );
      const byItem = new Map();
      for (const row of variantResult.rows) {
        const key = String(row.item_id);
        if (!byItem.has(key)) byItem.set(key, []);
        byItem.get(key).push(this.transformVariantRow(row));
      }
      const assignmentsByItem = await this.loadAssignedListsByItemIds(pool, ids);
      return items.map((item) => {
        const enriched = this.attachVariants(item, byItem.get(item.id) || []);
        enriched.assignedListIds = assignmentsByItem.get(item.id) ?? [];
        return enriched;
      });
    } catch (error) {
      Logger.error('Failed to fetch garment inventory', error);
      throw new AppError('Failed to fetch inventory', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getInventoryById(req, itemId) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(itemId), 10);
      if (Number.isNaN(id)) return null;
      const rows = await db.query(`SELECT * FROM garment_inventory_items WHERE id = $1`, [id]);
      if (!rows.length) return null;
      const item = this.transformInventoryRow(rows[0]);
      const variants = await this.getVariantsForItem(req, id);
      return this.enrichInventoryWithAssignments(req, this.attachVariants(item, variants));
    } catch (error) {
      Logger.error('Failed to get inventory item', error, { itemId });
      throw new AppError('Failed to get inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getVariantsForItem(req, itemId) {
    const pool = this._pool(req);
    const id = parseInt(String(itemId), 10);
    const result = await pool.query(
      `
      SELECT * FROM garment_inventory_variants
      WHERE item_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [id],
    );
    return result.rows.map((row) => this.transformVariantRow(row));
  }

  normalizePurchasePrice(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    if (Number.isNaN(num) || num < 0) return null;
    return Math.round(num * 100) / 100;
  }

  normalizeCurrency(value) {
    const code = String(value ?? 'SEK')
      .trim()
      .toUpperCase();
    if (!code || code.length > 10) return 'SEK';
    return code;
  }

  normalizeVariantInput(data, sortOrderFallback = 0) {
    return {
      sku: String(data.sku ?? '').trim(),
      audience: String(data.audience ?? '').trim(),
      color: String(data.color ?? '').trim(),
      size: String(data.size ?? '').trim(),
      quantity: Math.max(0, parseInt(String(data.quantity ?? 0), 10) || 0),
      sortOrder:
        data.sortOrder != null || data.sort_order != null
          ? parseInt(String(data.sortOrder ?? data.sort_order), 10) || 0
          : sortOrderFallback,
    };
  }

  async createInventoryItem(req, data) {
    try {
      const db = Database.get(req);
      const description =
        data.description !== undefined ? String(data.description ?? '').trim() || null : null;
      const comment = data.comment !== undefined ? String(data.comment ?? '').trim() || null : null;
      const record = await db.insert('garment_inventory_items', {
        article_name: String(data.articleName ?? data.article_name ?? '').trim(),
        brand: String(data.brand ?? '').trim(),
        description,
        material: String(data.material ?? '').trim(),
        purchase_price: this.normalizePurchasePrice(data.purchasePrice ?? data.purchase_price),
        recommended_price: this.normalizePurchasePrice(
          data.recommendedPrice ?? data.recommended_price,
        ),
        sale_price: this.normalizePurchasePrice(data.salePrice ?? data.sale_price),
        currency: this.normalizeCurrency(data.currency),
        comment,
      });
      const itemId = record.id;
      if (Array.isArray(data.variants)) {
        await this.syncInventoryVariants(req, itemId, data.variants);
      }
      return this.getInventoryById(req, itemId);
    } catch (error) {
      if (error?.code === '23505') throw error;
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create inventory item', error);
      throw new AppError('Failed to create inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateInventoryItem(req, itemId, data) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(itemId), 10);
      const existing = await this.getInventoryById(req, id);
      if (!existing) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }

      const nextArticleName =
        data.articleName !== undefined || data.article_name !== undefined
          ? String(data.articleName ?? data.article_name ?? '').trim()
          : existing.articleName;
      const nextBrand = data.brand !== undefined ? String(data.brand ?? '').trim() : existing.brand;
      const nextDescription =
        data.description !== undefined
          ? String(data.description ?? '').trim() || null
          : existing.description;
      const nextMaterial =
        data.material !== undefined ? String(data.material ?? '').trim() : existing.material;
      const nextPurchasePrice =
        data.purchasePrice !== undefined || data.purchase_price !== undefined
          ? this.normalizePurchasePrice(data.purchasePrice ?? data.purchase_price)
          : existing.purchasePrice;
      const nextRecommendedPrice =
        data.recommendedPrice !== undefined || data.recommended_price !== undefined
          ? this.normalizePurchasePrice(data.recommendedPrice ?? data.recommended_price)
          : existing.recommendedPrice;
      const nextSalePrice =
        data.salePrice !== undefined || data.sale_price !== undefined
          ? this.normalizePurchasePrice(data.salePrice ?? data.sale_price)
          : existing.salePrice;
      const nextCurrency =
        data.currency !== undefined
          ? this.normalizeCurrency(data.currency)
          : existing.currency || 'SEK';
      const nextComment =
        data.comment !== undefined ? String(data.comment ?? '').trim() || null : existing.comment;

      await db.query(
        `
        UPDATE garment_inventory_items SET
          article_name = $1,
          brand = $2,
          description = $3,
          material = $4,
          purchase_price = $5,
          recommended_price = $6,
          sale_price = $7,
          currency = $8,
          comment = $9,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $10
        RETURNING *
        `,
        [
          nextArticleName,
          nextBrand,
          nextDescription,
          nextMaterial,
          nextPurchasePrice,
          nextRecommendedPrice,
          nextSalePrice,
          nextCurrency,
          nextComment,
          id,
        ],
      );

      if (Array.isArray(data.variants)) {
        await this.syncInventoryVariants(req, id, data.variants);
      }

      return this.getInventoryById(req, id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error?.code === '23505') throw error;
      Logger.error('Failed to update inventory item', error, { itemId });
      throw new AppError('Failed to update inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async syncInventoryVariants(req, itemId, variantsInput) {
    const pool = this._pool(req);
    const id = parseInt(String(itemId), 10);
    const normalized = (Array.isArray(variantsInput) ? variantsInput : []).map((row, index) => {
      const base = this.normalizeVariantInput(row, index);
      const rowId =
        row.id != null && String(row.id).trim() !== '' ? parseInt(String(row.id), 10) : null;
      return {
        id: Number.isNaN(rowId) ? null : rowId,
        ...base,
      };
    });

    const existing = await this.getVariantsForItem(req, id);
    const keepIds = new Set(normalized.filter((v) => v.id != null).map((v) => String(v.id)));
    for (const old of existing) {
      if (!keepIds.has(String(old.id))) {
        await pool.query(`DELETE FROM garment_inventory_variants WHERE id = $1 AND item_id = $2`, [
          parseInt(old.id, 10),
          id,
        ]);
      }
    }

    for (let i = 0; i < normalized.length; i += 1) {
      const variant = normalized[i];
      if (variant.id != null) {
        const rows = await pool.query(
          `
          UPDATE garment_inventory_variants SET
            sku = $1,
            audience = $2,
            color = $3,
            size = $4,
            quantity = $5,
            sort_order = $6,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $7 AND item_id = $8
          RETURNING id
          `,
          [
            variant.sku,
            variant.audience,
            variant.color,
            variant.size,
            variant.quantity,
            i,
            variant.id,
            id,
          ],
        );
        if (!rows.rows.length) {
          await pool.query(
            `
            INSERT INTO garment_inventory_variants (item_id, sku, audience, color, size, quantity, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [id, variant.sku, variant.audience, variant.color, variant.size, variant.quantity, i],
          );
        }
      } else {
        await pool.query(
          `
          INSERT INTO garment_inventory_variants (item_id, sku, audience, color, size, quantity, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [id, variant.sku, variant.audience, variant.color, variant.size, variant.quantity, i],
        );
      }
    }

    await pool.query(
      `UPDATE garment_inventory_items SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id],
    );
  }

  async createInventoryVariant(req, itemId, data) {
    try {
      const id = parseInt(String(itemId), 10);
      const item = await this.getInventoryById(req, id);
      if (!item) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      const pool = this._pool(req);
      const maxOrder = await pool.query(
        `SELECT COALESCE(MAX(sort_order), -1) AS m FROM garment_inventory_variants WHERE item_id = $1`,
        [id],
      );
      const variant = this.normalizeVariantInput(data, (maxOrder.rows[0]?.m ?? -1) + 1);
      const result = await pool.query(
        `
        INSERT INTO garment_inventory_variants (item_id, sku, audience, color, size, quantity, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          id,
          variant.sku,
          variant.audience,
          variant.color,
          variant.size,
          variant.quantity,
          variant.sortOrder,
        ],
      );
      await pool.query(
        `UPDATE garment_inventory_items SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id],
      );
      return this.transformVariantRow(result.rows[0]);
    } catch (error) {
      if (error?.code === '23505') throw error;
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create inventory variant', error, { itemId });
      throw new AppError('Failed to create variant', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateInventoryVariant(req, itemId, variantId, data) {
    try {
      const lid = parseInt(String(itemId), 10);
      const vid = parseInt(String(variantId), 10);
      const item = await this.getInventoryById(req, lid);
      if (!item) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      const pool = this._pool(req);
      const existingResult = await pool.query(
        `SELECT * FROM garment_inventory_variants WHERE id = $1 AND item_id = $2`,
        [vid, lid],
      );
      if (!existingResult.rows.length) {
        throw new AppError('Variant not found', 404, AppError.CODES.NOT_FOUND);
      }
      const existing = existingResult.rows[0];
      const nextSku = data.sku !== undefined ? String(data.sku ?? '').trim() : (existing.sku ?? '');
      const nextAudience =
        data.audience !== undefined
          ? String(data.audience ?? '').trim()
          : (existing.audience ?? '');
      const nextColor =
        data.color !== undefined ? String(data.color ?? '').trim() : (existing.color ?? '');
      const nextSize =
        data.size !== undefined ? String(data.size ?? '').trim() : (existing.size ?? '');
      const nextQuantity =
        data.quantity !== undefined
          ? Math.max(0, parseInt(String(data.quantity), 10) || 0)
          : existing.quantity;
      const nextSort =
        data.sortOrder !== undefined || data.sort_order !== undefined
          ? parseInt(String(data.sortOrder ?? data.sort_order), 10) || 0
          : existing.sort_order;

      const rows = await pool.query(
        `
        UPDATE garment_inventory_variants SET
          sku = $1,
          audience = $2,
          color = $3,
          size = $4,
          quantity = $5,
          sort_order = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7 AND item_id = $8
        RETURNING *
        `,
        [nextSku, nextAudience, nextColor, nextSize, nextQuantity, nextSort, vid, lid],
      );
      await pool.query(
        `UPDATE garment_inventory_items SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [lid],
      );
      return this.transformVariantRow(rows.rows[0]);
    } catch (error) {
      if (error?.code === '23505') throw error;
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update inventory variant', error, { itemId, variantId });
      throw new AppError('Failed to update variant', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateInventoryVariantQuantity(req, itemId, variantId, quantity) {
    try {
      const lid = parseInt(String(itemId), 10);
      const vid = parseInt(String(variantId), 10);
      const nextQuantity = Math.max(0, parseInt(String(quantity), 10) || 0);
      const item = await this.getInventoryById(req, lid);
      if (!item) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      const pool = this._pool(req);
      const rows = await pool.query(
        `
        UPDATE garment_inventory_variants SET
          quantity = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND item_id = $3
        RETURNING *
        `,
        [nextQuantity, vid, lid],
      );
      if (!rows.rows.length) {
        throw new AppError('Variant not found', 404, AppError.CODES.NOT_FOUND);
      }
      await pool.query(
        `UPDATE garment_inventory_items SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [lid],
      );
      return this.transformVariantRow(rows.rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update inventory variant quantity', error, { itemId, variantId });
      throw new AppError('Failed to update variant quantity', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteInventoryVariant(req, itemId, variantId) {
    try {
      const pool = this._pool(req);
      const lid = parseInt(String(itemId), 10);
      const vid = parseInt(String(variantId), 10);
      const item = await this.getInventoryById(req, lid);
      if (!item) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      const rows = await pool.query(
        `DELETE FROM garment_inventory_variants WHERE id = $1 AND item_id = $2 RETURNING id`,
        [vid, lid],
      );
      if (!rows.rows.length) {
        throw new AppError('Variant not found', 404, AppError.CODES.NOT_FOUND);
      }
      await pool.query(
        `UPDATE garment_inventory_items SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [lid],
      );
      return { id: String(vid) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete inventory variant', error, { itemId, variantId });
      throw new AppError('Failed to delete variant', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteInventoryItem(req, itemId) {
    try {
      const db = Database.get(req);
      const pool = this._pool(req);
      const id = parseInt(String(itemId), 10);

      const assignments = await pool.query(
        `
        SELECT gl.id AS list_id, gl.name AS list_name
        FROM garment_list_inventory_items j
        JOIN garment_lists gl ON gl.id = j.list_id
        WHERE j.item_id = $1
        ORDER BY gl.name ASC, gl.id ASC
        `,
        [id],
      );

      // Delete cascades: force-unassign from every list (clears this article's
      // checkbox / size / audience keys), then remove the inventory row.
      for (const row of assignments.rows) {
        await this.unassignInventoryItemFromList(req, row.list_id, id, { force: true });
      }

      const rows = await db.query(
        `DELETE FROM garment_inventory_items WHERE id = $1 RETURNING id`,
        [id],
      );
      if (!rows.length) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      return { id: String(id) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete inventory item', error, { itemId });
      throw new AppError('Failed to delete inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ─── List ↔ inventory assignments ────────────────────────────────────────

  async loadAssignedInventoryByListIds(pool, listIds) {
    if (!listIds.length) return new Map();
    const result = await pool.query(
      `
      SELECT list_id, item_id
      FROM garment_list_inventory_items
      WHERE list_id = ANY($1::int[])
      ORDER BY sort_order ASC, id ASC
      `,
      [listIds],
    );
    const map = new Map();
    for (const row of result.rows) {
      const listKey = String(row.list_id);
      if (!map.has(listKey)) map.set(listKey, []);
      map.get(listKey).push(String(row.item_id));
    }
    return map;
  }

  async loadAssignedListsByItemIds(pool, itemIds) {
    if (!itemIds.length) return new Map();
    const result = await pool.query(
      `
      SELECT item_id, list_id
      FROM garment_list_inventory_items
      WHERE item_id = ANY($1::int[])
      ORDER BY sort_order ASC, id ASC
      `,
      [itemIds],
    );
    const map = new Map();
    for (const row of result.rows) {
      const itemKey = String(row.item_id);
      if (!map.has(itemKey)) map.set(itemKey, []);
      map.get(itemKey).push(String(row.list_id));
    }
    return map;
  }

  async enrichInventoryWithAssignments(req, item) {
    if (!item) return item;
    const pool = this._pool(req);
    const id = parseInt(String(item.id), 10);
    if (Number.isNaN(id)) return item;
    const map = await this.loadAssignedListsByItemIds(pool, [id]);
    return {
      ...item,
      assignedListIds: map.get(String(item.id)) ?? [],
    };
  }

  async enrichListsWithInventoryAssignments(req, lists) {
    if (!lists.length) return lists;
    const pool = this._pool(req);
    const listIds = lists
      .map((list) => parseInt(String(list.id), 10))
      .filter((id) => !Number.isNaN(id));
    const map = await this.loadAssignedInventoryByListIds(pool, listIds);
    return lists.map((list) => ({
      ...list,
      assignedInventoryItemIds: map.get(String(list.id)) ?? [],
    }));
  }

  async isInventoryItemUsedInList(pool, listId, itemId) {
    const prefix = inventoryCheckboxPrefix(itemId);
    const rows = await pool.query(
      `SELECT checkbox_values FROM garment_list_persons WHERE list_id = $1`,
      [listId],
    );
    for (const row of rows.rows) {
      const values = parseJsonb(row.checkbox_values, {});
      for (const [key, value] of Object.entries(values)) {
        if (key.startsWith(prefix) && value === true) {
          return true;
        }
      }
    }
    return false;
  }

  async assignInventoryItemToList(req, listId, itemId) {
    try {
      const db = Database.get(req);
      const pool = this._pool(req);
      const lid = parseInt(String(listId), 10);
      const iid = parseInt(String(itemId), 10);
      const list = await this.getListById(req, lid, { includePersons: false });
      if (!list) {
        throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
      }
      const inventory = await this.getInventoryById(req, iid);
      if (!inventory) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }

      const existingJoin = await pool.query(
        `SELECT id FROM garment_list_inventory_items WHERE list_id = $1 AND item_id = $2`,
        [lid, iid],
      );
      if (existingJoin.rows.length) {
        return this.getListById(req, lid);
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const maxOrderResult = await client.query(
          `SELECT COALESCE(MAX(sort_order), -1) AS m FROM garment_list_inventory_items WHERE list_id = $1`,
          [lid],
        );
        const nextSort = (maxOrderResult.rows[0]?.m ?? -1) + 1;
        await client.query(
          `INSERT INTO garment_list_inventory_items (list_id, item_id, sort_order) VALUES ($1, $2, $3)`,
          [lid, iid, nextSort],
        );

        let checkboxColumns = [...list.checkboxColumns];
        const existingIds = new Set(checkboxColumns.map((col) => col.id));
        const maxColSort = checkboxColumns.reduce(
          (max, col) => Math.max(max, col.sortOrder ?? 0),
          -1,
        );
        const newColumns = buildInventoryCheckboxColumns(
          iid,
          inventory.articleName,
          maxColSort + 1,
        ).filter((col) => !existingIds.has(col.id));
        if (newColumns.length) {
          checkboxColumns = [...checkboxColumns, ...newColumns];
          await client.query(
            `
            UPDATE garment_lists
            SET checkbox_columns = $1::jsonb, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            `,
            [JSON.stringify(checkboxColumns), lid],
          );
        }
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      return this.getListById(req, lid);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to assign inventory item to list', error, { listId, itemId });
      throw new AppError('Failed to assign inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async unassignInventoryItemFromList(req, listId, itemId, { force = false } = {}) {
    try {
      const pool = this._pool(req);
      const lid = parseInt(String(listId), 10);
      const iid = parseInt(String(itemId), 10);
      const list = await this.getListById(req, lid, { includePersons: false });
      if (!list) {
        throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
      }

      const join = await pool.query(
        `SELECT id FROM garment_list_inventory_items WHERE list_id = $1 AND item_id = $2`,
        [lid, iid],
      );
      if (!join.rows.length) {
        return this.getListById(req, lid);
      }

      if (!force && (await this.isInventoryItemUsedInList(pool, lid, iid))) {
        throw new AppError(
          'Cannot unassign inventory item with checked values in this list',
          409,
          AppError.CODES.CONFLICT,
        );
      }

      const removeIds = new Set(inventoryColumnIdsForItem(iid));
      const checkboxColumns = list.checkboxColumns.filter((col) => !removeIds.has(col.id));
      const itemKey = String(iid);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `DELETE FROM garment_list_inventory_items WHERE list_id = $1 AND item_id = $2`,
          [lid, iid],
        );
        await client.query(
          `
          UPDATE garment_lists
          SET checkbox_columns = $1::jsonb, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          `,
          [JSON.stringify(checkboxColumns), lid],
        );

        const persons = await client.query(
          `SELECT id, checkbox_values, ct_sizes, ct_audiences FROM garment_list_persons WHERE list_id = $1`,
          [lid],
        );
        for (const person of persons.rows) {
          const values = parseJsonb(person.checkbox_values, {});
          let valuesChanged = false;
          for (const rid of removeIds) {
            if (Object.prototype.hasOwnProperty.call(values, rid)) {
              delete values[rid];
              valuesChanged = true;
            }
          }
          const ctSizes = parseCtSizes(person.ct_sizes);
          const ctChanged = Object.prototype.hasOwnProperty.call(ctSizes, itemKey);
          if (ctChanged) {
            delete ctSizes[itemKey];
          }
          const ctAudiences = parseCtAudiences(person.ct_audiences);
          const audienceChanged = Object.prototype.hasOwnProperty.call(ctAudiences, itemKey);
          if (audienceChanged) {
            delete ctAudiences[itemKey];
          }
          if (valuesChanged || ctChanged || audienceChanged) {
            await client.query(
              `
              UPDATE garment_list_persons
              SET checkbox_values = $1::jsonb,
                  ct_sizes = $2::jsonb,
                  ct_audiences = $3::jsonb,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = $4
              `,
              [
                JSON.stringify(values),
                JSON.stringify(ctSizes),
                JSON.stringify(ctAudiences),
                person.id,
              ],
            );
          }
        }
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      return this.getListById(req, lid);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to unassign inventory item from list', error, { listId, itemId });
      throw new AppError('Failed to unassign inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updatePersonCtSizes(req, listId, personId, ctSizesInput, ctAudiencesInput = undefined) {
    try {
      const pool = this._pool(req);
      const lid = parseInt(String(listId), 10);
      const pid = parseInt(String(personId), 10);
      const list = await this.getListById(req, lid, { includePersons: false });
      if (!list) {
        throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
      }

      const assignedIds = new Set(list.assignedInventoryItemIds ?? []);
      const existingResult = await pool.query(
        `SELECT * FROM garment_list_persons WHERE id = $1 AND list_id = $2`,
        [pid, lid],
      );
      if (!existingResult.rows.length) {
        throw new AppError('Person not found', 404, AppError.CODES.NOT_FOUND);
      }
      const existing = existingResult.rows[0];
      const allowedIds = list.checkboxColumns.map((col) => col.id);
      const nextCtSizes = parseCtSizes(existing.ct_sizes);
      const nextCtAudiences = parseCtAudiences(existing.ct_audiences);

      if (ctSizesInput !== undefined) {
        const input = parseCtSizes(ctSizesInput);
        for (const [itemId, size] of Object.entries(input)) {
          if (!assignedIds.has(String(itemId))) continue;
          const trimmed = size.trim();
          if (trimmed) {
            nextCtSizes[String(itemId)] = trimmed.slice(0, 50);
          } else {
            delete nextCtSizes[String(itemId)];
          }
        }
      }

      if (ctAudiencesInput !== undefined) {
        const input = parseCtAudiences(ctAudiencesInput);
        for (const [itemId, audience] of Object.entries(input)) {
          if (!assignedIds.has(String(itemId))) continue;
          const trimmed = audience.trim();
          if (trimmed) {
            nextCtAudiences[String(itemId)] = trimmed.slice(0, 100);
          } else {
            delete nextCtAudiences[String(itemId)];
          }
        }
      }

      const rows = await pool.query(
        `
        UPDATE garment_list_persons
        SET ct_sizes = $1::jsonb,
            ct_audiences = $2::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND list_id = $4
        RETURNING *
        `,
        [JSON.stringify(nextCtSizes), JSON.stringify(nextCtAudiences), pid, lid],
      );
      await pool.query(`UPDATE garment_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
        lid,
      ]);
      return this.transformPersonRow(rows.rows[0], allowedIds);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update person clothing sizes', error, { listId, personId });
      throw new AppError('Failed to update person sizes', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ─── Transforms ──────────────────────────────────────────────────────────

  transformListRow(row) {
    return {
      id: String(row.id),
      name: row.name ?? '',
      teamId: row.team_id != null ? String(row.team_id) : null,
      checkboxColumns: normalizeCheckboxColumns(parseJsonb(row.checkbox_columns, [])),
      assignedInventoryItemIds: [],
      personCount: row.person_count != null ? Number(row.person_count) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  transformPersonRow(row, allowedIds = null) {
    const ids =
      allowedIds ||
      Object.keys(parseJsonb(row.checkbox_values, {})).filter((k) => typeof k === 'string');
    return {
      id: String(row.id),
      listId: String(row.list_id),
      name: row.name ?? '',
      shirtSize: row.shirt_size ?? null,
      shortsSize: row.shorts_size ?? null,
      socksSize: row.socks_size ?? null,
      jerseyNumber: row.jersey_number ?? null,
      jerseyName: row.jersey_name ?? null,
      initials: row.initials ?? null,
      comment: row.comment ?? null,
      contactId: row.contact_id != null ? String(row.contact_id) : null,
      teamId: row.team_id != null ? String(row.team_id) : null,
      checkboxValues: normalizeCheckboxValues(row.checkbox_values, ids),
      ctSizes: parseCtSizes(row.ct_sizes),
      ctAudiences: parseCtAudiences(row.ct_audiences),
      sortOrder: row.sort_order != null ? Number(row.sort_order) : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  transformShareRow(row) {
    return {
      id: String(row.id),
      listId: String(row.list_id),
      shareToken: row.share_token,
      validUntil: row.valid_until,
      createdAt: row.created_at,
      accessedCount: row.accessed_count,
      lastAccessedAt: row.last_accessed_at,
    };
  }

  transformVariantRow(row) {
    return {
      id: String(row.id),
      itemId: String(row.item_id),
      sku: row.sku ?? '',
      audience: row.audience ?? '',
      color: row.color ?? '',
      size: row.size ?? '',
      quantity: row.quantity != null ? Number(row.quantity) : 0,
      sortOrder: row.sort_order != null ? Number(row.sort_order) : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  attachVariants(item, variants) {
    const list = Array.isArray(variants) ? variants : [];
    const totalQuantity = list.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
    return {
      ...item,
      variants: list,
      totalQuantity,
      variantCount: list.length,
    };
  }

  transformInventoryRow(row) {
    const parseMoney = (raw) => {
      if (raw === undefined || raw === null || raw === '') return null;
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
      return Number.isNaN(num) ? null : num;
    };
    return {
      id: String(row.id),
      articleName: row.article_name ?? '',
      brand: row.brand ?? '',
      description: row.description ?? null,
      material: row.material ?? '',
      purchasePrice: parseMoney(row.purchase_price),
      recommendedPrice: parseMoney(row.recommended_price),
      salePrice: parseMoney(row.sale_price),
      currency: row.currency ?? 'SEK',
      comment: row.comment ?? null,
      variants: [],
      totalQuantity: 0,
      variantCount: 0,
      assignedListIds: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = GarmentsModel;
