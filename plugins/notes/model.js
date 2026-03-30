// plugins/notes/model.js
// Notes model - handles note CRUD operations with V2 ServiceManager
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');

class NoteModel {
  constructor() {
    // No pool needed - ServiceManager provides database service
  }

  async getAll(req) {
    try {
      const db = Database.get(req);

      // Tenant isolation automatic - no need to filter by user_id
      const rows = await db.query('SELECT * FROM notes ORDER BY created_at DESC', []);

      return rows.map(this.transformRow);
    } catch (error) {
      Logger.error('Failed to fetch notes', error);
      throw new AppError('Failed to fetch notes', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, noteData) {
    try {
      const db = Database.get(req);

      const { title, content, mentions } = noteData;

      // Use database.insert for automatic tenant isolation
      const result = await db.insert('notes', {
        title,
        content: content || '',
        mentions: JSON.stringify(mentions || []),
      });

      Logger.info('Note created', { noteId: result.id });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to create note', error, { noteData: { title: noteData.title } });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create note', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, noteId, noteData) {
    try {
      const db = Database.get(req);

      // Verify note exists (ownership check automatic via tenant isolation)
      const existing = await db.query('SELECT * FROM notes WHERE id = $1', [noteId]);

      if (existing.length === 0) {
        throw new AppError('Note not found', 404, AppError.CODES.NOT_FOUND);
      }

      const { title, content, mentions } = noteData;

      // Use database.update for automatic tenant isolation
      const result = await db.update('notes', noteId, {
        title,
        content: content || '',
        mentions: JSON.stringify(mentions || []),
      });

      Logger.info('Note updated', { noteId });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to update note', error, { noteId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update note', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, noteId) {
    try {
      const db = Database.get(req);

      // Fetch note before deletion for backup/logging
      const existing = await db.query('SELECT * FROM notes WHERE id = $1', [noteId]);
      const backup = existing.length > 0 ? this.transformRow(existing[0]) : null;

      // Delete the note (tenant isolation automatic)
      await db.deleteRecord('notes', noteId);

      Logger.info('Note deleted', { noteId });

      return { id: noteId, backup };
    } catch (error) {
      Logger.error('Failed to delete note', error, { noteId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete note', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      const pool = req.tenantPool;
      const userId = req.session?.user?.id;

      // Fetch notes before deletion for backup
      let backups = [];
      if (pool && userId && Array.isArray(idsTextArray) && idsTextArray.length > 0) {
        const ids = idsTextArray.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
        if (ids.length > 0) {
          const existing = await pool.query(
            'SELECT * FROM notes WHERE id = ANY($1::int[]) AND user_id = $2',
            [ids, userId],
          );
          backups = existing.rows.map((row) => this.transformRow(row));
        }
      }

      // Use core BulkOperationsHelper for generic bulk delete logic
      const result = await BulkOperationsHelper.bulkDelete(req, 'notes', idsTextArray);
      return { ...result, backups };
    } catch (error) {
      Logger.error('Failed to bulk delete notes', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to bulk delete notes', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformRow(row) {
    // Parse mentions if it's a string
    let mentions = row.mentions || [];
    if (typeof mentions === 'string') {
      try {
        mentions = JSON.parse(mentions);
      } catch (e) {
        mentions = [];
      }
    }

    return {
      id: row.id.toString(),
      title: row.title,
      content: row.content || '',
      mentions: mentions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = NoteModel;
