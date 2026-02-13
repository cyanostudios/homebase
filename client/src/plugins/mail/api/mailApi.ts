// Mail API
class MailApi {
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(`/api/mail${endpoint}`, {
      headers,
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      const err: any = new Error(error.error || error.message || 'Request failed');
      err.status = response.status;
      err.code = error.code;
      throw err;
    }

    return response.json();
  }

  async getHistory(params?: { limit?: number; offset?: number; pluginSource?: string }) {
    const search = new URLSearchParams();
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.offset) search.set('offset', String(params.offset));
    if (params?.pluginSource) search.set('pluginSource', params.pluginSource);
    const qs = search.toString();
    return this.request(`/history${qs ? `?${qs}` : ''}`);
  }

  async getSettings() {
    return this.request('/settings');
  }

  async testSettings(data: {
    testTo: string;
    useSaved?: boolean;
    provider?: 'smtp' | 'resend';
    host?: string;
    port?: number;
    secure?: boolean;
    authUser?: string;
    authPass?: string;
    fromAddress?: string;
    resendApiKey?: string;
    resendFromAddress?: string;
  }) {
    return this.request('/test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async saveSettings(data: {
    provider?: 'smtp' | 'resend';
    host?: string;
    port?: number;
    secure?: boolean;
    authUser?: string;
    authPass?: string;
    fromAddress?: string;
    resendApiKey?: string;
    resendFromAddress?: string;
  }) {
    return this.request('/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async send(data: {
    to: string[];
    subject: string;
    html?: string;
    text?: string;
    attachments?: { filename: string; content: string }[];
    pluginSource?: string;
    referenceId?: string;
  }) {
    return this.request('/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const mailApi = new MailApi();
