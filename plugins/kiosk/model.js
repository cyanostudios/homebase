// plugins/kiosk/model.js
// V3 with @homebase/core SDK
const { Logger, Database } = require('@homebase/core');
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

class KioskModel {
  async getAll(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        'SELECT * FROM kiosk_slots ORDER BY slot_time DESC, created_at DESC',
        [],
      );
      return rows.map(this.transformRow);
    } catch (error) {
      Logger.error('Failed to fetch kiosk slots', error);
      throw new AppError('Failed to fetch kiosk slots', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, slotData) {
    try {
      const db = Database.get(req);
      const { location, slot_time, capacity, visible, notifications_enabled } = slotData;
      const cap = validateCapacity(capacity);

      const result = await db.insert('kiosk_slots', {
        location: (location || '').trim() || null,
        slot_time: slot_time || null,
        capacity: cap,
        visible: visible !== false && visible !== 'false',
        notifications_enabled: notifications_enabled !== false && notifications_enabled !== 'false',
      });

      Logger.info('Kiosk slot created', { slotId: result.id });
      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to create kiosk slot', error, {
        slotData: { location: slotData?.location },
      });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create kiosk slot', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, slotId, slotData) {
    try {
      const db = Database.get(req);
      const userId = req.session?.currentTenantUserId || req.session?.user?.id;
      if (!userId) {
        throw new AppError('User context required for update', 401, AppError.CODES.UNAUTHORIZED);
      }

      const existing = await db.query('SELECT * FROM kiosk_slots WHERE id = $1', [slotId]);
      if (!existing || existing.length === 0) {
        throw new AppError('Kiosk slot not found', 404, AppError.CODES.NOT_FOUND);
      }

      const { location, slot_time, capacity, visible, notifications_enabled } = slotData;
      const cap = capacity != null ? validateCapacity(capacity) : existing[0].capacity;

      const result = await db.update('kiosk_slots', slotId, {
        location: (location || '').trim() || null,
        slot_time: slot_time || null,
        capacity: cap,
        visible: visible !== false && visible !== 'false',
        notifications_enabled: notifications_enabled !== false && notifications_enabled !== 'false',
      });

      Logger.info('Kiosk slot updated', { slotId });
      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to update kiosk slot', error, { slotId });
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to update kiosk slot: ${error.message || 'Unknown error'}`,
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async delete(req, slotId) {
    try {
      const db = Database.get(req);
      await db.deleteRecord('kiosk_slots', slotId);
      Logger.info('Kiosk slot deleted', { slotId });
      return { id: slotId };
    } catch (error) {
      Logger.error('Failed to delete kiosk slot', error, { slotId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete kiosk slot', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
      return await BulkOperationsHelper.bulkDelete(req, 'kiosk_slots', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete kiosk slots', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to bulk delete kiosk slots', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformRow(row) {
    return {
      id: row.id.toString(),
      location: row.location,
      slot_time: row.slot_time,
      capacity: row.capacity,
      visible: Boolean(row.visible),
      notifications_enabled: Boolean(row.notifications_enabled),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = KioskModel;
