// Pulse API
import type { PulseHistoryResponse, PulseSettings } from '../types/pulse';

class PulseApi {
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(`/api/pulses${endpoint}`, {
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

  async getHistory(params?: {
    limit?: number;
    offset?: number;
    pluginSource?: string;
  }): Promise<PulseHistoryResponse> {
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

  async getSettings(): Promise<PulseSettings> {
    return this.request('/settings');
  }

  async testSettings(data: {
    testTo: string;
    useSaved?: boolean;
    activeProvider?: 'twilio' | 'mock';
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
  }) {
    return this.request('/test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async saveSettings(data: {
    activeProvider?: 'twilio' | 'mock';
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
  }) {
    return this.request('/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async send(data: { to: string; body: string; pluginSource?: string; referenceId?: string }) {
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

export const pulseApi = new PulseApi();
