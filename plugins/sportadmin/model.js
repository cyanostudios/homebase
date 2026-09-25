// plugins/sportadmin/model.js
const { Database } = require('@homebase/core');

const ALLOWED_INTERVALS = new Set([15, 30, 60, 360, 1440]);

/** Database.query returns rows array (not pg Result). */
function firstRow(rows) {
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

class SportadminModel {
  async ensureConfig(req) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const existing = await db.query(`SELECT * FROM sportadmin_config LIMIT 1`);
    const row = firstRow(existing);
    if (row) {
      return row;
    }
    const inserted = await db.query(
      `INSERT INTO sportadmin_config (user_id, refresh_interval_minutes, cron_enabled)
       VALUES ($1, 1440, false)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [userId],
    );
    return firstRow(inserted);
  }

  async getConfig(req) {
    return this.ensureConfig(req);
  }

  async saveSiteUrl(req, siteUrl) {
    const db = Database.get(req);
    const userId = db.getUserId();
    await this.ensureConfig(req);
    const result = await db.query(
      `UPDATE sportadmin_config
          SET site_url = $1,
              updated_at = NOW()
        WHERE user_id = $2
      RETURNING *`,
      [siteUrl, userId],
    );
    return firstRow(result);
  }

  async setCronEnabled(req, enabled) {
    const db = Database.get(req);
    const userId = db.getUserId();
    await this.ensureConfig(req);
    const result = await db.query(
      `UPDATE sportadmin_config
          SET cron_enabled = $1,
              refresh_interval_minutes = 1440,
              updated_at = NOW()
        WHERE user_id = $2
      RETURNING *`,
      [Boolean(enabled), userId],
    );
    return firstRow(result);
  }

  async updateSyncMeta(req, fields) {
    const db = Database.get(req);
    const userId = db.getUserId();
    await this.ensureConfig(req);
    const interval = ALLOWED_INTERVALS.has(Number(fields.refresh_interval_minutes))
      ? Number(fields.refresh_interval_minutes)
      : null;
    const result = await db.query(
      `UPDATE sportadmin_config
          SET last_successful_sync = COALESCE($1, last_successful_sync),
              last_attempted_sync = COALESCE($2, last_attempted_sync),
              last_error = $3,
              connection_test = COALESCE($4::jsonb, connection_test),
              discovery_snapshot = COALESCE($5::jsonb, discovery_snapshot),
              refresh_interval_minutes = COALESCE($6, refresh_interval_minutes),
              updated_at = NOW()
        WHERE user_id = $7
      RETURNING *`,
      [
        fields.last_successful_sync || null,
        fields.last_attempted_sync || null,
        fields.last_error === undefined ? null : fields.last_error,
        fields.connection_test ? JSON.stringify(fields.connection_test) : null,
        fields.discovery_snapshot ? JSON.stringify(fields.discovery_snapshot) : null,
        interval,
        userId,
      ],
    );
    return firstRow(result);
  }

  async upsertResource(req, row) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const existing = await db.query(
      `SELECT content_hash FROM sportadmin_resources WHERE id = $1 AND user_id = $2`,
      [row.id, userId],
    );
    if (firstRow(existing)?.content_hash === row.content_hash) {
      return { skipped: true, id: row.id };
    }
    await db.query(
      `INSERT INTO sportadmin_resources (
         id, user_id, source, source_id, type, payload, source_url, source_image_url, content_hash, imported_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET
         payload = EXCLUDED.payload,
         source_url = EXCLUDED.source_url,
         source_image_url = EXCLUDED.source_image_url,
         content_hash = EXCLUDED.content_hash,
         updated_at = NOW()`,
      [
        row.id,
        userId,
        row.source,
        row.source_id,
        row.type,
        JSON.stringify(row.payload),
        row.source_url,
        row.source_image_url,
        row.content_hash,
      ],
    );
    return { skipped: false, id: row.id };
  }

  async listResources(req, type, { limit, upcoming, team, category } = {}) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const params = [userId, type];
    let sql = `SELECT * FROM sportadmin_resources WHERE user_id = $1 AND type = $2`;
    if (team) {
      params.push(team);
      sql += ` AND payload->>'team' = $${params.length}`;
    }
    if (category) {
      params.push(`%${category}%`);
      sql += ` AND (
        COALESCE(payload->>'category','') ILIKE $${params.length}
        OR COALESCE(payload->>'team','') ILIKE $${params.length}
      )`;
    }
    if (type === 'match' && upcoming) {
      sql += ` AND (
        payload->>'date' IS NULL
        OR payload->>'date' >= to_char(CURRENT_DATE, 'YYYY-MM-DD')
      )`;
    }
    if (type === 'news') {
      sql += ` ORDER BY COALESCE(payload->>'published_at','') DESC, updated_at DESC`;
    } else if (type === 'page') {
      sql += ` ORDER BY COALESCE((payload->>'sort_index')::int, 9999) ASC, COALESCE(payload->>'title','') ASC`;
    } else if (type === 'match' || type === 'event') {
      sql += ` ORDER BY COALESCE(payload->>'date', payload->>'start','') ASC, updated_at DESC`;
    } else {
      sql += ` ORDER BY updated_at DESC`;
    }
    if (limit) {
      params.push(Number(limit));
      sql += ` LIMIT $${params.length}`;
    }
    const rows = await db.query(sql, params);
    return Array.isArray(rows) ? rows : [];
  }

  async countByType(req) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const rows = await db.query(
      `SELECT type, COUNT(*)::int AS count
         FROM sportadmin_resources
        WHERE user_id = $1
        GROUP BY type`,
      [userId],
    );
    const counts = { pages: 0, teams: 0, news: 0, matches: 0, events: 0, links: 0 };
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row.type === 'page') counts.pages = row.count;
      if (row.type === 'team') counts.teams = row.count;
      if (row.type === 'news') counts.news = row.count;
      if (row.type === 'match') counts.matches = row.count;
      if (row.type === 'event') counts.events = row.count;
      if (row.type === 'link') counts.links = row.count;
    }
    return counts;
  }

  async addError(req, { resource, status, message }) {
    const db = Database.get(req);
    const userId = db.getUserId();
    await db.query(
      `INSERT INTO sportadmin_sync_errors (user_id, resource, status, message)
       VALUES ($1, $2, $3, $4)`,
      [userId, resource, status ?? null, message],
    );
  }

  async listErrors(req, limit = 50) {
    const db = Database.get(req);
    const userId = db.getUserId();
    const rows = await db.query(
      `SELECT created_at, resource, status, message
         FROM sportadmin_sync_errors
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [userId, Math.min(100, Number(limit) || 50)],
    );
    return Array.isArray(rows) ? rows : [];
  }

  async clearOldErrors(req, keep = 100) {
    const db = Database.get(req);
    const userId = db.getUserId();
    await db.query(
      `DELETE FROM sportadmin_sync_errors
        WHERE user_id = $1
          AND id NOT IN (
            SELECT id FROM sportadmin_sync_errors
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2
          )`,
      [userId, keep],
    );
  }
}

module.exports = SportadminModel;
