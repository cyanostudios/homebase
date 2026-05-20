// Pulse API
import { createApiClient } from '@/core/api/createApiClient';

import type { PulseHistoryResponse, PulseSettings } from '../types/pulse';

class PulseApi {
  private request = createApiClient('/pulses');

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
    return this.request(`/history${qs ? `?${qs}` : ''}`) as Promise<PulseHistoryResponse>;
  }

  async getSettings(): Promise<PulseSettings> {
    return this.request('/settings') as Promise<PulseSettings>;
  }

  async testSettings(data: {
    testTo: string;
    useSaved?: boolean;
    activeProvider?: 'twilio' | 'mock' | 'apple-messages';
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
    activeProvider?: 'twilio' | 'mock' | 'apple-messages';
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
