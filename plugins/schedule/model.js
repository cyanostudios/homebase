const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const SCHEDULE_COLORS = ['green', 'blue', 'red', 'purple', 'orange', 'teal', 'white'];
const EVENT_TYPES = ['recurring', 'date_based'];
const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const TEAMS_CALENDAR_NAME = 'Teams Calendar';

function sanitizeColor(value) {
  const color = String(value || 'blue')
    .trim()
    .toLowerCase();
  return SCHEDULE_COLORS.includes(color) ? color : 'blue';
}

function sanitizeEventType(value) {
  const type = String(value || 'recurring')
    .trim()
    .toLowerCase();
  return EVENT_TYPES.includes(type) ? type : 'recurring';
}

function sanitizeDay(value) {
  const day = String(value || '')
    .trim()
    .toLowerCase();
  return WEEK_DAYS.includes(day) ? day : null;
}

function sanitizeTime(value) {
  return String(value || '')
    .trim()
    .slice(0, 10);
}

function sanitizeLocation(value) {
  return String(value || '')
    .trim()
    .slice(0, 255);
}

function sanitizeTitle(value) {
  return String(value || '')
    .trim()
    .slice(0, 255);
}

function sanitizeName(value) {
  return String(value || '')
    .trim()
    .slice(0, 255);
}

function sanitizeEventDate(value) {
  if (!value) return null;
  const date = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

class ScheduleModel {
  constructor() {
    this.schedulesTable = 'schedules';
    this.eventsTable = 'schedule_events';
  }

  async ensureTeamsCalendar(req) {
    const db = Database.get(req);
    const existing = await db.query(
      `SELECT id FROM ${this.schedulesTable} WHERE is_team_calendar = true LIMIT 1`,
      [],
    );
    if (existing.length > 0) {
      return;
    }
    await db.insert(this.schedulesTable, {
      name: TEAMS_CALENDAR_NAME,
      color: 'blue',
      is_team_calendar: true,
    });
    Logger.info('Teams calendar seeded for tenant');
  }

  async getAll(req) {
    try {
      await this.ensureTeamsCalendar(req);
      const db = Database.get(req);
      const sql = `
        SELECT
          s.*,
          COALESCE(e.event_count, 0)::int AS event_count
        FROM ${this.schedulesTable} s
        LEFT JOIN (
          SELECT schedule_id, COUNT(*) AS event_count
          FROM ${this.eventsTable}
          GROUP BY schedule_id
        ) e ON e.schedule_id = s.id
        ORDER BY s.is_team_calendar DESC, s.updated_at DESC
      `;
      const rows = await db.query(sql, []);
      return rows.map((row) => this.transformScheduleRow(row));
    } catch (error) {
      Logger.error('Failed to fetch schedules', error);
      throw new AppError('Failed to fetch schedules', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, scheduleId) {
    try {
      await this.ensureTeamsCalendar(req);
      const db = Database.get(req);
      const scheduleRows = await db.query(`SELECT * FROM ${this.schedulesTable} WHERE id = $1`, [
        scheduleId,
      ]);
      if (!scheduleRows.length) {
        throw new AppError('Schedule not found', 404, AppError.CODES.NOT_FOUND);
      }
      const eventRows = await db.query(
        `SELECT * FROM ${this.eventsTable} WHERE schedule_id = $1 ORDER BY event_type, day, event_date, start_time`,
        [scheduleId],
      );
      const schedule = this.transformScheduleRow(scheduleRows[0]);
      schedule.events = eventRows.map((row) => this.transformEventRow(row));
      return schedule;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to fetch schedule', error, { scheduleId });
      throw new AppError('Failed to fetch schedule', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, data) {
    try {
      const db = Database.get(req);
      const record = await db.insert(this.schedulesTable, {
        name: sanitizeName(data.name),
        color: sanitizeColor(data.color),
        is_team_calendar: false,
      });
      Logger.info('Schedule created', { scheduleId: record.id });
      return this.transformScheduleRow({ ...record, event_count: 0 });
    } catch (error) {
      Logger.error('Failed to create schedule', error);
      throw new AppError('Failed to create schedule', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, scheduleId, data) {
    try {
      const db = Database.get(req);
      const currentRows = await db.query(`SELECT * FROM ${this.schedulesTable} WHERE id = $1`, [
        scheduleId,
      ]);
      if (!currentRows.length) {
        throw new AppError('Schedule not found', 404, AppError.CODES.NOT_FOUND);
      }
      const current = currentRows[0];
      if (current.is_team_calendar) {
        throw new AppError('Teams calendar cannot be edited', 403, AppError.CODES.FORBIDDEN);
      }

      const sql = `
        UPDATE ${this.schedulesTable}
        SET
          name = $1,
          color = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      const rows = await db.query(sql, [
        sanitizeName(data.name ?? current.name),
        sanitizeColor(data.color ?? current.color),
        scheduleId,
      ]);
      Logger.info('Schedule updated', { scheduleId });
      return this.transformScheduleRow(rows[0]);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to update schedule', error, { scheduleId });
      throw new AppError('Failed to update schedule', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, scheduleId) {
    try {
      const db = Database.get(req);
      const currentRows = await db.query(`SELECT * FROM ${this.schedulesTable} WHERE id = $1`, [
        scheduleId,
      ]);
      if (!currentRows.length) {
        throw new AppError('Schedule not found', 404, AppError.CODES.NOT_FOUND);
      }
      if (currentRows[0].is_team_calendar) {
        throw new AppError('Teams calendar cannot be deleted', 403, AppError.CODES.FORBIDDEN);
      }

      const sql = `
        DELETE FROM ${this.schedulesTable}
        WHERE id = $1
        RETURNING id
      `;
      const rows = await db.query(sql, [scheduleId]);
      Logger.info('Schedule deleted', { scheduleId: rows[0].id });
      return { id: String(scheduleId) };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to delete schedule', error, { scheduleId });
      throw new AppError('Failed to delete schedule', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createEvent(req, scheduleId, data) {
    try {
      const db = Database.get(req);
      const scheduleRows = await db.query(`SELECT * FROM ${this.schedulesTable} WHERE id = $1`, [
        scheduleId,
      ]);
      if (!scheduleRows.length) {
        throw new AppError('Schedule not found', 404, AppError.CODES.NOT_FOUND);
      }
      if (scheduleRows[0].is_team_calendar) {
        throw new AppError('Cannot add events to teams calendar', 403, AppError.CODES.FORBIDDEN);
      }

      const eventType = sanitizeEventType(data.event_type);
      const payload = this.buildEventPayload(eventType, data);

      const record = await db.insert(this.eventsTable, {
        schedule_id: scheduleId,
        ...payload,
      });
      Logger.info('Schedule event created', { eventId: record.id, scheduleId });
      return this.transformEventRow(record);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to create schedule event', error, { scheduleId });
      throw new AppError('Failed to create schedule event', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateEvent(req, scheduleId, eventId, data) {
    try {
      const db = Database.get(req);
      const scheduleRows = await db.query(`SELECT * FROM ${this.schedulesTable} WHERE id = $1`, [
        scheduleId,
      ]);
      if (!scheduleRows.length) {
        throw new AppError('Schedule not found', 404, AppError.CODES.NOT_FOUND);
      }
      if (scheduleRows[0].is_team_calendar) {
        throw new AppError('Cannot edit teams calendar events', 403, AppError.CODES.FORBIDDEN);
      }

      const currentRows = await db.query(
        `SELECT * FROM ${this.eventsTable} WHERE id = $1 AND schedule_id = $2`,
        [eventId, scheduleId],
      );
      if (!currentRows.length) {
        throw new AppError('Event not found', 404, AppError.CODES.NOT_FOUND);
      }
      const current = currentRows[0];
      const eventType = sanitizeEventType(data.event_type ?? current.event_type);
      const payload = this.buildEventPayload(eventType, { ...current, ...data });

      const sql = `
        UPDATE ${this.eventsTable}
        SET
          title = $1,
          event_type = $2,
          day = $3,
          event_date = $4,
          start_time = $5,
          end_time = $6,
          location = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8 AND schedule_id = $9
        RETURNING *
      `;
      const rows = await db.query(sql, [
        payload.title,
        payload.event_type,
        payload.day,
        payload.event_date,
        payload.start_time,
        payload.end_time,
        payload.location,
        eventId,
        scheduleId,
      ]);
      Logger.info('Schedule event updated', { eventId, scheduleId });
      return this.transformEventRow(rows[0]);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to update schedule event', error, { eventId, scheduleId });
      throw new AppError('Failed to update schedule event', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteEvent(req, scheduleId, eventId) {
    try {
      const db = Database.get(req);
      const scheduleRows = await db.query(`SELECT * FROM ${this.schedulesTable} WHERE id = $1`, [
        scheduleId,
      ]);
      if (!scheduleRows.length) {
        throw new AppError('Schedule not found', 404, AppError.CODES.NOT_FOUND);
      }
      if (scheduleRows[0].is_team_calendar) {
        throw new AppError('Cannot delete teams calendar events', 403, AppError.CODES.FORBIDDEN);
      }

      const sql = `
        DELETE FROM ${this.eventsTable}
        WHERE id = $1 AND schedule_id = $2
        RETURNING id
      `;
      const rows = await db.query(sql, [eventId, scheduleId]);
      if (!rows.length) {
        throw new AppError('Event not found', 404, AppError.CODES.NOT_FOUND);
      }
      Logger.info('Schedule event deleted', { eventId, scheduleId });
      return { id: String(eventId) };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to delete schedule event', error, { eventId, scheduleId });
      throw new AppError('Failed to delete schedule event', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  buildEventPayload(eventType, data) {
    const title = sanitizeTitle(data.title);
    if (!title) {
      throw new AppError('Event title is required', 400, AppError.CODES.VALIDATION_ERROR);
    }

    if (eventType === 'recurring') {
      const day = sanitizeDay(data.day);
      if (!day) {
        throw new AppError(
          'Day is required for recurring events',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      return {
        title,
        event_type: 'recurring',
        day,
        event_date: null,
        start_time: sanitizeTime(data.start_time),
        end_time: sanitizeTime(data.end_time),
        location: sanitizeLocation(data.location),
      };
    }

    const eventDate = sanitizeEventDate(data.event_date);
    if (!eventDate) {
      throw new AppError(
        'Date is required for date-based events',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    return {
      title,
      event_type: 'date_based',
      day: null,
      event_date: eventDate,
      start_time: sanitizeTime(data.start_time),
      end_time: sanitizeTime(data.end_time),
      location: sanitizeLocation(data.location),
    };
  }

  transformScheduleRow(row) {
    return {
      id: String(row.id),
      name: row.name ?? '',
      color: sanitizeColor(row.color),
      is_team_calendar: Boolean(row.is_team_calendar),
      event_count: Number(row.event_count ?? 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  transformEventRow(row) {
    return {
      id: String(row.id),
      schedule_id: String(row.schedule_id),
      title: row.title ?? '',
      event_type: sanitizeEventType(row.event_type),
      day: row.day ?? null,
      event_date: row.event_date ? String(row.event_date).slice(0, 10) : null,
      start_time: row.start_time ?? '',
      end_time: row.end_time ?? '',
      location: row.location ?? '',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = ScheduleModel;
