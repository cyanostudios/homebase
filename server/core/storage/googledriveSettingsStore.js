// server/core/storage/googledriveSettingsStore.js
// Reads/writes googledrive_settings for the Google Drive adapter (no plugin import).
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../errors/AppError');

const TABLE = 'googledrive_settings';

/** Same scope as Database.insert user_id: tenant owner when switched, else logged-in user. */
function userId(req) {
  return (
    req.session?.currentTenantUserId ?? req.session?.user?.id ?? req.session?.user?.uuid ?? null
  );
}

/**
 * @param {import('express').Request} req
 */
async function getSettings(req) {
  const uid = userId(req);
  if (!uid) {
    throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
  }
  const db = Database.get(req);
  const rows = await db.query(`SELECT * FROM ${TABLE} WHERE user_id = $1 LIMIT 1`, [uid]);
  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: String(row.id),
    userId: String(row.user_id),
    clientId: row.client_id || null,
    clientSecret: row.client_secret || null,
    accessToken: row.access_token || null,
    refreshToken: row.refresh_token || null,
    tokenExpiresAt: row.token_expires_at || null,
    connected: Boolean(row.connected),
  };
}

/**
 * @param {import('express').Request} req
 * @param {{ accessToken: string, refreshToken?: string|null, tokenExpiresAt?: Date|null }} data
 */
async function upsertTokens(req, data) {
  const uid = userId(req);
  if (!uid) {
    throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
  }
  const db = Database.get(req);
  const sql = `
    INSERT INTO ${TABLE} (
      user_id, access_token, refresh_token, token_expires_at, connected, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, googledrive_settings.refresh_token),
      token_expires_at = EXCLUDED.token_expires_at,
      connected = TRUE,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const rows = await db.query(sql, [
    uid,
    data.accessToken,
    data.refreshToken ?? null,
    data.tokenExpiresAt ?? null,
  ]);
  Logger.info('Google Drive tokens updated from storage adapter', { userId: uid });
  return rows[0];
}

module.exports = {
  getSettings,
  upsertTokens,
  TABLE,
};
