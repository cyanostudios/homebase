// plugins/files/cloudStorageModel.js
// Cloud storage model for managing OAuth tokens and settings for Google Drive
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const CredentialsCrypto = require('../../server/core/services/security/CredentialsCrypto');

class CloudStorageModel {
  static TABLES = {
    googledrive: 'googledrive_settings',
  };

  async migrateLegacySecrets(db, table, userId, row) {
    const updates = [];
    const params = [userId];
    let idx = 2;
    const encryptIfLegacy = (column) => {
      if (row[column] && !CredentialsCrypto.isEncrypted(row[column])) {
        updates.push(`${column} = $${idx++}`);
        params.push(CredentialsCrypto.encrypt(String(row[column])));
      }
    };

    encryptIfLegacy('client_secret');
    encryptIfLegacy('access_token');
    encryptIfLegacy('refresh_token');

    if (!updates.length) return;
    updates.push('updated_at = CURRENT_TIMESTAMP');
    await db.query(`UPDATE ${table} SET ${updates.join(', ')} WHERE user_id = $1`, params);
  }

  async getSettings(req, service) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const table = CloudStorageModel.TABLES[service];
      if (!table) {
        throw new AppError(`Unknown cloud storage service: ${service}`, 400, AppError.CODES.VALIDATION_ERROR);
      }

      const sql = `
        SELECT *
        FROM ${table}
        WHERE user_id = $1
        LIMIT 1
      `;
      const result = await db.query(sql, [userId]);
      if (result.length) {
        await this.migrateLegacySecrets(db, table, userId, result[0]);
      }
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
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const table = CloudStorageModel.TABLES[service];
      if (!table) {
        throw new AppError(`Unknown cloud storage service: ${service}`, 400, AppError.CODES.VALIDATION_ERROR);
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
        userId,
        accessToken ? CredentialsCrypto.encrypt(accessToken) : null,
        refreshToken ? CredentialsCrypto.encrypt(refreshToken) : null,
        tokenExpiresAt,
        connected,
      ]);
      Logger.info(`${service} settings saved`, { userId });
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
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const table = CloudStorageModel.TABLES[service];
      if (!table) {
        throw new AppError(`Unknown cloud storage service: ${service}`, 400, AppError.CODES.VALIDATION_ERROR);
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
      const result = await db.query(sql, [userId]);
      Logger.info(`${service} disconnected`, { userId });
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
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const table = CloudStorageModel.TABLES[service];
      if (!table) {
        throw new AppError(`Unknown cloud storage service: ${service}`, 400, AppError.CODES.VALIDATION_ERROR);
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
        userId,
        clientId ? String(clientId).trim() : null,
        clientSecret ? CredentialsCrypto.encrypt(String(clientSecret).trim()) : null,
      ]);
      Logger.info(`${service} OAuth credentials saved`, { userId });
      return this.transformSettingsRow(result[0], service);
    } catch (error) {
      Logger.error(`Failed to save ${service} OAuth credentials`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to save ${service} OAuth credentials`, 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformSettingsRow(row, service) {
    const clientSecret = row.client_secret ? CredentialsCrypto.decrypt(row.client_secret) : null;
    const accessToken = row.access_token ? CredentialsCrypto.decrypt(row.access_token) : null;
    const refreshToken = row.refresh_token ? CredentialsCrypto.decrypt(row.refresh_token) : null;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      // OAuth app credentials (optional)
      clientId: row.client_id || null,
      clientSecret,
      // OAuth tokens (per-user)
      accessToken,
      refreshToken,
      tokenExpiresAt: row.token_expires_at || null,
      connected: Boolean(row.connected),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }
}

module.exports = CloudStorageModel;
