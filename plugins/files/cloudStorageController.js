// plugins/files/cloudStorageController.js
// Google Drive OAuth flow (storage adapters live in server/core/storage)
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const ALLOWED_SERVICE = 'googledrive';

function assertGoogleDriveService(service) {
  if (service !== ALLOWED_SERVICE) {
    return false;
  }
  return true;
}

class CloudStorageController {
  constructor(model) {
    this.model = model;
  }

  // OAuth configuration — user-specific credentials first, then env vars
  async getOAuthConfig(req, service) {
    if (!assertGoogleDriveService(service)) {
      return null;
    }

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';

    let userClientId = null;
    let userClientSecret = null;
    try {
      const settings = await this.model.getSettings(req, service);
      if (settings?.clientId && settings?.clientSecret) {
        userClientId = settings.clientId;
        userClientSecret = settings.clientSecret;
      }
    } catch (_err) {
      // fall back to env
    }

    return {
      clientId: userClientId || process.env.GOOGLEDRIVE_CLIENT_ID || '',
      clientSecret: userClientSecret || process.env.GOOGLEDRIVE_CLIENT_SECRET || '',
      redirectUri: `${baseUrl}/api/files/cloud/googledrive/auth/callback`,
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/drive.file',
    };
  }

  async getSettings(req, res) {
    try {
      const service = req.params.service;
      if (!assertGoogleDriveService(service)) {
        return res.status(400).json({ error: 'Invalid cloud storage service' });
      }

      const settings = await this.model.getSettings(req, service);
      const safeSettings = settings
        ? {
            id: settings.id,
            userId: settings.userId,
            hasCustomCredentials: !!(settings.clientId && settings.clientSecret),
            connected: settings.connected,
            createdAt: settings.createdAt,
            updatedAt: settings.updatedAt,
          }
        : null;
      res.json(safeSettings);
    } catch (error) {
      Logger.error('Get cloud storage settings error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to get cloud storage settings' });
    }
  }

  async saveOAuthCredentials(req, res) {
    try {
      const service = req.params.service;
      if (!assertGoogleDriveService(service)) {
        return res.status(400).json({ error: 'Invalid cloud storage service' });
      }

      const { clientId, clientSecret } = req.body;
      if (!clientId || !clientSecret) {
        return res.status(400).json({ error: 'clientId and clientSecret are required' });
      }

      await this.model.upsertOAuthCredentials(req, service, clientId, clientSecret);
      res.json({ ok: true, message: 'OAuth credentials saved' });
    } catch (error) {
      Logger.error('Save OAuth credentials error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to save OAuth credentials' });
    }
  }

  async startAuth(req, res) {
    try {
      const service = req.params.service;
      if (!assertGoogleDriveService(service)) {
        return res.status(400).json({ error: 'Invalid cloud storage service' });
      }

      const config = await this.getOAuthConfig(req, service);
      if (!config || !config.clientId) {
        return res.status(500).json({
          error:
            'OAuth not configured for this service. Please configure OAuth credentials in settings or contact your administrator.',
          code: 'OAUTH_NOT_CONFIGURED',
        });
      }

      const state = Math.random().toString(36).substring(2, 15);
      req.session.cloudStorageState = state;
      req.session.cloudStorageService = service;

      const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: config.redirectUri,
        scope: config.scope,
        access_type: 'offline',
        prompt: 'consent',
        state,
      });
      const authUrl = `${config.authUrl}?${params.toString()}`;

      res.json({ authUrl, state });
    } catch (error) {
      Logger.error('Start OAuth error', error, { userId: Context.getUserId(req) });
      res.status(500).json({ error: 'Failed to start OAuth flow' });
    }
  }

  async handleCallback(req, res) {
    try {
      const service = req.params.service;
      const code = req.query.code;
      const state = req.query.state;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

      if (!assertGoogleDriveService(service)) {
        return res.redirect(`${frontendUrl}/files?cloud=error&message=invalid_service`);
      }

      if (!req.session || !req.session.user) {
        return res.redirect(`${frontendUrl}/files?cloud=error&message=session_expired`);
      }

      if (!req.session.cloudStorageState || req.session.cloudStorageState !== state) {
        return res.redirect(`${frontendUrl}/files?cloud=error&message=invalid_state`);
      }

      if (!code) {
        return res.redirect(`${frontendUrl}/files?cloud=error&message=no_code`);
      }

      const config = await this.getOAuthConfig(req, service);
      if (!config || !config.clientId || !config.clientSecret) {
        return res.redirect(`${frontendUrl}/files?cloud=error&message=oauth_not_configured`);
      }

      const tokenResponse = await this.exchangeGoogleDriveToken(config, code);

      if (!tokenResponse || !tokenResponse.access_token) {
        return res.status(500).json({ error: 'Failed to exchange authorization code' });
      }

      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null;

      await this.model.upsertSettings(req, service, {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || null,
        tokenExpiresAt: expiresAt,
        connected: true,
      });

      delete req.session.cloudStorageState;
      delete req.session.cloudStorageService;

      res.redirect(`${frontendUrl}/files?cloud=${service}&connected=true`);
    } catch (error) {
      Logger.error('OAuth callback error', error, { userId: Context.getUserId(req) });
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/files?cloud=error`);
    }
  }

  async exchangeGoogleDriveToken(config, code) {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    return response.json();
  }

  async disconnect(req, res) {
    try {
      const service = req.params.service;
      if (!assertGoogleDriveService(service)) {
        return res.status(400).json({ error: 'Invalid cloud storage service' });
      }

      await this.model.disconnect(req, service);
      res.json({ ok: true, message: 'Disconnected successfully' });
    } catch (error) {
      Logger.error('Disconnect cloud storage error', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to disconnect cloud storage' });
    }
  }

  async getEmbedUrl(req, res) {
    try {
      const service = req.params.service;
      if (!assertGoogleDriveService(service)) {
        return res.status(400).json({ error: 'Invalid cloud storage service' });
      }

      const settings = await this.model.getSettings(req, service);
      if (!settings || !settings.connected || !settings.accessToken) {
        return res.status(400).json({ error: 'Service not connected' });
      }

      res.json({ embedUrl: 'https://drive.google.com/drive/my-drive', service });
    } catch (error) {
      Logger.error('Get embed URL error', error, { userId: Context.getUserId(req) });
      res.status(500).json({ error: 'Failed to get embed URL' });
    }
  }
}

module.exports = CloudStorageController;
