import { createApiClient } from '@/core/api/createApiClient';

import type {
  MailCatalogEntry,
  MailHistoryResponse,
  MailProviderSettings,
  MailRoutingResponse,
  SaveMailProviderSettingsInput,
  SaveMailRoutingInput,
} from '../types/mail';

class MailApi {
  private request = createApiClient('/mail');

  async getHistory(params?: {
    limit?: number;
    offset?: number;
    pluginSource?: string;
  }): Promise<MailHistoryResponse> {
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
    return this.request(`/history${qs ? `?${qs}` : ''}`) as Promise<MailHistoryResponse>;
  }

  async getCatalog(): Promise<{ providers: MailCatalogEntry[] }> {
    return this.request('/providers/catalog') as Promise<{ providers: MailCatalogEntry[] }>;
  }

  async getProviderSettings(): Promise<{ providers: MailProviderSettings[] }> {
    return this.request('/providers/settings') as Promise<{ providers: MailProviderSettings[] }>;
  }

  async getRouting(): Promise<MailRoutingResponse> {
    return this.request('/providers/routing') as Promise<MailRoutingResponse>;
  }

  async saveGlobalRouting(
    data: SaveMailRoutingInput,
  ): Promise<{ global: { providerKey: string } }> {
    return this.request('/providers/routing', {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<{ global: { providerKey: string } }>;
  }

  async savePluginRouting(
    pluginKey: string,
    data: SaveMailRoutingInput,
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
    data: SaveMailProviderSettingsInput,
  ): Promise<{ provider: MailProviderSettings }> {
    return this.request(`/providers/settings/${encodeURIComponent(providerKey)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<{ provider: MailProviderSettings }>;
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
    },
  ): Promise<{ ok: boolean; provider: string; status: string }> {
    return this.request(`/providers/settings/${encodeURIComponent(providerKey)}/test`, {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<{ ok: boolean; provider: string; status: string }>;
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
