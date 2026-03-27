// plugins/cups/model.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class CupsModel {
  // ─── CUPS ───────────────────────────────────────────────────────────────────
  constructor() {
    this._cupsColumnSupportCache = null;
  }

  async _getCupsColumnSupport(req) {
    if (this._cupsColumnSupportCache) {
      return this._cupsColumnSupportCache;
    }
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'cups'`,
        [],
      );
      const names = new Set((rows || []).map((r) => String(r.column_name || '').toLowerCase()));
      this._cupsColumnSupportCache = {
        visible: names.has('visible'),
        sanctioned: names.has('sanctioned'),
      };
      return this._cupsColumnSupportCache;
    } catch {
      // Safe default for modern schema; if not present, insert/update path still handles app flow.
      this._cupsColumnSupportCache = { visible: true, sanctioned: true };
      return this._cupsColumnSupportCache;
    }
  }

  async getAll(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        'SELECT * FROM cups ORDER BY start_date ASC NULLS LAST, created_at DESC',
        [],
      );
      return rows.map(this.transformCupRow);
    } catch (error) {
      Logger.error('Failed to fetch cups', error);
      throw new AppError('Failed to fetch cups', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, id) {
    try {
      const db = Database.get(req);
      const rows = await db.query('SELECT * FROM cups WHERE id = $1', [id]);
      if (!rows || rows.length === 0) {
        throw new AppError('Cup not found', 404, AppError.CODES.NOT_FOUND);
      }
      return this.transformCupRow(rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch cup', error, { id });
      throw new AppError('Failed to fetch cup', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, data) {
    try {
      const db = Database.get(req);
      const columns = await this._getCupsColumnSupport(req);
      const result = await db.insert('cups', this._prepareCupData(data, { columns }));
      Logger.info('Cup created', { cupId: result.id });
      return this.transformCupRow(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create cup', error);
      throw new AppError('Failed to create cup', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, id, data) {
    try {
      const db = Database.get(req);
      const columns = await this._getCupsColumnSupport(req);
      const result = await db.update(
        'cups',
        id,
        this._prepareCupData(data, { partial: true, columns }),
      );
      Logger.info('Cup updated', { cupId: id });
      return this.transformCupRow(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update cup', error, { id });
      throw new AppError('Failed to update cup', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, id) {
    try {
      const db = Database.get(req);
      await db.deleteRecord('cups', id);
      Logger.info('Cup deleted', { cupId: id });
      return { id };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete cup', error, { id });
      throw new AppError('Failed to delete cup', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, ids) {
    try {
      const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
      return await BulkOperationsHelper.bulkDelete(req, 'cups', ids);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to bulk delete cups', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ─── SOURCES ─────────────────────────────────────────────────────────────────

  async getAllSources(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query('SELECT * FROM cup_sources ORDER BY created_at ASC', []);
      return rows.map(this.transformSourceRow);
    } catch (error) {
      Logger.error('Failed to fetch cup sources', error);
      throw new AppError('Failed to fetch cup sources', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createSource(req, data) {
    try {
      const db = Database.get(req);
      const payload = {
        type: data.type || 'url',
        url: data.url?.trim() || null,
        filename: data.filename?.trim() || null,
        label: data.label?.trim() || null,
        enabled: data.enabled !== false,
      };
      const result = await db.insert('cup_sources', payload);
      Logger.info('Cup source created', { sourceId: result.id });
      return this.transformSourceRow(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create cup source', error);
      throw new AppError('Failed to create cup source', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateSource(req, id, data) {
    try {
      const db = Database.get(req);
      const payload = {};
      if ('label' in data) payload.label = data.label?.trim() || null;
      if ('filename' in data) payload.filename = data.filename?.trim() || null;
      if ('enabled' in data) payload.enabled = Boolean(data.enabled);
      if ('last_scraped_at' in data) payload.last_scraped_at = data.last_scraped_at;
      if ('last_result' in data) payload.last_result = data.last_result;
      const result = await db.update('cup_sources', id, payload);
      return this.transformSourceRow(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update cup source', error, { id });
      throw new AppError('Failed to update cup source', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteSource(req, id) {
    try {
      const db = Database.get(req);
      await db.deleteRecord('cup_sources', id);
      Logger.info('Cup source deleted', { sourceId: id });
      return { id };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete cup source', error, { id });
      throw new AppError('Failed to delete cup source', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async insertScrapedCups(req, cups, sourceId) {
    const db = Database.get(req);
    const userId = req.session?.currentTenantUserId || req.session?.user?.id;
    const columns = await this._getCupsColumnSupport(req);
    const inserted = [];
    let skipped = 0;

    for (const cup of cups) {
      try {
        const data = this._prepareCupData({ ...cup, source_id: sourceId }, { columns });
        const cols = Object.keys(data);
        const vals = Object.values(data);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const colNames = cols.join(', ');
        const sql = `
          INSERT INTO cups (${colNames}, user_id)
          VALUES (${placeholders}, $${vals.length + 1})
          ON CONFLICT ON CONSTRAINT cups_source_id_name_unique DO NOTHING
          RETURNING *
        `;
        const rows = await db.query(sql, [...vals, userId]);
        if (rows && rows.length > 0) {
          inserted.push(this.transformCupRow(rows[0]));
        } else {
          skipped += 1;
        }
      } catch (err) {
        Logger.warn('Failed to insert scraped cup', { name: cup.name, error: err.message });
      }
    }
    return { inserted, skipped };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  _prepareCupData(data, options = { partial: false, columns: { visible: true, sanctioned: true } }) {
    const partial = Boolean(options.partial);
    const columns = options.columns || { visible: true, sanctioned: true };
    const has = (key) => Object.prototype.hasOwnProperty.call(data, key);
    const payload = {};
    if (!partial || has('name')) {
      payload.name = (data.name || '').toString().trim().slice(0, 500) || 'Unnamed Cup';
    }
    if (!partial || has('organizer')) {
      payload.organizer = data.organizer?.toString().trim().slice(0, 255) || null;
    }
    if (!partial || has('region')) {
      payload.region = data.region?.toString().trim().slice(0, 255) || null;
    }
    if (!partial || has('location')) {
      payload.location = data.location?.toString().trim().slice(0, 255) || null;
    }
    if (!partial || has('sport_type')) {
      payload.sport_type = data.sport_type?.toString().trim().slice(0, 100) || 'football';
    }
    if (!partial || has('start_date')) {
      payload.start_date = data.start_date || null;
    }
    if (!partial || has('end_date')) {
      payload.end_date = data.end_date || null;
    }
    if (!partial || has('age_groups')) {
      payload.age_groups = data.age_groups?.toString().trim() || null;
    }
    if (!partial || has('registration_url')) {
      payload.registration_url = data.registration_url?.toString().trim().slice(0, 1000) || null;
    }
    if (!partial || has('source_url')) {
      payload.source_url = data.source_url?.toString().trim().slice(0, 1000) || null;
    }
    if (!partial || has('source_id')) {
      payload.source_id = data.source_id ? parseInt(data.source_id, 10) : null;
    }
    if (!partial || has('raw_snippet')) {
      payload.raw_snippet = data.raw_snippet?.toString().trim() || null;
    }
    if (!partial || has('scraped_at')) {
      payload.scraped_at = data.scraped_at || null;
    }
    if ((!partial || has('visible')) && columns.visible) {
      payload.visible = data.visible !== false;
    }
    if ((!partial || has('sanctioned')) && columns.sanctioned) {
      payload.sanctioned = data.sanctioned === true;
    }
    return payload;
  }

  transformCupRow(row) {
    return {
      id: String(row.id),
      name: row.name,
      organizer: row.organizer || null,
      region: row.region || null,
      location: row.location || null,
      sport_type: row.sport_type || 'football',
      start_date: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : null,
      end_date: row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : null,
      age_groups: row.age_groups || null,
      registration_url: row.registration_url || null,
      source_url: row.source_url || null,
      source_id: row.source_id ? String(row.source_id) : null,
      raw_snippet: row.raw_snippet || null,
      scraped_at: row.scraped_at || null,
      visible: row.visible !== false,
      sanctioned: row.sanctioned === true,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  transformSourceRow(row) {
    return {
      id: String(row.id),
      type: row.type || 'url',
      url: row.url || null,
      filename: row.filename || null,
      label: row.label || null,
      enabled: Boolean(row.enabled),
      last_scraped_at: row.last_scraped_at || null,
      last_result: row.last_result || null,
      created_at: row.created_at,
      updated_at: row.updated_at || null,
    };
  }
}

module.exports = CupsModel;
