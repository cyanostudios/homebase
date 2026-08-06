const { Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class PublicInstructionsController {
  constructor(model) {
    this.model = model;
  }

  getPoolContext(req) {
    const pool = req.publicInstructionsPool;
    const ownerUserId = req.publicInstructionsOwnerUserId;
    if (!pool || !ownerUserId) {
      return null;
    }
    return { pool, ownerUserId };
  }

  async listInstructions(req, res) {
    try {
      const ctx = this.getPoolContext(req);
      if (!ctx) {
        return res.status(500).json({ error: 'Public instructions service not configured' });
      }

      const [instructions, categoryOrder] = await Promise.all([
        this.model.listPublished(ctx.pool, ctx.ownerUserId),
        this.model.listCategoryOrder(ctx.pool, ctx.ownerUserId),
      ]);
      return res.json({ instructions, categoryOrder });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('List public instructions failed', error);
      return res.status(500).json({ error: 'Failed to fetch instructions' });
    }
  }

  async getInstruction(req, res) {
    try {
      const ctx = this.getPoolContext(req);
      if (!ctx) {
        return res.status(500).json({ error: 'Public instructions service not configured' });
      }

      const item = await this.model.getPublishedBySlugOrId(
        ctx.pool,
        ctx.ownerUserId,
        req.params.slugOrId,
      );
      if (!item) {
        return res.status(404).json({ error: 'Instruction not found' });
      }
      return res.json(item);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      Logger.error('Get public instruction failed', error, {
        slugOrId: req.params.slugOrId,
      });
      return res.status(500).json({ error: 'Failed to fetch instruction' });
    }
  }
}

module.exports = PublicInstructionsController;
