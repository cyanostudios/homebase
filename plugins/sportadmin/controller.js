// plugins/sportadmin/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const { validatePublicHttpsUrl } = require('../../server/core/utils/ssrfUrlGuard');
const { assertFetchUrlAllowed, isAllowedSportadminHost } = require('./client/httpClient');
const { SportAdminProvider } = require('./providers/SportAdminProvider');
const { normalizeSiteUrl, siteHostFromUrl } = require('./services/syncService');

function mapResourceRow(row) {
  const payload = row.payload || {};
  const base = {
    id: row.id,
    source: row.source,
    source_id: row.source_id,
    type: row.type,
    source_url: row.source_url,
    source_image_url: row.source_image_url,
    imported_at: row.imported_at,
    updated_at: row.updated_at,
  };
  if (row.type === 'news') {
    return {
      ...base,
      title: payload.title,
      excerpt: payload.excerpt,
      published_at: payload.published_at,
      source_image_url: row.source_image_url,
      source_url: row.source_url,
    };
  }
  if (row.type === 'match') {
    return {
      ...base,
      team: payload.team,
      home_team: payload.home_team,
      away_team: payload.away_team,
      opponent: payload.opponent,
      is_home: payload.is_home,
      date: payload.date,
      time: payload.time,
      venue: payload.venue,
      category: payload.category,
      source_url: row.source_url,
    };
  }
  if (row.type === 'team') {
    return {
      ...base,
      name: payload.name,
      category: payload.category,
      age_group: payload.age_group,
      heading: payload.heading ?? null,
      description: payload.description ?? null,
      description_image_url: payload.description_image_url ?? null,
      upcoming_matches: Array.isArray(payload.upcoming_matches) ? payload.upcoming_matches : [],
      played_matches: Array.isArray(payload.played_matches) ? payload.played_matches : [],
      news_items: Array.isArray(payload.news_items) ? payload.news_items : [],
      modules: payload.modules ?? null,
      players: Array.isArray(payload.players) ? payload.players : [],
      leaders: Array.isArray(payload.leaders) ? payload.leaders : [],
      contact: payload.contact ?? null,
      source_url: row.source_url,
    };
  }
  if (row.type === 'page') {
    return {
      ...base,
      title: payload.title,
      kind: payload.kind ?? null,
      heading: payload.heading ?? null,
      description: payload.description ?? null,
      description_image_url: payload.description_image_url ?? null,
      news_items: Array.isArray(payload.news_items) ? payload.news_items : [],
      sort_index: payload.sort_index ?? 0,
      source_url: row.source_url,
    };
  }
  if (row.type === 'event') {
    return {
      ...base,
      title: payload.title,
      start: payload.start,
      end: payload.end,
      location: payload.location,
      description: payload.description,
      source_url: row.source_url,
    };
  }
  if (row.type === 'link') {
    return {
      ...base,
      title: payload.title,
      url: payload.url,
      source_url: row.source_url,
    };
  }
  if (row.type === 'organization') {
    return {
      ...base,
      name: payload.name,
      description: payload.description,
      source_image_url: row.source_image_url,
      source_url: row.source_url,
    };
  }
  return { ...base, ...payload };
}

function deriveStatus(config, counts) {
  if (!config?.site_url) {
    return 'not_configured';
  }
  if (config.last_error && !config.last_successful_sync) {
    return 'error';
  }
  if (config.last_error && config.last_successful_sync) {
    return 'partial';
  }
  const test = config.connection_test;
  if (Array.isArray(test) && test.some((t) => t.warning || !t.ok)) {
    const fatal = test.find((t) => t.key === 'reachable' && !t.ok);
    if (fatal) {
      return 'error';
    }
    const sportadmin = test.find((t) => t.key === 'sportadmin');
    if (sportadmin && !sportadmin.ok) {
      return 'error';
    }
    return 'partial';
  }
  if (config.last_successful_sync) {
    return 'connected';
  }
  return 'partial';
}

function nextSyncIso(config) {
  if (!config?.cron_enabled) {
    return null;
  }
  if (!config?.last_successful_sync && !config?.last_attempted_sync) {
    return null;
  }
  const base = new Date(config.last_successful_sync || config.last_attempted_sync);
  if (Number.isNaN(base.getTime())) {
    return null;
  }
  const minutes = Number(config.refresh_interval_minutes) || 1440;
  return new Date(base.getTime() + minutes * 60 * 1000).toISOString();
}

class SportadminController {
  constructor(model) {
    this.model = model;
    this.provider = new SportAdminProvider(model);
  }

  async getStatus(req, res) {
    try {
      const config = await this.model.getConfig(req);
      const counts = await this.model.countByType(req);
      const orgRows = await this.model.listResources(req, 'organization', { limit: 1 });
      const organizationName = orgRows[0]?.payload?.name || null;
      res.json({
        siteUrl: config.site_url || null,
        status: deriveStatus(config, counts),
        lastSuccessfulSync: config.last_successful_sync
          ? new Date(config.last_successful_sync).toISOString()
          : null,
        lastAttemptedSync: config.last_attempted_sync
          ? new Date(config.last_attempted_sync).toISOString()
          : null,
        nextSync: nextSyncIso(config),
        lastError: config.last_error || null,
        counts,
        connectionTest: config.connection_test || null,
        organizationName,
        cronEnabled: Boolean(config.cron_enabled),
        refreshIntervalMinutes: Number(config.refresh_interval_minutes) || 1440,
      });
    } catch (error) {
      Logger.error('[SportAdmin] getStatus failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to load SportAdmin status' });
    }
  }

  async saveConfig(req, res) {
    try {
      const raw = String(req.body?.siteUrl || '').trim();
      const check = validatePublicHttpsUrl(raw);
      if (!check.ok) {
        return res.status(400).json({ error: check.error, code: 'INVALID_URL' });
      }
      const siteUrl = normalizeSiteUrl(raw);
      const siteHost = siteHostFromUrl(siteUrl);
      // Fixed SportAdmin hosts, or the candidate custom club domain as siteHost only.
      const hostCheck = assertFetchUrlAllowed(siteUrl, { siteHost });
      if (!hostCheck.ok) {
        return res.status(400).json({
          error: hostCheck.error,
          code: 'HOST_NOT_ALLOWED',
        });
      }

      const previous = await this.model.getConfig(req);
      const previousUrl = previous.site_url || null;
      await this.model.saveSiteUrl(req, siteUrl);

      const result = await this.provider.sync(req, { connectionTestOnly: true });
      // Custom domains must prove SportAdmin shell; otherwise revert and reject.
      if (!result.ok && !isAllowedSportadminHost(siteHost)) {
        await this.model.saveSiteUrl(req, previousUrl);
        return res.status(400).json({
          error:
            result.error ||
            'SportAdmin was not detected on this URL. Use a *.web.sportadmin.se site or a club domain that serves SportAdmin.',
          code: 'NOT_SPORTADMIN',
          connectionTest: result.connectionTest || null,
        });
      }
      if (result.ok) {
        await this.provider.sync(req, {});
      }
      return this.getStatus(req, res);
    } catch (error) {
      Logger.error('[SportAdmin] saveConfig failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: error?.message || 'Failed to save SportAdmin config' });
    }
  }

  async saveCronSettings(req, res) {
    try {
      const enabled = Boolean(req.body?.cronEnabled);
      await this.model.setCronEnabled(req, enabled);
      return this.getStatus(req, res);
    } catch (error) {
      Logger.error('[SportAdmin] saveCronSettings failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: error?.message || 'Failed to save cron settings' });
    }
  }

  async syncNow(req, res) {
    try {
      const result = await this.provider.sync(req, {});
      if (!result.ok && result.error) {
        // Still return status so FE can show cached data + error.
      }
      return this.getStatus(req, res);
    } catch (error) {
      Logger.error('[SportAdmin] syncNow failed', error);
      if (error.statusCode === 400) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: error?.message || 'Sync failed' });
    }
  }

  async getErrors(req, res) {
    try {
      const rows = await this.model.listErrors(req);
      res.json(
        rows.map((r) => ({
          at: new Date(r.created_at).toISOString(),
          resource: r.resource,
          status: r.status,
          message: r.message,
        })),
      );
    } catch (error) {
      Logger.error('[SportAdmin] getErrors failed', error);
      res.status(500).json({ error: 'Failed to load errors' });
    }
  }

  async getDiscovery(req, res) {
    try {
      const config = await this.model.getConfig(req);
      const snap = config.discovery_snapshot || null;
      res.json({
        siteUrl: config.site_url || null,
        tree: snap?.tree || null,
        resources: snap?.resources || [],
        errors: snap?.errors || [],
      });
    } catch (error) {
      Logger.error('[SportAdmin] getDiscovery failed', error);
      res.status(500).json({ error: 'Failed to load discovery' });
    }
  }

  async listType(req, res, type) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const upcoming = String(req.query.upcoming || '') === 'true';
      const team = req.query.team ? String(req.query.team) : undefined;
      const category = req.query.category ? String(req.query.category) : undefined;
      const rows = await this.model.listResources(req, type, {
        limit,
        upcoming,
        team,
        category,
      });
      res.json(rows.map(mapResourceRow));
    } catch (error) {
      Logger.error(`[SportAdmin] list ${type} failed`, error);
      res.status(500).json({ error: `Failed to list ${type}` });
    }
  }
}

module.exports = SportadminController;
