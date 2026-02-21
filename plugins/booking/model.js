// plugins/booking/model.js
// Public booking model - uses pool directly (no auth context)

const { Logger } = require('@homebase/core');

class BookingModel {
  async getVisibleSlots(pool) {
    try {
      const result = await pool.query(`
        SELECT 
          s.*,
          COALESCE(sb.booked_count, 0)::int AS booked_count
        FROM slots s
        LEFT JOIN (
          SELECT slot_id, COUNT(*)::int AS booked_count
          FROM slot_bookings
          GROUP BY slot_id
        ) sb ON s.id = sb.slot_id
        WHERE s.visible = true 
          AND s.slot_time > NOW()
        ORDER BY s.slot_time ASC
      `);

      return result.rows.map(this.transformSlot);
    } catch (error) {
      Logger.error('Failed to fetch visible slots', error);
      throw error;
    }
  }

  async getSlotById(pool, slotId) {
    try {
      const result = await pool.query(
        `
        SELECT 
          s.*,
          COALESCE(sb.booked_count, 0)::int AS booked_count
        FROM slots s
        LEFT JOIN (
          SELECT slot_id, COUNT(*)::int AS booked_count
          FROM slot_bookings
          GROUP BY slot_id
        ) sb ON s.id = sb.slot_id
        WHERE s.id = $1 AND s.visible = true
      `,
        [slotId],
      );

      return result.rows.length > 0 ? this.transformSlot(result.rows[0]) : null;
    } catch (error) {
      Logger.error('Failed to fetch slot by ID', error, { slotId });
      throw error;
    }
  }

  async createBooking(pool, slotId, data) {
    try {
      const slot = await this.getSlotById(pool, slotId);

      if (!slot) {
        return { error: 'Slot not found', code: 'NOT_FOUND' };
      }

      const totalBooked = slot.booked_count + (slot.mentions?.length || 0);
      if (totalBooked >= slot.capacity) {
        return { error: 'Slot is fully booked', code: 'FULLY_BOOKED' };
      }

      const result = await pool.query(
        `
        INSERT INTO slot_bookings (slot_id, name, email, phone, message)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
        [slotId, data.name, data.email || null, data.phone || null, data.message || null],
      );

      const booking = result.rows[0];
      Logger.info('Public booking created', {
        bookingId: booking.id,
        slotId,
        name: data.name,
      });

      return {
        success: true,
        booking: {
          id: booking.id.toString(),
          slotId: booking.slot_id.toString(),
          name: booking.name,
          email: booking.email,
          phone: booking.phone,
          message: booking.message,
          createdAt: booking.created_at,
        },
      };
    } catch (error) {
      Logger.error('Failed to create booking', error, { slotId, data });
      throw error;
    }
  }

  async createNotification(pool, slot, booking) {
    try {
      const timeStr = new Date(slot.slot_time).toLocaleString('sv-SE');
      const title = `Ny bokning: ${booking.name}`;
      const body = `${booking.name} har bokat ${slot.location || 'slot'} kl ${timeStr}`;

      const result = await pool.query(
        `
        INSERT INTO notifications (type, title, body, reference_id, reference_type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
        ['slot_booking', title, body, parseInt(booking.slotId), 'slot'],
      );

      Logger.info('Notification created for booking', {
        notificationId: result.rows[0].id,
        bookingId: booking.id,
      });

      return result.rows[0];
    } catch (error) {
      Logger.error('Failed to create notification', error);
    }
  }

  transformSlot(row) {
    let mentions = row.mentions;
    if (typeof mentions === 'string') {
      try {
        mentions = JSON.parse(mentions);
      } catch {
        mentions = [];
      }
    }
    if (!Array.isArray(mentions)) {
      mentions = [];
    }

    return {
      id: row.id.toString(),
      location: row.location,
      slot_time: row.slot_time,
      capacity: row.capacity,
      booked_count: row.booked_count || 0,
      mentions_count: mentions.length,
      available: row.capacity - (row.booked_count || 0) - mentions.length,
    };
  }
}

module.exports = BookingModel;
