// plugins/ingest/model.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const SOURCES = 'ingest_sources';
const RUNS = 'ingest_runs';

class IngestModel {
  transformSourceRow(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      name: row.name ?? '',
      sourceUrl: row.source_url ?? '',
      sourceType: row.source_type ?? 'other',
      fetchMethod: row.fetch_method ?? 'generic_http',
      isActive: Boolean(row.is_active),
      notes: row.notes ?? null,
      lastFetchedAt: row.last_fetched_at ?? null,
      lastFetchStatus: row.last_fetch_status ?? 'never',
      lastFetchError: row.last_fetch_error ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  transformRunRow(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      sourceId: String(row.source_id),
      status: row.status ?? 'failed',
      startedAt: row.started_at,
      completedAt: row.completed_at ?? null,
      fetchMethod: row.fetch_method ?? null,
      httpStatus: row.http_status != null ? Number(row.http_status) : null,
      contentType: row.content_type ?? null,
      contentLength: row.content_length != null ? Number(row.content_length) : null,
      rawExcerpt: row.raw_excerpt ?? null,
      errorMessage: row.error_message ?? null,
      createdAt: row.created_at,
    };
  }

  async getAllSources(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `SELECT * FROM ${SOURCES} ORDER BY updated_at DESC NULLS LAST, id DESC`,
        [],
      );
      return rows.map((r) => this.transformSourceRow(r));
    } catch (error) {
      Logger.error('Failed to fetch ingest sources', error);
      throw new AppError('Failed to fetch sources', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getSourceById(req, id) {
    try {
      const db = Database.get(req);
      const rows = await db.query(`SELECT * FROM ${SOURCES} WHERE id = $1`, [id]);
      if (!rows.length) {
        return null;
      }
      return this.transformSourceRow(rows[0]);
    } catch (error) {
      Logger.error('Failed to fetch ingest source', error, { id });
      throw new AppError('Failed to fetch source', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createSource(req, data) {
    try {
      const db = Database.get(req);
      const record = await db.insert(SOURCES, {
        name: data.name,
        source_url: data.sourceUrl,
        source_type: data.sourceType,
        fetch_method: data.fetchMethod || 'generic_http',
        is_active: data.isActive !== false,
        notes: data.notes ?? null,
        last_fetch_status: 'never',
      });
      return this.transformSourceRow(record);
    } catch (error) {
      Logger.error('Failed to create ingest source', error);
      throw new AppError('Failed to create source', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateSource(req, id, data) {
    try {
      const db = Database.get(req);
      const existing = await db.query(`SELECT * FROM ${SOURCES} WHERE id = $1`, [id]);
      if (!existing.length) {
        throw new AppError('Source not found', 404, AppError.CODES.NOT_FOUND);
      }
      const result = await db.update(SOURCES, id, {
        name: data.name,
        source_url: data.sourceUrl,
        source_type: data.sourceType,
        fetch_method: data.fetchMethod || 'generic_http',
        is_active: data.isActive !== false,
        notes: data.notes ?? null,
      });
      return this.transformSourceRow(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update ingest source', error, { id });
      throw new AppError('Failed to update source', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteSource(req, id) {
    try {
      const db = Database.get(req);
      const existing = await db.query(`SELECT id FROM ${SOURCES} WHERE id = $1`, [id]);
      if (!existing.length) {
        throw new AppError('Source not found', 404, AppError.CODES.NOT_FOUND);
      }
      await db.deleteRecord(SOURCES, id);
      return { id: String(id) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete ingest source', error, { id });
      throw new AppError('Failed to delete source', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createRun(req, data) {
    try {
      const db = Database.get(req);
      const record = await db.insert(RUNS, {
        source_id: data.sourceId,
        status: data.status,
        started_at: data.startedAt,
        completed_at: data.completedAt ?? null,
        fetch_method: data.fetchMethod ?? null,
        http_status: data.httpStatus ?? null,
        content_type: data.contentType ?? null,
        content_length: data.contentLength ?? null,
        raw_excerpt: data.rawExcerpt ?? null,
        error_message: data.errorMessage ?? null,
      });
      return this.transformRunRow(record);
    } catch (error) {
      Logger.error('Failed to create ingest run', error);
      throw new AppError('Failed to save import run', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateRun(req, runId, data) {
    try {
      const db = Database.get(req);
      const existing = await db.query(`SELECT id FROM ${RUNS} WHERE id = $1`, [runId]);
      if (!existing.length) {
        throw new AppError('Run not found', 404, AppError.CODES.NOT_FOUND);
      }
      const row = await db.update(RUNS, runId, data);
      return this.transformRunRow(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update ingest run', error, { runId });
      throw new AppError('Failed to update run', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getRunsForSource(req, sourceId, limit = 50) {
    try {
      const db = Database.get(req);
      const cap = Math.min(Math.max(1, limit), 100);
      const rows = await db.query(
        `SELECT * FROM ${RUNS} WHERE source_id = $1 ORDER BY started_at DESC LIMIT $2`,
        [sourceId, cap],
      );
      return rows.map((r) => this.transformRunRow(r));
    } catch (error) {
      Logger.error('Failed to fetch ingest runs', error, { sourceId });
      throw new AppError('Failed to fetch runs', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getLatestRunForSource(req, sourceId) {
    const runs = await this.getRunsForSource(req, sourceId, 1);
    return runs[0] || null;
  }

  async markSourceFetchResult(req, sourceId, result) {
    try {
      const db = Database.get(req);
      const existing = await db.query(`SELECT id FROM ${SOURCES} WHERE id = $1`, [sourceId]);
      if (!existing.length) {
        throw new AppError('Source not found', 404, AppError.CODES.NOT_FOUND);
      }
      const updated = await db.update(SOURCES, sourceId, {
        last_fetched_at: result.lastFetchedAt,
        last_fetch_status: result.lastFetchStatus,
        last_fetch_error: result.lastFetchError ?? null,
      });
      return this.transformSourceRow(updated);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update source fetch metadata', error, { sourceId });
      throw new AppError('Failed to update source', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = IngestModel;
