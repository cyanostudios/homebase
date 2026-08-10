import { createApiClient } from '@/core/api/createApiClient';

import type {
  PulseCatalogEntry,
  PulseHistoryResponse,
  PulseProviderSettings,
  PulseRoutingResponse,
  SavePulseProviderSettingsInput,
  SavePulseRoutingInput,
} from '../types/pulse';

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

  async getCatalog(): Promise<{ providers: PulseCatalogEntry[] }> {
    return this.request('/providers/catalog') as Promise<{ providers: PulseCatalogEntry[] }>;
  }

  async getProviderSettings(): Promise<{ providers: PulseProviderSettings[] }> {
    return this.request('/providers/settings') as Promise<{ providers: PulseProviderSettings[] }>;
  }

  async getRouting(): Promise<PulseRoutingResponse> {
    return this.request('/providers/routing') as Promise<PulseRoutingResponse>;
  }

  async saveGlobalRouting(
    data: SavePulseRoutingInput,
  ): Promise<{ global: { providerKey: string } }> {
    return this.request('/providers/routing', {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<{ global: { providerKey: string } }>;
  }

  async savePluginRouting(
    pluginKey: string,
    data: SavePulseRoutingInput,
  ): Promise<{ plugin: { pluginKey: string; providerKey: string } }> {
    return this.request(`/providers/routing/plugins/${encodeURIComponent(pluginKey)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<{ plugin: { pluginKey: string; providerKey: string } }>;
  }

  async deletePluginRouting(pluginKey: string): Promise<{ pluginKey: string; deleted: boolean }> {
    return this.request(`/providers/routing/plugins/${encodeURIComponent(pluginKey)}`, {
      method: 'DELETE',
    }) as Promise<{ pluginKey: string; deleted: boolean }>;
  }

  async saveProviderSettings(
    providerKey: string,
    data: SavePulseProviderSettingsInput,
  ): Promise<{ provider: PulseProviderSettings }> {
    return this.request(`/providers/settings/${encodeURIComponent(providerKey)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<{ provider: PulseProviderSettings }>;
  }

  async deleteProviderSettings(
    providerKey: string,
  ): Promise<{ providerKey: string; deleted: boolean }> {
    return this.request(`/providers/settings/${encodeURIComponent(providerKey)}`, {
      method: 'DELETE',
    }) as Promise<{ providerKey: string; deleted: boolean }>;
  }

  async testProviderSettings(
    providerKey: string,
    data: {
      testTo: string;
      useSaved?: boolean;
      secretPrimary?: string | null;
      secretSecondary?: string | null;
      options?: Record<string, string>;
      fields?: Record<string, string>;
      fromNumber?: string;
    },
  ): Promise<{ ok: boolean; provider: string; status: string }> {
    return this.request(`/providers/settings/${encodeURIComponent(providerKey)}/test`, {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<{ ok: boolean; provider: string; status: string }>;
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
