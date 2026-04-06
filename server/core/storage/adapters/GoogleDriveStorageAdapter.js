// server/core/storage/adapters/GoogleDriveStorageAdapter.js
// Google Drive API execution only — OAuth account flow stays in plugins/files.
const { Readable } = require('stream');
const StorageProvider = require('../StorageProvider');
const googledriveSettingsStore = require('../googledriveSettingsStore');
const { Logger } = require('@homebase/core');

const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const API_URL = 'https://www.googleapis.com/drive/v3/files';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function getClientCredentials(settings) {
  return {
    clientId: settings?.clientId || process.env.GOOGLEDRIVE_CLIENT_ID || '',
    clientSecret: settings?.clientSecret || process.env.GOOGLEDRIVE_CLIENT_SECRET || '',
  };
}

async function readStreamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

class GoogleDriveStorageAdapter extends StorageProvider {
  constructor() {
    super();
    this.name = 'googledrive';
  }

  /**
   * @param {import('express').Request} req
   */
  async getValidAccessToken(req) {
    let settings = await googledriveSettingsStore.getSettings(req);
    if (!settings?.accessToken) {
      const err = new Error('Google Drive is not connected');
      err.code = 'DRIVE_NOT_CONNECTED';
      throw err;
    }

    const expiresMs = settings.tokenExpiresAt ? new Date(settings.tokenExpiresAt).getTime() : 0;
    const needsRefresh = !expiresMs || expiresMs < Date.now() + 60_000;

    if (needsRefresh) {
      if (!settings.refreshToken) {
        const err = new Error(
          'Google Drive access token expired and no refresh token is stored; reconnect Google Drive',
        );
        err.code = 'TOKEN_EXPIRED_NO_REFRESH';
        throw err;
      }
      const creds = getClientCredentials(settings);
      if (!creds.clientId || !creds.clientSecret) {
        const err = new Error('Google OAuth client not configured');
        err.code = 'OAUTH_NOT_CONFIGURED';
        throw err;
      }
      const body = new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: settings.refreshToken,
      });
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const data = await res.json();
      if (!data.access_token) {
        Logger.error('Google token refresh failed', {
          error: data.error,
          desc: data.error_description,
        });
        const err = new Error(data.error_description || data.error || 'Token refresh failed');
        err.code = 'TOKEN_REFRESH_FAILED';
        throw err;
      }
      const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
      await googledriveSettingsStore.upsertTokens(req, {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || settings.refreshToken,
        tokenExpiresAt: expiresAt,
      });
      settings = await googledriveSettingsStore.getSettings(req);
    }

    return settings.accessToken;
  }

  /**
   * @param {import('express').Request} req
   * @param {{ stream: import('stream').Readable, filename: string, mimeType?: string|null, size?: number|null }} input
   */
  async upload(req, input) {
    const token = await this.getValidAccessToken(req);
    const boundary = `hb_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    const meta = JSON.stringify({
      name: input.filename,
      ...(input.mimeType ? { mimeType: input.mimeType } : {}),
    });
    const fileBuf = await readStreamToBuffer(input.stream);
    const crlf = '\r\n';
    const part1 = Buffer.from(
      `--${boundary}${crlf}Content-Type: application/json; charset=UTF-8${crlf}${crlf}${meta}${crlf}`,
    );
    const part2Head = Buffer.from(
      `--${boundary}${crlf}Content-Type: ${input.mimeType || 'application/octet-stream'}${crlf}${crlf}`,
    );
    const partEnd = Buffer.from(`${crlf}--${boundary}--${crlf}`);
    const body = Buffer.concat([part1, part2Head, fileBuf, partEnd]);

    const res = await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=id,size,webViewLink`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    const data = await res.json();
    if (!res.ok) {
      Logger.error('Google Drive upload failed', { status: res.status, data });
      throw new Error(data.error?.message || data.error || 'Drive upload failed');
    }
    const url = data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`;
    return {
      externalFileId: data.id,
      url,
      size: data.size != null ? Number(data.size) : input.size != null ? Number(input.size) : null,
    };
  }

  /**
   * @param {import('express').Request} req
   * @param {{ externalFileId: string }} input
   */
  async download(req, input) {
    const token = await this.getValidAccessToken(req);
    const res = await fetch(`${API_URL}/${encodeURIComponent(input.externalFileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = new Error('Drive download failed');
      err.status = res.status;
      throw err;
    }
    if (!res.body) {
      throw new Error('Empty response body');
    }
    return Readable.fromWeb(res.body);
  }

  /**
   * @param {import('express').Request} req
   * @param {{ externalFileId: string }} input
   */
  async delete(req, input) {
    const token = await this.getValidAccessToken(req);
    const res = await fetch(`${API_URL}/${encodeURIComponent(input.externalFileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        /* ignore */
      }
      Logger.warn('Google Drive delete returned error', { status: res.status, data });
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {{ folderId?: string }} [_input]
   */
  async list(req, input = {}) {
    const token = await this.getValidAccessToken(req);
    const pageSize = Math.min(Math.max(Number(input.pageSize) || 50, 1), 100);
    const q = encodeURIComponent(
      "mimeType != 'application/vnd.google-apps.folder' and trashed = false",
    );
    const res = await fetch(
      `${API_URL}?pageSize=${pageSize}&fields=files(id,name,mimeType,size,webViewLink)&q=${q}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Drive list failed');
    }
    const files = data.files || [];
    return files.map((f) => ({
      externalFileId: f.id,
      name: f.name,
      size: f.size != null ? Number(f.size) : null,
      mimeType: f.mimeType || null,
      url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    }));
  }
}

module.exports = GoogleDriveStorageAdapter;
