// client/src/plugins/files/api/cloudStorageApi.ts
// Cloud storage API client for OneDrive, Dropbox, and Google Drive

export type CloudStorageService = 'onedrive' | 'dropbox' | 'googledrive';

export interface CloudStorageSettings {
  id: string;
  userId: string;
  connected: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export type ApiFieldError = { field: string; message: string };

class CloudStorageApi {
  private csrfToken: string | null = null;

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;

    const response = await fetch('/api/csrf-token', {
      credentials: 'include'
    });
    const data = await response.json();
    this.csrfToken = data.csrfToken;
    return this.csrfToken;
  }

  private async request(path: string, options: RequestInit = {}) {
    let response: Response;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
      };

      // Add CSRF token for mutations
      if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
        headers['X-CSRF-Token'] = await this.getCsrfToken();
      }

      response = await fetch(`/api/files${path}`, {
        headers,
        credentials: 'include',
        ...options,
      });
    } catch {
      const err: any = new Error('Network unreachable');
      err.status = 0;
      throw err;
    }

    if (!response.ok) {
      let payload: any = null;
      try {
        payload = await response.json();
      } catch (_err) {
        void _err;
      }

      const err: any = new Error(
        payload?.error || payload?.message || response.statusText || 'Request failed',
      );
      err.status = response.status;
      if (payload?.errors) {
        err.errors = payload.errors as ApiFieldError[];
      }
      throw err;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  // GET /api/files/cloud/:service/settings
  async getSettings(service: CloudStorageService): Promise<CloudStorageSettings | null> {
    return this.request(`/cloud/${service}/settings`);
  }

  // GET /api/files/cloud/:service/auth/start
  async startAuth(service: CloudStorageService): Promise<{ authUrl: string; state: string }> {
    return this.request(`/cloud/${service}/auth/start`);
  }

  // POST /api/files/cloud/:service/disconnect
  async disconnect(service: CloudStorageService): Promise<{ ok: boolean; message: string }> {
    return this.request(`/cloud/${service}/disconnect`, {
      method: 'POST',
    });
  }

  // POST /api/files/cloud/:service/credentials - Save OAuth app credentials
  async saveOAuthCredentials(
    service: CloudStorageService,
    clientId: string,
    clientSecret: string
  ): Promise<{ ok: boolean; message: string }> {
    return this.request(`/cloud/${service}/credentials`, {
      method: 'POST',
      body: JSON.stringify({ clientId, clientSecret }),
    });
  }

  // GET /api/files/cloud/:service/embed
  async getEmbedUrl(service: CloudStorageService): Promise<{ embedUrl: string; service: string }> {
    return this.request(`/cloud/${service}/embed`);
  }

  // GET /api/files/cloud/dropbox/app-key - For Dropbox Chooser (popup, not iframe)
  async getDropboxAppKey(): Promise<{ appKey: string }> {
    return this.request('/cloud/dropbox/app-key');
  }
}

export const cloudStorageApi = new CloudStorageApi();
