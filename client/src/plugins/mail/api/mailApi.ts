import { createApiClient } from '@/core/api/createApiClient';

// Mail API
class MailApi {
  private request = createApiClient('/mail');

  async getHistory(params?: { limit?: number; offset?: number; pluginSource?: string }) {
    const search = new URLSearchParams();
    if (params?.limit) {
      search.set('limit', String(params.limit));
    }
    if (params?.offset) {
      search.set('offset', String(params.offset));
    }
    if (params?.pluginSource) {
      search.set('pluginSource', params.pluginSource);
    }
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

  async deleteHistory(ids: string[]): Promise<{ ok: boolean; deleted: number }> {
    return this.request('/history/delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }
}

export const mailApi = new MailApi();
