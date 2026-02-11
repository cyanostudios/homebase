// plugins/inspection/model.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const PROJECTS_TABLE = 'inspection_projects';
const FILES_TABLE = 'inspection_project_files';
const USER_FILES_TABLE = 'user_files';
const FILE_LISTS_TABLE = 'inspection_project_file_lists';
const FILE_LIST_ITEMS_TABLE = 'inspection_project_file_list_items';
const LISTS_TABLE = 'lists';
const FILE_LIST_ITEMS_SOURCE_TABLE = 'file_list_items';

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
      project.fileCount = project.files.length;
      project.fileLists = await this.getProjectFileLists(req, projectId);
      return project;
    } catch (error) {
      Logger.error('Failed to get inspection project', error, { projectId });
      throw new AppError('Failed to get inspection project', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async projectExists(req, projectId) {
    const db = Database.get(req);
    const rows = await db.query(
      `SELECT id
       FROM ${PROJECTS_TABLE}
       WHERE id = $1
       LIMIT 1`,
      [projectId]
    );
    return rows.length > 0;
  }

  async getProjectRow(req, projectId) {
    const db = Database.get(req);
    const rows = await db.query(
      `SELECT id, user_id, name, description, admin_notes, created_at, updated_at
       FROM ${PROJECTS_TABLE}
       WHERE id = $1
       LIMIT 1`,
      [projectId]
    );
    return rows.length ? rows[0] : null;
  }

  async getProjectFileIds(req, projectId) {
    const db = Database.get(req);
    const rows = await db.query(
      `SELECT pf.file_id FROM ${FILES_TABLE} pf WHERE pf.project_id = $1`,
      [projectId]
    );
    return rows.map((r) => String(r.file_id));
  }

  async getProjectFiles(req, projectId) {
    const db = Database.get(req);
    const rows = await db.query(
      `SELECT
          uf.id,
          uf.user_id,
          uf.name,
          uf.size,
          uf.mime_type,
          uf.url,
          uf.created_at,
          uf.updated_at,
          pf.id AS link_id,
          pf.created_at AS link_created_at
       FROM ${FILES_TABLE} pf
       JOIN ${USER_FILES_TABLE} uf ON uf.id = pf.file_id
       WHERE pf.project_id = $1
       ORDER BY pf.created_at ASC`,
      [projectId]
    );
    return rows.map((r) => ({
      id: String(r.id),
      name: r.name ?? '',
      size: r.size,
      mimeType: r.mime_type,
      url: r.url,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      linkId: String(r.link_id),
      linkCreatedAt: r.link_created_at,
    }));
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

      const existingRow = await this.getProjectRow(req, projectId);
      if (!existingRow) throw new AppError('Project not found', 404, AppError.CODES.NOT_FOUND);

      const existing = this.transformProject(existingRow, 0);

      await db.update(PROJECTS_TABLE, projectId, {
        name: Object.prototype.hasOwnProperty.call(data, 'name')
          ? String(data.name ?? '').trim()
          : existing.name,
        description: Object.prototype.hasOwnProperty.call(data, 'description')
          ? (data.description ?? '')
          : existing.description,
        admin_notes: Object.prototype.hasOwnProperty.call(data, 'adminNotes')
          ? (data.adminNotes ?? '')
          : existing.adminNotes,
      });

      Logger.info('Inspection project updated', { projectId });

      // Behåll API-beteende: returnera fulla projektet med filer
      return this.getById(req, projectId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update inspection project', error, { projectId });
      throw new AppError('Failed to update inspection project', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getProjectFileLists(req, projectId) {
    const db = Database.get(req);
    const rows = await db.query(
      `SELECT id, source_list_id, source_list_name, created_at
       FROM ${FILE_LISTS_TABLE}
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [projectId]
    );
    const result = [];
    for (const r of rows) {
      const itemRows = await db.query(
        `SELECT file_id FROM ${FILE_LIST_ITEMS_TABLE}
         WHERE project_file_list_id = $1 ORDER BY created_at ASC`,
        [r.id]
      );
      result.push({
        id: String(r.id),
        sourceListId: r.source_list_id != null ? String(r.source_list_id) : null,
        sourceListName: r.source_list_name ?? '',
        createdAt: r.created_at,
        fileIds: itemRows.map((x) => String(x.file_id)),
      });
    }
    return result;
  }

  async addFileList(req, projectId, listId) {
    const db = Database.get(req);
    const listsModel = require('../../server/core/lists/listsModel');
    const userId = listsModel.getUserId(req);

    const exists = await this.projectExists(req, projectId);
    if (!exists) throw new AppError('Project not found', 404, AppError.CODES.NOT_FOUND);

    const list = await listsModel.getListById(req, 'files', listId);
    if (!list) throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
    const listName = list.name ?? '';

    const existing = await db.query(
      `SELECT id FROM ${FILE_LISTS_TABLE}
       WHERE project_id = $1 AND source_list_id = $2 LIMIT 1`,
      [projectId, listId]
    );
    if (existing && existing.length > 0) {
      return this.getById(req, projectId);
    }

    const fileIds = await listsModel.getFileListItems(req, listId);

    const listRow = await db.insert(FILE_LISTS_TABLE, {
      project_id: parseInt(projectId, 10),
      source_list_id: parseInt(listId, 10),
      source_list_name: listName,
    });

    for (const fileId of fileIds) {
      await db.insert(FILE_LIST_ITEMS_TABLE, {
        project_file_list_id: listRow.id,
        file_id: parseInt(fileId, 10),
      });
    }

    Logger.info('File list added to inspection project', { projectId, listId, fileCount: fileIds.length });
    return this.getById(req, projectId);
  }

  async removeFileList(req, projectId, fileListId) {
    const db = Database.get(req);
    const exists = await this.projectExists(req, projectId);
    if (!exists) throw new AppError('Project not found', 404, AppError.CODES.NOT_FOUND);

    await db.query(
      `DELETE FROM ${FILE_LISTS_TABLE}
       WHERE id = $1 AND project_id = $2`,
      [fileListId, projectId]
    );
    Logger.info('File list removed from inspection project', { projectId, fileListId });
    return this.getById(req, projectId);
  }

  async delete(req, projectId) {
    try {
      const db = Database.get(req);
      const exists = await this.projectExists(req, projectId);
      if (!exists) throw new AppError('Project not found', 404, AppError.CODES.NOT_FOUND);

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

      const exists = await this.projectExists(req, projectId);
      if (!exists) throw new AppError('Project not found', 404, AppError.CODES.NOT_FOUND);

      const ids = Array.isArray(fileIds) ? fileIds : [fileIds];

      const currentIds = new Set(await this.getProjectFileIds(req, projectId));
      const toAdd = ids
        .map((x) => (x == null ? '' : String(x)))
        .map((x) => x.trim())
        .filter((x) => x && !currentIds.has(x));

      for (const fileId of toAdd) {
        await db.insert(FILES_TABLE, {
          project_id: parseInt(projectId, 10),
          file_id: parseInt(fileId, 10),
        });
      }

      Logger.info('Files added to inspection project', { projectId, count: toAdd.length });
      return this.getById(req, projectId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to add files to project', error, { projectId });
      throw new AppError('Failed to add files to project', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async setFiles(req, projectId, fileIds) {
    try {
      const db = Database.get(req);

      const exists = await this.projectExists(req, projectId);
      if (!exists) throw new AppError('Project not found', 404, AppError.CODES.NOT_FOUND);

      await db.query(`DELETE FROM ${FILES_TABLE} WHERE project_id = $1`, [projectId]);

      const ids = Array.isArray(fileIds) ? fileIds : [fileIds];
      let count = 0;

      for (const fileId of ids) {
        if (!fileId) continue;
        await db.insert(FILES_TABLE, {
          project_id: parseInt(projectId, 10),
          file_id: parseInt(fileId, 10),
        });
        count += 1;
      }

      Logger.info('Files set for inspection project', { projectId, count });

      // Behåll API-beteende: returnera fulla projektet med filer
      return this.getById(req, projectId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to set files for project', error, { projectId });
      throw new AppError('Failed to set files for project', 500, AppError.CODES.DATABASE_ERROR);
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

      // Behåll API-beteende: returnera fulla projektet med filer
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