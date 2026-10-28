// plugins/site-audits/model.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
const { validateAuditUrl } = require('./services/urlGuard');
const { failStaleRuns } = require('./services/runAudit');

const TABLE = 'site_audits';
const RUNS_TABLE = 'site_audit_runs';

class SiteAuditModel {
  constructor() {
    this.table = TABLE;
    this.runsTable = RUNS_TABLE;
  }

  // ---------- transforms ----------

  transformRow(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      name: row.name ?? '',
      url: row.url ?? '',
      competitorUrl: row.competitor_url ?? null,
      lastScore: row.last_score != null ? Number(row.last_score) : null,
      lastRunAt: row.last_run_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  transformRunRow(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      siteAuditId: String(row.site_audit_id),
      target: row.target ?? 'site',
      status: row.status ?? 'queued',
      score: row.score != null ? Number(row.score) : null,
      summary: row.summary ?? {},
      pages: row.pages ?? [],
      error: row.error ?? null,
      startedAt: row.started_at,
      finishedAt: row.finished_at ?? null,
    };
  }

  // ---------- validation (defense-in-depth; routes.js also validates) ----------

  normalizeFields(data, { partial = false } = {}) {
    const out = {};
    const input = data || {};

    if (!partial || input.name !== undefined) {
      const name = String(input.name ?? '').trim();
      if (!name) {
        throw new AppError('name is required', 400, AppError.CODES.VALIDATION_ERROR, [
          { field: 'name', message: 'name is required' },
        ]);
      }
      if (name.length > 255) {
        throw new AppError(
          'name must not exceed 255 characters',
          400,
          AppError.CODES.VALIDATION_ERROR,
          [{ field: 'name', message: 'name must not exceed 255 characters' }],
        );
      }
      out.name = name;
    }

    if (!partial || input.url !== undefined) {
      const url = String(input.url ?? '').trim();
      if (!url) {
        throw new AppError('url is required', 400, AppError.CODES.VALIDATION_ERROR, [
          { field: 'url', message: 'url is required' },
        ]);
      }
      if (url.length > 2048) {
        throw new AppError(
          'url must not exceed 2048 characters',
          400,
          AppError.CODES.VALIDATION_ERROR,
          [{ field: 'url', message: 'url must not exceed 2048 characters' }],
        );
      }
      const check = validateAuditUrl(url);
      if (!check.ok) {
        throw new AppError(check.error, 400, AppError.CODES.VALIDATION_ERROR, [
          { field: 'url', message: check.error },
        ]);
      }
      out.url = url;
    }

    if (!partial || input.competitorUrl !== undefined) {
      const raw = input.competitorUrl;
      const competitorUrl =
        raw === undefined || raw === null || raw === '' ? null : String(raw).trim();
      if (competitorUrl) {
        if (competitorUrl.length > 2048) {
          throw new AppError(
            'competitorUrl must not exceed 2048 characters',
            400,
            AppError.CODES.VALIDATION_ERROR,
            [{ field: 'competitorUrl', message: 'competitorUrl must not exceed 2048 characters' }],
          );
        }
        const check = validateAuditUrl(competitorUrl);
        if (!check.ok) {
          throw new AppError(check.error, 400, AppError.CODES.VALIDATION_ERROR, [
            { field: 'competitorUrl', message: check.error },
          ]);
        }
      }
      out.competitorUrl = competitorUrl;
    }

    return out;
  }

  // ---------- site_audits CRUD (user_id scoped via Database tenant isolation) ----------

  async getAll(req) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      const rows = await db.query(`SELECT * FROM ${this.table} ORDER BY updated_at DESC`, []);
      return rows.map((row) => this.transformRow(row));
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch site audits', error);
      throw new AppError('Failed to fetch site audits', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, id) {
    try {
      const db = Database.get(req);
      const parsedId = parseInt(String(id), 10);
      if (Number.isNaN(parsedId)) {
        return null;
      }
      const rows = await db.query(`SELECT * FROM ${this.table} WHERE id = $1`, [parsedId]);
      if (!rows.length) {
        return null;
      }
      return this.transformRow(rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch site audit', error, { id });
      throw new AppError('Failed to fetch site audit', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, data) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      const fields = this.normalizeFields(data);
      const record = await db.insert(this.table, {
        name: fields.name,
        url: fields.url,
        competitor_url: fields.competitorUrl ?? null,
      });
      Logger.info('Site audit created', { siteAuditId: record.id });
      return this.transformRow(record);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create site audit', error);
      throw error;
    }
  }

  async update(req, id, data) {
    try {
      const parsedId = parseInt(String(id), 10);
      if (Number.isNaN(parsedId)) {
        throw new AppError('Site audit not found', 404, AppError.CODES.NOT_FOUND);
      }
      const db = Database.get(req);
      const fields = this.normalizeFields(data);
      const record = await db.update(this.table, parsedId, {
        name: fields.name,
        url: fields.url,
        competitor_url: fields.competitorUrl ?? null,
      });
      Logger.info('Site audit updated', { siteAuditId: parsedId });
      return this.transformRow(record);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update site audit', error, { id });
      throw error;
    }
  }

  async delete(req, id) {
    try {
      const parsedId = parseInt(String(id), 10);
      if (Number.isNaN(parsedId)) {
        throw new AppError('Site audit not found', 404, AppError.CODES.NOT_FOUND);
      }
      const db = Database.get(req);
      const existing = await db.query(`SELECT * FROM ${this.table} WHERE id = $1`, [parsedId]);
      const backup = existing.length ? this.transformRow(existing[0]) : null;

      await db.deleteRecord(this.table, parsedId);
      Logger.info('Site audit deleted', { siteAuditId: parsedId });
      return { id: String(parsedId), backup };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete site audit', error, { id });
      throw new AppError('Failed to delete site audit', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      const db = Database.get(req);
      let backups = [];
      if (Array.isArray(idsTextArray) && idsTextArray.length > 0) {
        const ids = idsTextArray.map((id) => parseInt(id, 10)).filter((id) => !Number.isNaN(id));
        if (ids.length > 0) {
          const existing = await db.query(`SELECT * FROM ${this.table} WHERE id = ANY($1::int[])`, [
            ids,
          ]);
          backups = existing.map((row) => this.transformRow(row));
        }
      }
      const result = await BulkOperationsHelper.bulkDelete(req, this.table, idsTextArray);
      return { ...result, backups };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to bulk delete site audits', error);
      throw new AppError('Failed to bulk delete site audits', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // ---------- site_audit_runs ----------
  // site_audit_runs has NO user_id column, so Database.query()/insert()/update() cannot be used
  // for it directly — PostgreSQLAdapter._addTenantFilter() blindly appends `AND user_id = $n`
  // to any query that doesn't already mention user_id, which would break against this table.
  // Instead we go through the raw tenant pool (db.getPool(), same technique as
  // plugins/instructions/model.js getStepsForInstruction) and enforce ownership explicitly by
  // first loading the parent site_audit (which *is* user_id-scoped).

  async assertOwnedSiteAudit(req, siteAuditId) {
    const db = Database.get(req);
    if (!db.getUserId()) {
      throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
    }
    const site = await this.getById(req, siteAuditId);
    if (!site) {
      throw new AppError('Site audit not found', 404, AppError.CODES.NOT_FOUND);
    }
    return site;
  }

  async createRun(req, siteAuditId, { target = 'site' } = {}) {
    try {
      const site = await this.assertOwnedSiteAudit(req, siteAuditId);
      const db = Database.get(req);
      const result = await db.getPool().query(
        `
          INSERT INTO ${this.runsTable} (site_audit_id, target, status)
          VALUES ($1, $2, 'queued')
          RETURNING *
        `,
        [Number(site.id), target],
      );
      const run = this.transformRunRow(result.rows[0]);
      Logger.info('Site audit run created', { siteAuditId: site.id, target, runId: run.id });
      return run;
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create site audit run', error, { siteAuditId, target });
      throw new AppError('Failed to create audit run', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateRunRaw(req, runId, data) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      const allowedColumns = new Set([
        'status',
        'score',
        'summary',
        'pages',
        'error',
        'finished_at',
      ]);
      const columns = [];
      const values = [];
      let i = 1;
      for (const [key, value] of Object.entries(data)) {
        if (!allowedColumns.has(key)) {
          throw new AppError('Failed to update audit run', 500, AppError.CODES.DATABASE_ERROR);
        }
        columns.push(`${key} = $${i}`);
        const isJsonColumn = key === 'summary' || key === 'pages';
        values.push(isJsonColumn ? JSON.stringify(value ?? (key === 'pages' ? [] : {})) : value);
        i += 1;
      }
      if (!columns.length) {
        throw new AppError('Failed to update audit run', 500, AppError.CODES.DATABASE_ERROR);
      }
      values.push(Number(runId));
      const runParam = i;
      i += 1;
      values.push(userId);
      const result = await db.getPool().query(
        `
          UPDATE ${this.runsTable}
          SET ${columns.join(', ')}
          WHERE id = $${runParam}
            AND site_audit_id IN (SELECT id FROM ${this.table} WHERE user_id = $${i})
          RETURNING *
        `,
        values,
      );
      if (!result.rows.length) {
        throw new AppError('Audit run not found', 404, AppError.CODES.NOT_FOUND);
      }
      return this.transformRunRow(result.rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update site audit run', error, { runId });
      throw new AppError('Failed to update audit run', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async markRunRunning(req, runId) {
    return this.updateRunRaw(req, runId, { status: 'running' });
  }

  async finishRun(
    req,
    runId,
    { status, score = null, summary = null, pages = null, error = null },
  ) {
    return this.updateRunRaw(req, runId, {
      status,
      score,
      summary,
      pages,
      error,
      finished_at: new Date(),
    });
  }

  /**
   * Finish a run only when it is still queued/running (cancel / race-safe).
   * @returns {object|null} updated run, or null when already terminal
   */
  async finishRunIfActive(
    req,
    runId,
    { status, score = null, summary = null, pages = null, error = null },
  ) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      const result = await db.getPool().query(
        `
          UPDATE ${this.runsTable}
          SET status = $1,
              score = $2,
              summary = $3,
              pages = $4,
              error = $5,
              finished_at = NOW()
          WHERE id = $6
            AND status IN ('queued', 'running')
            AND site_audit_id IN (SELECT id FROM ${this.table} WHERE user_id = $7)
          RETURNING *
        `,
        [
          status,
          score,
          JSON.stringify(summary ?? {}),
          JSON.stringify(pages ?? []),
          error,
          Number(runId),
          userId,
        ],
      );
      if (!result.rows.length) {
        return null;
      }
      return this.transformRunRow(result.rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to finish active site audit run', error, { runId });
      throw new AppError('Failed to update audit run', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async attachComparison(req, runId, comparison) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) return null;
      const pool = db.getPool();
      const existing = await pool.query(
        `
          SELECT r.summary
          FROM ${this.runsTable} r
          INNER JOIN ${this.table} s ON s.id = r.site_audit_id
          WHERE r.id = $1 AND s.user_id = $2
        `,
        [Number(runId), userId],
      );
      if (!existing.rows.length) return null;
      const summary = { ...(existing.rows[0].summary || {}), comparison };
      const result = await pool.query(
        `
          UPDATE ${this.runsTable}
          SET summary = $1
          WHERE id = $2
            AND site_audit_id IN (SELECT id FROM ${this.table} WHERE user_id = $3)
          RETURNING *
        `,
        [JSON.stringify(summary), Number(runId), userId],
      );
      return this.transformRunRow(result.rows[0]);
    } catch (error) {
      // Comparison is a nice-to-have attached after both legs finish; never fail the run over it.
      Logger.error('Failed to attach comparison to site audit run', error, { runId });
      return null;
    }
  }

  async markSiteAuditScore(req, siteAuditId, { lastScore, lastRunAt }) {
    try {
      const db = Database.get(req);
      await db.update(this.table, Number(siteAuditId), {
        last_score: lastScore,
        last_run_at: lastRunAt,
      });
    } catch (error) {
      Logger.error('Failed to update site audit last score', error, { siteAuditId });
    }
  }

  async getRunsForSite(req, siteAuditId, limit = 50) {
    try {
      const site = await this.assertOwnedSiteAudit(req, siteAuditId);
      const db = Database.get(req);
      const pool = db.getPool();
      await failStaleRuns(pool, db.getUserId());
      const cap = Math.min(Math.max(1, Number(limit) || 50), 100);
      const result = await pool.query(
        `
          SELECT * FROM ${this.runsTable}
          WHERE site_audit_id = $1
          ORDER BY started_at DESC
          LIMIT $2
        `,
        [Number(site.id), cap],
      );
      return result.rows.map((row) => this.transformRunRow(row));
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch site audit runs', error, { siteAuditId });
      throw new AppError('Failed to fetch audit runs', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getRunById(req, siteAuditId, runId) {
    try {
      const site = await this.assertOwnedSiteAudit(req, siteAuditId);
      const parsedRunId = parseInt(String(runId), 10);
      if (Number.isNaN(parsedRunId)) {
        throw new AppError('Audit run not found', 404, AppError.CODES.NOT_FOUND);
      }
      const db = Database.get(req);
      // Poll path (GET /:id/runs/:runId). Sweep here so a client waiting on one run
      // sees a stale queued/running row flip to failed without listing or starting another.
      await failStaleRuns(db.getPool(), db.getUserId());
      const result = await db
        .getPool()
        .query(`SELECT * FROM ${this.runsTable} WHERE id = $1 AND site_audit_id = $2`, [
          parsedRunId,
          Number(site.id),
        ]);
      if (!result.rows.length) {
        throw new AppError('Audit run not found', 404, AppError.CODES.NOT_FOUND);
      }
      return this.transformRunRow(result.rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch site audit run', error, { siteAuditId, runId });
      throw new AppError('Failed to fetch audit run', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = SiteAuditModel;
