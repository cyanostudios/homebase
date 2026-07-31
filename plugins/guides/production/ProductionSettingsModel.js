// plugins/guides/production/ProductionSettingsModel.js
const { Context, Database, Logger } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');

const SETTINGS_TABLE = 'guide_production_settings';

/** @type {readonly number[]} */
const ALLOWED_POLL_INTERVALS_MS = Object.freeze([5000, 15000, 30000, 60000, 300000]);

const DEFAULT_SETTINGS = Object.freeze({
  workerEnabled: false,
  pollIntervalMs: 5000,
});

function isUndefinedTableError(error) {
  return (
    error &&
    (error.code === '42P01' ||
      (typeof error.message === 'string' && /guide_production_settings/i.test(error.message)))
  );
}

class ProductionSettingsModel {
  static getAllowedPollIntervalsMs() {
    return [...ALLOWED_POLL_INTERVALS_MS];
  }

  static getDefaults() {
    return { ...DEFAULT_SETTINGS };
  }

  _requireUserId(req) {
    const userId = Context.getTenantUserId(req);
    if (!userId) {
      throw new AppError('Unauthorized', 401, AppError.CODES.UNAUTHORIZED);
    }
    return userId;
  }

  _normalizePollIntervalMs(value) {
    const ms = Number(value);
    if (!ALLOWED_POLL_INTERVALS_MS.includes(ms)) {
      throw new AppError(
        `pollIntervalMs must be one of: ${ALLOWED_POLL_INTERVALS_MS.join(', ')}`,
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    return ms;
  }

  _rowToSettings(row) {
    if (!row) return { ...DEFAULT_SETTINGS };
    return {
      workerEnabled: Boolean(row.worker_enabled),
      pollIntervalMs: Number(row.poll_interval_ms) || DEFAULT_SETTINGS.pollIntervalMs,
    };
  }

  /**
   * Effective settings for the current tenant (defaults when no row / table missing).
   * @returns {Promise<{ workerEnabled: boolean, pollIntervalMs: number }>}
   */
  async get(req) {
    const userId = this._requireUserId(req);
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT worker_enabled, poll_interval_ms
          FROM ${SETTINGS_TABLE}
          WHERE user_id = $1
          LIMIT 1
        `,
        [userId],
      );
      return this._rowToSettings(rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (isUndefinedTableError(error)) {
        Logger.warn('guide_production_settings missing; using defaults', { userId });
        return { ...DEFAULT_SETTINGS };
      }
      Logger.error('Failed to load production settings', error, { userId });
      throw new AppError('Failed to load production settings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * @param {{ workerEnabled?: boolean, pollIntervalMs?: number }} patch
   * @returns {Promise<{ workerEnabled: boolean, pollIntervalMs: number }>}
   */
  async upsert(req, patch) {
    const userId = this._requireUserId(req);
    const current = await this.get(req);

    const workerEnabled =
      patch.workerEnabled === undefined ? current.workerEnabled : Boolean(patch.workerEnabled);
    const pollIntervalMs =
      patch.pollIntervalMs === undefined
        ? current.pollIntervalMs
        : this._normalizePollIntervalMs(patch.pollIntervalMs);

    const db = Database.get(req);
    try {
      const rows = await db.query(
        `
          INSERT INTO ${SETTINGS_TABLE} (user_id, worker_enabled, poll_interval_ms, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET
            worker_enabled = EXCLUDED.worker_enabled,
            poll_interval_ms = EXCLUDED.poll_interval_ms,
            updated_at = NOW()
          RETURNING worker_enabled, poll_interval_ms
        `,
        [userId, workerEnabled, pollIntervalMs],
      );
      return this._rowToSettings(rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to save production settings', error, { userId });
      throw new AppError('Failed to save production settings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = ProductionSettingsModel;
module.exports.ALLOWED_POLL_INTERVALS_MS = ALLOWED_POLL_INTERVALS_MS;
module.exports.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
