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

  async getStops(req, res) {
    try {
      const ctx = this.getPoolContext(req);
      if (!ctx) {
        return res.status(500).json({ error: 'Public guides service not configured' });
      }

      const placeId = this.model.parsePositiveInt(req.params.placeId, 'placeId');
      const language = this.model.parseOptionalLanguageQuery(req.query.language);
      const stops = await this.model.listStopsWithVariants(
        ctx.pool,
        ctx.ownerUserId,
        placeId,
        language,
      );
      if (!stops) {
        return res.status(404).json({ error: 'Guide not found' });
      }
      return res.json({ stops });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('Get public guide stops failed', error, { placeId: req.params.placeId });
      return res.status(500).json({ error: 'Failed to fetch stops' });
    }
  }

  async streamAudio(req, res) {
    try {
      const ctx = this.getPoolContext(req);
      if (!ctx) {
        return res.status(500).json({ error: 'Public guides service not configured' });
      }

      const placeId = this.model.parsePositiveInt(req.params.placeId, 'placeId');
      const stopId = this.model.parsePositiveInt(req.params.stopId, 'stopId');
      const variantId = this.model.parsePositiveInt(req.params.variantId, 'variantId');

      const audio = await this.model.getReadyAudioForPublicVariant(
        ctx.pool,
        ctx.ownerUserId,
        placeId,
        stopId,
        variantId,
      );
      if (!audio) {
        return res.status(404).json({ error: 'Audio not found' });
      }

      const { stream, mimeType } = await this.model.openAudioStream(req, audio);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      stream.on('error', (err) => {
        Logger.error('Public guide audio stream error', err, {
          placeId,
          stopId,
          variantId,
        });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Audio stream failed' });
        } else {
          res.destroy();
        }
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('Stream public guide audio failed', error, {
        placeId: req.params.placeId,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
      });
      return res.status(500).json({ error: 'Failed to stream audio' });
    }
  }
}

module.exports = PublicGuidesController;
