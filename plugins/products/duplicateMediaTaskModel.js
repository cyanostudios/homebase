const { Database } = require('@homebase/core');

const { AppError } = require('../../server/core/errors/AppError');

const TABLE = 'product_duplicate_media_tasks';

/**
 * @param {import('@homebase/core').RequestContext} req
 * @param {string|number} jobId
 * @param {number} sourceProductId
 * @param {number} destProductId
 */
async function insertDuplicateMediaTask(req, jobId, sourceProductId, destProductId) {
  const db = Database.get(req);
  const jid = String(jobId || '').trim();
  const src = Number(sourceProductId);
  const dst = Number(destProductId);
  if (!jid || !Number.isFinite(src) || !Number.isFinite(dst)) {
    throw new AppError('Invalid duplicate media task', 400, AppError.CODES.VALIDATION_ERROR);
  }
  const rows = await db.query(
    `
    INSERT INTO ${TABLE} (job_id, source_product_id, dest_product_id, status)
    VALUES ($1::uuid, $2::int, $3::int, 'queued')
    RETURNING *
    `,
    [jid, src, dst],
  );
  return rows[0] || null;
}

/**
 * @param {import('@homebase/core').RequestContext} req
 * @param {string|number} jobId
 */
async function countTasksForJob(req, jobId) {
  const db = Database.get(req);
  const jid = String(jobId || '').trim();
  if (!jid) return 0;
  const rows = await db.query(`SELECT COUNT(*)::int AS n FROM ${TABLE} WHERE job_id = $1::uuid`, [
    jid,
  ]);
  const n = rows[0]?.n;
  return Number.isFinite(Number(n)) ? Number(n) : 0;
}

/**
 * @param {import('@homebase/core').RequestContext} req
 * @param {number} sourceProductId
 */
async function sourceHasManagedMediaWithContentHash(req, sourceProductId) {
  const db = Database.get(req);
  const src = Number(sourceProductId);
  if (!Number.isFinite(src)) return false;
  const rows = await db.query(
    `
    SELECT 1
    FROM product_media_objects
    WHERE product_id = $1::int
      AND content_hash IS NOT NULL
      AND TRIM(content_hash) <> ''
    LIMIT 1
    `,
    [src],
  );
  return rows.length > 0;
}

/**
 * @param {import('@homebase/core').RequestContext} req
 * @param {string|number} productId
 */
async function hasActiveDuplicateMediaSourceLock(req, productId) {
  const db = Database.get(req);
  const pid = Number(productId);
  if (!Number.isFinite(pid)) return false;
  const rows = await db.query(
    `
    SELECT 1
    FROM ${TABLE}
    WHERE source_product_id = $1::int
      AND status IN ('queued', 'running')
    LIMIT 1
    `,
    [pid],
  );
  return rows.length > 0;
}

/**
 * @param {import('@homebase/core').RequestContext} req
 * @param {string|number} productId
 */
function assertSourceNotLockedForActiveDuplicateMediaTask(req, productId) {
  return hasActiveDuplicateMediaSourceLock(req, productId).then((locked) => {
    if (locked) {
      throw new AppError(
        'Produkten är källa i en pågående mediakopiering (duplicering). Vänta tills kopieringen är klar innan du raderar eller ändrar bilder.',
        409,
        'PRODUCT_MEDIA_COPY_IN_PROGRESS',
      );
    }
  });
}

/**
 * @param {import('@homebase/core').RequestContext} req
 * @param {number} staleMinutes
 */
async function reclaimStaleRunningTasks(req, staleMinutes = 30) {
  const db = Database.get(req);
  const mins = Math.max(1, Math.min(1440, Number(staleMinutes) || 30));
  await db.query(
    `
    UPDATE ${TABLE}
    SET status = 'queued',
        started_at = NULL
    WHERE status = 'running'
      AND started_at IS NOT NULL
      AND started_at < NOW() - ($1::int * INTERVAL '1 minute')
    `,
    [mins],
  );
}

/**
 * Atomically claim the next queued task for a job (FIFO).
 * @param {import('@homebase/core').RequestContext} req
 * @param {string|number} jobId
 */
async function claimNextQueuedTaskForJob(req, jobId) {
  const db = Database.get(req);
  const jid = String(jobId || '').trim();
  if (!jid) return null;
  const rows = await db.query(
    `
    WITH picked AS (
      SELECT id
      FROM ${TABLE}
      WHERE job_id = $1::uuid
        AND status = 'queued'
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    )
    UPDATE ${TABLE} AS t
    SET status = 'running',
        started_at = CURRENT_TIMESTAMP
    FROM picked
    WHERE t.id = picked.id
    RETURNING t.*
    `,
    [jid],
  );
  return rows[0] || null;
}

/**
 * @param {import('@homebase/core').RequestContext} req
 * @param {string} taskId
 */
async function markTaskRunning(req, taskId) {
  const db = Database.get(req);
  const tid = String(taskId || '').trim();
  if (!tid) return null;
  const rows = await db.query(
    `
    UPDATE ${TABLE}
    SET status = 'running',
        started_at = CURRENT_TIMESTAMP
    WHERE id = $1::uuid
      AND status = 'queued'
    RETURNING *
    `,
    [tid],
  );
  return rows[0] || null;
}

/**
 * @param {import('@homebase/core').RequestContext} req
 * @param {string} taskId
 */
async function markTaskCompleted(req, taskId) {
  const db = Database.get(req);
  const tid = String(taskId || '').trim();
  if (!tid) return;
  await db.query(
    `
    UPDATE ${TABLE}
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        last_error = NULL
    WHERE id = $1::uuid
    `,
    [tid],
  );
}

/**
 * @param {import('@homebase/core').RequestContext} req
 * @param {string} taskId
 * @param {string} message
 */
async function markTaskFailed(req, taskId, message) {
  const db = Database.get(req);
  const tid = String(taskId || '').trim();
  if (!tid) return;
  const err = message != null ? String(message).trim().slice(0, 2000) : 'unknown';
  await db.query(
    `
    UPDATE ${TABLE}
    SET status = 'failed',
        completed_at = CURRENT_TIMESTAMP,
        last_error = $2
    WHERE id = $1::uuid
    `,
    [tid, err || 'unknown'],
  );
}

module.exports = {
  TABLE,
  insertDuplicateMediaTask,
  countTasksForJob,
  sourceHasManagedMediaWithContentHash,
  hasActiveDuplicateMediaSourceLock,
  assertSourceNotLockedForActiveDuplicateMediaTask,
  reclaimStaleRunningTasks,
  claimNextQueuedTaskForJob,
  markTaskRunning,
  markTaskCompleted,
  markTaskFailed,
};
