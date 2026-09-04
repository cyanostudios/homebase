// plugins/matches/services/svffFogisClient.js
// Shared SvFF FOGIS Club API transport (credentials from matches settings).

const axios = require('axios');
const { Logger } = require('@homebase/core');
const ServiceManager = require('../../../server/core/ServiceManager');
const { AppError } = require('../../../server/core/errors/AppError');
const { validatePublicHttpsUrl } = require('../../../server/core/utils/ssrfUrlGuard');

const DEFAULT_API_BASE_URL = 'https://forening-api.svenskfotboll.se';
const API_SUBSCRIPTION_HEADER = 'Ocp-Apim-Subscription-Key';
const API_KEY_HEADER = 'ApiKey';

function sanitizeExternalTeamId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 100) : null;
}

/**
 * SvFF can return `timeAsDateTime` without explicit timezone.
 * When that happens, JS parses it as local time and `toISOString()` shifts it to UTC,
 * which causes a fixed offset display bug (e.g. -2h in Sweden).
 *
 * Rule:
 * - If the input contains explicit timezone info (`Z` or `+HH:mm`/`-HH:mm`), normalize to UTC ISO.
 * - Otherwise, keep the wall-clock value as-is (no conversion).
 */
function parseFogisStartTime(timeAsDateTime) {
  if (timeAsDateTime == null) return null;
  const str = String(timeAsDateTime).trim();
  if (!str) return null;

  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(str);
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;

  return hasTimezone ? parsed.toISOString() : str;
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
      payload.game,
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

function fogisAuthHeaders(apiKey) {
  return {
    [API_SUBSCRIPTION_HEADER]: apiKey,
    [API_KEY_HEADER]: apiKey,
    Accept: 'application/json',
  };
}

function assertFogisHttpOk(response, url, seasonYear) {
  if (response.status === 401 || response.status === 403) {
    Logger.error('SvFF API auth failed', null, {
      status: response.status,
      url,
      seasonYear,
    });
    throw new AppError('Invalid API key or access denied', 401, AppError.CODES.UNAUTHORIZED);
  }
  if (response.status === 404) {
    return null;
  }
  if (response.status >= 400) {
    throw new AppError(
      `External API error (${response.status})`,
      502,
      AppError.CODES.SERVICE_UNAVAILABLE,
    );
  }
  return response.data;
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

  const urlCheck = validatePublicHttpsUrl(apiBaseUrl);
  if (!urlCheck.ok) {
    throw new AppError(
      `Invalid matches API base URL: ${urlCheck.error}`,
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
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
    headers: fogisAuthHeaders(apiKey),
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });

  // Redirects are still possible; validate the final URL host/protocol to keep SSRF risk low.
  const finalUrl = response?.request?.res?.responseUrl || response?.request?.res?.responseURL;
  if (typeof finalUrl === 'string' && finalUrl.trim()) {
    const finalCheck = validatePublicHttpsUrl(finalUrl);
    if (!finalCheck.ok) {
      throw new AppError(
        `External matches API redirect blocked: ${finalCheck.error}`,
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
  }

  const data = assertFogisHttpOk(response, url, seasonYear);
  if (data == null) return [];
  return normalizeApiMatches(data);
}

/**
 * @param {{ apiBaseUrl: string, apiKey: string, seasonIds?: string|number|null }} opts
 */
async function fetchClubDetailsFromApi({ apiBaseUrl, apiKey, seasonIds }) {
  const url = `${apiBaseUrl}/club/details`;
  const params = {};
  if (seasonIds != null && String(seasonIds).trim() !== '') {
    params.seasonIds = String(seasonIds).trim();
  }
  const response = await axios.get(url, {
    params,
    headers: fogisAuthHeaders(apiKey),
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });
  // Redirects are still possible; validate the final URL host/protocol to keep SSRF risk low.
  const finalUrl = response?.request?.res?.responseUrl || response?.request?.res?.responseURL;
  if (typeof finalUrl === 'string' && finalUrl.trim()) {
    const finalCheck = validatePublicHttpsUrl(finalUrl);
    if (!finalCheck.ok) {
      throw new AppError(
        `External matches API redirect blocked: ${finalCheck.error}`,
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
  }

  const data = assertFogisHttpOk(response, url);
  return data && typeof data === 'object' ? data : {};
}

/**
 * @param {{ apiBaseUrl: string, apiKey: string, teamId: string, seasonIds?: string|number|null }} opts
 */
async function fetchTeamStandingsFromApi({ apiBaseUrl, apiKey, teamId, seasonIds }) {
  const safeTeamId = sanitizeExternalTeamId(teamId);
  if (!safeTeamId) {
    throw new AppError('Valid FOGIS teamId is required', 400, AppError.CODES.VALIDATION_ERROR);
  }
  // Path segment only — reject anything that is not a numeric FOGIS id.
  if (!/^\d{1,20}$/.test(safeTeamId)) {
    throw new AppError('Invalid FOGIS teamId', 400, AppError.CODES.VALIDATION_ERROR);
  }

  const url = `${apiBaseUrl}/club/team-standings/${safeTeamId}`;
  const params = {};
  if (seasonIds != null && String(seasonIds).trim() !== '') {
    params.seasonIds = String(seasonIds).trim();
  }
  const response = await axios.get(url, {
    params,
    headers: fogisAuthHeaders(apiKey),
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });
  // Redirects are still possible; validate the final URL host/protocol to keep SSRF risk low.
  const finalUrl = response?.request?.res?.responseUrl || response?.request?.res?.responseURL;
  if (typeof finalUrl === 'string' && finalUrl.trim()) {
    const finalCheck = validatePublicHttpsUrl(finalUrl);
    if (!finalCheck.ok) {
      throw new AppError(
        `External matches API redirect blocked: ${finalCheck.error}`,
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
  }

  const data = assertFogisHttpOk(response, url);
  return data && typeof data === 'object' ? data : { team: null };
}

/**
 * Fetch upcoming club games for the user (uses matches API key + teams activeSeason).
 * @param {number|string} userId
 * @returns {Promise<object[]>}
 */
async function requireFogisCredentials(userId) {
  if (userId == null || String(userId).trim() === '') {
    throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
  }
  const settings = await getFogisSettings(userId);
  if (!settings.apiKey) {
    throw new AppError(
      'API key not configured. Add it in Matches settings.',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  return settings;
}

async function fetchUpcomingGames(userId) {
  const { apiBaseUrl, apiKey, seasonYear } = await requireFogisCredentials(userId);

  try {
    return await fetchUpcomingGamesFromApi({ apiBaseUrl, apiKey, seasonYear });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error?.message || 'Failed to fetch matches from external API';
    Logger.error('FOGIS fetch failed', error, { seasonYear });
    throw new AppError(message, 502, AppError.CODES.SERVICE_UNAVAILABLE);
  }
}

/**
 * @param {number|string} userId
 * @param {string|number} externalTeamId
 * @param {{ seasonIds?: string|number|null }} [options]
 */
async function fetchTeamStandings(userId, externalTeamId, options = {}) {
  const { apiBaseUrl, apiKey } = await requireFogisCredentials(userId);
  try {
    return await fetchTeamStandingsFromApi({
      apiBaseUrl,
      apiKey,
      teamId: externalTeamId,
      seasonIds: options.seasonIds,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error?.message || 'Failed to fetch standings from external API';
    Logger.error('FOGIS team-standings fetch failed', error, {
      externalTeamId: sanitizeExternalTeamId(externalTeamId),
    });
    throw new AppError(message, 502, AppError.CODES.SERVICE_UNAVAILABLE);
  }
}

/**
 * @param {number|string} userId
 * @param {{ seasonIds?: string|number|null }} [options]
 */
async function fetchClubDetails(userId, options = {}) {
  const { apiBaseUrl, apiKey } = await requireFogisCredentials(userId);
  try {
    return await fetchClubDetailsFromApi({
      apiBaseUrl,
      apiKey,
      seasonIds: options.seasonIds,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error?.message || 'Failed to fetch club details from external API';
    Logger.error('FOGIS club/details fetch failed', error, {});
    throw new AppError(message, 502, AppError.CODES.SERVICE_UNAVAILABLE);
  }
}

module.exports = {
  DEFAULT_API_BASE_URL,
  sanitizeExternalTeamId,
  parseFogisStartTime,
  parseSeasonYear,
  normalizeApiMatches,
  getFogisSettings,
  fetchUpcomingGamesFromApi,
  fetchUpcomingGames,
  fetchTeamStandingsFromApi,
  fetchTeamStandings,
  fetchClubDetailsFromApi,
  fetchClubDetails,
};
