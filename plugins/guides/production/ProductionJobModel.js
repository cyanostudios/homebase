// plugins/guides/production/ProductionJobModel.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');

const JOBS_TABLE = 'guide_production_jobs';
const ITEMS_TABLE = 'guide_production_job_items';
const EVENTS_TABLE = 'guide_production_job_events';

const JOB_TYPES = ['full_guide', 'stop', 'variant'];
const JOB_STATUSES = [
  'pending',
  'processing',
  'awaiting_review',
  'completed',
  'failed',
  'cancelled',
];
const ITEM_STEPS = ['text_derivation', 'translation', 'audio'];
const ITEM_STATUSES = ['pending', 'processing', 'completed', 'failed', 'skipped'];

class ProductionJobModel {
  transformJobRow(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      placeId: String(row.place_id),
      type: row.type,
      status: row.status,
      scopeStopId: row.scope_stop_id != null ? String(row.scope_stop_id) : null,
      scopeVariantId: row.scope_variant_id != null ? String(row.scope_variant_id) : null,
      errorMessage: row.error_message ?? null,
      startedAt: row.started_at ?? null,
      completedAt: row.completed_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  transformItemRow(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      jobId: String(row.job_id),
      stopId: String(row.stop_id),
      variantId: row.variant_id != null ? String(row.variant_id) : null,
      step: row.step,
      status: row.status,
      fingerprint: row.fingerprint,
      providerKey: row.provider_key,
      providerResult: row.provider_result ?? null,
      errorMessage: row.error_message ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createJob(req, placeId, data) {
    const db = Database.get(req);
    const userId = db.getUserId();
    if (!userId) {
      throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
    }

    const type = String(data.type ?? '')
      .trim()
      .toLowerCase();
    if (!JOB_TYPES.includes(type)) {
      throw new AppError('Invalid production job type', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const rows = await db.query(
      `
        INSERT INTO ${JOBS_TABLE} (
          user_id,
          place_id,
          type,
          status,
          scope_stop_id,
          scope_variant_id
        )
        VALUES ($1, $2, $3, 'pending', $4, $5)
        RETURNING *
      `,
      [userId, placeId, type, data.scopeStopId ?? null, data.scopeVariantId ?? null],
    );

    const job = this.transformJobRow(rows[0]);
    await this.appendEvent(req, job.id, 'job_created', { type });
    return job;
  }

  async getJobById(req, placeId, jobId) {
    const db = Database.get(req);
    const rows = await db.query(
      `
        SELECT *
        FROM ${JOBS_TABLE}
        WHERE id = $1 AND place_id = $2
      `,
      [jobId, placeId],
    );
    if (!rows.length) {
      throw new AppError('Production job not found', 404, AppError.CODES.NOT_FOUND);
    }
    return this.transformJobRow(rows[0]);
  }

  async listJobs(req, placeId) {
    const db = Database.get(req);
    const rows = await db.query(
      `
        SELECT *
        FROM ${JOBS_TABLE}
        WHERE place_id = $1
        ORDER BY created_at DESC, id DESC
      `,
      [placeId],
    );
    return rows.map((row) => this.transformJobRow(row));
  }

  async listJobItems(req, jobId) {
    const db = Database.get(req);
    const rows = await db.query(
      `
        SELECT *
        FROM ${ITEMS_TABLE}
        WHERE job_id = $1
        ORDER BY id ASC
      `,
      [jobId],
    );
    return rows.map((row) => this.transformItemRow(row));
  }

  async updateJobStatus(req, placeId, jobId, status, extra = {}) {
    if (!JOB_STATUSES.includes(status)) {
      throw new AppError('Invalid production job status', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const db = Database.get(req);
    const rows = await db.query(
      `
        UPDATE ${JOBS_TABLE}
        SET
          status = $1,
          error_message = COALESCE($2, error_message),
          started_at = CASE WHEN $1 = 'processing' AND started_at IS NULL THEN NOW() ELSE started_at END,
          completed_at = CASE WHEN $1 IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND place_id = $4
        RETURNING *
      `,
      [status, extra.errorMessage ?? null, jobId, placeId],
    );
    if (!rows.length) {
      throw new AppError('Production job not found', 404, AppError.CODES.NOT_FOUND);
    }
    await this.appendEvent(req, jobId, `job_${status}`, extra.payload ?? null);
    return this.transformJobRow(rows[0]);
  }

  async hasCompletedFingerprint(req, placeId, fingerprint) {
    const db = Database.get(req);
    const rows = await db.query(
      `
        SELECT 1
        FROM ${ITEMS_TABLE} i
        INNER JOIN ${JOBS_TABLE} j ON j.id = i.job_id
        WHERE j.place_id = $1
          AND i.fingerprint = $2
          AND i.status = 'completed'
        LIMIT 1
      `,
      [placeId, fingerprint],
    );
    return rows.length > 0;
  }

  async createJobItem(req, jobId, data) {
    const step = String(data.step ?? '')
      .trim()
      .toLowerCase();
    if (!ITEM_STEPS.includes(step)) {
      throw new AppError('Invalid production job step', 400, AppError.CODES.VALIDATION_ERROR);
    }
    const status = data.status ?? 'completed';
    if (!ITEM_STATUSES.includes(status)) {
      throw new AppError(
        'Invalid production job item status',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }

    const db = Database.get(req);
    const rows = await db.query(
      `
        INSERT INTO ${ITEMS_TABLE} (
          job_id,
          stop_id,
          variant_id,
          step,
          status,
          fingerprint,
          provider_key,
          provider_result,
          error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        jobId,
        data.stopId,
        data.variantId ?? null,
        step,
        status,
        data.fingerprint,
        data.providerKey,
        data.providerResult ? JSON.stringify(data.providerResult) : null,
        data.errorMessage ?? null,
      ],
    );
    const item = this.transformItemRow(rows[0]);
    await this.appendEvent(req, jobId, 'item_created', { itemId: item.id, step, status }, item.id);
    return item;
  }

  async appendEvent(req, jobId, eventType, payload, itemId = null) {
    const db = Database.get(req);
    await db.query(
      `
        INSERT INTO ${EVENTS_TABLE} (job_id, item_id, event_type, payload)
        VALUES ($1, $2, $3, $4)
      `,
      [jobId, itemId, eventType, payload ? JSON.stringify(payload) : null],
    );
  }
}

module.exports = {
  ProductionJobModel,
  JOB_TYPES,
  JOB_STATUSES,
  ITEM_STEPS,
  ITEM_STATUSES,
};
