// plugins/notes/model.js
// Notes model - handles note CRUD operations with V2 ServiceManager
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class NoteModel {
  constructor() {
    // No pool needed - ServiceManager provides database service
  }

  async getAll(req) {
    try {
      const db = Database.get(req);

      // Tenant isolation is handled by schema/database routing.
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

  async bulkDelete(req, idsTextArray) {
    try {
      const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
      return await BulkOperationsHelper.bulkDelete(req, 'notes', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete notes', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to bulk delete notes', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, noteId) {
    try {
      const db = Database.get(req);

      // First, delete all tasks that were created from this note
      // Use direct pool access for cross-plugin operations
      const pool = req.tenantPool;
      if (pool) {
        await pool.query('DELETE FROM tasks WHERE created_from_note = $1', [noteId]);
      }

      // Delete the note (tenant isolation automatic)
      await db.deleteRecord('notes', noteId);

      Logger.info('Note deleted', { noteId });

      return { id: noteId };
    } catch (error) {
      Logger.error('Failed to delete note', error, { noteId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete note', 500, AppError.CODES.DATABASE_ERROR);
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
