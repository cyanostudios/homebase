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
      await this.model.delete(req, req.params.id);
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
}

module.exports = NoteController;
