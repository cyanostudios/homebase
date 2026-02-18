// plugins/kiosk/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class KioskController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const slots = await this.model.getAll(req);
      res.json(slots);
    } catch (error) {
      Logger.error('Get kiosk slots failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch kiosk slots' });
    }
  }

  async create(req, res) {
    try {
      const slot = await this.model.create(req, req.body);
      res.json(slot);
    } catch (error) {
      Logger.error('Create kiosk slot failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create kiosk slot' });
    }
  }

  async update(req, res) {
    try {
      const slot = await this.model.update(req, req.params.id, req.body);
      res.json(slot);
    } catch (error) {
      Logger.error('Update kiosk slot failed', error, {
        slotId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res
        .status(500)
        .json({ error: 'Failed to update kiosk slot', message: error.message || 'Unknown error' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Kiosk slot deleted successfully' });
    } catch (error) {
      Logger.error('Delete kiosk slot failed', error, {
        slotId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete kiosk slot' });
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
      Logger.error('Bulk delete kiosk slots failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Bulk delete failed' });
    }
  }
}

module.exports = KioskController;
