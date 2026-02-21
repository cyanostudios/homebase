// plugins/booking/controller.js
// Public booking controller

const { Logger } = require('@homebase/core');

class BookingController {
  constructor(model) {
    this.model = model;
  }

  async getSlots(req, res) {
    try {
      const pool = req.bookingPool;
      if (!pool) {
        return res.status(500).json({ error: 'Booking service not configured' });
      }

      const slots = await this.model.getVisibleSlots(pool);
      res.json({ slots });
    } catch (error) {
      Logger.error('Get public slots failed', error);
      res.status(500).json({ error: 'Failed to fetch slots' });
    }
  }

  async bookSlot(req, res) {
    try {
      const pool = req.bookingPool;
      if (!pool) {
        return res.status(500).json({ error: 'Booking service not configured' });
      }

      const { id } = req.params;
      const { name, email, phone, message } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name is required' });
      }

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid slot ID' });
      }

      const slot = await this.model.getSlotById(pool, parseInt(id));
      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }

      const result = await this.model.createBooking(pool, parseInt(id), {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        message: message?.trim() || null,
      });

      if (result.error) {
        const statusCode = result.code === 'NOT_FOUND' ? 404 : 400;
        return res.status(statusCode).json({ error: result.error });
      }

      await this.model.createNotification(pool, slot, result.booking);

      res.json({
        success: true,
        message: 'Booking confirmed',
        booking: result.booking,
      });
    } catch (error) {
      Logger.error('Book slot failed', error);
      res.status(500).json({ error: 'Failed to create booking' });
    }
  }
}

module.exports = BookingController;
