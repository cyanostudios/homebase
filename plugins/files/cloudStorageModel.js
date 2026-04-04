// plugins/files/cloudStorageModel.js
// Cloud storage model for managing OAuth tokens and settings for OneDrive, Dropbox, and Google Drive
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

/** Same scope as Database.insert / googledrive_settings lookups in storage layer. */
function tenantScopedUserId(req) {
  return (
    req.session?.currentTenantUserId ?? req.session?.user?.id ?? req.session?.user?.uuid ?? null
  );
}

class CloudStorageModel {
  static TABLES = {
    onedrive: 'onedrive_settings',
    dropbox: 'dropbox_settings',
    googledrive: 'googledrive_settings',
  };

  async getSettings(req, service) {
    try {
      const db = Database.get(req);
      const uid = tenantScopedUserId(req);

      if (!uid) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const table = CloudStorageModel.TABLES[service];
      if (!table) {
        throw new AppError(
          `Unknown cloud storage service: ${service}`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const sql = `
        SELECT *
        FROM ${table}
        WHERE user_id = $1
        LIMIT 1
      `;
      const result = await db.query(sql, [uid]);
      return result.length ? this.transformSettingsRow(result[0], service) : null;
    } catch (error) {
      Logger.error(`Failed to get ${service} settings`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to get ${service} settings`, 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async upsertSettings(req, service, data) {
    try {
      const db = Database.get(req);
      const uid = tenantScopedUserId(req);

      if (!uid) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const table = CloudStorageModel.TABLES[service];
      if (!table) {
        throw new AppError(
          `Unknown cloud storage service: ${service}`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const accessToken = data.accessToken ? String(data.accessToken).trim() : null;
      const refreshToken = data.refreshToken ? String(data.refreshToken).trim() : null;
      const tokenExpiresAt = data.tokenExpiresAt || null;
      const connected = Boolean(data.connected);

      const sql = `
        INSERT INTO ${table} (
          user_id, access_token, refresh_token, token_expires_at, connected, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_expires_at = EXCLUDED.token_expires_at,
          connected = EXCLUDED.connected,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const result = await db.query(sql, [
        uid,
        accessToken,
        refreshToken,
        tokenExpiresAt,
        connected,
      ]);
      Logger.info(`${service} settings saved`, { userId: uid });
      return this.transformSettingsRow(result[0], service);
    } catch (error) {
      Logger.error(`Failed to save ${service} settings`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to save ${service} settings`, 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async disconnect(req, service) {
    try {
      const db = Database.get(req);
      const uid = tenantScopedUserId(req);

      if (!uid) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const table = CloudStorageModel.TABLES[service];
      if (!table) {
        throw new AppError(
          `Unknown cloud storage service: ${service}`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const sql = `
        UPDATE ${table}
        SET access_token = NULL,
            refresh_token = NULL,
            token_expires_at = NULL,
            connected = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *
      `;
      const result = await db.query(sql, [uid]);
      Logger.info(`${service} disconnected`, { userId: uid });
      return result.length ? this.transformSettingsRow(result[0], service) : null;
    } catch (error) {
      Logger.error(`Failed to disconnect ${service}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to disconnect ${service}`, 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async upsertOAuthCredentials(req, service, clientId, clientSecret) {
    try {
      const db = Database.get(req);
      const uid = tenantScopedUserId(req);

      if (!uid) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const table = CloudStorageModel.TABLES[service];
      if (!table) {
        throw new AppError(
          `Unknown cloud storage service: ${service}`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const sql = `
        INSERT INTO ${table} (
          user_id, client_id, client_secret, updated_at
        ) VALUES (
          $1, $2, $3, CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id) DO UPDATE SET
          client_id = EXCLUDED.client_id,
          client_secret = EXCLUDED.client_secret,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const result = await db.query(sql, [
        uid,
        clientId ? String(clientId).trim() : null,
        clientSecret ? String(clientSecret).trim() : null,
      ]);
      Logger.info(`${service} OAuth credentials saved`, { userId: uid });
      return this.transformSettingsRow(result[0], service);
    } catch (error) {
      Logger.error(`Failed to save ${service} OAuth credentials`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Failed to save ${service} OAuth credentials`,
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  transformSettingsRow(row, service) {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      // OAuth app credentials (optional)
      clientId: row.client_id || null,
      clientSecret: row.client_secret || null,
      // OAuth tokens (per-user)
      accessToken: row.access_token || null,
      refreshToken: row.refresh_token || null,
      tokenExpiresAt: row.token_expires_at || null,
      connected: Boolean(row.connected),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }
}

module.exports = CloudStorageModel;
