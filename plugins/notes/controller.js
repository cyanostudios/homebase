// plugins/notes/controller.js
// Notes controller - handles HTTP requests for notes CRUD operations (V2)
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class NoteController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const notes = await this.model.getAll(req);
      res.json(notes);
    } catch (error) {
      Logger.error('Get notes failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to fetch notes' });
    }
  }

  async create(req, res) {
    try {
      const note = await this.model.create(req, req.body);
      res.json(note);
    } catch (error) {
      Logger.error('Create note failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to create note' });
    }
  }

  async update(req, res) {
    try {
      const note = await this.model.update(req, req.params.id, req.body);
      res.json(note);
    } catch (error) {
      Logger.error('Update note failed', error, {
        noteId: req.params.id,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to update note' });
    }
  }

  async delete(req, res) {
    try {
      const result = await this.model.delete(req, req.params.id);

      // Attach metadata for activity log middleware
      req.activityLogEntityName = result.backup?.title || 'Unknown Note';
      req.activityLogMetadata = {
        backup: result.backup,
      };

      res.json({ message: 'Note deleted successfully' });
    } catch (error) {
      Logger.error('Delete note failed', error, {
        noteId: req.params.id,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to delete note' });
    }
  }

  // DELETE /api/notes/batch
  // body: { ids: string[] }
  async bulkDelete(req, res) {
    try {
      // Debug logging
      Logger.info('Bulk delete request received', {
        body: req.body,
        bodyType: typeof req.body,
        bodyKeys: req.body ? Object.keys(req.body) : 'null/undefined',
        idsRaw: req.body?.ids,
        idsType: typeof req.body?.ids,
        isArray: Array.isArray(req.body?.ids),
      });

      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        Logger.warn('Bulk delete validation failed - not an array', {
          idsRaw,
          idsType: typeof idsRaw,
        });
        return res
          .status(400)
          .json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const ids = Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)));

      if (!ids.length) {
        return res.json({ ok: true, requested: 0, deleted: 0 });
      }

      if (ids.length > 500) {
        return res
          .status(400)
          .json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }

      // Use model's bulkDelete which handles task cleanup and uses BulkOperationsHelper
      const result = await this.model.bulkDelete(req, ids);

      const deleted =
        typeof result?.deletedCount === 'number'
          ? result.deletedCount
          : Array.isArray(result?.deletedIds)
            ? result.deletedIds.length
            : 0;

      // Attach metadata for activity log middleware
      req.activityLogEntityName = `${deleted} notes`;
      req.activityLogMetadata = {
        count: deleted,
        ids: result.deletedIds || ids,
        backups: result.backups || [], // Multiple backups for bulk delete
      };

      return res.json({
        ok: true,
        requested: ids.length,
        deleted,
        deletedIds: result?.deletedIds || [],
      });
    } catch (error) {
      Logger.error('Bulk delete error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({ error: 'Bulk delete failed' });
    }
  }

  async createShare(req, res) {
    try {
      const { noteId, validUntil } = req.body;

      if (!noteId || !validUntil) {
        return res.status(400).json({
          error: 'Note ID and valid until date are required',
        });
      }

      const validUntilDate = new Date(validUntil);
      if (validUntilDate <= new Date()) {
        return res.status(400).json({
          error: 'Valid until date must be in the future',
        });
      }

      const share = await this.model.createShare(req, noteId, validUntilDate);
      res.json(share);
    } catch (error) {
      Logger.error('Create note share failed', error, {
        noteId: req.body.noteId,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to create share link' });
    }
  }

  async getPublicNote(req, res) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ error: 'Share token is required' });
      }

      const note = await this.model.getNoteByShareToken(req, token);

      if (!note) {
        return res.status(404).json({
          error: 'Note not found or share link has expired',
        });
      }

      res.json(note);
    } catch (error) {
      Logger.error('Get public note failed', error, {
        token: req.params.token?.substring(0, 10),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to load note' });
    }
  }

  async getShares(req, res) {
    try {
      const { id } = req.params;
      const shares = await this.model.getSharesForNote(req, id);
      res.json(shares);
    } catch (error) {
      Logger.error('Get note shares failed', error, {
        noteId: req.params.id,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to get shares' });
    }
  }

  async revokeShare(req, res) {
    try {
      const { shareId } = req.params;
      const revokedShare = await this.model.revokeShare(req, shareId);
      res.json({ message: 'Share revoked successfully', share: revokedShare });
    } catch (error) {
      Logger.error('Revoke note share failed', error, {
        shareId: req.params.shareId,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to revoke share' });
    }
  }
}

module.exports = NoteController;
