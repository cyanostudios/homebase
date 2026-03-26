// plugins/cups/model.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class CupsModel {
  // ─── CUPS ───────────────────────────────────────────────────────────────────

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
      const result = await db.insert('cups', this._prepareCupData(data));
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
      const result = await db.update('cups', id, this._prepareCupData(data));
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
    const inserted = [];
    for (const cup of cups) {
      try {
        const row = await db.insert('cups', this._prepareCupData({ ...cup, source_id: sourceId }));
        inserted.push(this.transformCupRow(row));
      } catch (err) {
        Logger.warn('Failed to insert scraped cup', { name: cup.name, error: err.message });
      }
    }
    return inserted;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  _prepareCupData(data) {
    return {
      name: (data.name || '').toString().trim().slice(0, 500) || 'Unnamed Cup',
      organizer: data.organizer?.toString().trim().slice(0, 255) || null,
      region: data.region?.toString().trim().slice(0, 255) || null,
      location: data.location?.toString().trim().slice(0, 255) || null,
      sport_type: data.sport_type?.toString().trim().slice(0, 100) || 'football',
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      age_groups: data.age_groups?.toString().trim() || null,
      registration_url: data.registration_url?.toString().trim().slice(0, 1000) || null,
      source_url: data.source_url?.toString().trim().slice(0, 1000) || null,
      source_id: data.source_id ? parseInt(data.source_id, 10) : null,
      raw_snippet: data.raw_snippet?.toString().trim() || null,
      scraped_at: data.scraped_at || null,
    };
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
