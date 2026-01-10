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
}

module.exports = NoteController;
