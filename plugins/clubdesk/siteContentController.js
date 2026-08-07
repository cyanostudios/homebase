// plugins/clubdesk/siteContentController.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class SiteContentController {
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
      const cards = await this.model.getAll(req);
      res.json(cards);
    } catch (error) {
      Logger.error('Get clubdesk site content failed', error, {
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to fetch site content' });
    }
  }

  async putBatch(req, res) {
    try {
      const cards = await this.model.upsertMany(req, req.body?.cards);
      res.json(cards);
    } catch (error) {
      Logger.error('Update clubdesk site content failed', error, {
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to update site content' });
    }
  }

  async putOne(req, res) {
    try {
      const card = await this.model.upsert(req, req.params.cardKey, {
        content: req.body?.content,
        meta: req.body?.meta,
      });
      res.json(card);
    } catch (error) {
      Logger.error('Update clubdesk site content card failed', error, {
        userId: Context.getUserId(req),
        cardKey: req.params.cardKey,
      });
      if (error instanceof AppError) {
        return this.sendAppError(res, error);
      }
      res.status(500).json({ error: 'Failed to update site content card' });
    }
  }
}

module.exports = SiteContentController;
