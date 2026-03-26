// client/src/plugins/woocommerce-products/api/woocommerceApi.ts
// WooCommerce API client with CSRF token support

import { getSharedCsrfToken } from '@/core/api/csrf';

import type { WooTestResult, WooExportResult } from '../types/woocommerce';

export type ApiFieldError = { field: string; message: string };

const WOO_INSTANCES_CACHE_TTL_MS = 5_000;

class WooCommerceApi {
  private instancesCache: {
    fetchedAt: number;
    value: {
      ok: boolean;
      items: Array<{
        id: string;
        channel: string;
        instanceKey: string;
        market: string | null;
        label: string | null;
        credentials: {
          storeUrl: string;
          consumerKey: string;
          consumerSecret: string;
          useQueryAuth: boolean;
        } | null;
        createdAt: string | null;
        updatedAt: string | null;
      }>;
    };
  } | null = null;
  private instancesPromise: Promise<{
    ok: boolean;
    items: Array<{
      id: string;
      channel: string;
      instanceKey: string;
      market: string | null;
      label: string | null;
      credentials: {
        storeUrl: string;
        consumerKey: string;
        consumerSecret: string;
        useQueryAuth: boolean;
      } | null;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
  }> | null = null;

  private async getCsrfToken(): Promise<string> {
    return getSharedCsrfToken();
  }

  private clearInstancesCache() {
    this.instancesCache = null;
    this.instancesPromise = null;
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

      response = await fetch(`/api/woocommerce-products${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    } catch {
      const err: any = new Error('Network unreachable');
      err.status = 0;
      throw err;
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!response.ok) {
      let payload: any = null;
      if (text && !contentType.includes('text/html') && !text.trimStart().startsWith('<')) {
        try {
          payload = JSON.parse(text);
        } catch {
          void 0;
        }
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

    if (!text) {
      return {};
    }
    if (contentType.includes('text/html') || text.trimStart().startsWith('<')) {
      const err: any = new Error(
        'Server returned HTML instead of JSON. The API may be unreachable (is the backend running?) or the route is missing.',
      );
      err.status = response.status;
      throw err;
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `Invalid JSON response: ${text.slice(0, 100)}${text.length > 100 ? '…' : ''}`,
      );
    }
  }

  // ---- Woo settings ----
  // ---- Connection test ----
  async testConnection(data?: {
    storeUrl?: string;
    consumerKey?: string;
    consumerSecret?: string;
    useQueryAuth?: boolean;
    instanceId?: string;
  }): Promise<WooTestResult> {
    return this.request('/test', { method: 'POST', body: JSON.stringify(data || {}) });
  }

  // ---- Batch export ----
  async exportProducts(
    products: any[],
    opts?: { instanceIds?: string[]; mode?: 'update_only_strict' },
  ): Promise<WooExportResult> {
    const body: { products: any[]; instanceIds?: string[]; mode?: 'update_only_strict' } = {
      products,
    };
    if (opts?.instanceIds?.length) {
      body.instanceIds = opts.instanceIds;
    }
    if (opts?.mode) {
      body.mode = opts.mode;
    }
    return this.request('/products/export', { method: 'POST', body: JSON.stringify(body) });
  }

  // ---- IMPORT (read-only) by SKU ----
  async importProductBySku(_sku: string): Promise<{
    ok: boolean;
    source: string;
    wooId: number;
    product: any;
  }> {
    throw new Error(
      'importProductBySku now requires instanceId; use importProductBySkuForInstance() instead.',
    );
  }

  async importProductBySkuForInstance(
    instanceId: string,
    sku: string,
  ): Promise<{
    ok: boolean;
    source: string;
    wooId: number;
    product: any;
  }> {
    return this.request(
      `/products/import?instanceId=${encodeURIComponent(instanceId)}&sku=${encodeURIComponent(sku)}`,
    );
  }

  // ---- Orders pull ----
  async pullOrders(data?: { perPage?: number; after?: string; renumber?: boolean }): Promise<{
    ok: boolean;
    fetched: number;
    ingested: number;
    created: number;
    skippedExisting: number;
    results: Array<{ channelOrderId: string; created: boolean; orderId: number | null }>;
  }> {
    return this.request('/orders/pull', { method: 'POST', body: JSON.stringify(data || {}) });
  }

  // ---- Batch delete (Woo) ----
  // DELETE /api/woocommerce-products/batch
  // When instanceIds provided, send productIds so backend resolves external_id per instance.
  async deleteProducts(payload: {
    productIds?: string[];
    skus?: string[];
    externalIds?: number[];
    instanceIds?: string[];
  }): Promise<{
    ok: boolean;
    endpoint: string;
    deleted: number;
    items: Array<{
      externalId: number;
      status: 'deleted' | 'not_found' | 'error';
      message?: string;
    }>;
  }> {
    return this.request('/batch', {
      method: 'DELETE',
      body: JSON.stringify(payload),
    });
  }

  // ---- Category cache sync (manual) ----
  async syncCategoryCache(instanceId: string): Promise<{ ok: boolean; count: number }> {
    return this.request('/category-cache/sync', {
      method: 'POST',
      body: JSON.stringify({ instanceId }),
    });
  }

  // ---- Instances (multi-store support) ----
  // GET /api/woocommerce-products/categories?instanceId=...&perPage=100&search=...
  async getCategories(params?: {
    instanceId?: string;
    perPage?: number;
    search?: string;
  }): Promise<{
    ok: boolean;
    endpoint?: string;
    items?: Array<{ id: number; name: string; slug?: string; parent?: number }>;
  }> {
    const q = new URLSearchParams();
    if (params?.instanceId) {
      q.set('instanceId', params.instanceId);
    }
    if (params?.perPage !== undefined && params?.perPage !== null) {
      q.set('perPage', String(params.perPage));
    }
    if (params?.search) {
      q.set('search', params.search);
    }
    return this.request(`/categories?${q.toString()}`);
  }

  async getInstances(): Promise<{
    ok: boolean;
    items: Array<{
      id: string;
      channel: string;
      instanceKey: string;
      market: string | null;
      label: string | null;
      credentials: {
        storeUrl: string;
        consumerKey: string;
        consumerSecret: string;
        useQueryAuth: boolean;
      } | null;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
  }> {
    if (
      this.instancesCache &&
      Date.now() - this.instancesCache.fetchedAt < WOO_INSTANCES_CACHE_TTL_MS
    ) {
      return this.instancesCache.value;
    }
    if (this.instancesPromise) {
      return this.instancesPromise;
    }
    this.instancesPromise = this.request('/instances')
      .then((value) => {
        this.instancesCache = {
          fetchedAt: Date.now(),
          value,
        };
        return value;
      })
      .finally(() => {
        this.instancesPromise = null;
      });
    return this.instancesPromise;
  }

  async createInstance(data: {
    instanceKey: string;
    label?: string;
    storeUrl: string;
    consumerKey: string;
    consumerSecret: string;
    useQueryAuth?: boolean;
  }): Promise<{
    ok: boolean;
    instance: {
      id: string;
      channel: string;
      instanceKey: string;
      market: string | null;
      label: string | null;
      credentials: {
        storeUrl: string;
        consumerKey: string;
        consumerSecret: string;
        useQueryAuth: boolean;
      } | null;
      createdAt: string | null;
      updatedAt: string | null;
    };
  }> {
    this.clearInstancesCache();
    return this.request('/instances', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInstance(
    id: string,
    data: {
      label?: string;
      storeUrl?: string;
      consumerKey?: string;
      consumerSecret?: string;
      useQueryAuth?: boolean;
    },
  ): Promise<{
    ok: boolean;
    instance: {
      id: string;
      channel: string;
      instanceKey: string;
      market: string | null;
      label: string | null;
      credentials: {
        storeUrl: string;
        consumerKey: string;
        consumerSecret: string;
        useQueryAuth: boolean;
      } | null;
      createdAt: string | null;
      updatedAt: string | null;
    };
  }> {
    this.clearInstancesCache();
    return this.request(`/instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteInstance(id: string): Promise<{
    ok: boolean;
    deleted: { id: string };
  }> {
    this.clearInstancesCache();
    return this.request(`/instances/${id}`, {
      method: 'DELETE',
    });
  }
}

export const woocommerceApi = new WooCommerceApi();
