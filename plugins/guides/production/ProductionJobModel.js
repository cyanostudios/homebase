// plugins/guides/production/ProductionJobModel.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');

const JOBS_TABLE = 'guide_production_jobs';
const ITEMS_TABLE = 'guide_production_job_items';
const EVENTS_TABLE = 'guide_production_job_events';
const WORKERS_TABLE = 'guide_production_workers';

const JOB_TYPES = ['full_guide'];
const JOB_STATUSES = [
  'pending',
  'planning',
  'processing',
  'awaiting_review',
  'completed',
  'failed',
  'cancelled',
];
const ITEM_STEPS = ['text_derivation', 'translation'];
const ITEM_STATUSES = [
  'pending',
  'queued',
  'processing',
  'awaiting_callback',
  'completed',
  'failed',
  'skipped',
  'cancelled',
];
const REVIEW_STATUSES = ['pending_review', 'approved', 'rejected', 'superseded'];
const CHECKPOINT_MODES = ['after_text', 'after_each', 'auto'];
/** Text-first pipeline; translation is opt-in until a real provider exists. */
const DEFAULT_PHASES = ['text_derivation'];
const DEFAULT_CHECKPOINT_MODE = 'after_text';

const IN_FLIGHT_ITEM_STATUSES = ['pending', 'queued', 'processing', 'awaiting_callback'];

class ProductionJobModel {
  transformJobRow(row) {
    if (!row) return null;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      placeId: String(row.place_id),
      type: row.type,
      status: row.status,
      phases: row.phases ?? DEFAULT_PHASES,
      currentPhaseIndex: row.current_phase_index ?? 0,
      checkpointMode: row.checkpoint_mode ?? DEFAULT_CHECKPOINT_MODE,
      priority: row.priority ?? 50,
      queuedAt: row.queued_at ?? null,
      workerClaimedAt: row.worker_claimed_at ?? null,
      reviewPhase: row.review_phase ?? null,
      jobOptions: row.job_options ?? null,
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
      userId: row.user_id != null ? String(row.user_id) : null,
      presentationId: String(row.presentation_id),
      step: row.step,
      phaseIndex: row.phase_index ?? 0,
      status: row.status,
      fingerprint: row.fingerprint,
      providerKey: row.provider_key,
      providerVersion: row.provider_version ?? '1',
      providerResult: row.provider_result ?? null,
      reviewStatus: row.review_status ?? null,
      reviewedAt: row.reviewed_at ?? null,
      retryCount: row.retry_count ?? 0,
      retryAfter: row.retry_after ?? null,
      externalId: row.external_id ?? null,
      workerClaimedAt: row.worker_claimed_at ?? null,
      errorMessage: row.error_message ?? null,
      failureCode: row.failure_code ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  _requireUserId(req) {
    const db = Database.get(req);
    const userId = db.getUserId();
    if (!userId) {
      throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
    }
    return { db, userId };
  }

  async createJob(req, placeId, data) {
    const { db, userId } = this._requireUserId(req);

    const type = String(data.type ?? '')
      .trim()
      .toLowerCase();
    if (!JOB_TYPES.includes(type)) {
      throw new AppError('Invalid production job type', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const phases = Array.isArray(data.phases) && data.phases.length ? data.phases : DEFAULT_PHASES;
    const checkpointMode = data.checkpointMode ?? DEFAULT_CHECKPOINT_MODE;
    if (!CHECKPOINT_MODES.includes(checkpointMode)) {
      throw new AppError('Invalid checkpoint mode', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const rows = await db.query(
      `
        INSERT INTO ${JOBS_TABLE} (
          user_id,
          place_id,
          type,
          status,
          phases,
          checkpoint_mode,
          priority,
          queued_at,
          job_options
        )
        VALUES ($1, $2, $3, 'pending', $4::jsonb, $5, $6, COALESCE($7, NOW()), $8::jsonb)
        RETURNING *
      `,
      [
        userId,
        placeId,
        type,
        JSON.stringify(phases),
        checkpointMode,
        data.priority ?? 50,
        data.queuedAt ?? null,
        data.jobOptions ? JSON.stringify(data.jobOptions) : null,
      ],
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

  async getJobByIdInternal(req, jobId) {
    const db = Database.get(req);
    const rows = await db.query(
      `
        SELECT *
        FROM ${JOBS_TABLE}
        WHERE id = $1
      `,
      [jobId],
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

  /**
   * Sum estimated provider costs across all completed production items for a place
   * (text, translation, future audio steps — any item with provider_result.cost).
   * @returns {{ currency: string, totalCost: number, estimated: boolean }|null}
   */
  async sumPlaceEstimatedCost(req, placeId) {
    const { db, userId } = this._requireUserId(req);
    const rows = await db.query(
      `
        SELECT
          COALESCE(
            SUM((i.provider_result->'cost'->>'totalCost')::numeric),
            0
          ) AS total_cost,
          (
            SELECT i2.provider_result->'cost'->>'currency'
            FROM ${ITEMS_TABLE} i2
            INNER JOIN ${JOBS_TABLE} j2 ON j2.id = i2.job_id
            WHERE j2.place_id = $1
              AND j2.user_id = $2
              AND i2.status = 'completed'
              AND i2.provider_result->'cost'->>'currency' IS NOT NULL
            ORDER BY i2.id DESC
            LIMIT 1
          ) AS currency,
          BOOL_AND(COALESCE((i.provider_result->'cost'->>'estimated')::boolean, true))
            AS all_estimated
        FROM ${ITEMS_TABLE} i
        INNER JOIN ${JOBS_TABLE} j ON j.id = i.job_id
        WHERE j.place_id = $1
          AND j.user_id = $2
          AND i.status = 'completed'
          AND i.provider_result->'cost'->>'totalCost' IS NOT NULL
      `,
      [placeId, userId],
    );
    const row = rows[0];
    if (!row || row.currency == null) {
      return null;
    }
    return {
      currency: String(row.currency),
      totalCost: Math.round(Number(row.total_cost || 0) * 1e8) / 1e8,
      estimated: row.all_estimated !== false,
    };
  }

  async hasActiveJob(req, placeId) {
    const db = Database.get(req);
    const rows = await db.query(
      `
        SELECT 1
        FROM ${JOBS_TABLE}
        WHERE place_id = $1
          AND status IN ('pending', 'planning', 'processing', 'awaiting_review')
        LIMIT 1
      `,
      [placeId],
    );
    return rows.length > 0;
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

  async listJobsByStatus(req, status) {
    const { db, userId } = this._requireUserId(req);
    const rows = await db.query(
      `
        SELECT *
        FROM ${JOBS_TABLE}
        WHERE user_id = $1 AND status = $2
        ORDER BY updated_at ASC, id ASC
      `,
      [userId, status],
    );
    return rows.map((row) => this.transformJobRow(row));
  }

  async updateJobStatus(req, placeId, jobId, status, extra = {}) {
    if (!JOB_STATUSES.includes(status)) {
      throw new AppError('Invalid production job status', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const db = Database.get(req);
    const blockedFrom = extra.blockedFrom ?? [];
    const blockedClause =
      blockedFrom.length > 0
        ? ` AND status NOT IN (${blockedFrom.map((_, i) => `$${6 + i}`).join(', ')})`
        : '';
    const params = [
      status,
      extra.errorMessage ?? null,
      extra.reviewPhase ?? null,
      jobId,
      placeId,
      ...blockedFrom,
    ];

    const clearError = Boolean(extra.clearErrorMessage);
    const rows = await db.query(
      `
        UPDATE ${JOBS_TABLE}
        SET
          status = $1::text,
          error_message = CASE WHEN $${6 + blockedFrom.length}::boolean IS TRUE THEN NULL ELSE COALESCE($2, error_message) END,
          review_phase = COALESCE($3, review_phase),
          started_at = CASE WHEN $1::text = 'processing' AND started_at IS NULL THEN NOW() ELSE started_at END,
          completed_at = CASE WHEN $1::text IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND place_id = $5${blockedClause}
        RETURNING *
      `,
      [...params, clearError],
    );
    if (!rows.length) {
      if (blockedFrom.length > 0) {
        return null;
      }
      throw new AppError('Production job not found', 404, AppError.CODES.NOT_FOUND);
    }
    await this.appendEvent(req, jobId, `job_${status}`, extra.payload ?? null);
    return this.transformJobRow(rows[0]);
  }

  /**
   * Merge keys into job_options JSONB (shallow merge).
   * @param {import('express').Request} req
   * @param {string} jobId
   * @param {object} patch
   */
  async mergeJobOptions(req, jobId, patch) {
    const { db, userId } = this._requireUserId(req);
    const rows = await db.query(
      `
        UPDATE ${JOBS_TABLE}
        SET
          job_options = COALESCE(job_options, '{}'::jsonb) || $1::jsonb,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `,
      [JSON.stringify(patch ?? {}), jobId, userId],
    );
    if (!rows.length) {
      throw new AppError('Production job not found', 404, AppError.CODES.NOT_FOUND);
    }
    return this.transformJobRow(rows[0]);
  }

  async requeueJobForNextPhase(req, placeId, jobId) {
    const db = Database.get(req);
    const rows = await db.query(
      `
        UPDATE ${JOBS_TABLE}
        SET
          current_phase_index = current_phase_index + 1,
          status = 'pending',
          queued_at = NOW(),
          review_phase = NULL,
          worker_claimed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND place_id = $2 AND status IN ('awaiting_review', 'processing')
        RETURNING *
      `,
      [jobId, placeId],
    );
    if (!rows.length) {
      throw new AppError('Production job not found', 404, AppError.CODES.NOT_FOUND);
    }
    return this.transformJobRow(rows[0]);
  }

  async claimPendingJob(req) {
    const { db, userId } = this._requireUserId(req);
    const rows = await db.query(
      `
        UPDATE ${JOBS_TABLE}
        SET
          status = 'planning',
          worker_claimed_at = NOW(),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = (
          SELECT id
          FROM ${JOBS_TABLE}
          WHERE user_id = $1
            AND status = 'pending'
          ORDER BY priority DESC, queued_at ASC NULLS LAST, id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `,
      [userId],
    );
    return rows.length ? this.transformJobRow(rows[0]) : null;
  }

  async claimPendingItems(req, batchSize) {
    const { db, userId } = this._requireUserId(req);
    const limit = Math.max(1, Number(batchSize) || 5);
    const rows = await db.query(
      `
        UPDATE ${ITEMS_TABLE}
        SET
          status = 'processing',
          worker_claimed_at = NOW(),
          updated_at = CURRENT_TIMESTAMP
        WHERE id IN (
          SELECT i.id
          FROM ${ITEMS_TABLE} i
          INNER JOIN ${JOBS_TABLE} j ON j.id = i.job_id
          WHERE i.user_id = $1
            AND i.status = 'pending'
            AND (i.retry_after IS NULL OR i.retry_after <= NOW())
            AND j.status = 'processing'
          ORDER BY i.created_at ASC, i.id ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `,
      [userId, limit],
    );
    return rows.map((row) => this.transformItemRow(row));
  }

  async countInFlightItems(req, jobId, phaseIndex = null) {
    const db = Database.get(req);
    const phaseClause = phaseIndex != null ? ' AND phase_index = $3' : '';
    const params =
      phaseIndex != null
        ? [jobId, IN_FLIGHT_ITEM_STATUSES, phaseIndex]
        : [jobId, IN_FLIGHT_ITEM_STATUSES];
    const rows = await db.query(
      `
        SELECT COUNT(*)::int AS count
        FROM ${ITEMS_TABLE}
        WHERE job_id = $1
          AND status = ANY($2::text[])${phaseClause}
      `,
      params,
    );
    return rows[0]?.count ?? 0;
  }

  async summarizeJobItems(req, jobId, phaseIndex = null) {
    const db = Database.get(req);
    const phaseClause = phaseIndex != null ? ' AND phase_index = $2' : '';
    const params = phaseIndex != null ? [jobId, phaseIndex] : [jobId];
    const rows = await db.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
          COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped,
          COUNT(*) FILTER (
            WHERE status = 'completed'
              AND (review_status IS NULL OR review_status = 'pending_review')
          )::int AS reviewable
        FROM ${ITEMS_TABLE}
        WHERE job_id = $1${phaseClause}
      `,
      params,
    );
    const row = rows[0] ?? {};
    return {
      total: row.total ?? 0,
      failed: row.failed ?? 0,
      skipped: row.skipped ?? 0,
      reviewable: row.reviewable ?? 0,
    };
  }

  async listApprovedPresentationTargetsForPhase(req, jobId, phaseIndex) {
    const db = Database.get(req);
    const rows = await db.query(
      `
        SELECT DISTINCT presentation_id
        FROM ${ITEMS_TABLE}
        WHERE job_id = $1
          AND phase_index = $2
          AND review_status = 'approved'
          AND presentation_id IS NOT NULL
      `,
      [jobId, phaseIndex],
    );
    return rows.map((row) => ({
      presentationId: String(row.presentation_id),
    }));
  }

  async cancelActiveItemsForJob(req, jobId) {
    const { db, userId } = this._requireUserId(req);
    const rows = await db.query(
      `
        UPDATE ${ITEMS_TABLE}
        SET
          status = 'cancelled',
          worker_claimed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = $1
          AND user_id = $2
          AND status IN ('pending', 'queued', 'processing', 'awaiting_callback')
        RETURNING id
      `,
      [jobId, userId],
    );
    return rows.length;
  }

  async getJobItemById(req, jobId, itemId) {
    const { db, userId } = this._requireUserId(req);
    const rows = await db.query(
      `
        SELECT *
        FROM ${ITEMS_TABLE}
        WHERE id = $1
          AND job_id = $2
          AND user_id = $3
      `,
      [itemId, jobId, userId],
    );
    if (!rows.length) {
      throw new AppError('Production job item not found', 404, AppError.CODES.NOT_FOUND);
    }
    return this.transformItemRow(rows[0]);
  }

  async hasCompletedFingerprint(req, fingerprint) {
    const { db, userId } = this._requireUserId(req);
    const rows = await db.query(
      `
        SELECT 1
        FROM ${ITEMS_TABLE}
        WHERE user_id = $1
          AND fingerprint = $2
          AND status = 'completed'
        LIMIT 1
      `,
      [userId, fingerprint],
    );
    return rows.length > 0;
  }

  async resetFailedItemsInPhase(req, jobId, phaseIndex) {
    const { db, userId } = this._requireUserId(req);
    const rows = await db.query(
      `
        UPDATE ${ITEMS_TABLE}
        SET
          status = 'pending',
          error_message = NULL,
          worker_claimed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = $1
          AND user_id = $2
          AND phase_index = $3
          AND status = 'failed'
        RETURNING id
      `,
      [jobId, userId, phaseIndex],
    );
    return rows.length;
  }

  async createJobItem(req, jobId, data) {
    const { db, userId } = this._requireUserId(req);
    const step = String(data.step ?? '')
      .trim()
      .toLowerCase();
    if (!ITEM_STEPS.includes(step)) {
      throw new AppError('Invalid production job step', 400, AppError.CODES.VALIDATION_ERROR);
    }
    const status = data.status ?? 'pending';
    if (!ITEM_STATUSES.includes(status)) {
      throw new AppError(
        'Invalid production job item status',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    if (data.reviewStatus && !REVIEW_STATUSES.includes(data.reviewStatus)) {
      throw new AppError('Invalid review status', 400, AppError.CODES.VALIDATION_ERROR);
    }
    if (data.presentationId == null || data.presentationId === '') {
      throw new AppError(
        'presentationId is required for production job items',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }

    const rows = await db.query(
      `
        INSERT INTO ${ITEMS_TABLE} (
          job_id,
          user_id,
          presentation_id,
          step,
          phase_index,
          status,
          fingerprint,
          provider_key,
          provider_version,
          provider_result,
          review_status,
          error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `,
      [
        jobId,
        userId,
        data.presentationId,
        step,
        data.phaseIndex ?? 0,
        status,
        data.fingerprint,
        data.providerKey,
        data.providerVersion ?? '1',
        data.providerResult ? JSON.stringify(data.providerResult) : null,
        data.reviewStatus ?? null,
        data.errorMessage ?? null,
      ],
    );
    const item = this.transformItemRow(rows[0]);
    await this.appendEvent(req, jobId, 'item_created', { itemId: item.id, step, status }, item.id);
    return item;
  }

  async updateJobItem(req, itemId, data) {
    const { db, userId } = this._requireUserId(req);
    if (data.status && !ITEM_STATUSES.includes(data.status)) {
      throw new AppError(
        'Invalid production job item status',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    if (data.reviewStatus && !REVIEW_STATUSES.includes(data.reviewStatus)) {
      throw new AppError('Invalid review status', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const rows = await db.query(
      `
        UPDATE ${ITEMS_TABLE}
        SET
          status = COALESCE($1, status),
          provider_result = COALESCE($2::jsonb, provider_result),
          review_status = COALESCE($3, review_status),
          reviewed_at = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE reviewed_at END,
          error_message = COALESCE($4, error_message),
          external_id = COALESCE($5, external_id),
          retry_count = COALESCE($6, retry_count),
          retry_after = COALESCE($7, retry_after),
          failure_code = COALESCE($8, failure_code),
          worker_claimed_at = CASE WHEN $1 IN ('completed', 'failed', 'skipped', 'cancelled', 'pending') THEN NULL ELSE worker_claimed_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $9 AND user_id = $10
        RETURNING *
      `,
      [
        data.status ?? null,
        data.providerResult ? JSON.stringify(data.providerResult) : null,
        data.reviewStatus ?? null,
        data.errorMessage ?? null,
        data.externalId ?? null,
        data.retryCount ?? null,
        data.retryAfter ?? null,
        data.failureCode ?? null,
        itemId,
        userId,
      ],
    );
    if (!rows.length) {
      throw new AppError('Production job item not found', 404, AppError.CODES.NOT_FOUND);
    }
    return this.transformItemRow(rows[0]);
  }

  async resetStuckItems(req, { timeoutMinutes, maxRetries }) {
    const { db, userId } = this._requireUserId(req);
    const timeout = Math.max(1, Number(timeoutMinutes) || 10);
    const retries = Math.max(1, Number(maxRetries) || 5);

    const retryRows = await db.query(
      `
        UPDATE ${ITEMS_TABLE}
        SET
          status = 'pending',
          retry_count = retry_count + 1,
          worker_claimed_at = NULL,
          error_message = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND status = 'processing'
          AND worker_claimed_at IS NOT NULL
          AND worker_claimed_at < NOW() - ($2::text || ' minutes')::interval
          AND retry_count < $3
        RETURNING id, job_id
      `,
      [userId, String(timeout), retries],
    );

    const failRows = await db.query(
      `
        UPDATE ${ITEMS_TABLE}
        SET
          status = 'failed',
          error_message = 'Max retries exceeded',
          worker_claimed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND status = 'processing'
          AND worker_claimed_at IS NOT NULL
          AND worker_claimed_at < NOW() - ($2::text || ' minutes')::interval
          AND retry_count >= $3
        RETURNING id, job_id
      `,
      [userId, String(timeout), retries],
    );

    return {
      retried: retryRows.length,
      failed: failRows.length,
    };
  }

  async upsertWorkerHeartbeat(req, workerId, itemsProcessing) {
    const db = Database.get(req);
    await db.query(
      `
        INSERT INTO ${WORKERS_TABLE} (worker_id, last_heartbeat_at, items_processing)
        VALUES ($1, NOW(), $2)
        ON CONFLICT (worker_id)
        DO UPDATE SET
          last_heartbeat_at = NOW(),
          items_processing = EXCLUDED.items_processing
      `,
      [workerId, itemsProcessing],
    );
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
  REVIEW_STATUSES,
  DEFAULT_PHASES,
  DEFAULT_CHECKPOINT_MODE,
  CHECKPOINT_MODES,
  IN_FLIGHT_ITEM_STATUSES,
};
