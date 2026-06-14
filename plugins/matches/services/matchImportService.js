// plugins/matches/services/matchImportService.js
// Fetches matches from external API and upserts into tenant DB.

const axios = require('axios');
const { Logger } = require('@homebase/core');
const ServiceManager = require('../../../server/core/ServiceManager');
const { AppError } = require('../../../server/core/errors/AppError');

const DEFAULT_API_BASE_URL = 'https://forening-api.svenskfotboll.se';
const API_SUBSCRIPTION_HEADER = 'Ocp-Apim-Subscription-Key';
const EXTERNAL_SOURCE = 'svff-forening';

function sanitizeExternalTeamId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 100) : null;
}

function pickString(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function pickExternalId(obj) {
  const raw =
    obj?.id ??
    obj?.matchId ??
    obj?.match_id ??
    obj?.gameId ??
    obj?.game_id ??
    obj?.fixtureId ??
    obj?.fixture_id;
  if (raw == null || String(raw).trim() === '') {
    return null;
  }
  return String(raw).trim().slice(0, 255);
}

function parseStartTime(obj) {
  const date = pickString(obj, ['date', 'matchDate', 'match_date', 'datum', 'startDate']);
  const time = pickString(obj, ['time', 'startTime', 'start_time', 'tid', 'kickoff']);
  if (date && time) {
    const normalizedTime = time.length === 5 ? `${time}:00` : time;
    const parsed = new Date(`${date}T${normalizedTime}`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  const combined = pickString(obj, [
    'start_time',
    'startTime',
    'datetime',
    'dateTime',
    'matchStart',
    'match_start',
  ]);
  if (combined) {
    const parsed = new Date(combined);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
}

function inferMatchType(obj) {
  const raw = pickString(obj, [
    'match_type',
    'matchType',
    'type',
    'competitionType',
    'competition_type',
    'tavlingstyp',
  ]).toLowerCase();
  if (!raw) return 'series';
  if (raw.includes('cup')) return 'cup';
  if (raw.includes('vänskap') || raw.includes('friendly') || raw.includes('trän'))
    return 'friendly';
  if (raw.includes('serie') || raw.includes('series')) return 'series';
  return 'series';
}

function mapExternalMatch(raw, team) {
  const externalId = pickExternalId(raw);
  if (!externalId) {
    return null;
  }

  const homeTeam = pickString(raw, [
    'home_team',
    'homeTeam',
    'home',
    'hemmalag',
    'homeTeamName',
    'home_team_name',
    'lag1namn',
    'lag1',
  ]);
  const awayTeam = pickString(raw, [
    'away_team',
    'awayTeam',
    'away',
    'bortalag',
    'awayTeamName',
    'away_team_name',
    'lag2namn',
    'lag2',
  ]);
  const startTime = parseStartTime(raw);
  if (!startTime) {
    return null;
  }

  const location = pickString(raw, [
    'location',
    'venue',
    'arena',
    'plats',
    'matchVenue',
    'match_venue',
  ]);

  return {
    external_id: externalId,
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
  };
}

function normalizeApiMatches(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const candidates = [
      payload.matches,
      payload.games,
      payload.fixtures,
      payload.items,
      payload.data,
      payload.results,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }
  return [];
}

async function getMatchesSettings(userId) {
  const mainPool = ServiceManager.getMainPool();
  const result = await mainPool.query(
    'SELECT settings FROM user_settings WHERE user_id = $1 AND category = $2',
    [userId, 'matches'],
  );
  const settings = result.rows[0]?.settings || {};
  const apiBaseUrl = (settings.apiBaseUrl || DEFAULT_API_BASE_URL)
    .toString()
    .trim()
    .replace(/\/$/, '');
  const apiKey = (settings.apiKey || '').toString().trim();
  return { apiBaseUrl, apiKey };
}

async function fetchTeamMatchesFromApi({ apiBaseUrl, apiKey, externalTeamId }) {
  const url = `${apiBaseUrl}/club/team-games/${encodeURIComponent(externalTeamId)}`;
  const response = await axios.get(url, {
    headers: {
      [API_SUBSCRIPTION_HEADER]: apiKey,
      Accept: 'application/json',
    },
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });

  if (response.status === 401 || response.status === 403) {
    throw new AppError('Invalid API key or access denied', 401, AppError.CODES.UNAUTHORIZED);
  }
  if (response.status === 404) {
    return [];
  }
  if (response.status >= 400) {
    throw new AppError(
      `External API error (${response.status})`,
      502,
      AppError.CODES.SERVICE_UNAVAILABLE,
    );
  }

  return normalizeApiMatches(response.data);
}

async function importMatches(req, matchModel, { teamId } = {}) {
  const userId = req.session?.currentTenantUserId || req.session?.user?.id;
  if (!userId) {
    throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
  }

  const { apiBaseUrl, apiKey } = await getMatchesSettings(userId);
  if (!apiKey) {
    throw new AppError(
      'API key not configured. Add it in Matches settings.',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
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

  let totalImported = 0;
  let totalUpdated = 0;
  const errors = [];
  const teamResults = [];

  for (const team of teams) {
    try {
      const rawMatches = await fetchTeamMatchesFromApi({
        apiBaseUrl,
        apiKey,
        externalTeamId: team.external_team_id,
      });
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
  DEFAULT_API_BASE_URL,
};
