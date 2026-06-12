// plugins/teams/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class TeamController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const teams = await this.model.getAll(req);
      res.json(teams);
    } catch (error) {
      Logger.error('Get teams failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  }

  async getById(req, res) {
    try {
      const team = await this.model.getById(req, req.params.id);
      res.json(team);
    } catch (error) {
      Logger.error('Get team failed', error, {
        teamId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch team' });
    }
  }

  async create(req, res) {
    try {
      const team = await this.model.create(req, req.body);
      res.json(team);
    } catch (error) {
      Logger.error('Create team failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create team' });
    }
  }

  async update(req, res) {
    try {
      const team = await this.model.update(req, req.params.id, req.body);
      if (team._changeSummary) {
        req.activityLogMetadata = { changeSummary: team._changeSummary };
        delete team._changeSummary;
      }
      res.json(team);
    } catch (error) {
      Logger.error('Update team failed', error, {
        teamId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update team' });
    }
  }

  async delete(req, res) {
    try {
      const team = await this.model.getById(req, req.params.id);
      req.activityLogEntityName = team.name;
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Team deleted successfully' });
    } catch (error) {
      Logger.error('Delete team failed', error, {
        teamId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete team' });
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
      Logger.error('Bulk delete teams failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Bulk delete failed' });
    }
  }
}

module.exports = TeamController;
