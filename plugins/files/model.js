// server/plugins/files/model.js
// Postgres model for Files plugin (metadata only; binary upload handled elsewhere)

class FilesModel {
  constructor(pool) {
    this.pool = pool;
  }

  // DB table (snake_case)
  static TABLE = 'user_files';
  static ORDER_BY = 'updated_at DESC, id DESC';

  async getAll(userId) {
    const sql = `
      SELECT id, user_id, name, size, mime_type, url, created_at, updated_at
      FROM ${FilesModel.TABLE}
      WHERE user_id = $1
      ORDER BY ${FilesModel.ORDER_BY}
    `;
    const result = await this.pool.query(sql, [userId]);
    return result.rows.map(this.transformRow);
  }

  async getById(userId, itemId) {
    const sql = `
      SELECT id, user_id, name, size, mime_type, url, created_at, updated_at
      FROM ${FilesModel.TABLE}
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `;
    const result = await this.pool.query(sql, [itemId, userId]);
    return result.rows.length ? this.transformRow(result.rows[0]) : null;
  }

  // NEW: find by stored filename in url (/api/files/raw/<filename>)
  async getByStoredFilename(userId, filename) {
    const sql = `
      SELECT id, user_id, name, size, mime_type, url, created_at, updated_at
      FROM ${FilesModel.TABLE}
      WHERE user_id = $1 AND url LIKE $2
      ORDER BY id DESC
      LIMIT 1
    `;
    const like = `%/api/files/raw/${filename}`;
    const result = await this.pool.query(sql, [userId, like]);
    return result.rows.length ? this.transformRow(result.rows[0]) : null;
  }

  async create(userId, data) {
    const sql = `
      INSERT INTO ${FilesModel.TABLE} (
        user_id, name, size, mime_type, url, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING id, user_id, name, size, mime_type, url, created_at, updated_at
    `;
    const params = [
      userId,
      String(data?.name ?? '').trim(),
      data?.size ?? null,
      data?.mimeType ?? null,
      data?.url ?? null,
    ];
    const result = await this.pool.query(sql, params);
    return this.transformRow(result.rows[0]);
  }

  async update(userId, itemId, data) {
    const sets = [];
    const params = [];
    let p = 1;

    if (Object.prototype.hasOwnProperty.call(data, 'name')) { sets.push(`name = $${p++}`); params.push(String(data.name ?? '')); }
    if (Object.prototype.hasOwnProperty.call(data, 'size')) { sets.push(`size = $${p++}`); params.push(data.size ?? null); }
    if (Object.prototype.hasOwnProperty.call(data, 'mimeType')) { sets.push(`mime_type = $${p++}`); params.push(data.mimeType ?? null); }
    if (Object.prototype.hasOwnProperty.call(data, 'url')) { sets.push(`url = $${p++}`); params.push(data.url ?? null); }

    sets.push(`updated_at = CURRENT_TIMESTAMP`);

    const sql = `
      UPDATE ${FilesModel.TABLE}
      SET ${sets.join(', ')}
      WHERE id = $${p++} AND user_id = $${p}
      RETURNING id, user_id, name, size, mime_type, url, created_at, updated_at
    `;
    params.push(itemId, userId);

    const result = await this.pool.query(sql, params);
    if (!result.rows.length) throw new Error('Item not found');
    return this.transformRow(result.rows[0]);
  }

  async delete(userId, itemId) {
    const sql = `
      DELETE FROM ${FilesModel.TABLE}
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    const result = await this.pool.query(sql, [itemId, userId]);
    if (!result.rows.length) throw new Error('Item not found');
    return { id: String(itemId) };
  }

  // Map DB row -> API shape (camelCase)
  transformRow(row) {
    return {
      id: String(row.id),
      name: row.name ?? '',
      size: row.size != null ? Number(row.size) : null,
      mimeType: row.mime_type ?? null,
      url: row.url ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = FilesModel;
