// plugins/notes/model.js
// Notes model - handles note CRUD operations with V2 ServiceManager
const crypto = require('crypto');
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');

class NoteModel {
  constructor() {
    // No pool needed - ServiceManager provides database service
  }

  _getContext(req) {
    if (!req) {
      throw new Error('Request object is required');
    }
    const pool = req.tenantPool;
    if (!pool) {
      throw new Error('Tenant pool not found in request. Ensure auth middleware is applied.');
    }
    return { pool, userId: req.session?.currentTenantUserId || req.session?.user?.id };
  }

  async getById(req, noteId) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(noteId), 10);
      if (Number.isNaN(id)) {
        return null;
      }
      const rows = await db.query('SELECT * FROM notes WHERE id = $1', [id]);
      if (!rows.length) {
        return null;
      }
      return this.transformRow(rows[0]);
    } catch (error) {
      Logger.error('Failed to get note by id', error, { noteId });
      throw new AppError('Failed to get note', 500, AppError.CODES.DATABASE_ERROR);
    }
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

  generateShareToken() {
    const bytes = crypto.randomBytes(24);
    return this.base62Encode(bytes);
  }

  base62Encode(buffer) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    let num = BigInt(`0x${buffer.toString('hex')}`);

    while (num > 0n) {
      result = chars[Number(num % 62n)] + result;
      num = num / 62n;
    }

    return result.padStart(32, '0');
  }

  async createShare(req, noteId, validUntil) {
    try {
      const context = this._getContext(req);
      const pool = context.pool;

      const note = await this.getById(req, noteId);
      if (!note) {
        throw new AppError('Note not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      const shareToken = this.generateShareToken();
      const id = parseInt(String(noteId), 10);

      const result = await pool.query(
        `
        INSERT INTO note_shares (note_id, share_token, valid_until)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
        [id, shareToken, validUntil],
      );

      Logger.info('Note share created', { noteId: id, shareId: result.rows[0].id });

      return {
        id: result.rows[0].id.toString(),
        noteId: result.rows[0].note_id.toString(),
        shareToken: result.rows[0].share_token,
        validUntil: result.rows[0].valid_until,
        createdAt: result.rows[0].created_at,
        accessedCount: result.rows[0].accessed_count,
        lastAccessedAt: result.rows[0].last_accessed_at,
      };
    } catch (error) {
      Logger.error('Failed to create note share', error, { noteId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create share', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getNoteByShareToken(req, shareToken) {
    try {
      const pool = req.tenantPool || this._getContext(req).pool;

      const result = await pool.query(
        `
        SELECT
          n.*,
          ns.accessed_count,
          ns.valid_until AS share_valid_until
        FROM notes n
        JOIN note_shares ns ON n.id = ns.note_id
        WHERE ns.share_token = $1 AND ns.valid_until > NOW()
      `,
        [shareToken],
      );

      if (!result.rows.length) {
        return null;
      }

      const row = result.rows[0];
      const currentAccessCount = row.accessed_count;

      await pool.query(
        `
        UPDATE note_shares
        SET accessed_count = accessed_count + 1, last_accessed_at = NOW()
        WHERE share_token = $1
      `,
        [shareToken],
      );

      const note = this.transformRow(row);
      note.shareValidUntil = row.share_valid_until;
      note.accessedCount = currentAccessCount + 1;

      return note;
    } catch (error) {
      Logger.error('Failed to get note by share token', error, {
        shareToken: shareToken.substring(0, 10),
      });
      throw new AppError('Failed to get note by share token', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getSharesForNote(req, noteId) {
    try {
      const context = this._getContext(req);
      const pool = context.pool;

      const note = await this.getById(req, noteId);
      if (!note) {
        throw new AppError('Note not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      const id = parseInt(String(noteId), 10);
      const result = await pool.query(
        `
        SELECT * FROM note_shares
        WHERE note_id = $1
        ORDER BY created_at DESC
      `,
        [id],
      );

      return result.rows.map((row) => ({
        id: row.id.toString(),
        noteId: row.note_id.toString(),
        shareToken: row.share_token,
        validUntil: row.valid_until,
        createdAt: row.created_at,
        accessedCount: row.accessed_count,
        lastAccessedAt: row.last_accessed_at,
      }));
    } catch (error) {
      Logger.error('Failed to get shares for note', error, { noteId });

      if (error instanceof AppError) {
        throw error;
      }

      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        throw new AppError(
          'Shares table not found. Please run database migrations.',
          500,
          AppError.CODES.DATABASE_ERROR,
        );
      }

      throw new AppError('Failed to get shares for note', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async revokeShare(req, shareId) {
    try {
      const context = this._getContext(req);
      const pool = context.pool;

      const shareCheck = await pool.query('SELECT note_id FROM note_shares WHERE id = $1', [
        shareId,
      ]);

      if (!shareCheck.rows.length) {
        throw new AppError('Share not found', 404, AppError.CODES.NOT_FOUND);
      }

      const noteId = shareCheck.rows[0].note_id;
      const note = await this.getById(req, noteId);

      if (!note) {
        throw new AppError('Share not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      const deleteResult = await pool.query('DELETE FROM note_shares WHERE id = $1 RETURNING *', [
        shareId,
      ]);

      if (!deleteResult.rows.length) {
        throw new AppError('Share not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('Note share revoked', { shareId, noteId });

      return {
        id: deleteResult.rows[0].id.toString(),
        noteId: deleteResult.rows[0].note_id.toString(),
        shareToken: deleteResult.rows[0].share_token,
      };
    } catch (error) {
      Logger.error('Failed to revoke note share', error, { shareId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to revoke share', 500, AppError.CODES.DATABASE_ERROR);
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
