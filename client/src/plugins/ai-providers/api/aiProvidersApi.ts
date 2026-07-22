import { createApiClient } from '@/core/api/createApiClient';

import type {
  ProviderCatalogResponse,
  ProviderRoutingResponse,
  ProviderVoicesResponse,
  ProvidersSettingsResponse,
  ProviderSettings,
  SaveProviderRoutingInput,
  SaveProviderSettingsInput,
  TestConnectionInput,
  TestConnectionResult,
} from '../types/aiProviders';

class AIProvidersApi {
  private request = createApiClient('/ai-providers');

  async getSettings(): Promise<ProvidersSettingsResponse> {
    return this.request('/settings') as Promise<ProvidersSettingsResponse>;
  }

  async getCatalog(): Promise<ProviderCatalogResponse> {
    return this.request('/catalog') as Promise<ProviderCatalogResponse>;
  }

  async getRouting(): Promise<ProviderRoutingResponse> {
    return this.request('/routing') as Promise<ProviderRoutingResponse>;
  }

  async saveGlobalRouting(
    data: SaveProviderRoutingInput,
  ): Promise<{ global: { providerKey: string; model: string | null } }> {
    return this.request('/routing', {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<{ global: { providerKey: string; model: string | null } }>;
  }

  async savePluginRouting(
    pluginKey: string,
    data: SaveProviderRoutingInput,
  ): Promise<{ plugin: { pluginKey: string; providerKey: string; model: string | null } }> {
    return this.request(`/routing/plugins/${encodeURIComponent(pluginKey)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<{ plugin: { pluginKey: string; providerKey: string; model: string | null } }>;
  }

  async deletePluginRouting(pluginKey: string): Promise<{ pluginKey: string; deleted: boolean }> {
    return this.request(`/routing/plugins/${encodeURIComponent(pluginKey)}`, {
      method: 'DELETE',
    }) as Promise<{ pluginKey: string; deleted: boolean }>;
  }

  async saveSettings(
    providerKey: string,
    data: SaveProviderSettingsInput,
  ): Promise<{ provider: ProviderSettings }> {
    return this.request(`/settings/${encodeURIComponent(providerKey)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<{ provider: ProviderSettings }>;
  }

  async deleteSettings(providerKey: string): Promise<{ providerKey: string; deleted: boolean }> {
    return this.request(`/settings/${encodeURIComponent(providerKey)}`, {
      method: 'DELETE',
    }) as Promise<{ providerKey: string; deleted: boolean }>;
  }

  async testConnection(
    providerKey: string,
    data: TestConnectionInput,
  ): Promise<TestConnectionResult> {
    return this.request(`/settings/${encodeURIComponent(providerKey)}/test`, {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<TestConnectionResult>;
  }

  async listVoices(
    providerKey: string,
    data: { apiKey?: string | null; useSaved?: boolean } = {},
  ): Promise<ProviderVoicesResponse> {
    return this.request(`/settings/${encodeURIComponent(providerKey)}/voices`, {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<ProviderVoicesResponse>;
  }
}

export const aiProvidersApi = new AIProvidersApi();
