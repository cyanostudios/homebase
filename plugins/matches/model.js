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
  if (format) {
    const allowed = FORMATS_BY_SPORT[sportType];
    if (!allowed.includes(format)) {
      throw new AppError(
        `Invalid format for ${sportType}. Allowed: ${allowed.join(', ')}`,
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
  }
}

class MatchModel {
  _deriveName({ name, home_team, away_team }) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (trimmed) {
      return trimmed.slice(0, 255);
    }
    const home = (home_team || '').toString().trim();
    const away = (away_team || '').toString().trim();
    const derived = [home, away].filter(Boolean).join(' – ').trim();
    return derived ? derived.slice(0, 255) : null;
  }

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
        name,
        match_number,
        match_type,
        referee_count,
        map_link,
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
      const nextName = this._deriveName({ name, home_team, away_team });

      const result = await db.insert('matches', {
        name: nextName,
        match_number:
          match_number !== null && match_number !== undefined && String(match_number).trim() !== ''
            ? parseInt(match_number, 10)
            : null,
        match_type:
          match_type !== null && match_type !== undefined && String(match_type).trim() !== ''
            ? String(match_type).trim()
            : null,
        referee_count:
          referee_count !== null &&
          referee_count !== undefined &&
          String(referee_count).trim() !== ''
            ? parseInt(referee_count, 10)
            : 1,
        map_link: (map_link || '').trim() || null,
        home_team: (home_team || '').trim() || null,
        away_team: (away_team || '').trim() || null,
        location: (location || '').trim() || null,
        start_time: start_time || null,
        sport_type: sport_type || 'football',
        // DB column `format` is NOT NULL; keep optional UX by storing empty string when unset.
        format: (format ?? '').toString().trim(),
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
        name,
        match_number,
        match_type,
        referee_count,
        map_link,
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
      const nextName = this._deriveName({ name, home_team, away_team });

      const result = await db.update('matches', matchId, {
        name: nextName,
        match_number:
          match_number !== undefined
            ? match_number !== null && String(match_number).trim() !== ''
              ? parseInt(match_number, 10)
              : null
            : (existing[0].match_number ?? null),
        match_type:
          match_type !== undefined
            ? match_type !== null && String(match_type).trim() !== ''
              ? String(match_type).trim()
              : null
            : (existing[0].match_type ?? null),
        referee_count:
          referee_count !== undefined
            ? referee_count !== null && String(referee_count).trim() !== ''
              ? parseInt(referee_count, 10)
              : 1
            : (existing[0].referee_count ?? 1),
        map_link:
          map_link !== undefined ? (map_link || '').trim() || null : (existing[0].map_link ?? null),
        home_team: (home_team || '').trim() || null,
        away_team: (away_team || '').trim() || null,
        location: (location || '').trim() || null,
        start_time: start_time || null,
        sport_type: sport_type || 'football',
        // DB column `format` is NOT NULL; keep optional UX by storing empty string when unset.
        format: (format ?? '').toString().trim(),
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
      name: row.name !== null && row.name !== undefined ? String(row.name) : null,
      match_number:
        row.match_number !== null && row.match_number !== undefined
          ? Number(row.match_number)
          : null,
      match_type:
        row.match_type !== null && row.match_type !== undefined ? String(row.match_type) : null,
      referee_count:
        row.referee_count !== null && row.referee_count !== undefined
          ? Number(row.referee_count)
          : 1,
      map_link: row.map_link !== null && row.map_link !== undefined ? String(row.map_link) : null,
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
