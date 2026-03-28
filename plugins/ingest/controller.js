// plugins/ingest/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const ingestService = require('./services/ingestService');

class IngestController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const items = await this.model.getAllSources(req);
      res.json(items);
    } catch (error) {
      Logger.error('Get ingest sources failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch sources' });
    }
  }

  async getById(req, res) {
    try {
      const item = await this.model.getSourceById(req, req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Source not found', code: 'NOT_FOUND' });
      }
      res.json(item);
    } catch (error) {
      Logger.error('Get ingest source failed', error, { id: req.params.id });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch source' });
    }
  }

  async create(req, res) {
    try {
      const body = req.body || {};
      const payload = {
        name: body.name,
        sourceUrl: body.sourceUrl,
        sourceType: body.sourceType || 'other',
        fetchMethod: body.fetchMethod || 'generic_http',
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        notes: body.notes ?? null,
      };
      const created = await this.model.createSource(req, payload);
      req.activityLogEntityName = created.name || 'Ingest source';
      res.json(created);
    } catch (error) {
      Logger.error('Create ingest source failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to create source' });
    }
  }

  async update(req, res) {
    try {
      const body = req.body || {};
      const payload = {
        name: body.name,
        sourceUrl: body.sourceUrl,
        sourceType: body.sourceType || 'other',
        fetchMethod: body.fetchMethod || 'generic_http',
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        notes: body.notes ?? null,
      };
      const updated = await this.model.updateSource(req, req.params.id, payload);
      req.activityLogEntityName = updated.name || 'Ingest source';
      res.json(updated);
    } catch (error) {
      Logger.error('Update ingest source failed', error, { id: req.params.id });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to update source' });
    }
  }

  async delete(req, res) {
    try {
      const existing = await this.model.getSourceById(req, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Source not found', code: 'NOT_FOUND' });
      }
      req.activityLogEntityName = existing.name || 'Ingest source';
      await this.model.deleteSource(req, req.params.id);
      res.json({ message: 'Source deleted successfully' });
    } catch (error) {
      Logger.error('Delete ingest source failed', error, { id: req.params.id });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to delete source' });
    }
  }

  async getRuns(req, res) {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const runs = await this.model.getRunsForSource(req, req.params.id, limit);
      res.json(runs);
    } catch (error) {
      Logger.error('Get ingest runs failed', error, { sourceId: req.params.id });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch runs' });
    }
  }

  async runImport(req, res, next) {
    try {
      const { run, source } = await ingestService.runSourceById(this.model, req, req.params.id);
      res.json({ run, source });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('Run ingest import failed', error, { sourceId: req.params.id });
      next(error);
    }
  }
}

module.exports = IngestController;
