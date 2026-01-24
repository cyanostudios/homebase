// plugins/profixio/model.js
// Profixio model - integrates with Profixio API

const axios = require('axios');
const { Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const PROFIXIO_BASE_URL = 'https://www.profixio.com/app/api';

class ProfixioModel {
  constructor() {
    // No database needed - read-only plugin using external API
  }

  /**
   * Get API key from user settings
   */
  async getApiKey(req) {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      // Get settings from user_settings table
      const { Database } = require('@homebase/core');
      const db = Database.get(req);

      const result = await db.query(
        'SELECT settings FROM user_settings WHERE user_id = $1 AND category = $2',
        [userId, 'profixio'],
      );

      if (!result || !result.length || !result[0].settings?.apiKey) {
        throw new AppError(
          'Profixio API key not configured. Please configure it in settings.',
          400,
          'API_KEY_MISSING',
        );
      }

      return result[0].settings.apiKey;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to get API key', error);
      throw new AppError('Failed to get API key', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Make authenticated request to Profixio API
   */
  async makeApiRequest(req, endpoint, params = {}) {
    try {
      const apiKey = await this.getApiKey(req);

      const response = await axios.get(`${PROFIXIO_BASE_URL}${endpoint}`, {
        headers: {
          'X-Api-Secret': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        params,
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        // Profixio API error
        const status = error.response.status;
        const message = error.response.data?.message || error.response.statusText;

        if (status === 401) {
          throw new AppError(
            'Invalid Profixio API key. Please check your settings.',
            401,
            'INVALID_API_KEY',
          );
        }
        if (status === 403) {
          throw new AppError('Access forbidden. Check your API key permissions.', 403, 'FORBIDDEN');
        }
        if (status === 404) {
          throw new AppError('Resource not found', 404, AppError.CODES.NOT_FOUND);
        }
        if (status === 429) {
          throw new AppError('Rate limit exceeded. Please try again later.', 429, 'RATE_LIMIT');
        }

        Logger.error('Profixio API error', error, { endpoint, status, message });
        throw new AppError(`Profixio API error: ${message}`, status, 'API_ERROR');
      }

      Logger.error('Failed to make Profixio API request', error, { endpoint });
      throw new AppError('Failed to connect to Profixio API', 500, 'API_CONNECTION_ERROR');
    }
  }

  /**
   * Get matches from Profixio API
   * Filters by team name (default: "IFK Malmö")
   */
  async getMatches(req, filters = {}) {
    try {
      const {
        seasonId,
        tournamentId,
        teamFilter = 'IFK Malmö',
        fromDate,
        toDate,
        page = 1,
        limit = 50,
      } = filters;

      let endpoint;
      if (tournamentId) {
        endpoint = `/tournaments/${tournamentId}/matches`;
      } else if (seasonId) {
        endpoint = `/seasons/${seasonId}/matches`;
      } else {
        throw new AppError('Either seasonId or tournamentId is required', 400, 'VALIDATION_ERROR');
      }

      const params = {
        page,
        limit: Math.min(limit, 500), // Max 500 per Profixio API
      };

      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const response = await this.makeApiRequest(req, endpoint, params);

      // Filter matches by team name if teamFilter is provided
      let matches = response.data || [];
      if (teamFilter && teamFilter.trim()) {
        const filterLower = teamFilter.toLowerCase();
        matches = matches.filter((match) => {
          const homeTeam = match.homeTeam?.name?.toLowerCase() || '';
          const awayTeam = match.awayTeam?.name?.toLowerCase() || '';
          return homeTeam.includes(filterLower) || awayTeam.includes(filterLower);
        });
      }

      return {
        data: matches.map(this.transformMatch),
        pagination: response.meta || null,
        links: response.links || null,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to get matches', error);
      throw new AppError('Failed to get matches', 500, 'FETCH_ERROR');
    }
  }

  /**
   * Get a specific match by ID
   */
  async getMatchById(req, tournamentId, matchId) {
    try {
      const endpoint = `/tournaments/${tournamentId}/matches/${matchId}`;
      const response = await this.makeApiRequest(req, endpoint);

      return this.transformMatch(response.data);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to get match', error, { tournamentId, matchId });
      throw new AppError('Failed to get match', 500, 'FETCH_ERROR');
    }
  }

  /**
   * Get seasons for an organisation
   */
  async getSeasons(req, organisationId, sportId = null) {
    try {
      const endpoint = `/organisations/${organisationId}/seasons`;
      const params = sportId ? { sportId } : {};

      const response = await this.makeApiRequest(req, endpoint, params);
      return response.data || [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to get seasons', error);
      throw new AppError('Failed to get seasons', 500, 'FETCH_ERROR');
    }
  }

  /**
   * Get tournaments for a season
   */
  async getTournaments(req, seasonId, categoryId = null, sportId = null) {
    try {
      const endpoint = `/seasons/${seasonId}/tournaments`;
      const params = {};
      if (categoryId) params.categoryId = categoryId;
      if (sportId) params.sportId = sportId;

      const response = await this.makeApiRequest(req, endpoint, params);
      return response.data || [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to get tournaments', error);
      throw new AppError('Failed to get tournaments', 500, 'FETCH_ERROR');
    }
  }

  /**
   * Get user settings for profixio plugin
   */
  async getSettings(req) {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const { Database } = require('@homebase/core');
      const db = Database.get(req);

      const result = await db.query(
        'SELECT settings FROM user_settings WHERE user_id = $1 AND category = $2',
        [userId, 'profixio'],
      );

      if (!result || !result.length) {
        return {
          apiKey: '',
          defaultTeamFilter: 'IFK Malmö',
          defaultSeasonId: null,
          defaultTournamentId: null,
        };
      }

      const settings = result[0].settings || {};
      return {
        apiKey: settings.apiKey || '',
        defaultTeamFilter: settings.defaultTeamFilter || 'IFK Malmö',
        defaultSeasonId: settings.defaultSeasonId || null,
        defaultTournamentId: settings.defaultTournamentId || null,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to get settings', error);
      throw new AppError('Failed to get settings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Update user settings for profixio plugin
   */
  async updateSettings(req, settings) {
    try {
      const userId = req.session?.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const { Database } = require('@homebase/core');
      const db = Database.get(req);

      // Upsert settings
      await db.query(
        `INSERT INTO user_settings (user_id, category, settings, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, category)
         DO UPDATE SET settings = $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, 'profixio', JSON.stringify(settings)],
      );

      Logger.info('Profixio settings updated', { userId });
      return settings;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to update settings', error);
      throw new AppError('Failed to update settings', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Transform Profixio match data to plugin format
   */
  transformMatch(match) {
    return {
      id: String(match.id),
      tournamentId: match.tournamentId ? String(match.tournamentId) : null,
      number: match.number || null,
      name: match.name || '',
      gameRound: match.gameRound || null,
      date: match.date || null,
      time: match.time || null,
      datetimeStart: match.datetimeStart || null,
      homeTeam: {
        teamRegistrationId: match.homeTeam?.teamRegistrationId
          ? String(match.homeTeam.teamRegistrationId)
          : null,
        globalTeamId: match.homeTeam?.globalTeamId ? String(match.homeTeam.globalTeamId) : null,
        name: match.homeTeam?.name || '',
        goals: match.homeTeam?.goals || null,
        isWinner: match.homeTeam?.isWinner || false,
      },
      awayTeam: {
        teamRegistrationId: match.awayTeam?.teamRegistrationId
          ? String(match.awayTeam.teamRegistrationId)
          : null,
        globalTeamId: match.awayTeam?.globalTeamId ? String(match.awayTeam.globalTeamId) : null,
        name: match.awayTeam?.name || '',
        goals: match.awayTeam?.goals || null,
        isWinner: match.awayTeam?.isWinner || false,
      },
      hasWinner: match.hasWinner || false,
      winnerTeam: match.winnerTeam || null,
      field: match.field
        ? {
            id: String(match.field.id),
            name: match.field.name || '',
            arena: match.field.arena
              ? {
                  id: String(match.field.arena.id),
                  arenaName: match.field.arena.arenaName || '',
                }
              : null,
          }
        : null,
      matchCategory: match.matchCategory
        ? {
            id: String(match.matchCategory.id),
            name: match.matchCategory.name || '',
            categoryCode: match.matchCategory.categoryCode || '',
          }
        : null,
      matchGroup: match.matchGroup
        ? {
            id: String(match.matchGroup.id),
            displayName: match.matchGroup.displayName || '',
            name: match.matchGroup.name || '',
          }
        : null,
      matchUrl: match.matchUrl || null,
      matchDataUpdated: match.matchDataUpdated || null,
      resultsUpdated: match.resultsUpdated || null,
      sets: match.sets || [],
      periodInfo: match.periodInfo || null,
      isGroupPlay: match.isGroupPlay || false,
      isLeaguePlay: match.isLeaguePlay || false,
      isPlayoff: match.isPlayoff || false,
    };
  }
}

module.exports = new ProfixioModel();
