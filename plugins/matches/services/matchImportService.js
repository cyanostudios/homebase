// plugins/matches/services/matchImportService.js
// Fetches matches from SvFF FOGIS Club API and upserts into tenant DB.

const { Logger } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');
const {
  DEFAULT_API_BASE_URL,
  sanitizeExternalTeamId,
  parseSeasonYear,
  normalizeApiMatches,
  fetchUpcomingGames,
} = require('./svffFogisClient');

const EXTERNAL_SOURCE = 'svff-forening';

function parseFogisStartTime(raw) {
  const timeAsDateTime = raw?.timeAsDateTime;
  if (timeAsDateTime != null && String(timeAsDateTime).trim()) {
    const str = String(timeAsDateTime).trim();
    const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(str);
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
      // If no timezone is included, keep wall-clock time as-is to avoid -2h display shifts.
      // If timezone is present, normalize to UTC ISO.
      return hasTimezone ? parsed.toISOString() : str;
    }
  }
  return null;
}

function inferMatchType(raw) {
  const rawType = String(raw?.competitionCategoryName || raw?.competitionName || '').toLowerCase();
  if (!rawType) return 'series';
  if (rawType.includes('cup')) return 'cup';
  if (rawType.includes('vänskap') || rawType.includes('friendly') || rawType.includes('trän')) {
    return 'friendly';
  }
  if (rawType.includes('serie') || rawType.includes('series')) return 'series';
  return 'series';
}

function mapExternalMatch(raw, team) {
  const gameId = raw?.gameId;
  if (gameId == null || String(gameId).trim() === '') {
    return null;
  }

  const startTime = parseFogisStartTime(raw);
  if (!startTime) {
    return null;
  }

  const homeTeam = String(raw?.homeTeamName || '').trim();
  const awayTeam = String(raw?.awayTeamName || '').trim();
  const location = String(raw?.venueName || '').trim();

  return {
    external_id: String(gameId).trim().slice(0, 255),
    home_team: homeTeam || team.name,
    away_team: awayTeam || 'TBD',
    location: location || null,
    start_time: startTime,
    sport_type: 'football',
    format: '',
    match_type: inferMatchType(raw),
    team_id: Number(team.id),
    is_external: true,
    external_source: EXTERNAL_SOURCE,
    home_score:
      raw?.goalsScoredHomeTeam != null && raw.goalsScoredHomeTeam !== ''
        ? Number(raw.goalsScoredHomeTeam)
        : null,
    away_score:
      raw?.goalsScoredAwayTeam != null && raw.goalsScoredAwayTeam !== ''
        ? Number(raw.goalsScoredAwayTeam)
        : null,
    result: String(raw?.result || '').trim() || null,
    competition_name:
      String(raw?.competitionName || raw?.competitionCategoryName || '').trim() || null,
    is_canceled: Boolean(raw?.isCanceled),
    is_finished: Boolean(raw?.isFinished),
    is_postponed: Boolean(raw?.isPostponed),
  };
}

function filterGamesForTeam(games, externalTeamId) {
  const teamIdNum = Number(externalTeamId);
  if (!Number.isFinite(teamIdNum)) {
    return [];
  }
  return games.filter((game) => {
    const homeTeamId = Number(game?.homeTeamId);
    const awayTeamId = Number(game?.awayTeamId);
    return homeTeamId === teamIdNum || awayTeamId === teamIdNum;
  });
}

async function importMatches(req, matchModel, { teamId } = {}) {
  const userId = req.session?.currentTenantUserId || req.session?.user?.id;
  if (!userId) {
    throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
  }

  const { Database } = require('@homebase/core');
  const db = Database.get(req);

  let teamsQuery =
    'SELECT id, name, external_team_id FROM teams WHERE external_team_id IS NOT NULL';
  const params = [];
  if (teamId != null && String(teamId).trim() !== '') {
    teamsQuery += ' AND id = $1';
    params.push(Number(teamId));
  }
  const teamRows = await db.query(teamsQuery, params);

  const teams = teamRows
    .map((row) => ({
      id: String(row.id),
      name: row.name,
      external_team_id: sanitizeExternalTeamId(row.external_team_id),
    }))
    .filter((team) => team.external_team_id);

  if (teams.length === 0) {
    return {
      imported: 0,
      updated: 0,
      errors: [
        teamId
          ? 'Team has no external team ID configured.'
          : 'No teams have an external team ID configured.',
      ],
      teams: [],
    };
  }

  let allGames;
  try {
    allGames = await fetchUpcomingGames(userId);
  } catch (error) {
    Logger.error('Match import failed while fetching club games', error, { userId });
    throw error instanceof AppError
      ? error
      : new AppError(
          error?.message || 'Failed to fetch matches from external API',
          502,
          AppError.CODES.SERVICE_UNAVAILABLE,
        );
  }

  let totalImported = 0;
  let totalUpdated = 0;
  const errors = [];
  const teamResults = [];

  for (const team of teams) {
    try {
      const rawMatches = filterGamesForTeam(allGames, team.external_team_id);
      const mapped = rawMatches.map((raw) => mapExternalMatch(raw, team)).filter(Boolean);

      const result = await matchModel.upsertExternal(req, team.id, mapped);
      totalImported += result.imported;
      totalUpdated += result.updated;
      teamResults.push({
        teamId: team.id,
        teamName: team.name,
        imported: result.imported,
        updated: result.updated,
      });
    } catch (error) {
      const message =
        error instanceof AppError
          ? error.message
          : error?.message || 'Failed to import matches for team';
      Logger.error('Match import failed for team', error, {
        teamId: team.id,
        externalTeamId: team.external_team_id,
      });
      errors.push(`${team.name}: ${message}`);
      teamResults.push({
        teamId: team.id,
        teamName: team.name,
        imported: 0,
        updated: 0,
        error: message,
      });
    }
  }

  return {
    imported: totalImported,
    updated: totalUpdated,
    errors,
    teams: teamResults,
  };
}

module.exports = {
  importMatches,
  mapExternalMatch,
  normalizeApiMatches,
  filterGamesForTeam,
  parseSeasonYear,
  parseFogisStartTime,
  DEFAULT_API_BASE_URL,
};
