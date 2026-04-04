// plugins/files/attachmentModel.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class AttachmentModel {
  static TABLE = 'file_attachments';

  /**
   * @param {import('express').Request} req
   * @param {string} pluginName
   * @param {string} entityId
   */
  async listForEntity(req, pluginName, entityId) {
    try {
      const db = Database.get(req);
      const sql = `
        SELECT fa.id AS attachment_id, fa.created_at AS attached_at,
               f.id, f.user_id, f.name, f.size, f.mime_type, f.url,
               f.storage_provider, f.external_file_id, f.created_at, f.updated_at
        FROM ${AttachmentModel.TABLE} fa
        INNER JOIN user_files f ON f.id = fa.file_id
        WHERE fa.plugin_name = $1 AND fa.entity_id = $2
        ORDER BY fa.created_at DESC
      `;
      const rows = await db.query(sql, [String(pluginName), String(entityId)]);
      return rows.map((r) => ({
        attachmentId: String(r.attachment_id),
        attachedAt: r.attached_at,
        file: {
          id: String(r.id),
          name: r.name ?? '',
          size: r.size != null ? Number(r.size) : null,
          mimeType: r.mime_type ?? null,
          url: r.url ?? null,
          storageProvider: r.storage_provider ?? 'local',
          externalFileId: r.external_file_id ?? null,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        },
      }));
    } catch (error) {
      Logger.error('List attachments failed', error);
      throw new AppError('Failed to list attachments', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {{ pluginName: string, entityId: string, fileId: string }} data
   */
  async create(req, data) {
    try {
      const db = Database.get(req);
      const result = await db.insert(AttachmentModel.TABLE, {
        plugin_name: String(data.pluginName).trim(),
        entity_id: String(data.entityId).trim(),
        file_id: Number(data.fileId),
      });
      return { id: String(result.id), fileId: String(data.fileId) };
    } catch (error) {
      Logger.error('Create attachment failed', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create attachment', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {string} attachmentId
   */
  async getById(req, attachmentId) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `SELECT id, user_id, file_id, plugin_name, entity_id FROM ${AttachmentModel.TABLE} WHERE id = $1 LIMIT 1`,
        [attachmentId],
      );
      if (!rows.length) return null;
      const r = rows[0];
      return {
        id: String(r.id),
        userId: String(r.user_id),
        fileId: String(r.file_id),
        pluginName: r.plugin_name,
        entityId: String(r.entity_id),
      };
    } catch (error) {
      Logger.error('Get attachment failed', error);
      throw new AppError('Failed to get attachment', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {string} attachmentId
   */
  async delete(req, attachmentId) {
    try {
      const db = Database.get(req);
      await db.deleteRecord(AttachmentModel.TABLE, attachmentId);
      return { id: String(attachmentId) };
    } catch (error) {
      Logger.error('Delete attachment failed', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete attachment', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = AttachmentModel;
