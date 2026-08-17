// plugins/teams/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const { getExternalOptions } = require('./services/externalTeamOptionsService');

class TeamController {
  constructor(model) {
    this.model = model;
  }

  async getExternalOptions(req, res) {
    try {
      const options = await getExternalOptions(req);
      res.json(options);
    } catch (error) {
      Logger.error('Get team external options failed', error, {
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch external team options' });
    }
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

  sendVenueAppError(res, error) {
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
        details: errors,
      });
    }
    return res.status(error.statusCode).json(error.toJSON());
  }

  async listVenues(req, res) {
    try {
      const venues = await this.model.listVenues(req);
      res.json(venues);
    } catch (error) {
      Logger.error('List team venues failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return this.sendVenueAppError(res, error);
      res.status(500).json({ error: 'Failed to list venues' });
    }
  }

  async createVenue(req, res) {
    try {
      const venue = await this.model.createVenue(req, req.body);
      res.json(venue);
    } catch (error) {
      Logger.error('Create team venue failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return this.sendVenueAppError(res, error);
      res.status(500).json({ error: 'Failed to create venue' });
    }
  }

  async updateVenue(req, res) {
    try {
      const venue = await this.model.updateVenue(req, req.params.id, req.body);
      res.json(venue);
    } catch (error) {
      Logger.error('Update team venue failed', error, {
        venueId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return this.sendVenueAppError(res, error);
      res.status(500).json({ error: 'Failed to update venue' });
    }
  }

  async deleteVenue(req, res) {
    try {
      await this.model.deleteVenue(req, req.params.id);
      res.json({ message: 'Venue deleted successfully' });
    } catch (error) {
      Logger.error('Delete team venue failed', error, {
        venueId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return this.sendVenueAppError(res, error);
      res.status(500).json({ error: 'Failed to delete venue' });
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
