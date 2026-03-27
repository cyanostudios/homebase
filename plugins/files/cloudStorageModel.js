// plugins/files/cloudStorageModel.js
// Cloud storage model for managing OAuth tokens and settings for Google Drive
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const CredentialsCrypto = require('../../server/core/services/security/CredentialsCrypto');

class CloudStorageModel {
  static TABLES = {
    googledrive: 'googledrive_settings',
  };

  async getSettings(req, service) {
    try {
      const db = Database.get(req);
      const tenantId = req.session?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
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
        LIMIT 1
      `;
      const result = await db.query(sql, []);
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
      const tenantId = req.session?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
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

      const values = [
        accessToken ? CredentialsCrypto.encrypt(accessToken) : null,
        refreshToken ? CredentialsCrypto.encrypt(refreshToken) : null,
        tokenExpiresAt,
        connected,
      ];
      const existing = await db.query(`SELECT id FROM ${table} ORDER BY id ASC LIMIT 1`, []);
      const result = existing.length
        ? await db.query(
            `UPDATE ${table}
             SET access_token = $1,
                 refresh_token = $2,
                 token_expires_at = $3,
                 connected = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING *`,
            [...values, existing[0].id],
          )
        : await db.query(
            `INSERT INTO ${table} (
               access_token, refresh_token, token_expires_at, connected, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING *`,
            values,
          );
      Logger.info(`${service} settings saved`, { service });
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
      const tenantId = req.session?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
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
        RETURNING *
      `;
      const result = await db.query(sql, []);
      Logger.info(`${service} disconnected`, { service });
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
      const tenantId = req.session?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
      }

      const table = CloudStorageModel.TABLES[service];
      if (!table) {
        throw new AppError(
          `Unknown cloud storage service: ${service}`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const values = [
        clientId ? String(clientId).trim() : null,
        clientSecret ? CredentialsCrypto.encrypt(String(clientSecret).trim()) : null,
      ];
      const existing = await db.query(`SELECT id FROM ${table} ORDER BY id ASC LIMIT 1`, []);
      const result = existing.length
        ? await db.query(
            `UPDATE ${table}
             SET client_id = $1,
                 client_secret = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [...values, existing[0].id],
          )
        : await db.query(
            `INSERT INTO ${table} (
               client_id, client_secret, updated_at
             ) VALUES ($1, $2, CURRENT_TIMESTAMP)
             RETURNING *`,
            values,
          );
      Logger.info(`${service} OAuth credentials saved`, { service });
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
    const clientSecret = row.client_secret ? CredentialsCrypto.decrypt(row.client_secret) : null;
    const accessToken = row.access_token ? CredentialsCrypto.decrypt(row.access_token) : null;
    const refreshToken = row.refresh_token ? CredentialsCrypto.decrypt(row.refresh_token) : null;
    return {
      id: String(row.id),
      // OAuth app credentials (optional)
      clientId: row.client_id || null,
      clientSecret,
      // OAuth tokens for the active tenant
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
