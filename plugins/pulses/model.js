// plugins/pulses/model.js — history log only (provider settings live in providerModel.js)
const { Logger, Database, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const TABLE = 'pulse_log';

class PulseModel {
  async logSent(req, data) {
    try {
      const db = Database.get(req);
      const userId = Context.getTenantUserId(req);
      if (!userId) {
        throw new AppError('Unauthorized', 401, AppError.CODES.UNAUTHORIZED);
      }
      const result = await db.insert(TABLE, {
        recipient: String(data.recipient || '').substring(0, 100),
        body: data.body != null ? String(data.body) : null,
        provider: data.provider || null,
        status: data.status || 'sent',
        plugin_source: data.pluginSource || null,
        reference_id: data.referenceId ? String(data.referenceId) : null,
      });
      Logger.info('Pulse logged', { id: result.id });
      return {
        id: String(result.id),
        recipient: result.recipient,
        body: result.body,
        provider: result.provider,
        status: result.status,
        sentAt: result.sent_at,
        pluginSource: result.plugin_source || null,
        referenceId: result.reference_id || null,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to log pulse', error);
      throw new AppError('Failed to log pulse', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getHistory(req, options = {}) {
    try {
      const db = Database.get(req);
      const userId = Context.getTenantUserId(req);
      if (!userId) {
        return [];
      }
      const limit = Math.min(Math.max(1, options.limit || 50), 100);
      const offset = Math.max(0, options.offset || 0);
      const pluginSource = options.pluginSource;

      let sql;
      let params;
      if (pluginSource) {
        sql = `SELECT id, user_id, recipient, body, provider, status, sent_at, plugin_source, reference_id
               FROM ${TABLE}
               WHERE user_id = $1 AND plugin_source = $2
               ORDER BY sent_at DESC
               LIMIT $3 OFFSET $4`;
        params = [userId, pluginSource, limit, offset];
      } else {
        sql = `SELECT id, user_id, recipient, body, provider, status, sent_at, plugin_source, reference_id
               FROM ${TABLE}
               WHERE user_id = $1
               ORDER BY sent_at DESC
               LIMIT $2 OFFSET $3`;
        params = [userId, limit, offset];
      }

      const rows = await db.query(sql, params);
      return rows.map((r) => ({
        id: String(r.id),
        recipient: r.recipient || '',
        body: r.body || '',
        provider: r.provider || null,
        status: r.status || '',
        sentAt: r.sent_at,
        pluginSource: r.plugin_source || null,
        referenceId: r.reference_id || null,
      }));
    } catch (error) {
      Logger.error('Failed to fetch pulse history', error);
      throw new AppError('Failed to fetch pulse history', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getHistoryCount(req, options = {}) {
    try {
      const db = Database.get(req);
      const userId = Context.getTenantUserId(req);
      if (!userId) {
        return 0;
      }
      const pluginSource = options.pluginSource;

      let sql;
      let params;
      if (pluginSource) {
        sql = `SELECT COUNT(*)::int AS cnt FROM ${TABLE} WHERE user_id = $1 AND plugin_source = $2`;
        params = [userId, pluginSource];
      } else {
        sql = `SELECT COUNT(*)::int AS cnt FROM ${TABLE} WHERE user_id = $1`;
        params = [userId];
      }

      const rows = await db.query(sql, params);
      return rows[0]?.cnt ?? 0;
    } catch (error) {
      Logger.error('Failed to count pulse history', error);
      throw new AppError('Failed to count pulse history', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteHistory(req, ids) {
    try {
      const db = Database.get(req);
      const userId = Context.getTenantUserId(req);
      if (!userId) {
        throw new AppError('Unauthorized', 401, AppError.CODES.UNAUTHORIZED);
      }
      if (!Array.isArray(ids) || ids.length === 0) {
        return { deleted: 0 };
      }
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
      const sql = `DELETE FROM ${TABLE} WHERE user_id = $1 AND id IN (${placeholders})`;
      const params = [userId, ...ids];
      const result = await db.query(sql, params);
      const deleted = result?.rowCount ?? ids.length;
      Logger.info('Pulse history deleted', { count: deleted, userId });
      return { deleted };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete pulse history', error);
      throw new AppError('Failed to delete pulse history', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = new PulseModel();
