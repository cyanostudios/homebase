// plugins/matches/model.js
// V3 with @homebase/core SDK
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const SPORT_TYPES = ['football', 'handball'];
const FORMATS_BY_SPORT = {
  football: ['3vs3', '5vs5', '7vs7', '8vs8', '9vs9', '11vs11'],
  handball: ['6vs6', '7vs7'],
};

function validateSportAndFormat(sportType, format) {
  if (!SPORT_TYPES.includes(sportType)) {
    throw new AppError(
      `Invalid sport_type. Allowed: ${SPORT_TYPES.join(', ')}`,
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  const allowed = FORMATS_BY_SPORT[sportType];
  if (!allowed.includes(format)) {
    throw new AppError(
      `Invalid format for ${sportType}. Allowed: ${allowed.join(', ')}`,
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
}

class MatchModel {
  async getAll(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        'SELECT * FROM matches ORDER BY start_time DESC, created_at DESC',
        [],
      );
      return rows.map(this.transformRow);
    } catch (error) {
      Logger.error('Failed to fetch matches', error);
      throw new AppError('Failed to fetch matches', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, matchData) {
    try {
      const db = Database.get(req);
      const {
        home_team,
        away_team,
        location,
        start_time,
        sport_type,
        format,
        total_minutes,
        contact_id,
        mentions,
      } = matchData;
      validateSportAndFormat(sport_type, format);

      const result = await db.insert('matches', {
        home_team: (home_team || '').trim() || null,
        away_team: (away_team || '').trim() || null,
        location: (location || '').trim() || null,
        start_time: start_time || null,
        sport_type: sport_type || 'football',
        format: format || null,
        total_minutes: total_minutes != null ? parseInt(total_minutes, 10) : null,
        contact_id: contact_id || null,
        mentions: JSON.stringify(Array.isArray(mentions) ? mentions : []),
      });

      Logger.info('Match created', { matchId: result.id });
      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to create match', error, {
        matchData: { home_team: matchData?.home_team },
      });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create match', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, matchId, matchData) {
    try {
      const db = Database.get(req);
      const userId = req.session?.currentTenantUserId || req.session?.user?.id;
      if (!userId) {
        throw new AppError('User context required for update', 401, AppError.CODES.UNAUTHORIZED);
      }

      const existing = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
      if (!existing || existing.length === 0) {
        throw new AppError('Match not found', 404, AppError.CODES.NOT_FOUND);
      }

      const {
        home_team,
        away_team,
        location,
        start_time,
        sport_type,
        format,
        total_minutes,
        contact_id,
        mentions,
      } = matchData;
      validateSportAndFormat(sport_type, format);

      const result = await db.update('matches', matchId, {
        home_team: (home_team || '').trim() || null,
        away_team: (away_team || '').trim() || null,
        location: (location || '').trim() || null,
        start_time: start_time || null,
        sport_type: sport_type || 'football',
        format: format || null,
        total_minutes: total_minutes != null ? parseInt(total_minutes, 10) : null,
        contact_id: contact_id ?? existing[0].contact_id ?? null,
        mentions:
          mentions !== undefined
            ? JSON.stringify(Array.isArray(mentions) ? mentions : [])
            : existing[0].mentions,
      });

      Logger.info('Match updated', { matchId });
      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to update match', error, { matchId });
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to update match: ${error.message || 'Unknown error'}`,
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async delete(req, matchId) {
    try {
      const db = Database.get(req);
      await db.deleteRecord('matches', matchId);
      Logger.info('Match deleted', { matchId });
      return { id: matchId };
    } catch (error) {
      Logger.error('Failed to delete match', error, { matchId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete match', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
      return await BulkOperationsHelper.bulkDelete(req, 'matches', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete matches', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to bulk delete matches', 500, AppError.CODES.DATABASE_ERROR);
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
      home_team: row.home_team,
      away_team: row.away_team,
      location: row.location,
      start_time: row.start_time,
      sport_type: row.sport_type || 'football',
      format: row.format,
      total_minutes: row.total_minutes,
      contact_id: row.contact_id != null ? row.contact_id.toString() : null,
      mentions,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = MatchModel;
