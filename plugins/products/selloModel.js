// plugins/products/selloModel.js
// Sello API settings for product import.

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const CredentialsCrypto = require('../../server/core/services/security/CredentialsCrypto');

class SelloModel {
  static SETTINGS_TABLE = 'sello_settings';
  static API_BASE = 'https://api.sello.io';

  async getSettings(req) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const res = await db.query(
        `SELECT * FROM ${SelloModel.SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      return res.length ? this.transformSettingsRow(res[0]) : null;
    } catch (error) {
      Logger.error('Failed to get Sello settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get Sello settings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async upsertSettings(req, data) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const apiKey = String(data.apiKey || '').trim();
      const connected = Boolean(apiKey);

      const sql = `
        INSERT INTO ${SelloModel.SETTINGS_TABLE} (
          user_id, api_key, connected, created_at, updated_at
        ) VALUES (
          $1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id) DO UPDATE SET
          api_key = EXCLUDED.api_key,
          connected = EXCLUDED.connected,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const res = await db.query(sql, [
        userId,
        apiKey ? CredentialsCrypto.encrypt(apiKey) : null,
        connected,
      ]);
      return this.transformSettingsRow(res[0]);
    } catch (error) {
      Logger.error('Failed to save Sello settings', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to save Sello settings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformSettingsRow(row) {
    const apiKey = row.api_key ? CredentialsCrypto.decrypt(row.api_key) : '';
    return {
      id: String(row.id),
      apiKey: apiKey || '',
      connected: !!row.connected,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  async getApiKeyForJobs(req) {
    const settings = await this.getSettings(req);
    const apiKey = String(settings?.apiKey || '').trim();
    if (!apiKey) {
      throw new AppError('Sello API key missing', 400, AppError.CODES.VALIDATION_ERROR);
    }
    return apiKey;
  }

  getFetch() {
    return typeof fetch === 'function'
      ? fetch
      : async (...args) => {
          const mod = await import('node-fetch').catch(() => null);
          if (!mod?.default)
            throw new Error('fetch is not available (Node <18) and node-fetch is not installed');
          return mod.default(...args);
        };
  }

  async fetchSelloJson({ apiKey, path, method = 'GET', query = null, body = null }) {
    const token = String(apiKey || '').trim();
    if (!token) throw new AppError('Sello API key missing', 400, AppError.CODES.VALIDATION_ERROR);
    const endpointPath = String(path || '').trim();
    if (!endpointPath.startsWith('/v5/')) {
      throw new AppError('Invalid Sello endpoint path', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const url = new URL(`${SelloModel.API_BASE}${endpointPath}`);
    if (query && typeof query === 'object') {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && String(v) !== '') {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const headers = new Headers();
    headers.set('Accept', 'application/json');
    headers.set('Authorization', token);
    if (body != null) headers.set('Content-Type', 'application/json');

    const fetchFn = this.getFetch();
    const resp = await fetchFn(url.toString(), {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await resp.text().catch(() => '');
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!resp.ok) {
      const detail = (json && (json.message || json.error)) || text || `HTTP ${resp.status}`;
      throw new AppError(
        `Sello API request failed: ${detail}`,
        502,
        AppError.CODES.SERVICE_UNAVAILABLE,
      );
    }
    return json;
  }

  /**
   * Fetch manufacturer by id from Sello API.
   * GET /v5/manufacturers/{id}
   * @param {string} apiKey
   * @param {string|number} manufacturerId
   * @returns {Promise<{ id: string|number, name?: string, title?: string } | null>}
   */
  async fetchManufacturer(apiKey, manufacturerId) {
    const id = String(manufacturerId ?? '').trim();
    if (!id) return null;
    try {
      const json = await this.fetchSelloJson({
        apiKey,
        path: `/v5/manufacturers/${encodeURIComponent(id)}`,
      });
      if (!json || typeof json !== 'object') return null;
      const name = json.name ?? json.title ?? null;
      return { id: json.id ?? id, name };
    } catch {
      return null;
    }
  }
}

module.exports = SelloModel;
