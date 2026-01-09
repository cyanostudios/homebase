// plugins/notes/model.js
// Notes model - handles note CRUD operations with V2 ServiceManager
const ServiceManager = require('../../server/core/ServiceManager');
const { AppError } = require('../../server/core/errors/AppError');

class NoteModel {
  constructor() {
    // No pool needed - ServiceManager provides database service
  }

  _getContext(req) {
    return {
      userId: req?.session?.currentTenantUserId || req?.session?.user?.id,
      pool: req?.tenantPool,
    };
  }

  async getAll(req) {
    try {
      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);
      
      // Tenant isolation automatic - no need to filter by user_id
      const rows = await database.query(
        'SELECT * FROM notes ORDER BY created_at DESC',
        [],
        context
      );
      
      return rows.map(this.transformRow);
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to fetch notes', error);
      throw new AppError('Failed to fetch notes', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, noteData) {
    try {
      const database = ServiceManager.get('database', req);
      const logger = ServiceManager.get('logger');
      const context = this._getContext(req);
      
      const { title, content, mentions } = noteData;
      
      // Use database.insert for automatic tenant isolation
      const result = await database.insert('notes', {
        title,
        content: content || '',
        mentions: JSON.stringify(mentions || []),
      }, context);
      
      logger.info('Note created', { noteId: result.id, userId: context.userId });
      
      return this.transformRow(result);
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to create note', error, { noteData: { title: noteData.title } });
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create note', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, noteId, noteData) {
    try {
      const database = ServiceManager.get('database', req);
      const logger = ServiceManager.get('logger');
      const context = this._getContext(req);
      
      // Verify note exists (ownership check automatic via tenant isolation)
      const existing = await database.query(
        'SELECT * FROM notes WHERE id = $1',
        [noteId],
        context
      );
      
      if (existing.length === 0) {
        throw new AppError('Note not found', 404, AppError.CODES.NOT_FOUND);
      }
      
      const { title, content, mentions } = noteData;
      
      // Use database.update for automatic tenant isolation
      const result = await database.update('notes', noteId, {
        title,
        content: content || '',
        mentions: JSON.stringify(mentions || []),
      }, context);
      
      logger.info('Note updated', { noteId, userId: context.userId });
      
      return this.transformRow(result);
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to update note', error, { noteId });
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update note', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, noteId) {
    try {
      const database = ServiceManager.get('database', req);
      const logger = ServiceManager.get('logger');
      const context = this._getContext(req);
      
      // First, delete all tasks that were created from this note
      // Note: This still needs direct pool access for cross-plugin operations
      const pool = context.pool || req.tenantPool;
      if (pool) {
        await pool.query(
          'DELETE FROM tasks WHERE created_from_note = $1 AND user_id = $2',
          [noteId, context.userId]
        );
      }
      
      // Delete the note (tenant isolation automatic)
      await database.delete('notes', noteId, context);
      
      logger.info('Note deleted', { noteId, userId: context.userId });
      
      return { id: noteId };
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to delete note', error, { noteId });
      
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