// plugins/inspection/model.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const PROJECTS_TABLE = 'inspection_projects';
const FILES_TABLE = 'inspection_project_files';

class InspectionModel {
  async getAll(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `SELECT p.id, p.user_id, p.name, p.description, p.admin_notes, p.created_at, p.updated_at,
                (SELECT COUNT(*)::int FROM ${FILES_TABLE} f WHERE f.project_id = p.id) AS file_count
         FROM ${PROJECTS_TABLE} p
         ORDER BY p.created_at DESC`,
        []
      );
      return rows.map((r) => this.transformProject(r, r.file_count));
    } catch (error) {
      Logger.error('Failed to fetch inspection projects', error);
      throw new AppError('Failed to fetch inspection projects', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, projectId) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `SELECT id, user_id, name, description, admin_notes, created_at, updated_at
         FROM ${PROJECTS_TABLE}
         WHERE id = $1
         LIMIT 1`,
        [projectId]
      );
      if (rows.length === 0) return null;
      const project = this.transformProject(rows[0], 0);
      project.files = await this.getProjectFiles(req, projectId);
      return project;
    } catch (error) {
      Logger.error('Failed to get inspection project', error, { projectId });
      throw new AppError('Failed to get inspection project', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getProjectFiles(req, projectId) {
    const db = Database.get(req);
    const FilesModel = require('../files/model');
    const filesModel = new FilesModel();

    const rows = await db.query(
      `SELECT pf.id, pf.file_id, pf.created_at
       FROM ${FILES_TABLE} pf
       WHERE pf.project_id = $1
       ORDER BY pf.created_at ASC`,
      [projectId]
    );

    const files = [];
    for (const row of rows) {
      try {
        const file = await filesModel.getById(req, row.file_id);
        if (file) {
          files.push({ ...file, linkId: String(row.id) });
        }
      } catch (e) {
        Logger.warn('File not found for project file link', { fileId: row.file_id });
      }
    }
    return files;
  }

  async create(req, data) {
    try {
      const db = Database.get(req);
      const result = await db.insert(PROJECTS_TABLE, {
        name: String(data?.name ?? '').trim() || new Date().toISOString().slice(0, 10),
        description: data?.description ?? '',
        admin_notes: data?.adminNotes ?? '',
      });
      Logger.info('Inspection project created', { projectId: result.id });
      return this.getById(req, result.id);
    } catch (error) {
      Logger.error('Failed to create inspection project', error);
      throw new AppError('Failed to create inspection project', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, projectId, data) {
    try {
      const db = Database.get(req);
      const existing = await this.getById(req, projectId);
      if (!existing) throw new AppError('Project not found', 404, AppError.CODES.NOT_FOUND);

      await db.update(PROJECTS_TABLE, projectId, {
        name: Object.prototype.hasOwnProperty.call(data, 'name') ? String(data.name ?? '').trim() : existing.name,
        description: Object.prototype.hasOwnProperty.call(data, 'description') ? (data.description ?? '') : existing.description,
        admin_notes: Object.prototype.hasOwnProperty.call(data, 'adminNotes') ? (data.adminNotes ?? '') : existing.adminNotes,
      });
      Logger.info('Inspection project updated', { projectId });
      return this.getById(req, projectId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update inspection project', error, { projectId });
      throw new AppError('Failed to update inspection project', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, projectId) {
    try {
      const db = Database.get(req);
      const existing = await this.getById(req, projectId);
      if (!existing) throw new AppError('Project not found', 404, AppError.CODES.NOT_FOUND);

      await db.query(`DELETE FROM ${FILES_TABLE} WHERE project_id = $1`, [projectId]);
      await db.deleteRecord(PROJECTS_TABLE, projectId);
      Logger.info('Inspection project deleted', { projectId });
      return { id: projectId };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete inspection project', error, { projectId });
      throw new AppError('Failed to delete inspection project', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async addFiles(req, projectId, fileIds) {
    try {
      const db = Database.get(req);
      const existing = await this.getById(req, projectId);
      if (!existing) throw new AppError('Project not found', 404, AppError.CODES.NOT_FOUND);

      const ids = Array.isArray(fileIds) ? fileIds : [fileIds];
      for (const fileId of ids) {
        if (!fileId) continue;
        await db.insert(FILES_TABLE, { project_id: parseInt(projectId, 10), file_id: parseInt(fileId, 10) });
      }
      Logger.info('Files added to inspection project', { projectId, count: ids.length });
      return this.getById(req, projectId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to add files to project', error, { projectId });
      throw new AppError('Failed to add files to project', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async removeFile(req, projectId, fileId) {
    try {
      const db = Database.get(req);
      await db.query(
        `DELETE FROM ${FILES_TABLE} WHERE project_id = $1 AND file_id = $2`,
        [projectId, fileId]
      );
      Logger.info('File removed from inspection project', { projectId, fileId });
      return this.getById(req, projectId);
    } catch (error) {
      Logger.error('Failed to remove file from project', error, { projectId, fileId });
      throw new AppError('Failed to remove file from project', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformProject(row, fileCount = 0) {
    return {
      id: String(row.id),
      name: row.name ?? '',
      description: row.description ?? '',
      adminNotes: row.admin_notes ?? '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      files: [],
      fileCount: fileCount != null ? fileCount : 0,
    };
  }
}

module.exports = new InspectionModel();
