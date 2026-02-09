// plugins/files/model.js
// Files model - V3 with @homebase/core SDK
// Note: Binary upload handled elsewhere, this only manages metadata
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class FilesModel {
  constructor() {
    // No pool needed - @homebase/core Database provides database service
  }

  // DB table (snake_case)
  static TABLE = 'user_files';
  static ORDER_BY = 'updated_at DESC, id DESC';

  async getAll(req) {
    try {
      const db = Database.get(req);

      // Tenant isolation automatic
      const rows = await db.query(
        `SELECT id, user_id, name, size, mime_type, url, created_at, updated_at
         FROM ${FilesModel.TABLE}
         ORDER BY ${FilesModel.ORDER_BY}`,
        [],
      );

      return rows.map(this.transformRow);
    } catch (error) {
      Logger.error('Failed to fetch files', error);
      throw new AppError('Failed to fetch files', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, itemId) {
    try {
      const db = Database.get(req);

      const result = await db.query(
        `SELECT id, user_id, name, size, mime_type, url, created_at, updated_at
         FROM ${FilesModel.TABLE}
         WHERE id = $1
         LIMIT 1`,
        [itemId]
      );

      if (result.length === 0) {
        return null;
      }

      return this.transformRow(result[0]);
    } catch (error) {
      Logger.error('Failed to get file', error, { itemId });
      throw new AppError('Failed to get file', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Find by stored filename in url (/api/files/raw/<filename>)
  async getByStoredFilename(req, filename) {
    try {
      const db = Database.get(req);

      const like = `%/api/files/raw/${filename}`;
      const result = await db.query(
        `SELECT id, user_id, name, size, mime_type, url, created_at, updated_at
         FROM ${FilesModel.TABLE}
         WHERE url LIKE $1
         ORDER BY id DESC
         LIMIT 1`,
        [like]
      );

      if (result.length === 0) {
        return null;
      }

      return this.transformRow(result[0]);
    } catch (error) {
      Logger.error('Failed to get file by stored filename', error, { filename });
      throw new AppError(
        'Failed to get file by stored filename',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async create(req, data) {
    try {
      const db = Database.get(req);

      // Use database.insert for automatic tenant isolation
      const result = await db.insert(FilesModel.TABLE, {
        name: String(data?.name ?? '').trim(),
        size: data?.size ?? null,
        mime_type: data?.mimeType ?? null,
        url: data?.url ?? null,
      });

      Logger.info('File metadata created', { fileId: result.id });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to create file metadata', error, { data: { name: data?.name } });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create file metadata', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, itemId, data) {
    try {
      const db = Database.get(req);

      // Verify file exists (ownership check automatic)
      const existing = await this.getById(req, itemId);
      if (!existing) {
        throw new AppError('File not found', 404, AppError.CODES.NOT_FOUND);
      }

      // Build update object
      const updateData = {};
      if (Object.prototype.hasOwnProperty.call(data, 'name')) {
        updateData.name = String(data.name ?? '');
      }
      if (Object.prototype.hasOwnProperty.call(data, 'size')) {
        updateData.size = data.size ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(data, 'mimeType')) {
        updateData.mime_type = data.mimeType ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(data, 'url')) {
        updateData.url = data.url ?? null;
      }

      // Use database.update for automatic tenant isolation
      const result = await db.update(FilesModel.TABLE, itemId, updateData);

      Logger.info('File metadata updated', { fileId: itemId });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to update file metadata', error, { itemId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update file metadata', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, itemId) {
    try {
      const db = Database.get(req);

      // Delete the file metadata (tenant isolation automatic)
      await db.deleteRecord(FilesModel.TABLE, itemId);

      Logger.info('File metadata deleted', { fileId: itemId });

      return { id: String(itemId) };
    } catch (error) {
      Logger.error('Failed to delete file metadata', error, { itemId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete file metadata', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      const db = Database.get(req);

      const ids = Array.isArray(idsTextArray)
        ? idsTextArray.map((x) => String(x).trim()).filter(Boolean)
        : [];

      if (!ids.length) {
        return { deletedCount: 0, deletedIds: [] };
      }

      const sql = `
        DELETE FROM ${FilesModel.TABLE}
        WHERE id::text = ANY($1::text[])
        RETURNING id::text AS id
      `;

      const rows = await db.query(sql, [ids]);

      Logger.info('Files bulk deleted', { count: rows.length });
      return {
        deletedCount: rows.length,
        deletedIds: rows.map((r) => r.id),
      };
    } catch (error) {
      Logger.error('Failed to bulk delete files', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to bulk delete files', 500, AppError.CODES.DATABASE_ERROR);
    }
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
