// plugins/requests/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class RequestController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const requests = await this.model.getAll(req);
      res.json(requests);
    } catch (error) {
      Logger.error('Get requests failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch requests' });
    }
  }

  async getById(req, res) {
    try {
      const request = await this.model.getById(req, req.params.id);
      res.json(request);
    } catch (error) {
      Logger.error('Get request failed', error, {
        requestId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch request' });
    }
  }

  async create(req, res) {
    try {
      const request = await this.model.create(req, req.body);
      res.json(request);
    } catch (error) {
      Logger.error('Create request failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create request' });
    }
  }

  async update(req, res) {
    try {
      const request = await this.model.update(req, req.params.id, req.body);
      if (request._changeSummary) {
        req.activityLogMetadata = { changeSummary: request._changeSummary };
        delete request._changeSummary;
      }
      res.json(request);
    } catch (error) {
      Logger.error('Update request failed', error, {
        requestId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update request' });
    }
  }

  async delete(req, res) {
    try {
      const request = await this.model.getById(req, req.params.id);
      req.activityLogEntityName = request.title;
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Request deleted successfully' });
    } catch (error) {
      Logger.error('Delete request failed', error, {
        requestId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete request' });
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
      if (ids.length > 500) {
        return res
          .status(400)
          .json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }
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
      Logger.error('Bulk delete requests failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Bulk delete failed' });
    }
  }

  async publicGetTeams(req, res) {
    try {
      const pool = req.publicRequestsPool;
      if (!pool) {
        return res.status(503).json({ error: 'Public requests not configured' });
      }
      const teams = await this.model.getPublicTeams(pool);
      res.json(teams);
    } catch (error) {
      Logger.error('Public get teams failed', error);
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  }

  async publicSubmit(req, res) {
    try {
      const pool = req.publicRequestsPool;
      if (!pool) {
        return res.status(503).json({ error: 'Public requests not configured' });
      }
      const { title, description, request_type, team_id, submitter_name, submitter_email } =
        req.body;

      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const request = await this.model.createPublic(pool, {
        title,
        description,
        request_type,
        team_id,
        submitter_name,
        submitter_email,
      });

      res.json({ success: true, request });
    } catch (error) {
      Logger.error('Public submit request failed', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to submit request' });
    }
  }
}

module.exports = RequestController;
