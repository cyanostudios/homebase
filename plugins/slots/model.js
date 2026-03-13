// plugins/slots/model.js
// V3 with @homebase/core SDK
const { Logger, Database, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const CAPACITY_MIN = 1;
const CAPACITY_MAX = 5;

function validateCapacity(capacity) {
  const n = capacity != null ? parseInt(capacity, 10) : null;
  if (n === null || Number.isNaN(n) || n < CAPACITY_MIN || n > CAPACITY_MAX) {
    throw new AppError(
      `Invalid capacity. Must be between ${CAPACITY_MIN} and ${CAPACITY_MAX}.`,
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  return n;
}

class SlotsModel {
  async getAll(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `SELECT s.*, COALESCE(sb.booked_count, 0)::int AS booked_count
         FROM slots s
         LEFT JOIN (
           SELECT slot_id, COUNT(*)::int AS booked_count
           FROM slot_bookings
           GROUP BY slot_id
         ) sb ON s.id = sb.slot_id
         ORDER BY s.slot_time DESC, s.created_at DESC`,
        [],
      );
      return rows.map(this.transformRow);
    } catch (error) {
      Logger.error('Failed to fetch slots', error);
      throw new AppError('Failed to fetch slots', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, slotData) {
    try {
      const db = Database.get(req);
      const {
        location,
        slot_time,
        capacity,
        visible,
        notifications_enabled,
        contact_id,
        mentions,
        match_id,
      } = slotData;
      const cap = validateCapacity(capacity);

      const result = await db.insert('slots', {
        location: (location || '').trim() || null,
        slot_time: slot_time || null,
        capacity: cap,
        visible: visible !== false && visible !== 'false',
        notifications_enabled: notifications_enabled !== false && notifications_enabled !== 'false',
        contact_id: contact_id || null,
        mentions: JSON.stringify(Array.isArray(mentions) ? mentions : []),
        match_id: match_id != null && match_id !== '' ? parseInt(match_id, 10) : null,
      });

      Logger.info('Slot created', { slotId: result.id });
      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to create slot', error, {
        slotData: { location: slotData?.location },
      });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create slot', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Build a human-readable list of changed fields for activity log.
   * Compares raw slotData from the request body against the existing DB row.
   * Only fields explicitly present in slotData are evaluated.
   * @param {Object} existing - existing raw DB row
   * @param {Object} slotData - raw request body from the client
   * @returns {string|null} e.g. "Capacity, Location" or null if nothing changed
   */
  static getChangeSummary(existing, slotData) {
    const labels = {
      location: 'Location',
      slot_time: 'Time',
      capacity: 'Capacity',
      visible: 'Visible',
      notifications_enabled: 'Notifications',
      contact_id: 'Contact',
      mentions: 'Contacts assigned',
    };
    const changed = [];

    if ('location' in slotData) {
      const next = (slotData.location || '').trim() || null;
      const prev = existing.location || null;
      if (next !== prev) changed.push(labels.location);
    }
    if ('slot_time' in slotData) {
      if (String(slotData.slot_time || '') !== String(existing.slot_time || '')) {
        changed.push(labels.slot_time);
      }
    }
    if ('capacity' in slotData && slotData.capacity != null) {
      if (Number(slotData.capacity) !== Number(existing.capacity)) {
        changed.push(labels.capacity);
      }
    }
    if ('visible' in slotData) {
      const next = slotData.visible !== false && slotData.visible !== 'false';
      if (next !== Boolean(existing.visible)) changed.push(labels.visible);
    }
    if ('notifications_enabled' in slotData) {
      const next =
        slotData.notifications_enabled !== false && slotData.notifications_enabled !== 'false';
      if (next !== Boolean(existing.notifications_enabled))
        changed.push(labels.notifications_enabled);
    }
    if ('contact_id' in slotData) {
      // Normalise both sides to integer or null for a type-safe comparison
      const next =
        slotData.contact_id != null && slotData.contact_id !== ''
          ? parseInt(String(slotData.contact_id), 10)
          : null;
      const prev = existing.contact_id != null ? parseInt(String(existing.contact_id), 10) : null;
      if (next !== prev) changed.push(labels.contact_id);
    }
    if ('mentions' in slotData) {
      // Normalise both sides to a sorted array of contactId strings for comparison
      const toIds = (val) => {
        let arr = val;
        if (typeof val === 'string') {
          try {
            arr = JSON.parse(val);
          } catch {
            arr = [];
          }
        }
        if (!Array.isArray(arr)) return '[]';
        return JSON.stringify(arr.map((m) => String(m?.contactId ?? m?.contact_id ?? m)).sort());
      };
      if (toIds(slotData.mentions) !== toIds(existing.mentions)) {
        changed.push(labels.mentions);
      }
    }

    return changed.length === 0 ? null : changed.join(', ');
  }

  async update(req, slotId, slotData) {
    try {
      const db = Database.get(req);
      const userId = req.session?.currentTenantUserId || req.session?.user?.id;
      if (!userId) {
        throw new AppError('User context required for update', 401, AppError.CODES.UNAUTHORIZED);
      }

      const existing = await db.query('SELECT * FROM slots WHERE id = $1', [slotId]);
      if (!existing || existing.length === 0) {
        throw new AppError('Slot not found', 404, AppError.CODES.NOT_FOUND);
      }

      const {
        location,
        slot_time,
        capacity,
        visible,
        notifications_enabled,
        contact_id,
        mentions,
      } = slotData;
      const cap = capacity != null ? validateCapacity(capacity) : existing[0].capacity;

      const updates = {
        location: (location || '').trim() || null,
        slot_time: slot_time || null,
        capacity: cap,
        visible: visible !== false && visible !== 'false',
        notifications_enabled: notifications_enabled !== false && notifications_enabled !== 'false',
        contact_id: contact_id ?? existing[0].contact_id ?? null,
        mentions:
          mentions !== undefined
            ? JSON.stringify(Array.isArray(mentions) ? mentions : [])
            : existing[0].mentions,
      };

      const result = await db.update('slots', slotId, updates);

      const changeSummary = SlotsModel.getChangeSummary(existing[0], slotData);
      const slot = this.transformRow(result);
      if (changeSummary) {
        slot._changeSummary = changeSummary;
      }
      Logger.info('Slot updated', { slotId });
      return slot;
    } catch (error) {
      Logger.error('Failed to update slot', error, { slotId });
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to update slot: ${error.message || 'Unknown error'}`,
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async delete(req, slotId) {
    try {
      const db = Database.get(req);
      await db.deleteRecord('slots', slotId);
      Logger.info('Slot deleted', { slotId });
      return { id: slotId };
    } catch (error) {
      Logger.error('Failed to delete slot', error, { slotId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete slot', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async batchCreate(req, slotsData) {
    try {
      const db = Database.get(req);
      const userId = req.session?.currentTenantUserId || req.session?.user?.id;
      if (!userId) {
        throw new AppError(
          'User context required for batch create',
          401,
          AppError.CODES.UNAUTHORIZED,
        );
      }
      if (!Array.isArray(slotsData) || slotsData.length === 0) {
        throw new AppError(
          'slots array is required and must not be empty',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      if (slotsData.length > 50) {
        throw new AppError(
          'Too many slots (max 50 per request)',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const rows = await db.transaction(async (tx) => {
        const inserted = [];
        for (const slotData of slotsData) {
          const cap = validateCapacity(slotData.capacity);
          const location = (slotData.location || '').trim() || null;
          const slot_time = slotData.slot_time || null;
          if (!slot_time) {
            throw new AppError(
              'slot_time is required for each slot',
              400,
              AppError.CODES.VALIDATION_ERROR,
            );
          }
          const visible = slotData.visible !== false && slotData.visible !== 'false';
          const notifications_enabled =
            slotData.notifications_enabled !== false && slotData.notifications_enabled !== 'false';
          const contact_id = slotData.contact_id || null;
          const mentions = JSON.stringify(
            Array.isArray(slotData.mentions) ? slotData.mentions : [],
          );

          const sql = `INSERT INTO slots (location, slot_time, capacity, visible, notifications_enabled, contact_id, mentions, user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
          const params = [
            location,
            slot_time,
            cap,
            visible,
            notifications_enabled,
            contact_id,
            mentions,
            userId,
          ];
          const res = await tx.query(sql, params);
          if (res && res[0]) {
            inserted.push(res[0]);
          }
        }
        return inserted;
      });

      Logger.info('Slots batch created', { count: rows.length });
      return rows.map((row) => this.transformRow(row));
    } catch (error) {
      Logger.error('Failed to batch create slots', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to batch create slots', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
      return await BulkOperationsHelper.bulkDelete(req, 'slots', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete slots', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to bulk delete slots', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getBookings(req, slotId) {
    try {
      const db = Database.get(req);
      const userId = Context.getUserId(req);
      const rows = await db.query(
        `SELECT sb.id, sb.slot_id, sb.name, sb.email, sb.phone, sb.message, sb.created_at
         FROM slot_bookings sb
         INNER JOIN slots s ON sb.slot_id = s.id AND s.user_id = $2
         WHERE sb.slot_id = $1
         ORDER BY sb.created_at DESC`,
        [slotId, userId],
      );
      return rows.map((row) => ({
        id: row.id.toString(),
        slot_id: row.slot_id.toString(),
        name: row.name,
        email: row.email,
        phone: row.phone,
        message: row.message,
        created_at: row.created_at,
      }));
    } catch (error) {
      Logger.error('Failed to fetch slot bookings', error, { slotId });
      throw new AppError('Failed to fetch slot bookings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteBooking(req, bookingId) {
    try {
      const db = Database.get(req);
      const userId = Context.getUserId(req);

      // Verify the booking belongs to a slot owned by this user
      const existing = await db.query(
        `SELECT sb.id FROM slot_bookings sb
         INNER JOIN slots s ON sb.slot_id = s.id AND s.user_id = $2
         WHERE sb.id = $1`,
        [bookingId, userId],
      );

      if (!existing || existing.length === 0) {
        throw new AppError('Booking not found', 404, AppError.CODES.NOT_FOUND);
      }

      // Delete using subquery so adapter does not add user_id to slot_bookings (table has no user_id column)
      await db.query(
        `DELETE FROM slot_bookings
         WHERE id = $1
         AND slot_id IN (SELECT id FROM slots WHERE user_id = $2)`,
        [bookingId, userId],
      );

      Logger.info('Booking deleted', { bookingId });
      return { success: true };
    } catch (error) {
      Logger.error('Failed to delete booking', error, { bookingId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete booking', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformRow(row) {
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
      visible: Boolean(row.visible),
      notifications_enabled: Boolean(row.notifications_enabled),
      contact_id: row.contact_id != null ? row.contact_id.toString() : null,
      mentions,
      created_at: row.created_at,
      updated_at: row.updated_at,
      match_id: row.match_id != null ? row.match_id.toString() : null,
      booked_count: row.booked_count ?? 0,
    };
  }
}

module.exports = SlotsModel;
