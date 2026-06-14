// plugins/matches/model.js
// V3 with @homebase/core SDK
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');

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

function sanitizeTeamId(value) {
  if (value == null || value === '') {
    return null;
  }
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sanitizeExternalId(value) {
  if (value == null || value === '') {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 255) : null;
}

function sanitizeScore(value) {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 999 ? parsed : null;
}

function sanitizeResult(value) {
  if (value == null || value === '') {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 50) : null;
}

function sanitizeCompetitionName(value) {
  if (value == null || value === '') {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 255) : null;
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
      return rows.map((row) => this.transformRow(row));
    } catch (error) {
      Logger.error('Failed to fetch matches', error);
      throw new AppError('Failed to fetch matches', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getAllByTeam(req, teamId) {
    try {
      const db = Database.get(req);
      const parsedTeamId = sanitizeTeamId(teamId);
      if (!parsedTeamId) {
        throw new AppError('Invalid team id', 400, AppError.CODES.VALIDATION_ERROR);
      }
      const rows = await db.query(
        'SELECT * FROM matches WHERE team_id = $1 ORDER BY start_time ASC, created_at ASC',
        [parsedTeamId],
      );
      return rows.map((row) => this.transformRow(row));
    } catch (error) {
      Logger.error('Failed to fetch team matches', error, { teamId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch team matches', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async upsertExternal(req, teamId, externalMatches) {
    try {
      const db = Database.get(req);
      const parsedTeamId = sanitizeTeamId(teamId);
      if (!parsedTeamId) {
        throw new AppError('Invalid team id', 400, AppError.CODES.VALIDATION_ERROR);
      }
      if (!Array.isArray(externalMatches)) {
        throw new AppError(
          'externalMatches must be an array',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      let imported = 0;
      let updated = 0;

      for (const matchData of externalMatches) {
        const externalId = sanitizeExternalId(matchData.external_id);
        if (!externalId) {
          continue;
        }

        const payload = {
          name: this._deriveName({
            name: matchData.name,
            home_team: matchData.home_team,
            away_team: matchData.away_team,
          }),
          match_number: null,
          match_type:
            matchData.match_type != null && String(matchData.match_type).trim()
              ? String(matchData.match_type).trim()
              : null,
          referee_count: 1,
          map_link: null,
          home_team: (matchData.home_team || '').trim() || null,
          away_team: (matchData.away_team || '').trim() || null,
          location: (matchData.location || '').trim() || null,
          start_time: matchData.start_time || null,
          sport_type: matchData.sport_type || 'football',
          format: (matchData.format ?? '').toString().trim(),
          total_minutes: null,
          contact_id: null,
          mentions: JSON.stringify([]),
          team_id: parsedTeamId,
          external_id: externalId,
          is_external: true,
          external_source: (matchData.external_source || '').trim() || null,
          home_score: sanitizeScore(matchData.home_score),
          away_score: sanitizeScore(matchData.away_score),
          result: sanitizeResult(matchData.result),
          competition_name: sanitizeCompetitionName(matchData.competition_name),
          is_canceled: Boolean(matchData.is_canceled),
          is_finished: Boolean(matchData.is_finished),
          is_postponed: Boolean(matchData.is_postponed),
        };

        const existing = await db.query('SELECT id FROM matches WHERE external_id = $1', [
          externalId,
        ]);

        if (existing.length > 0) {
          await db.update('matches', existing[0].id, payload);
          updated += 1;
        } else {
          await db.insert('matches', payload);
          imported += 1;
        }
      }

      return { imported, updated };
    } catch (error) {
      Logger.error('Failed to upsert external matches', error, { teamId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to upsert external matches', 500, AppError.CODES.DATABASE_ERROR);
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
        team_id,
        external_id,
        is_external,
        external_source,
        home_score,
        away_score,
        result: matchResult,
        competition_name,
        is_canceled,
        is_finished,
        is_postponed,
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
        team_id: sanitizeTeamId(team_id),
        external_id: sanitizeExternalId(external_id),
        is_external: Boolean(is_external),
        external_source: (external_source || '').trim() || null,
        home_score: sanitizeScore(home_score),
        away_score: sanitizeScore(away_score),
        result: sanitizeResult(matchResult),
        competition_name: sanitizeCompetitionName(competition_name),
        is_canceled: Boolean(is_canceled),
        is_finished: Boolean(is_finished),
        is_postponed: Boolean(is_postponed),
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
        team_id,
        external_id,
        is_external,
        external_source,
        home_score,
        away_score,
        result: matchResult,
        competition_name,
        is_canceled,
        is_finished,
        is_postponed,
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
        team_id: team_id !== undefined ? sanitizeTeamId(team_id) : (existing[0].team_id ?? null),
        external_id:
          external_id !== undefined
            ? sanitizeExternalId(external_id)
            : (existing[0].external_id ?? null),
        is_external:
          is_external !== undefined ? Boolean(is_external) : Boolean(existing[0].is_external),
        external_source:
          external_source !== undefined
            ? (external_source || '').trim() || null
            : (existing[0].external_source ?? null),
        home_score:
          home_score !== undefined ? sanitizeScore(home_score) : (existing[0].home_score ?? null),
        away_score:
          away_score !== undefined ? sanitizeScore(away_score) : (existing[0].away_score ?? null),
        result:
          matchResult !== undefined ? sanitizeResult(matchResult) : (existing[0].result ?? null),
        competition_name:
          competition_name !== undefined
            ? sanitizeCompetitionName(competition_name)
            : (existing[0].competition_name ?? null),
        is_canceled:
          is_canceled !== undefined ? Boolean(is_canceled) : Boolean(existing[0].is_canceled),
        is_finished:
          is_finished !== undefined ? Boolean(is_finished) : Boolean(existing[0].is_finished),
        is_postponed:
          is_postponed !== undefined ? Boolean(is_postponed) : Boolean(existing[0].is_postponed),
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
      team_id: row.team_id != null ? String(row.team_id) : null,
      external_id: row.external_id != null ? String(row.external_id) : null,
      is_external: Boolean(row.is_external),
      external_source: row.external_source != null ? String(row.external_source) : null,
      home_score:
        row.home_score !== null && row.home_score !== undefined ? Number(row.home_score) : null,
      away_score:
        row.away_score !== null && row.away_score !== undefined ? Number(row.away_score) : null,
      result: row.result != null ? String(row.result) : null,
      competition_name: row.competition_name != null ? String(row.competition_name) : null,
      is_canceled: Boolean(row.is_canceled),
      is_finished: Boolean(row.is_finished),
      is_postponed: Boolean(row.is_postponed),
      mentions,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = MatchModel;
