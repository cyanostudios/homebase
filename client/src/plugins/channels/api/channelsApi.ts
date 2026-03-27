// client/src/plugins/channels/api/channelsApi.ts
// Channels API client: lists channel summaries and toggles per-product enable/disable.

import { getSharedCsrfToken } from '@/core/api/csrf';

import type {
  ChannelErrorLogItem,
  ChannelSummary,
  ChannelMapRow,
  ChannelInstance,
  ChannelProductOverride,
} from '../types/channels';

export type ApiFieldError = { field: string; message: string };
export type { ChannelMapRow };

const INSTANCES_CACHE_TTL_MS = 5_000;
const PRODUCT_LINKS_CACHE_TTL_MS = 5_000;
const CHANNELS_SUMMARY_CACHE_TTL_MS = 5_000;

class ChannelsApi {
  private instancesCache = new Map<
    string,
    {
      fetchedAt: number;
      value: { ok: true; items: ChannelInstance[] };
    }
  >();
  private instancesPromises = new Map<string, Promise<{ ok: true; items: ChannelInstance[] }>>();
  private productLinksCache = new Map<
    string,
    {
      fetchedAt: number;
      value: {
        ok: true;
        links: Array<{
          channel: string;
          channelInstanceId: string | null;
          market: string | null;
          label: string | null;
          instanceKey: string | null;
          externalId: string;
          storeUrl?: string | null;
        }>;
      };
    }
  >();
  private productLinksPromises = new Map<
    string,
    Promise<{
      ok: true;
      links: Array<{
        channel: string;
        channelInstanceId: string | null;
        market: string | null;
        label: string | null;
        instanceKey: string | null;
        externalId: string;
        storeUrl?: string | null;
      }>;
    }>
  >();
  private channelsSummaryCache: {
    fetchedAt: number;
    value: ChannelSummary[];
  } | null = null;
  private channelsSummaryPromise: Promise<ChannelSummary[]> | null = null;

  private async getCsrfToken(): Promise<string> {
    return getSharedCsrfToken();
  }

  private clearInstancesCache() {
    this.instancesCache.clear();
    this.instancesPromises.clear();
  }

  private clearChannelsSummaryCache() {
    this.channelsSummaryCache = null;
    this.channelsSummaryPromise = null;
  }

  private clearProductLinksCache(productId?: string) {
    if (productId) {
      this.productLinksCache.delete(String(productId));
      this.productLinksPromises.delete(String(productId));
      return;
    }
    this.productLinksCache.clear();
    this.productLinksPromises.clear();
  }

  private async request(path: string, options: RequestInit = {}) {
    let response: Response;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      };

      // Add CSRF token for mutations
      if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
        headers['X-CSRF-Token'] = await this.getCsrfToken();
      }

      response = await fetch(`/api/channels${path}`, {
        ...options,
        headers,
        credentials: 'include',
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
    const cached = this.channelsSummaryCache;
    if (cached && Date.now() - cached.fetchedAt < CHANNELS_SUMMARY_CACHE_TTL_MS) {
      return cached.value;
    }
    const pending = this.channelsSummaryPromise;
    if (pending) {
      return pending;
    }
    const promise = this.request('/')
      .then((rows: unknown) => {
        const value = Array.isArray(rows) ? (rows as ChannelSummary[]) : [];
        this.channelsSummaryCache = {
          fetchedAt: Date.now(),
          value,
        };
        return value;
      })
      .finally(() => {
        this.channelsSummaryPromise = null;
      });
    this.channelsSummaryPromise = promise;
    return promise;
  }

  // GET /api/channels/product-targets?productId=...
  async getProductTargets(
    productId: string,
  ): Promise<{ ok: true; targets: Array<{ channel: string; channelInstanceId: string | null }> }> {
    const q = new URLSearchParams({ productId });
    return this.request(`/product-targets?${q.toString()}`);
  }

  // GET /api/channels/product-links?productId=...
  async getProductChannelLinks(productId: string): Promise<{
    ok: true;
    links: Array<{
      channel: string;
      channelInstanceId: string | null;
      market: string | null;
      label: string | null;
      instanceKey: string | null;
      externalId: string;
      storeUrl?: string | null;
    }>;
  }> {
    const cacheKey = String(productId);
    const cached = this.productLinksCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < PRODUCT_LINKS_CACHE_TTL_MS) {
      return cached.value;
    }
    const pending = this.productLinksPromises.get(cacheKey);
    if (pending) {
      return pending;
    }
    const q = new URLSearchParams({ productId });
    const promise = this.request(`/product-links?${q.toString()}`)
      .then((value) => {
        this.productLinksCache.set(cacheKey, {
          fetchedAt: Date.now(),
          value,
        });
        return value;
      })
      .finally(() => {
        this.productLinksPromises.delete(cacheKey);
      });
    this.productLinksPromises.set(cacheKey, promise);
    return promise;
  }

  // GET /api/channels/map?productId=...&channel=...
  async getProductMap(params: {
    productId: string;
    channel: string;
  }): Promise<{ ok: true; row: ChannelMapRow | null }> {
    const q = new URLSearchParams({ productId: params.productId, channel: params.channel });
    return this.request(`/map?${q.toString()}`);
  }

  // PUT /api/channels/map — per-product enable/disable for a channel (optionally per instance)
  // Body: { productId: string, channel: string, enabled: boolean, channelInstanceId?: number }
  async setProductEnabled(body: {
    productId: string;
    channel: string;
    enabled: boolean;
    channelInstanceId?: number;
  }): Promise<{
    ok: boolean;
    row: ChannelMapRow;
    summary: ChannelSummary | null;
  }> {
    this.clearChannelsSummaryCache();
    this.clearProductLinksCache(body.productId);
    return this.request('/map', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // PUT /api/channels/map/bulk — apply multiple enable/disable in one request
  async setProductMapBulk(body: {
    productId: string;
    updates: Array<{ channel: string; channelInstanceId?: number; enabled: boolean }>;
  }): Promise<{ ok: true; count: number }> {
    if (!body.updates?.length) {
      return Promise.resolve({ ok: true, count: 0 });
    }
    this.clearChannelsSummaryCache();
    this.clearProductLinksCache(body.productId);
    return this.request('/map/bulk', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // GET /api/channels/errors?channel=...&limit=...
  async getErrors(params: {
    channel: string;
    limit?: number;
  }): Promise<{ ok: true; items: ChannelErrorLogItem[] }> {
    const q = new URLSearchParams({ channel: params.channel });
    if ((params.limit ?? null) !== null) {
      q.set('limit', String(params.limit));
    }
    return this.request(`/errors?${q.toString()}`);
  }

  // ---- Instances (Selloklon) ----
  async getInstances(params?: {
    channel?: string;
    includeDisabled?: boolean;
  }): Promise<{ ok: true; items: ChannelInstance[] }> {
    const q = new URLSearchParams();
    if (params?.channel) {
      q.set('channel', params.channel);
    }
    if (params?.includeDisabled === true) {
      q.set('includeDisabled', 'true');
    }
    const suffix = q.toString() ? `?${q.toString()}` : '';
    const cacheKey = suffix || '__all__';
    const cached = this.instancesCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < INSTANCES_CACHE_TTL_MS) {
      return cached.value;
    }
    const pending = this.instancesPromises.get(cacheKey);
    if (pending) {
      return pending;
    }
    const promise = this.request(`/instances${suffix}`)
      .then((value) => {
        this.instancesCache.set(cacheKey, {
          fetchedAt: Date.now(),
          value,
        });
        return value;
      })
      .finally(() => {
        this.instancesPromises.delete(cacheKey);
      });
    this.instancesPromises.set(cacheKey, promise);
    return promise;
  }

  async createInstance(body: {
    channel: string;
    instanceKey: string;
    market?: string | null;
    label?: string | null;
    credentials?: any | null;
  }): Promise<{ ok: true; row: ChannelInstance }> {
    this.clearChannelsSummaryCache();
    this.clearInstancesCache();
    return this.request('/instances', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateInstance(
    id: string,
    body: {
      market?: string | null;
      label?: string | null;
      credentials?: any | null;
      enabled?: boolean;
    },
  ): Promise<{ ok: true; row: ChannelInstance }> {
    this.clearChannelsSummaryCache();
    this.clearInstancesCache();
    return this.request(`/instances/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // ---- Per-product overrides ----
  async getOverrides(params: {
    productId: string;
    channel?: string;
  }): Promise<{ ok: true; items: ChannelProductOverride[] }> {
    const q = new URLSearchParams({ productId: params.productId });
    if (params.channel) {
      q.set('channel', params.channel);
    }
    return this.request(`/overrides?${q.toString()}`);
  }

  async upsertOverride(body: {
    productId: string;
    channelInstanceId: string | number;
    active?: boolean;
    priceAmount?: number | string | null;
    currency?: string | null;
    vatRate?: number | string | null;
    category?: string | null;
  }): Promise<{ ok: true; id?: string | null }> {
    this.clearChannelsSummaryCache();
    this.clearProductLinksCache(body.productId);
    return this.request('/overrides', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /** Bulk upsert overrides (one request, one DB round-trip). */
  async upsertOverridesBulk(body: {
    productId: string;
    items: Array<{
      channelInstanceId: number | string;
      active?: boolean;
      priceAmount?: number | null;
      category?: string | null;
      salePrice?: number | null;
      originalPrice?: number | null;
    }>;
  }): Promise<{ ok: true; count: number }> {
    const items = body.items
      .map((o) => {
        const id = Number(o.channelInstanceId);
        if (!Number.isFinite(id) || id < 1) {
          return null;
        }
        const row: {
          channelInstanceId: number;
          active: boolean;
          priceAmount?: number;
          category?: string;
          salePrice?: number;
          originalPrice?: number;
        } = {
          channelInstanceId: id,
          active: o.active ?? true,
        };
        if ((o.priceAmount ?? null) !== null && Number.isFinite(Number(o.priceAmount))) {
          row.priceAmount = Number(o.priceAmount);
        }
        if ((o.category ?? null) !== null && String(o.category).trim() !== '') {
          row.category = String(o.category).trim();
        }
        if ((o.salePrice ?? null) !== null && Number.isFinite(Number(o.salePrice))) {
          row.salePrice = Number(o.salePrice);
        }
        if ((o.originalPrice ?? null) !== null && Number.isFinite(Number(o.originalPrice))) {
          row.originalPrice = Number(o.originalPrice);
        }
        return row;
      })
      .filter((x): x is NonNullable<typeof x> => (x ?? null) !== null);
    if (items.length === 0) {
      return Promise.resolve({ ok: true, count: 0 });
    }
    this.clearChannelsSummaryCache();
    this.clearProductLinksCache(body.productId);
    return this.request('/overrides/bulk', {
      method: 'PUT',
      body: JSON.stringify({ productId: body.productId, items }),
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
