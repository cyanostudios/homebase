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
      return { id, label, sortOrder };
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
      return rows.map((row) => this.transformListRow(row));
    } catch (error) {
      Logger.error('Failed to fetch garment lists', error);
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
      if (includePersons) {
        list.persons = await this.getPersonsForList(req, id);
      }
      return list;
    } catch (error) {
      Logger.error('Failed to get garment list', error, { listId });
      throw new AppError('Failed to get list', 500, AppError.CODES.DATABASE_ERROR);
    }
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
    const allowedIds = normalizeCheckboxColumns(
      parseJsonb(listResult.rows[0]?.checkbox_columns, []),
    ).map((c) => c.id);
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
      const allowedIds = list.checkboxColumns.map((c) => c.id);
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

      const record = await pool.query(
        `
        INSERT INTO garment_list_persons (
          list_id, name, shirt_size, shorts_size, socks_size, jersey_number,
          comment, checkbox_values, sort_order
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
        RETURNING *
        `,
        [
          id,
          String(data.name || '').trim(),
          data.shirtSize ?? data.shirt_size ?? null,
          data.shortsSize ?? data.shorts_size ?? null,
          data.socksSize ?? data.socks_size ?? null,
          data.jerseyNumber ?? data.jersey_number ?? null,
          data.comment ?? null,
          JSON.stringify(checkboxValues),
          sortOrder,
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
      const allowedIds = list.checkboxColumns.map((c) => c.id);
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

      const rows = await pool.query(
        `
        UPDATE garment_list_persons SET
          name = $1,
          shirt_size = $2,
          shorts_size = $3,
          socks_size = $4,
          jersey_number = $5,
          comment = $6,
          checkbox_values = $7::jsonb,
          sort_order = $8,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $9 AND list_id = $10
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
          data.comment !== undefined ? data.comment : existing.comment,
          JSON.stringify(checkboxValues),
          data.sortOrder !== undefined
            ? parseInt(String(data.sortOrder), 10)
            : data.sort_order !== undefined
              ? parseInt(String(data.sort_order), 10)
              : existing.sort_order,
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
      list.persons = await this.getPersonsForList(req, list.id);
      // Public: strip comments (PII)
      list.persons = list.persons.map((p) => ({ ...p, comment: null }));
      list.shareValidUntil = row.share_valid_until;
      list.accessedCount = (row.accessed_count || 0) + 1;
      return list;
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
        `SELECT * FROM garment_inventory_items ORDER BY article_name ASC, brand ASC, size ASC`,
        [],
      );
      return rows.map((row) => this.transformInventoryRow(row));
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
      return this.transformInventoryRow(rows[0]);
    } catch (error) {
      Logger.error('Failed to get inventory item', error, { itemId });
      throw new AppError('Failed to get inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createInventoryItem(req, data) {
    try {
      const db = Database.get(req);
      const record = await db.insert('garment_inventory_items', {
        article_name: String(data.articleName ?? data.article_name ?? '').trim(),
        brand: String(data.brand ?? '').trim(),
        size: String(data.size ?? '').trim(),
        quantity: Math.max(0, parseInt(String(data.quantity ?? 0), 10) || 0),
        comment: data.comment ?? null,
      });
      return this.transformInventoryRow(record);
    } catch (error) {
      if (error?.code === '23505') throw error;
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
      const rows = await db.query(
        `
        UPDATE garment_inventory_items SET
          article_name = $1,
          brand = $2,
          size = $3,
          quantity = $4,
          comment = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *
        `,
        [
          data.articleName !== undefined || data.article_name !== undefined
            ? String(data.articleName ?? data.article_name ?? '').trim()
            : existing.articleName,
          data.brand !== undefined ? String(data.brand ?? '').trim() : existing.brand,
          data.size !== undefined ? String(data.size ?? '').trim() : existing.size,
          data.quantity !== undefined
            ? Math.max(0, parseInt(String(data.quantity), 10) || 0)
            : existing.quantity,
          data.comment !== undefined ? data.comment : existing.comment,
          id,
        ],
      );
      return this.transformInventoryRow(rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error?.code === '23505') throw error;
      Logger.error('Failed to update inventory item', error, { itemId });
      throw new AppError('Failed to update inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteInventoryItem(req, itemId) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(itemId), 10);
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

  // ─── Transforms ──────────────────────────────────────────────────────────

  transformListRow(row) {
    return {
      id: String(row.id),
      name: row.name ?? '',
      teamId: row.team_id != null ? String(row.team_id) : null,
      checkboxColumns: normalizeCheckboxColumns(parseJsonb(row.checkbox_columns, [])),
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
      comment: row.comment ?? null,
      checkboxValues: normalizeCheckboxValues(row.checkbox_values, ids),
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

  transformInventoryRow(row) {
    return {
      id: String(row.id),
      articleName: row.article_name ?? '',
      brand: row.brand ?? '',
      size: row.size ?? '',
      quantity: row.quantity != null ? Number(row.quantity) : 0,
      comment: row.comment ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = GarmentsModel;
