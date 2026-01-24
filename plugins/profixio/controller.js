// plugins/profixio/controller.js
const { Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class ProfixioController {
  constructor(model) {
    this.model = model;
  }

  async getMatches(req, res, next) {
    try {
      const filters = {
        seasonId: req.query.seasonId ? parseInt(req.query.seasonId) : null,
        tournamentId: req.query.tournamentId ? parseInt(req.query.tournamentId) : null,
        teamFilter: req.query.teamFilter || null,
        fromDate: req.query.fromDate || null,
        toDate: req.query.toDate || null,
        page: req.query.page ? parseInt(req.query.page) : 1,
        limit: req.query.limit ? parseInt(req.query.limit) : 50,
      };

      const result = await this.model.getMatches(req, filters);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMatch(req, res, next) {
    try {
      const { tournamentId, matchId } = req.params;
      const match = await this.model.getMatchById(req, parseInt(tournamentId), parseInt(matchId));
      res.json(match);
    } catch (error) {
      next(error);
    }
  }

  async getSeasons(req, res, next) {
    try {
      const { organisationId, sportId } = req.query;

      if (!organisationId) {
        return res.status(400).json({ error: 'organisationId is required' });
      }

      const seasons = await this.model.getSeasons(req, organisationId, sportId || null);
      res.json({ data: seasons });
    } catch (error) {
      next(error);
    }
  }

  async getTournaments(req, res, next) {
    try {
      const { seasonId, categoryId, sportId } = req.query;

      if (!seasonId) {
        return res.status(400).json({ error: 'seasonId is required' });
      }

      const tournaments = await this.model.getTournaments(
        req,
        parseInt(seasonId),
        categoryId ? parseInt(categoryId) : null,
        sportId || null,
      );
      res.json({ data: tournaments });
    } catch (error) {
      next(error);
    }
  }

  async getSettings(req, res, next) {
    try {
      const settings = await this.model.getSettings(req);
      res.json({ settings });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Settings object is required' });
      }

      const updated = await this.model.updateSettings(req, settings);
      res.json({ settings: updated });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProfixioController(require('./model'));
