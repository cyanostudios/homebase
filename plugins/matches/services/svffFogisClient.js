// plugins/matches/services/svffFogisClient.js
// Shared SvFF FOGIS Club API transport (credentials from matches settings).

const axios = require('axios');
const { Logger } = require('@homebase/core');
const ServiceManager = require('../../../server/core/ServiceManager');
const { AppError } = require('../../../server/core/errors/AppError');

const DEFAULT_API_BASE_URL = 'https://forening-api.svenskfotboll.se';
const API_SUBSCRIPTION_HEADER = 'Ocp-Apim-Subscription-Key';
const API_KEY_HEADER = 'ApiKey';

function sanitizeExternalTeamId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 100) : null;
}

function parseSeasonYear(activeSeason) {
  const match = String(activeSeason || '').match(/\d{4}/);
  if (match) {
    return Number.parseInt(match[0], 10);
  }
  return new Date().getFullYear();
}

function buildSeasonDateRange(seasonYear) {
  const year = Number.isFinite(seasonYear) ? seasonYear : new Date().getFullYear();
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
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

async function getFogisSettings(userId) {
  const mainPool = ServiceManager.getMainPool();
  const [matchesResult, teamsResult] = await Promise.all([
    mainPool.query('SELECT settings FROM user_settings WHERE user_id = $1 AND category = $2', [
      userId,
      'matches',
    ]),
    mainPool.query('SELECT settings FROM user_settings WHERE user_id = $1 AND category = $2', [
      userId,
      'teams',
    ]),
  ]);

  const matchesSettings = matchesResult.rows[0]?.settings || {};
  const teamsSettings = teamsResult.rows[0]?.settings || {};
  const apiBaseUrl = (matchesSettings.apiBaseUrl || DEFAULT_API_BASE_URL)
    .toString()
    .trim()
    .replace(/\/$/, '');
  const apiKey = (matchesSettings.apiKey || '').toString().trim();
  const seasonYear = parseSeasonYear(teamsSettings.activeSeason);

  return { apiBaseUrl, apiKey, seasonYear };
}

async function fetchUpcomingGamesFromApi({ apiBaseUrl, apiKey, seasonYear }) {
  const { from, to } = buildSeasonDateRange(seasonYear);
  const url = `${apiBaseUrl}/club/upcoming-games`;
  const response = await axios.get(url, {
    params: {
      from,
      to,
      w: 3,
    },
    headers: {
      [API_SUBSCRIPTION_HEADER]: apiKey,
      [API_KEY_HEADER]: apiKey,
      Accept: 'application/json',
    },
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });

  if (response.status === 401 || response.status === 403) {
    Logger.error('SvFF API auth failed', null, {
      status: response.status,
      url,
      seasonYear,
    });
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

/**
 * Fetch upcoming club games for the user (uses matches API key + teams activeSeason).
 * @param {number|string} userId
 * @returns {Promise<object[]>}
 */
async function fetchUpcomingGames(userId) {
  if (userId == null || String(userId).trim() === '') {
    throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
  }

  const { apiBaseUrl, apiKey, seasonYear } = await getFogisSettings(userId);
  if (!apiKey) {
    throw new AppError(
      'API key not configured. Add it in Matches settings.',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }

  try {
    return await fetchUpcomingGamesFromApi({ apiBaseUrl, apiKey, seasonYear });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error?.message || 'Failed to fetch matches from external API';
    Logger.error('FOGIS fetch failed', error, { seasonYear });
    throw new AppError(message, 502, AppError.CODES.SERVICE_UNAVAILABLE);
  }
}

module.exports = {
  DEFAULT_API_BASE_URL,
  sanitizeExternalTeamId,
  parseSeasonYear,
  normalizeApiMatches,
  getFogisSettings,
  fetchUpcomingGamesFromApi,
  fetchUpcomingGames,
};
