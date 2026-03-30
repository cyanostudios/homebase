const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const { importFromIngest } = require('./services/importFromIngest');

class CupsController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const rows = await this.model.getAll(req);
      res.json(rows);
    } catch (error) {
      Logger.error('Get cups failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch cups' });
    }
  }

  async getById(req, res) {
    try {
      const cup = await this.model.getById(req, req.params.id);
      if (!cup) {
        return res.status(404).json({ error: 'Cup not found', code: 'NOT_FOUND' });
      }
      res.json(cup);
    } catch (error) {
      Logger.error('Get cup failed', error, { id: req.params.id, userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch cup' });
    }
  }

  async create(req, res) {
    try {
      const cup = await this.model.create(req, req.body || {});
      res.json(cup);
    } catch (error) {
      Logger.error('Create cup failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create cup' });
    }
  }

  async update(req, res) {
    try {
      const cup = await this.model.update(req, req.params.id, req.body || {});
      res.json(cup);
    } catch (error) {
      Logger.error('Update cup failed', error, {
        id: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update cup' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Cup deleted successfully' });
    } catch (error) {
      Logger.error('Delete cup failed', error, {
        id: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete cup' });
    }
  }

  async bulkDelete(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res
          .status(400)
          .json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }
      const ids = Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)));
      if (!ids.length) return res.json({ ok: true, requested: 0, deleted: 0 });
      const result = await this.model.bulkDelete(req, ids);
      const deleted =
        typeof result?.deletedCount === 'number'
          ? result.deletedCount
          : (result?.deletedIds?.length ?? 0);
      return res.json({
        ok: true,
        requested: ids.length,
        deleted,
        deletedIds: result?.deletedIds || [],
      });
    } catch (error) {
      Logger.error('Bulk delete cups failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Bulk delete failed' });
    }
  }

  async importFromIngest(req, res) {
    try {
      const summary = await importFromIngest({
        model: this.model,
        req,
        sourceId: req.params.sourceId,
      });
      res.json(summary);
    } catch (error) {
      Logger.error('Import cups from ingest failed', error, {
        sourceId: req.params.sourceId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to import cups from ingest' });
    }
  }
}

module.exports = CupsController;
