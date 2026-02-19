// plugins/mail/model.js
const { Logger, Database, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const TABLE = 'mail_log';
const SETTINGS_TABLE = 'mail_settings';

class MailModel {
  async logSent(req, data) {
    try {
      const db = Database.get(req);
      const recipients = Array.isArray(data.to) ? data.to.join(', ') : String(data.to || '');
      const result = await db.insert(TABLE, {
        recipients,
        subject: String(data.subject || '').substring(0, 500),
        sent_at: new Date(),
        plugin_source: data.pluginSource || null,
        reference_id: data.referenceId ? String(data.referenceId) : null,
      });
      Logger.info('Mail logged', { id: result.id });
      return {
        id: String(result.id),
        to: recipients,
        subject: result.subject || '',
        sentAt: result.sent_at,
        pluginSource: result.plugin_source || null,
        referenceId: result.reference_id || null,
        createdAt: result.created_at || result.sent_at,
      };
    } catch (error) {
      Logger.error('Failed to log mail', error);
      throw new AppError('Failed to log mail', 500, AppError.CODES.DATABASE_ERROR);
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
        sql = `SELECT id, recipients, subject, sent_at, plugin_source, reference_id, created_at
               FROM ${TABLE}
               WHERE user_id = $1 AND plugin_source = $2
               ORDER BY sent_at DESC
               LIMIT $3 OFFSET $4`;
        params = [userId, pluginSource, limit, offset];
      } else {
        sql = `SELECT id, recipients, subject, sent_at, plugin_source, reference_id, created_at
               FROM ${TABLE}
               WHERE user_id = $1
               ORDER BY sent_at DESC
               LIMIT $2 OFFSET $3`;
        params = [userId, limit, offset];
      }

      const rows = await db.query(sql, params);
      return rows.map((r) => ({
        id: String(r.id),
        to: r.recipients || '',
        subject: r.subject || '',
        sentAt: r.sent_at,
        pluginSource: r.plugin_source || null,
        referenceId: r.reference_id || null,
        createdAt: r.created_at,
      }));
    } catch (error) {
      Logger.error('Failed to fetch mail history', error);
      throw new AppError('Failed to fetch mail history', 500, AppError.CODES.DATABASE_ERROR);
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
      Logger.error('Failed to count mail history', error);
      throw new AppError('Failed to count mail history', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Get SMTP settings for the current user (for display - password never returned).
   * Returns raw settings for sending (including password) when needsPassword=true.
   */
  async getSettings(req, options = { needsPassword: false }) {
    try {
      const db = Database.get(req);
      const userId = Context.getTenantUserId(req);
      if (!userId) {
        return null;
      }
      const sql = `SELECT id, provider, host, port, secure, auth_user, auth_pass, from_address,
                          resend_api_key, resend_from_address, created_at, updated_at
                   FROM ${SETTINGS_TABLE}
                   WHERE user_id = $1
                   LIMIT 1`;
      const params = [userId];
      const rows = await db.query(sql, params);
      const row = rows[0];
      if (!row) return null;
      const out = {
        id: row.id,
        provider: row.provider || 'smtp',
        host: row.host || 'smtp.gmail.com',
        port: row.port ?? 587,
        secure: !!row.secure,
        authUser: row.auth_user || '',
        fromAddress: row.from_address || 'noreply@homebase.se',
        hasPassword: !!row.auth_pass,
        resendApiKey: row.resend_api_key ? '••••••••' : '',
        hasResendApiKey: !!row.resend_api_key,
        resendFromAddress: row.resend_from_address || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      if (options.needsPassword && row.auth_pass) {
        out.authPass = row.auth_pass;
      }
      if (options.needsPassword && row.resend_api_key) {
        out.resendApiKeyRaw = row.resend_api_key;
      }
      return out;
    } catch (error) {
      Logger.error('Failed to fetch mail settings', error);
      throw new AppError('Failed to fetch mail settings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Save or update SMTP settings for the current user.
   */
  async saveSettings(req, data) {
    try {
      const db = Database.get(req);
      const userId = Context.getTenantUserId(req);
      if (!userId) {
        throw new AppError('Unauthorized', 401, AppError.CODES.UNAUTHORIZED);
      }
      const provider = (data.provider || 'smtp') === 'resend' ? 'resend' : 'smtp';
      const host = String(data.host || 'smtp.gmail.com').trim();
      const port = parseInt(String(data.port || '587'), 10) || 587;
      const secure = !!data.secure;
      const authUser = data.authUser != null ? String(data.authUser).trim() : '';
      const fromAddress = String(data.fromAddress || 'noreply@homebase.se').trim();
      const resendFromAddress =
        data.resendFromAddress != null ? String(data.resendFromAddress).trim() : null;

      const existing = await db.query(
        `SELECT id FROM ${SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      const now = new Date();

      if (existing?.length) {
        const updateData = {
          provider,
          host,
          port,
          secure,
          auth_user: authUser,
          from_address: fromAddress,
          resend_from_address: resendFromAddress || null,
        };
        if (data.authPass != null && String(data.authPass).trim() !== '') {
          updateData.auth_pass = String(data.authPass).trim();
        }
        if (
          data.resendApiKey != null &&
          String(data.resendApiKey).trim() !== '' &&
          !String(data.resendApiKey).startsWith('••••')
        ) {
          updateData.resend_api_key = String(data.resendApiKey).trim();
        }
        await db.update(SETTINGS_TABLE, existing[0].id, updateData);
        return { ok: true };
      }

      await db.insert(SETTINGS_TABLE, {
        provider,
        host,
        port,
        secure,
        auth_user: authUser,
        auth_pass:
          data.authPass != null && String(data.authPass).trim() !== ''
            ? String(data.authPass).trim()
            : null,
        from_address: fromAddress,
        resend_api_key:
          data.resendApiKey != null &&
          String(data.resendApiKey).trim() !== '' &&
          !String(data.resendApiKey).startsWith('••••')
            ? String(data.resendApiKey).trim()
            : null,
        resend_from_address: resendFromAddress || null,
        created_at: now,
        updated_at: now,
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to save mail settings', error);
      throw new AppError('Failed to save mail settings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = new MailModel();
