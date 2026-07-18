const { Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class PublicGuidesController {
  constructor(model) {
    this.model = model;
  }

  getPoolContext(req) {
    const pool = req.publicGuidesPool;
    const ownerUserId = req.publicGuidesOwnerUserId;
    if (!pool || !ownerUserId) {
      return null;
    }
    return { pool, ownerUserId };
  }

  async listGuides(req, res) {
    try {
      const ctx = this.getPoolContext(req);
      if (!ctx) {
        return res.status(500).json({ error: 'Public guides service not configured' });
      }

      const language = this.model.parseOptionalLanguageQuery(req.query.language);
      const guides = await this.model.listPlaces(ctx.pool, ctx.ownerUserId, language);
      return res.json({ guides });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('List public guides failed', error);
      return res.status(500).json({ error: 'Failed to fetch guides' });
    }
  }

  async getGuide(req, res) {
    try {
      const ctx = this.getPoolContext(req);
      if (!ctx) {
        return res.status(500).json({ error: 'Public guides service not configured' });
      }

      const placeId = this.model.parsePositiveInt(req.params.placeId, 'placeId');
      const guide = await this.model.getPlaceById(ctx.pool, ctx.ownerUserId, placeId);
      if (!guide) {
        return res.status(404).json({ error: 'Guide not found' });
      }
      return res.json(guide);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('Get public guide failed', error, { placeId: req.params.placeId });
      return res.status(500).json({ error: 'Failed to fetch guide' });
    }
  }

  async getPresentations(req, res) {
    try {
      const ctx = this.getPoolContext(req);
      if (!ctx) {
        return res.status(500).json({ error: 'Public guides service not configured' });
      }

      const placeId = this.model.parsePositiveInt(req.params.placeId, 'placeId');
      const language = this.model.parseOptionalLanguageQuery(req.query.language);
      const presentations = await this.model.listPresentations(
        ctx.pool,
        ctx.ownerUserId,
        placeId,
        language,
      );
      if (!presentations) {
        return res.status(404).json({ error: 'Guide not found' });
      }
      return res.json({ presentations });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('Get public guide presentations failed', error, {
        placeId: req.params.placeId,
      });
      return res.status(500).json({ error: 'Failed to fetch presentations' });
    }
  }
}

module.exports = PublicGuidesController;
