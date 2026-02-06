// client/src/plugins/channels/api/channelsApi.ts
// Channels API client: lists channel summaries and toggles per-product enable/disable.

import type {
  ChannelErrorLogItem,
  ChannelSummary,
  ChannelMapRow,
  ChannelInstance,
  ChannelProductOverride,
} from '../types/channels';

export type ApiFieldError = { field: string; message: string };
export type { ChannelMapRow };

class ChannelsApi {
  private csrfToken: string | null = null;

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;

    const response = await fetch('/api/csrf-token', {
      credentials: 'include'
    });
    const data = await response.json();
    this.csrfToken = String(data?.csrfToken || '');
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

      response = await fetch(`/api/channels${path}`, {
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
        response.status === 409 && payload?.errors?.[0]?.message
          ? payload.errors[0].message
          : payload?.error || response.statusText || 'Request failed',
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

  // GET /api/channels — list channel summaries
  async getChannels(): Promise<ChannelSummary[]> {
    return this.request('/');
  }

  // GET /api/channels/product-targets?productId=...
  async getProductTargets(productId: string): Promise<{ ok: true; targets: Array<{ channel: string; channelInstanceId: string | null }> }> {
    const q = new URLSearchParams({ productId });
    return this.request(`/product-targets?${q.toString()}`);
  }

  // GET /api/channels/map?productId=...&channel=...
  async getProductMap(params: { productId: string; channel: string }): Promise<{ ok: true; row: ChannelMapRow | null }> {
    const q = new URLSearchParams({ productId: params.productId, channel: params.channel });
    return this.request(`/map?${q.toString()}`);
  }

  // PUT /api/channels/map — per-product enable/disable for a channel
  // Body: { productId: string, channel: string, enabled: boolean }
  async setProductEnabled(body: { productId: string; channel: string; enabled: boolean }): Promise<{
    ok: boolean;
    row: ChannelMapRow;
    summary: ChannelSummary | null;
  }> {
    return this.request('/map', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // GET /api/channels/errors?channel=...&limit=...
  async getErrors(params: { channel: string; limit?: number }): Promise<{ ok: true; items: ChannelErrorLogItem[] }> {
    const q = new URLSearchParams({ channel: params.channel });
    if (params.limit != null) q.set('limit', String(params.limit));
    return this.request(`/errors?${q.toString()}`);
  }

  // ---- Instances (Selloklon) ----
  async getInstances(params?: { channel?: string }): Promise<{ ok: true; items: ChannelInstance[] }> {
    const q = new URLSearchParams();
    if (params?.channel) q.set('channel', params.channel);
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return this.request(`/instances${suffix}`);
  }

  async createInstance(body: {
    channel: string;
    instanceKey: string;
    market?: string | null;
    label?: string | null;
    credentials?: any | null;
  }): Promise<{ ok: true; row: ChannelInstance }> {
    return this.request('/instances', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateInstance(id: string, body: {
    market?: string | null;
    label?: string | null;
    credentials?: any | null;
  }): Promise<{ ok: true; row: ChannelInstance }> {
    return this.request(`/instances/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // ---- Per-product overrides ----
  async getOverrides(params: { productId: string; channel?: string }): Promise<{ ok: true; items: ChannelProductOverride[] }> {
    const q = new URLSearchParams({ productId: params.productId });
    if (params.channel) q.set('channel', params.channel);
    return this.request(`/overrides?${q.toString()}`);
  }

  async upsertOverride(body: {
    productId: string;
    channelInstanceId: string;
    active?: boolean;
    priceAmount?: number | string | null;
    currency?: string | null;
    vatRate?: number | string | null;
    category?: string | null;
  }): Promise<{ ok: true; id?: string | null }> {
    return this.request('/overrides', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // ---- Template download (CSV) ----
  async downloadImportTemplate(): Promise<string> {
    const csrf = await this.getCsrfToken();
    const resp = await fetch('/api/channels/template', {
      method: 'GET',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrf },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      const err: any = new Error(text || resp.statusText || 'Failed to download template');
      err.status = resp.status;
      throw err;
    }
    return await resp.text();
  }
}

export const channelsApi = new ChannelsApi();
