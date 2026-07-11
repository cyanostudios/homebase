// plugins/guides/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class GuidesController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const places = await this.model.getAll(req);
      res.json(places);
    } catch (error) {
      Logger.error('Get guides places failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch places' });
    }
  }

  async getById(req, res) {
    try {
      const place = await this.model.getById(req, req.params.id);
      res.json(place);
    } catch (error) {
      Logger.error('Get guide place failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch place' });
    }
  }

  async create(req, res) {
    try {
      const place = await this.model.create(req, req.body);
      res.json(place);
    } catch (error) {
      Logger.error('Create guide place failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create place' });
    }
  }

  async update(req, res) {
    try {
      const place = await this.model.update(req, req.params.id, req.body);
      res.json(place);
    } catch (error) {
      Logger.error('Update guide place failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update place' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ deleted: true });
    } catch (error) {
      Logger.error('Delete guide place failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete place' });
    }
  }

  async getStops(req, res) {
    try {
      const stops = await this.model.getStops(req, req.params.id);
      res.json(stops);
    } catch (error) {
      Logger.error('Get guide stops failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch stops' });
    }
  }

  async getStopById(req, res) {
    try {
      const stop = await this.model.getStopById(req, req.params.id, req.params.stopId);
      res.json(stop);
    } catch (error) {
      Logger.error('Get guide stop failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch stop' });
    }
  }

  async createStop(req, res) {
    try {
      const stop = await this.model.createStop(req, req.params.id, req.body);
      res.json(stop);
    } catch (error) {
      Logger.error('Create guide stop failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create stop' });
    }
  }

  async updateStop(req, res) {
    try {
      const stop = await this.model.updateStop(req, req.params.id, req.params.stopId, req.body);
      res.json(stop);
    } catch (error) {
      Logger.error('Update guide stop failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update stop' });
    }
  }

  async deleteStop(req, res) {
    try {
      await this.model.deleteStop(req, req.params.id, req.params.stopId);
      res.json({ deleted: true });
    } catch (error) {
      Logger.error('Delete guide stop failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete stop' });
    }
  }

  async reorderStops(req, res) {
    try {
      const stops = await this.model.reorderStops(req, req.params.id, req.body.stopIds);
      res.json(stops);
    } catch (error) {
      Logger.error('Reorder guide stops failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to reorder stops' });
    }
  }

  async getVariants(req, res) {
    try {
      const variants = await this.model.getVariants(req, req.params.id, req.params.stopId);
      res.json(variants);
    } catch (error) {
      Logger.error('Get guide variants failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch variants' });
    }
  }

  async getVariantById(req, res) {
    try {
      const variant = await this.model.getVariantById(
        req,
        req.params.id,
        req.params.stopId,
        req.params.variantId,
      );
      res.json(variant);
    } catch (error) {
      Logger.error('Get guide variant failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch variant' });
    }
  }

  async createVariant(req, res) {
    try {
      const variant = await this.model.createVariant(
        req,
        req.params.id,
        req.params.stopId,
        req.body,
      );
      res.json(variant);
    } catch (error) {
      Logger.error('Create guide variant failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create variant' });
    }
  }

  async updateVariant(req, res) {
    try {
      const variant = await this.model.updateVariant(
        req,
        req.params.id,
        req.params.stopId,
        req.params.variantId,
        req.body,
      );
      res.json(variant);
    } catch (error) {
      Logger.error('Update guide variant failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update variant' });
    }
  }

  async deleteVariant(req, res) {
    try {
      await this.model.deleteVariant(req, req.params.id, req.params.stopId, req.params.variantId);
      res.json({ deleted: true });
    } catch (error) {
      Logger.error('Delete guide variant failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete variant' });
    }
  }
}

module.exports = GuidesController;
