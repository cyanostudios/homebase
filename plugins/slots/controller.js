// plugins/slots/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class SlotsController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const slots = await this.model.getAll(req);
      res.json(slots);
    } catch (error) {
      Logger.error('Get slots failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch slots' });
    }
  }

  async create(req, res) {
    try {
      const slot = await this.model.create(req, req.body);
      res.json(slot);
    } catch (error) {
      Logger.error('Create slot failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create slot' });
    }
  }

  async batchCreate(req, res) {
    try {
      const slots = req.body?.slots;
      if (!Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({
          error: 'slots array is required and must not be empty',
          code: 'VALIDATION_ERROR',
        });
      }
      if (slots.length > 50) {
        return res.status(400).json({
          error: 'Too many slots (max 50 per request)',
          code: 'VALIDATION_ERROR',
        });
      }
      const created = await this.model.batchCreate(req, slots);
      res.json(created);
    } catch (error) {
      Logger.error('Batch create slots failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to batch create slots' });
    }
  }

  async update(req, res) {
    try {
      const slot = await this.model.update(req, req.params.id, req.body);
      res.json(slot);
    } catch (error) {
      Logger.error('Update slot failed', error, {
        slotId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res
        .status(500)
        .json({ error: 'Failed to update slot', message: error.message || 'Unknown error' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Slot deleted successfully' });
    } catch (error) {
      Logger.error('Delete slot failed', error, {
        slotId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete slot' });
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
      Logger.error('Bulk delete slots failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Bulk delete failed' });
    }
  }

  async getBookings(req, res) {
    try {
      const bookings = await this.model.getBookings(req, req.params.id);
      res.json(bookings);
    } catch (error) {
      Logger.error('Get slot bookings failed', error, {
        slotId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch bookings' });
    }
  }

  async deleteBooking(req, res) {
    try {
      await this.model.deleteBooking(req, req.params.bookingId);
      res.json({ message: 'Booking deleted successfully' });
    } catch (error) {
      Logger.error('Delete booking failed', error, {
        bookingId: req.params.bookingId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete booking' });
    }
  }
}

module.exports = SlotsController;
