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

  async getAll(req, opts = {}) {
    try {
      const db = Database.get(req);
      const { folderPath } = opts;

      let sql = `SELECT id, name, size, mime_type, url, folder_path, created_at, updated_at
         FROM ${FilesModel.TABLE}`;
      const params = [];

      if (folderPath !== undefined) {
        if (folderPath === null || folderPath === '') {
          sql += ` WHERE folder_path IS NULL`;
        } else {
          sql += ` WHERE folder_path = $1`;
          params.push(folderPath);
        }
      }
      sql += ` ORDER BY ${FilesModel.ORDER_BY}`;

      const rows = await db.query(sql, params);
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
        `SELECT id, name, size, mime_type, url, folder_path, created_at, updated_at
         FROM ${FilesModel.TABLE}
         WHERE id = $1
         LIMIT 1`,
        [itemId],
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

  // Find by full url (matches /api/files/raw/<path>/<filename> or /api/files/raw/<filename>)
  async getByUrl(req, url) {
    try {
      const db = Database.get(req);

      const result = await db.query(
        `SELECT id, name, size, mime_type, url, folder_path, created_at, updated_at
         FROM ${FilesModel.TABLE}
         WHERE url = $1
         ORDER BY id DESC
         LIMIT 1`,
        [url],
      );

      if (result.length === 0) return null;
      return this.transformRow(result[0]);
    } catch (error) {
      Logger.error('Failed to get file by url', error, { url });
      throw new AppError('Failed to get file by url', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Find by stored filename (legacy: matches url ending with filename, for root or folder)
  async getByStoredFilename(req, filename) {
    try {
      const db = Database.get(req);
      const escaped = filename.replace(/[%_\\]/g, '\\$&');
      const likeFolder = `%/api/files/raw/%/${escaped}`;
      const likeRoot = `%/api/files/raw/${escaped}`;
      const result = await db.query(
        `SELECT id, name, size, mime_type, url, folder_path, created_at, updated_at
         FROM ${FilesModel.TABLE}
         WHERE url LIKE $1 ESCAPE '\\' OR url LIKE $2 ESCAPE '\\'
         ORDER BY id DESC LIMIT 1`,
        [likeFolder, likeRoot],
      );
      if (result.length === 0) return null;
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

      const insertData = {
        name: String(data?.name ?? '').trim(),
        size: data?.size ?? null,
        mime_type: data?.mimeType ?? null,
        url: data?.url ?? null,
      };
      if (Object.prototype.hasOwnProperty.call(data, 'folderPath')) {
        insertData.folder_path =
          data.folderPath === '' || data.folderPath == null ? null : data.folderPath;
      }
      const result = await db.insert(FilesModel.TABLE, insertData);

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
      if (Object.prototype.hasOwnProperty.call(data, 'folderPath')) {
        updateData.folder_path =
          data.folderPath === '' || data.folderPath == null ? null : data.folderPath;
      }
      // Preserve updated_at when caller passes it (e.g. move should not change "Updated" date)
      if (
        Object.prototype.hasOwnProperty.call(data, 'updatedAt') ||
        Object.prototype.hasOwnProperty.call(data, 'updated_at')
      ) {
        const val = data.updated_at ?? data.updatedAt;
        if (val != null) updateData.updated_at = val;
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

  // Get all file IDs in a folder (and subfolders) for batch delete
  async getFileIdsInFolder(req, folderPath) {
    if (!folderPath || typeof folderPath !== 'string') return [];
    try {
      const db = Database.get(req);
      const sql = `
        SELECT id FROM ${FilesModel.TABLE}
        WHERE (folder_path = $1 OR folder_path LIKE $2)
      `;
      const prefix = folderPath.replace(/'/g, "''") + '/';
      const rows = await db.query(sql, [folderPath, prefix + '%']);
      return rows.map((r) => String(r.id));
    } catch (error) {
      Logger.error('Failed to get file IDs in folder', error, { folderPath });
      return [];
    }
  }

  // Get all distinct folder paths (for folder tree)
  async getFolderPaths(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `SELECT DISTINCT folder_path FROM ${FilesModel.TABLE}
         WHERE folder_path IS NOT NULL AND folder_path != ''
         ORDER BY folder_path`,
        [],
      );
      return rows.map((r) => r.folder_path);
    } catch (error) {
      Logger.error('Failed to get folder paths', error);
      throw new AppError('Failed to get folder paths', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getListFiles(req, listId) {
    const listsModel = require('../../server/core/lists/listsModel');
    const list = await listsModel.getListById(req, 'files', listId);
    if (!list) return [];
    const fileIds = await listsModel.getFileListItems(req, listId);
    const result = [];
    for (const fileId of fileIds) {
      const file = await this.getById(req, fileId);
      if (file) result.push(file);
    }
    return result;
  }

  async addFilesToList(req, listId, fileIds) {
    const db = Database.get(req);
    const listsModel = require('../../server/core/lists/listsModel');
    const list = await listsModel.getListById(req, 'files', listId);
    if (!list) throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
    const TABLE = 'file_list_items';
    const ids = Array.isArray(fileIds) ? fileIds : [fileIds];
    let added = 0;
    for (const fileId of ids) {
      if (!fileId) continue;
      try {
        await db.insert(TABLE, {
          list_id: parseInt(listId, 10),
          file_id: parseInt(String(fileId), 10),
        });
        added += 1;
      } catch (e) {
        if (e?.details?.code === '23505') continue;
        throw e;
      }
    }
    Logger.info('Files added to list', { listId, added });
    return { added };
  }

  async removeFileFromList(req, listId, fileId) {
    const db = Database.get(req);
    const listsModel = require('../../server/core/lists/listsModel');
    const list = await listsModel.getListById(req, 'files', listId);
    if (!list) throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
    const result = await db.query(
      `DELETE FROM file_list_items
       WHERE list_id = $1 AND file_id = $2
       RETURNING file_id`,
      [listId, fileId],
    );
    return { removed: result && result.length > 0 };
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
      folderPath: row.folder_path ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = FilesModel;
