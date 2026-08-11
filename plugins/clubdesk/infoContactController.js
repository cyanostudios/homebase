// plugins/clubdesk/infoContactController.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class InfoContactController {
  constructor(model) {
    this.model = model;
  }

  sendAppError(res, error) {
    if (
      (error.code === AppError.CODES.VALIDATION_ERROR || error.code === AppError.CODES.CONFLICT) &&
      Array.isArray(error.details) &&
      error.details.length > 0 &&
      error.details[0]?.field
    ) {
      const errors = error.details.map((d) => ({
        field: d.field,
        message: d.message || error.message,
      }));
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        errors,
        details: errors.map((e) => ({
          path: e.field,
          msg: e.message,
          field: e.field,
          message: e.message,
        })),
      });
    }
    return res.status(error.statusCode).json(error.toJSON());
  }

  async getAll(req, res) {
    try {
      const items = await this.model.getAll(req);
      res.json(items);
    } catch (error) {
      Logger.error('Get clubdesk Info contacts failed', error, {
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to fetch Info contacts' });
    }
  }

  async getById(req, res) {
    try {
      const item = await this.model.getById(req, req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Info contact not found', code: 'NOT_FOUND' });
      }
      res.json(item);
    } catch (error) {
      Logger.error('Get clubdesk Info contact failed', error, {
        id: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to fetch Info contact' });
    }
  }

  async create(req, res) {
    try {
      const item = await this.model.create(req, req.body || {});
      res.status(201).json(item);
    } catch (error) {
      Logger.error('Create clubdesk Info contact failed', error, {
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to create Info contact' });
    }
  }

  async update(req, res) {
    try {
      const item = await this.model.update(req, req.params.id, req.body || {});
      res.json(item);
    } catch (error) {
      Logger.error('Update clubdesk Info contact failed', error, {
        id: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to update Info contact' });
    }
  }

  async remove(req, res) {
    try {
      const result = await this.model.remove(req, req.params.id);
      res.json(result);
    } catch (error) {
      Logger.error('Delete clubdesk Info contact failed', error, {
        id: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to delete Info contact' });
    }
  }

  async reorder(req, res) {
    try {
      const items = await this.model.reorder(req, req.body?.orderedIds);
      res.json(items);
    } catch (error) {
      Logger.error('Reorder clubdesk Info contacts failed', error, {
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to reorder Info contacts' });
    }
  }
}

module.exports = InfoContactController;
