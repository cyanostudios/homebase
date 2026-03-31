const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');

class CupsModel {
  transformRow(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      name: row.name ?? '',
      organizer: row.organizer ?? null,
      location: row.location ?? null,
      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,
      categories: row.categories ?? null,
      visible: row.visible !== false && row.visible !== 'false',
      featured: row.featured === true || row.featured === 'true',
      sanctioned: row.sanctioned !== false && row.sanctioned !== 'false',
      team_count:
        row.team_count !== null &&
        row.team_count !== undefined &&
        !Number.isNaN(Number(row.team_count))
          ? Number(row.team_count)
          : null,
      match_format: row.match_format ?? null,
      description: row.description ?? null,
      registration_url: row.registration_url ?? null,
      source_url: row.source_url ?? null,
      source_type: row.source_type ?? null,
      ingest_source_id:
        row.ingest_source_id !== null && row.ingest_source_id !== undefined
          ? String(row.ingest_source_id)
          : null,
      ingest_run_id:
        row.ingest_run_id !== null && row.ingest_run_id !== undefined
          ? String(row.ingest_run_id)
          : null,
      external_id: row.external_id ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async getAll(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        'SELECT * FROM cups ORDER BY start_date DESC NULLS LAST, created_at DESC',
        [],
      );
      return rows.map((r) => this.transformRow(r));
    } catch (error) {
      Logger.error('Failed to fetch cups', error);
      throw new AppError('Failed to fetch cups', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, id) {
    try {
      const db = Database.get(req);
      const rows = await db.query('SELECT * FROM cups WHERE id = $1', [id]);
      return rows.length ? this.transformRow(rows[0]) : null;
    } catch (error) {
      Logger.error('Failed to fetch cup', error, { id });
      throw new AppError('Failed to fetch cup', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, data) {
    try {
      const db = Database.get(req);
      const row = await db.insert('cups', {
        name: (data.name || '').trim(),
        organizer: data.organizer?.trim() || null,
        location: data.location?.trim() || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        categories: data.categories?.trim() || null,
        visible: data.visible !== false && data.visible !== 'false',
        featured: data.featured === true || data.featured === 'true',
        sanctioned:
          data.sanctioned !== undefined
            ? data.sanctioned !== false && data.sanctioned !== 'false'
            : true,
        team_count: (() => {
          if (data.team_count === null || data.team_count === undefined || data.team_count === '') {
            return null;
          }
          const n = parseInt(String(data.team_count), 10);
          return Number.isFinite(n) ? n : null;
        })(),
        match_format: data.match_format?.trim() || null,
        description: data.description || null,
        registration_url: data.registration_url?.trim() || null,
        source_url: data.source_url?.trim() || null,
        source_type: data.source_type?.trim() || null,
        ingest_source_id: data.ingest_source_id || null,
        ingest_run_id: data.ingest_run_id || null,
        external_id: data.external_id?.trim() || null,
      });
      return this.transformRow(row);
    } catch (error) {
      Logger.error('Failed to create cup', error);
      throw new AppError('Failed to create cup', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, id, data) {
    try {
      const db = Database.get(req);
      const existing = await db.query('SELECT * FROM cups WHERE id = $1', [id]);
      if (!existing.length) {
        throw new AppError('Cup not found', 404, AppError.CODES.NOT_FOUND);
      }
      const row = await db.update('cups', id, {
        name: (data.name || '').trim(),
        organizer: data.organizer?.trim() || null,
        location: data.location?.trim() || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        categories: data.categories?.trim() || null,
        visible:
          data.visible !== undefined
            ? data.visible !== false && data.visible !== 'false'
            : existing[0].visible !== false && existing[0].visible !== 'false',
        featured:
          data.featured !== undefined
            ? data.featured === true || data.featured === 'true'
            : existing[0].featured === true || existing[0].featured === 'true',
        sanctioned:
          data.sanctioned !== undefined
            ? data.sanctioned !== false && data.sanctioned !== 'false'
            : existing[0].sanctioned !== false && existing[0].sanctioned !== 'false',
        team_count: (() => {
          if (data.team_count === null || data.team_count === undefined || data.team_count === '') {
            return null;
          }
          const n = parseInt(String(data.team_count), 10);
          return Number.isFinite(n) ? n : null;
        })(),
        match_format: data.match_format?.trim() || null,
        description: data.description || null,
        registration_url: data.registration_url?.trim() || null,
        source_url: data.source_url?.trim() || null,
        source_type: data.source_type?.trim() || null,
        ingest_source_id: data.ingest_source_id || null,
        ingest_run_id: data.ingest_run_id || null,
        external_id: data.external_id?.trim() || null,
      });
      return this.transformRow(row);
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
      return { id: String(id) };
    } catch (error) {
      Logger.error('Failed to delete cup', error, { id });
      throw new AppError('Failed to delete cup', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      return await BulkOperationsHelper.bulkDelete(req, 'cups', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete cups', error);
      throw new AppError('Failed to bulk delete cups', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Find existing cup for import: (ingest_source_id + external_id), else same source + name + dates.
   * Secondary match avoids duplicates when external_id changes between parser versions or page HTML.
   */
  async findCupIdForImportDedupe(req, ingestSourceId, item) {
    const db = Database.get(req);
    const parsedIngest =
      ingestSourceId !== null &&
      ingestSourceId !== undefined &&
      String(ingestSourceId).trim() !== ''
        ? parseInt(String(ingestSourceId), 10)
        : NaN;
    const ingestId = Number.isNaN(parsedIngest) ? null : parsedIngest;
    if (ingestId == null) {
      return null;
    }

    const name = String(item?.name || '').trim();
    if (!name) {
      return null;
    }

    const ext =
      item.external_id !== null && item.external_id !== undefined
        ? String(item.external_id).trim()
        : '';
    if (ext) {
      const byExt = await db.query(
        'SELECT id FROM cups WHERE ingest_source_id = $1 AND external_id = $2 LIMIT 1',
        [ingestId, ext],
      );
      if (byExt.length) return byExt[0].id;
    }

    const start = item.start_date ?? null;
    const end = item.end_date ?? null;

    const byKey = await db.query(
      `SELECT id FROM cups WHERE ingest_source_id = $1
       AND name = $2
       AND start_date IS NOT DISTINCT FROM $3::timestamptz
       AND end_date IS NOT DISTINCT FROM $4::timestamptz
       LIMIT 1`,
      [ingestId, name, start, end],
    );
    return byKey.length ? byKey[0].id : null;
  }

  buildImportPayload(item, importMeta) {
    const name = String(item?.name || '').trim();
    const extRaw = item.external_id != null ? String(item.external_id).trim() : '';
    return {
      name,
      organizer: item.organizer?.trim() || null,
      location: item.location?.trim() || null,
      start_date: item.start_date ?? null,
      end_date: item.end_date ?? null,
      categories: item.categories?.trim() || null,
      team_count: (() => {
        if (item.team_count === null || item.team_count === undefined || item.team_count === '') {
          return null;
        }
        const n = parseInt(String(item.team_count), 10);
        return Number.isFinite(n) ? n : null;
      })(),
      match_format:
        item.match_format != null && String(item.match_format).trim() !== ''
          ? String(item.match_format).trim()
          : null,
      description: item.description ?? null,
      registration_url: item.registration_url?.trim() || null,
      source_url: item.source_url ?? importMeta.sourceUrl ?? null,
      source_type: item.source_type ?? importMeta.sourceType ?? 'html',
      ingest_source_id: importMeta.ingestSourceId ?? null,
      ingest_run_id: importMeta.ingestRunId ?? null,
      external_id: extRaw || null,
    };
  }

  async createManyFromImport(req, items, importMeta = {}) {
    const errors = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const ingestSourceId = importMeta.ingestSourceId ?? null;

    const userId = Database.get(req).getUserId();
    if (!userId) {
      throw new AppError('User context required for import', 400, AppError.CODES.BAD_REQUEST);
    }

    for (const item of items || []) {
      const name = String(item?.name || '').trim();
      if (!name) {
        skipped += 1;
        continue;
      }
      try {
        const payload = this.buildImportPayload(item, importMeta);
        const existingId = await this.findCupIdForImportDedupe(req, ingestSourceId, item);
        if (existingId != null) {
          await this.update(req, existingId, payload);
          updated += 1;
        } else {
          await this.create(req, payload);
          created += 1;
        }
      } catch (e) {
        skipped += 1;
        const orig = e?.details && typeof e.details === 'object' ? e.details.originalError : null;
        errors.push(
          orig && String(orig).trim()
            ? `${e?.message || 'Error'}: ${orig}`
            : e?.message || 'Failed to save imported cup',
        );
      }
    }
    return { created, updated, skipped, errors };
  }
}

module.exports = CupsModel;
