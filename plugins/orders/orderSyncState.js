// plugins/orders/orderSyncState.js
// Read/write order_sync_state for incremental sync and quick-sync skip.

const { Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const TABLE = 'order_sync_state';
const FRESH_THRESHOLD_MINUTES = 2;

function getUserId(req) {
  return req?.session?.user?.id ?? req?.session?.user?.uuid;
}

/** DB uses 0 for single-instance channels (CDON/Fyndiq). */
function normInstanceId(channelInstanceId) {
  return channelInstanceId != null && Number.isFinite(Number(channelInstanceId)) ? Number(channelInstanceId) : 0;
}

/**
 * Get state for one slot (user_id, channel, channel_instance_id).
 * @param {object} req - request with session
 * @param {string} channel - cdon | fyndiq | woocommerce
 * @param {number|null} channelInstanceId - null for single-instance channels
 */
async function getState(req, channel, channelInstanceId = null) {
  const db = Database.get(req);
  const userId = getUserId(req);
  if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

  const instId = normInstanceId(channelInstanceId);
  const res = await db.query(
    `SELECT last_cursor_placed_at, last_run_at, last_success_at, last_status, last_error, next_run_at, running_since, updated_at
     FROM ${TABLE}
     WHERE user_id = $1 AND channel = $2 AND channel_instance_id = $3
     LIMIT 1`,
    [userId, String(channel), instId],
  );
  return res.length ? res[0] : null;
}

/**
 * Try to claim this slot for sync (set running_since). Returns true if we claimed it, false if already running.
 */
async function trySetRunning(req, channel, channelInstanceId = null) {
  const db = Database.get(req);
  const userId = getUserId(req);
  if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

  const instId = normInstanceId(channelInstanceId);
  await ensureRow(req, channel, channelInstanceId);
  const updated = await db.query(
    `UPDATE ${TABLE}
     SET last_run_at = NOW(), last_status = 'running', running_since = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND channel = $2 AND channel_instance_id = $3 AND running_since IS NULL
     RETURNING user_id`,
    [userId, String(channel), instId],
  );
  return updated.length > 0;
}

/**
 * Set running_since = NOW() (call when starting sync after lock acquired).
 */
async function setRunning(req, channel, channelInstanceId = null) {
  const db = Database.get(req);
  const userId = getUserId(req);
  if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

  const instId = normInstanceId(channelInstanceId);
  await db.query(
    `INSERT INTO ${TABLE} (user_id, channel, channel_instance_id, last_run_at, last_status, running_since, updated_at)
     VALUES ($1, $2, $3, NOW(), 'running', NOW(), NOW())
     ON CONFLICT (user_id, channel, channel_instance_id)
     DO UPDATE SET last_run_at = NOW(), last_status = 'running', running_since = NOW(), updated_at = NOW()`,
    [userId, String(channel), instId],
  );
}

/**
 * Update state after successful sync. Clears running_since.
 */
async function setSuccess(req, channel, channelInstanceId, { lastCursorPlacedAt = null, nextRunAt = null } = {}) {
  const db = Database.get(req);
  const userId = getUserId(req);
  if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

  const instId = normInstanceId(channelInstanceId);
  await db.query(
    `UPDATE ${TABLE}
     SET last_success_at = NOW(), last_status = 'success', last_error = NULL,
         last_cursor_placed_at = COALESCE($4, last_cursor_placed_at),
         next_run_at = COALESCE($5, next_run_at),
         running_since = NULL, updated_at = NOW()
     WHERE user_id = $1 AND channel = $2 AND channel_instance_id = $3`,
    [userId, String(channel), instId, lastCursorPlacedAt, nextRunAt],
  );
}

/**
 * Update state after failed sync. Clears running_since.
 */
async function setError(req, channel, channelInstanceId, errorMessage) {
  const db = Database.get(req);
  const userId = getUserId(req);
  if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

  const instId = normInstanceId(channelInstanceId);
  const msg = errorMessage != null ? String(errorMessage).slice(0, 2000) : null;
  await db.query(
    `UPDATE ${TABLE}
     SET last_status = 'error', last_error = $4, running_since = NULL, updated_at = NOW()
     WHERE user_id = $1 AND channel = $2 AND channel_instance_id = $3`,
    [userId, String(channel), instId, msg],
  );
}

/**
 * Ensure state row exists (e.g. after first sync). Creates with running_since = NULL if missing.
 */
async function ensureRow(req, channel, channelInstanceId = null) {
  const db = Database.get(req);
  const userId = getUserId(req);
  if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

  const instId = normInstanceId(channelInstanceId);
  await db.query(
    `INSERT INTO ${TABLE} (user_id, channel, channel_instance_id, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, channel, channel_instance_id) DO NOTHING`,
    [userId, String(channel), instId],
  );
}

/**
 * True if any sync for this user is currently running (running_since IS NOT NULL).
 */
async function isBusyForUser(req) {
  const db = Database.get(req);
  const userId = getUserId(req);
  if (!userId) return false;

  const res = await db.query(
    `SELECT 1 FROM ${TABLE} WHERE user_id = $1 AND running_since IS NOT NULL LIMIT 1`,
    [userId],
  );
  return res.length > 0;
}

/**
 * True if quick-sync should run: no state rows yet (first time) or any slot has last_success_at older than FRESH_THRESHOLD_MINUTES.
 */
async function shouldRunQuickSync(req) {
  const db = Database.get(req);
  const userId = getUserId(req);
  if (!userId) return false;

  const anyRow = await db.query(
    `SELECT 1 FROM ${TABLE} WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  if (anyRow.length === 0) return true;

  const stale = await db.query(
    `SELECT 1 FROM ${TABLE}
     WHERE user_id = $1
       AND (last_success_at IS NULL OR last_success_at < NOW() - INTERVAL '1 minute' * $2)
     LIMIT 1`,
    [userId, FRESH_THRESHOLD_MINUTES],
  );
  return stale.length > 0;
}

/**
 * List all state rows for the current user (for status endpoint or scheduler).
 */
async function listForUser(req) {
  const db = Database.get(req);
  const userId = getUserId(req);
  if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

  const rows = await db.query(
    `SELECT channel, channel_instance_id, last_run_at, last_success_at, last_status, last_error, running_since, next_run_at
     FROM ${TABLE} WHERE user_id = $1 ORDER BY channel, channel_instance_id NULLS FIRST`,
    [userId],
  );
  return rows;
}

module.exports = {
  getState,
  trySetRunning,
  setRunning,
  setSuccess,
  setError,
  ensureRow,
  isBusyForUser,
  shouldRunQuickSync,
  listForUser,
  FRESH_THRESHOLD_MINUTES,
};
